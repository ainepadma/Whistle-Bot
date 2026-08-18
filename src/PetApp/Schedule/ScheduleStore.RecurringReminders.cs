using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    private static readonly TimeSpan ReminderHorizon = TimeSpan.FromDays(90);
    private static readonly TimeSpan MaximumReminderLead = TimeSpan.FromDays(7);

    /// <summary>
    /// Rebuilds reminders after an event is saved. Recurring events receive one
    /// durable reminder per occurrence in the rolling planning horizon.
    /// </summary>
    public void ReplaceEventRemindersForEvent(Dictionary<string, object?> item)
    {
        var eventId = (string)item["id"]!;
        var configurations = (JsonElement)item["reminders"]!;
        var minutes = ReadReminderMinutes(configurations);

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

        if (minutes.Count > 0)
        {
            var now = DateTimeOffset.UtcNow;
            foreach (var occurrence in ReminderOccurrences(item, now - MaximumReminderLead, now + ReminderHorizon))
            {
                foreach (var leadMinutes in minutes)
                    InsertReminderIfMissing(db, transaction, eventId, occurrence, leadMinutes);
            }
        }
        transaction.Commit();
    }

    /// <summary>Extends stored recurring reminders without changing their acknowledgement state.</summary>
    public void EnsureRecurringReminderHorizon()
    {
        using var db = Open();
        db.Open();
        var events = new List<Dictionary<string, object?>>();
        using (var command = db.CreateCommand())
        {
            command.CommandText = "SELECT * FROM events WHERE rrule_str IS NOT NULL AND status <> 'cancelled' AND reminders <> '[]'";
            using var reader = command.ExecuteReader();
            while (reader.Read()) events.Add(ReadEvent(reader));
        }

        if (events.Count == 0) return;
        var now = DateTimeOffset.UtcNow;
        using var transaction = db.BeginTransaction();
        foreach (var item in events)
        {
            var minutes = ReadReminderMinutes((JsonElement)item["reminders"]!);
            foreach (var occurrence in ReminderOccurrences(item, now - MaximumReminderLead, now + ReminderHorizon))
            {
                foreach (var leadMinutes in minutes)
                    InsertReminderIfMissing(db, transaction, (string)item["id"]!, occurrence, leadMinutes);
            }
        }
        transaction.Commit();
    }

    private static IReadOnlyList<int> ReadReminderMinutes(JsonElement configurations)
    {
        if (configurations.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) return [];
        if (configurations.ValueKind != JsonValueKind.Array) throw new InvalidOperationException("提醒配置格式无效");

        var minutes = new HashSet<int>();
        foreach (var config in configurations.EnumerateArray())
        {
            if (!config.TryGetProperty("minutes", out var value) || !value.TryGetInt32(out var leadMinutes))
                throw new InvalidOperationException("提醒缺少提前分钟数");
            if (leadMinutes is < 0 or > 10080) throw new InvalidOperationException("提醒时间必须在 0 到 10080 分钟之间");
            minutes.Add(leadMinutes);
        }
        return minutes.ToArray();
    }

    private static IEnumerable<DateTimeOffset> ReminderOccurrences(
        Dictionary<string, object?> item, DateTimeOffset rangeStart, DateTimeOffset rangeEnd)
    {
        if (item["rrule_str"] is not string rule || string.IsNullOrWhiteSpace(rule))
        {
            if (DateTimeOffset.TryParse((string)item["start_at"]!, out var start)) yield return start;
            yield break;
        }

        foreach (var occurrence in ExpandOne(item, rule, rangeStart, rangeEnd))
            if (DateTimeOffset.TryParse((string)occurrence["start_at"]!, out var start)) yield return start;
    }

    private static void InsertReminderIfMissing(
        SqliteConnection db, SqliteTransaction transaction, string eventId, DateTimeOffset occurrence, int minutes)
    {
        var triggerAt = occurrence.ToUniversalTime().AddMinutes(-minutes).ToString("O");
        using var insert = db.CreateCommand();
        insert.Transaction = transaction;
        insert.CommandText = """
            INSERT INTO reminders (id, event_id, trigger_at, minutes_before)
            SELECT $id, $eventId, $triggerAt, $minutes
            WHERE NOT EXISTS (
                SELECT 1 FROM reminders
                WHERE event_id = $eventId AND trigger_at = $triggerAt AND minutes_before = $minutes
            )
            """;
        insert.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
        insert.Parameters.AddWithValue("$eventId", eventId);
        insert.Parameters.AddWithValue("$triggerAt", triggerAt);
        insert.Parameters.AddWithValue("$minutes", minutes);
        insert.ExecuteNonQuery();
    }
}
