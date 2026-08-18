using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    private static void EnsureReminderSchema(SqliteConnection db)
    {
        using var command = db.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                trigger_at TEXT NOT NULL,
                minutes_before INTEGER NOT NULL CHECK (minutes_before >= 0),
                dismissed INTEGER NOT NULL DEFAULT 0,
                dismissed_at TEXT NULL,
                snoozed_until TEXT NULL,
                triggered_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_reminders_event ON reminders(event_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(dismissed, triggered_at);
            """;
        command.ExecuteNonQuery();
    }

    public void ReplaceEventReminders(string eventId, string startAt, JsonElement configurations)
    {
        if (!DateTimeOffset.TryParse(startAt, out var start)) throw new InvalidOperationException("日程开始时间无效");
        if (configurations.ValueKind is not (JsonValueKind.Array or JsonValueKind.Null or JsonValueKind.Undefined))
            throw new InvalidOperationException("提醒配置格式无效");

        using var db = Open();
        db.Open();
        using var transaction = db.BeginTransaction();
        using (var remove = db.CreateCommand())
        {
            remove.Transaction = transaction;
            remove.CommandText = "DELETE FROM reminders WHERE event_id = $eventId";
            remove.Parameters.AddWithValue("$eventId", eventId);
            remove.ExecuteNonQuery();
        }

        if (configurations.ValueKind == JsonValueKind.Array)
        {
            foreach (var config in configurations.EnumerateArray())
            {
                if (!config.TryGetProperty("minutes", out var minutesValue) || !minutesValue.TryGetInt32(out var minutes))
                    throw new InvalidOperationException("提醒缺少提前分钟数");
                if (minutes is < 0 or > 10080) throw new InvalidOperationException("提醒时间必须在 0 到 10080 分钟之间");

                using var insert = db.CreateCommand();
                insert.Transaction = transaction;
                insert.CommandText = """
                    INSERT INTO reminders (id, event_id, trigger_at, minutes_before)
                    VALUES ($id, $eventId, $triggerAt, $minutes)
                    """;
                insert.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
                insert.Parameters.AddWithValue("$eventId", eventId);
                insert.Parameters.AddWithValue("$triggerAt", start.ToUniversalTime().AddMinutes(-minutes).ToString("O"));
                insert.Parameters.AddWithValue("$minutes", minutes);
                insert.ExecuteNonQuery();
            }
        }
        transaction.Commit();
    }

    public IReadOnlyList<Dictionary<string, object?>> ListPendingReminders() => ReadDueReminders(onlyUnclaimed: false, claim: false);

    public IReadOnlyList<Dictionary<string, object?>> ClaimDueReminders() => ReadDueReminders(onlyUnclaimed: true, claim: true);

    public void DismissReminder(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE reminders SET dismissed = 1, dismissed_at = $now WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }

    public void SnoozeReminder(string id, int minutes)
    {
        if (minutes is < 1 or > 1440) throw new InvalidOperationException("稍后提醒时间必须在 1 到 1440 分钟之间");
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            UPDATE reminders SET snoozed_until = $until, triggered_at = NULL
            WHERE id = $id AND dismissed = 0
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$until", DateTimeOffset.UtcNow.AddMinutes(minutes).ToString("O"));
        command.ExecuteNonQuery();
    }

    private IReadOnlyList<Dictionary<string, object?>> ReadDueReminders(bool onlyUnclaimed, bool claim)
    {
        using var db = Open();
        db.Open();
        using var transaction = claim ? db.BeginTransaction() : null;
        using var command = db.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            SELECT r.*, e.id AS event_row_id, e.title AS event_title, e.start_at AS event_start_at
            FROM reminders r JOIN events e ON e.id = r.event_id
            WHERE r.dismissed = 0 AND e.status <> 'cancelled'
            """ + (onlyUnclaimed ? " AND r.triggered_at IS NULL" : "");
        using var reader = command.ExecuteReader();
        var now = DateTimeOffset.UtcNow;
        var reminders = new List<Dictionary<string, object?>>();
        while (reader.Read())
        {
            var dueAt = ReadNullableTimestamp(reader, "snoozed_until") ?? ReadTimestamp(reader, "trigger_at");
            if (dueAt > now) continue;
            reminders.Add(ReadReminder(reader));
        }
        reader.Close();

        if (claim && reminders.Count > 0)
        {
            foreach (var reminder in reminders)
            {
                using var update = db.CreateCommand();
                update.Transaction = transaction;
                update.CommandText = "UPDATE reminders SET triggered_at = $now WHERE id = $id AND triggered_at IS NULL";
                update.Parameters.AddWithValue("$id", (string)reminder["id"]!);
                update.Parameters.AddWithValue("$now", now.ToString("O"));
                update.ExecuteNonQuery();
            }
        }
        transaction?.Commit();
        return reminders;
    }

    private static Dictionary<string, object?> ReadReminder(SqliteDataReader row) => new()
    {
        ["id"] = row.GetString(row.GetOrdinal("id")),
        ["event_id"] = row.GetString(row.GetOrdinal("event_id")),
        ["trigger_at"] = row.GetString(row.GetOrdinal("trigger_at")),
        ["minutes_before"] = row.GetInt32(row.GetOrdinal("minutes_before")),
        ["dismissed"] = row.GetInt64(row.GetOrdinal("dismissed")) != 0,
        ["dismissed_at"] = ReadNullableString(row, "dismissed_at"),
        ["snoozed_until"] = ReadNullableString(row, "snoozed_until"),
        ["triggered_at"] = ReadNullableString(row, "triggered_at"),
        ["created_at"] = row.GetString(row.GetOrdinal("created_at")),
        ["event"] = new Dictionary<string, object?>
        {
            ["id"] = row.GetString(row.GetOrdinal("event_row_id")),
            ["title"] = row.GetString(row.GetOrdinal("event_title")),
            ["start_at"] = row.GetString(row.GetOrdinal("event_start_at"))
        }
    };

    private static string? ReadNullableString(SqliteDataReader row, string column) =>
        row.IsDBNull(row.GetOrdinal(column)) ? null : row.GetString(row.GetOrdinal(column));

    private static DateTimeOffset ReadTimestamp(SqliteDataReader row, string column)
    {
        var value = row.GetString(row.GetOrdinal(column));
        return DateTimeOffset.TryParse(value, out var timestamp) ? timestamp : DateTimeOffset.MinValue;
    }

    private static DateTimeOffset? ReadNullableTimestamp(SqliteDataReader row, string column)
    {
        if (row.IsDBNull(row.GetOrdinal(column))) return null;
        return ReadTimestamp(row, column);
    }
}

