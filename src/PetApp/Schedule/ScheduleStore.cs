using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

/// <summary>
/// Native storage for the transplanted MOTODO planner.  The schema deliberately
/// keeps MOTODO's snake_case columns, which makes the WebView contract and the
/// one-time SQLite migration straightforward.
/// </summary>
internal sealed partial class ScheduleStore
{
    private readonly string _connectionString;
    private readonly object _initializationGate = new();
    private bool _initialized;

    public ScheduleStore(string? databasePath = null)
    {
        databasePath ??= Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BanyaoPet", "data", "schedule.db");
        Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
        _connectionString = new SqliteConnectionStringBuilder { DataSource = databasePath, ForeignKeys = true }.ToString();
    }

    public void Initialize()
    {
        lock (_initializationGate)
        {
            if (_initialized) return;
            using var db = Open();
            db.Open();
            using var command = db.CreateCommand();
            command.CommandText = """
                PRAGMA journal_mode = WAL;
                PRAGMA foreign_keys = ON;
                CREATE TABLE IF NOT EXISTS calendars (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL DEFAULT '#3B82F6',
                    is_visible INTEGER NOT NULL DEFAULT 1,
                    is_system INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                INSERT OR IGNORE INTO calendars (id, name, color, is_system) VALUES ('default', '我的日历', '#3B82F6', 1);
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    calendar_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    location TEXT NOT NULL DEFAULT '',
                    start_at TEXT NOT NULL,
                    end_at TEXT NOT NULL,
                    is_all_day INTEGER NOT NULL DEFAULT 0,
                    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
                    rrule_str TEXT DEFAULT NULL,
                    exdates TEXT NOT NULL DEFAULT '[]',
                    reminders TEXT NOT NULL DEFAULT '[]',
                    priority INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'confirmed',
                    item_type TEXT NOT NULL DEFAULT 'plan',
                    is_completed INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_events_range ON events(start_at, end_at);
                CREATE INDEX IF NOT EXISTS idx_events_item_type ON events(item_type);
                """;
            command.ExecuteNonQuery();
            EnsureCurriculumSchema(db);
            EnsureReminderSchema(db);
            EnsureFocusSessionSchema(db);
            EnsureLegacyMigrationSchema(db);
            TryMigrateLegacyMotodo(db);
            _initialized = true;
        }
    }

    public IReadOnlyList<Dictionary<string, object?>> QueryEvents(JsonElement query)
    {
        var start = RequiredString(query, "start");
        var end = RequiredString(query, "end");
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT events.* FROM events JOIN calendars ON calendars.id = events.calendar_id WHERE calendars.is_visible = 1 AND (events.rrule_str IS NOT NULL OR (events.start_at < $end AND events.end_at > $start))";
        command.Parameters.AddWithValue("$start", start);
        command.Parameters.AddWithValue("$end", end);
        if (TryString(query, "item_type", out var itemType))
        {
            command.CommandText += " AND item_type = $itemType";
            command.Parameters.AddWithValue("$itemType", itemType);
        }
        if (query.TryGetProperty("is_completed", out var completed))
        {
            command.CommandText += " AND is_completed = $completed";
            command.Parameters.AddWithValue("$completed", completed.GetBoolean() ? 1 : 0);
        }
        command.CommandText += " ORDER BY start_at ASC";
        return ExpandRecurringEvents(ReadEvents(command), start, end);
    }

    public Dictionary<string, object?>? GetEvent(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM events WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadEvent(reader) : null;
    }

    public Dictionary<string, object?> CreateEvent(JsonElement input)
    {
        var title = RequiredString(input, "title").Trim();
        if (title.Length == 0) throw new InvalidOperationException("标题不能为空");
        var startAt = RequiredString(input, "start_at");
        var endAt = RequiredString(input, "end_at");
        ValidateRange(startAt, endAt);
        var id = Guid.NewGuid().ToString();

        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO events (id, calendar_id, title, description, location, start_at, end_at,
                is_all_day, timezone, rrule_str, exdates, reminders, priority, status, item_type, is_completed)
            VALUES ($id, $calendarId, $title, $description, $location, $startAt, $endAt,
                $allDay, $timezone, $rrule, $exdates, $reminders, $priority, $status, $itemType, $completed)
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$calendarId", StringOr(input, "calendar_id", "default"));
        command.Parameters.AddWithValue("$title", title);
        command.Parameters.AddWithValue("$description", StringOr(input, "description", ""));
        command.Parameters.AddWithValue("$location", StringOr(input, "location", ""));
        command.Parameters.AddWithValue("$startAt", startAt);
        command.Parameters.AddWithValue("$endAt", endAt);
        command.Parameters.AddWithValue("$allDay", BoolOr(input, "is_all_day") ? 1 : 0);
        command.Parameters.AddWithValue("$timezone", StringOr(input, "timezone", "Asia/Shanghai"));
        command.Parameters.AddWithValue("$rrule", NullableString(input, "rrule_str"));
        command.Parameters.AddWithValue("$exdates", JsonOr(input, "exdates", "[]"));
        command.Parameters.AddWithValue("$reminders", JsonOr(input, "reminders", "[]"));
        command.Parameters.AddWithValue("$priority", IntOr(input, "priority", 0));
        command.Parameters.AddWithValue("$status", StringOr(input, "status", "confirmed"));
        command.Parameters.AddWithValue("$itemType", StringOr(input, "item_type", "plan"));
        command.Parameters.AddWithValue("$completed", BoolOr(input, "is_completed") ? 1 : 0);
        command.ExecuteNonQuery();
        return GetEvent(id)!;
    }

    public Dictionary<string, object?> UpdateEvent(string id, JsonElement input)
    {
        var existing = GetEvent(id) ?? throw new InvalidOperationException("日程不存在");
        var startAt = StringOr(input, "start_at", (string)existing["start_at"]!);
        var endAt = StringOr(input, "end_at", (string)existing["end_at"]!);
        ValidateRange(startAt, endAt);

        var fields = new List<string>();
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        foreach (var key in new[] { "calendar_id", "title", "description", "location", "start_at", "end_at", "timezone", "rrule_str", "priority", "status", "item_type", "is_completed", "is_all_day", "reminders", "exdates" })
        {
            if (!input.TryGetProperty(key, out var value)) continue;
            var parameter = "$p" + fields.Count;
            fields.Add(key + " = " + parameter);
            command.Parameters.AddWithValue(parameter, ToSqlValue(value));
        }
        if (fields.Count == 0) return existing;
        fields.Add("updated_at = datetime('now')");
        command.CommandText = "UPDATE events SET " + string.Join(", ", fields) + " WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
        return GetEvent(id)!;
    }

    public void RemoveEvent(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM events WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<Dictionary<string, object?>> SearchEvents(string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword)) return [];
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            SELECT * FROM events
            WHERE title LIKE $keyword OR description LIKE $keyword OR location LIKE $keyword
            ORDER BY start_at DESC LIMIT 50
            """;
        command.Parameters.AddWithValue("$keyword", "%" + keyword.Trim() + "%");
        return ReadEvents(command);
    }

    private SqliteConnection Open() => new(_connectionString);

    private static IReadOnlyList<Dictionary<string, object?>> ReadEvents(SqliteCommand command)
    {
        using var reader = command.ExecuteReader();
        var events = new List<Dictionary<string, object?>>();
        while (reader.Read()) events.Add(ReadEvent(reader));
        return events;
    }

    private static Dictionary<string, object?> ReadEvent(SqliteDataReader row) => new()
    {
        ["id"] = row.GetString(row.GetOrdinal("id")),
        ["calendar_id"] = row.GetString(row.GetOrdinal("calendar_id")),
        ["title"] = row.GetString(row.GetOrdinal("title")),
        ["description"] = row.GetString(row.GetOrdinal("description")),
        ["location"] = row.GetString(row.GetOrdinal("location")),
        ["start_at"] = row.GetString(row.GetOrdinal("start_at")),
        ["end_at"] = row.GetString(row.GetOrdinal("end_at")),
        ["is_all_day"] = row.GetInt64(row.GetOrdinal("is_all_day")) != 0,
        ["timezone"] = row.GetString(row.GetOrdinal("timezone")),
        ["rrule_str"] = row.IsDBNull(row.GetOrdinal("rrule_str")) ? null : row.GetString(row.GetOrdinal("rrule_str")),
        ["exdates"] = JsonSerializer.Deserialize<JsonElement>(row.GetString(row.GetOrdinal("exdates"))),
        ["reminders"] = JsonSerializer.Deserialize<JsonElement>(row.GetString(row.GetOrdinal("reminders"))),
        ["priority"] = row.GetInt32(row.GetOrdinal("priority")),
        ["status"] = row.GetString(row.GetOrdinal("status")),
        ["item_type"] = row.GetString(row.GetOrdinal("item_type")),
        ["is_completed"] = row.GetInt64(row.GetOrdinal("is_completed")) != 0,
        ["created_at"] = row.GetString(row.GetOrdinal("created_at")),
        ["updated_at"] = row.GetString(row.GetOrdinal("updated_at"))
    };

    private static string RequiredString(JsonElement element, string name) =>
        TryString(element, name, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value : throw new InvalidOperationException($"缺少 {name}");

    private static bool TryString(JsonElement element, string name, out string value)
    {
        value = "";
        if (!element.TryGetProperty(name, out var property) || property.ValueKind == JsonValueKind.Null) return false;
        value = property.GetString() ?? "";
        return true;
    }

    private static string StringOr(JsonElement element, string name, string fallback) => TryString(element, name, out var value) ? value : fallback;
    private static object NullableString(JsonElement element, string name) =>
        !element.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null
            ? DBNull.Value : value.GetString() is { } text ? text : DBNull.Value;
    private static bool BoolOr(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;
    private static int IntOr(JsonElement element, string name, int fallback) => element.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : fallback;
    private static string JsonOr(JsonElement element, string name, string fallback) => element.TryGetProperty(name, out var value) ? value.GetRawText() : fallback;
    private static object ToSqlValue(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString() ?? "",
        JsonValueKind.Number when value.TryGetInt64(out var number) => number,
        JsonValueKind.True => 1,
        JsonValueKind.False => 0,
        JsonValueKind.Null => DBNull.Value,
        _ => value.GetRawText()
    };

    private static void ValidateRange(string start, string end)
    {
        if (!DateTimeOffset.TryParse(start, out var startAt) || !DateTimeOffset.TryParse(end, out var endAt) || endAt <= startAt)
            throw new InvalidOperationException("结束时间必须晚于开始时间");
    }
}









