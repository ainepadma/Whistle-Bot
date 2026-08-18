using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    private const string LegacyMigrationKey = "legacy-motodo:v1";

    private static void EnsureLegacyMigrationSchema(SqliteConnection db)
    {
        using var command = db.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS migration_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """;
        command.ExecuteNonQuery();
    }

    private static string? FindLegacyMotodoDatabase()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var localData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var candidates = new[]
        {
            Path.Combine(appData, "MOTODO", "motodo.db"),
            Path.Combine(appData, "motodo", "motodo.db"),
            Path.Combine(localData, "MOTODO", "motodo.db")
        };
        return candidates.FirstOrDefault(File.Exists);
    }

    private static void TryMigrateLegacyMotodo(SqliteConnection target)
    {
        var sourcePath = FindLegacyMotodoDatabase();
        if (sourcePath is null || HasMigrationMarker(target) || !TargetHasNoUserData(target)) return;

        try
        {
            var sourceBuilder = new SqliteConnectionStringBuilder
            {
                DataSource = sourcePath,
                Mode = SqliteOpenMode.ReadOnly,
                Pooling = false,
                ForeignKeys = true
            };
            using var source = new SqliteConnection(sourceBuilder.ToString());
            source.Open();
            if (!HasTable(source, "events")) return;

            using var transaction = target.BeginTransaction();
            var counts = new Dictionary<string, int>
            {
                ["calendars"] = CopyCalendars(source, target, transaction),
                ["semesters"] = CopySemesters(source, target, transaction),
                ["courses"] = CopyCourses(source, target, transaction),
                ["events"] = CopyEvents(source, target, transaction),
                ["reminders"] = CopyReminders(source, target, transaction),
                ["special_dates"] = CopySpecialDates(source, target, transaction)
            };
            using var marker = target.CreateCommand();
            marker.Transaction = transaction;
            marker.CommandText = "INSERT INTO migration_state (key, value) VALUES ($key, $value)";
            marker.Parameters.AddWithValue("$key", LegacyMigrationKey);
            marker.Parameters.AddWithValue("$value", JsonSerializer.Serialize(new { source = sourcePath, imported_at = DateTimeOffset.UtcNow, counts }));
            marker.ExecuteNonQuery();
            transaction.Commit();
        }
        catch
        {
            // Migration is opportunistic. A locked/corrupt legacy database must
            // never prevent the desktop pet from starting; the source remains intact.
        }
    }

    private static int CopyCalendars(SqliteConnection source, SqliteConnection target, SqliteTransaction transaction)
    {
        if (!HasTable(source, "calendars")) return 0;
        using var reader = ReadSource(source, "calendars", ["id", "name", "color", "is_visible", "is_system", "created_at", "updated_at"]);
        var count = 0;
        while (reader.Read())
        {
            using var insert = target.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO calendars (id,name,color,is_visible,is_system,created_at,updated_at) VALUES ($id,$name,$color,$visible,$system,$created,$updated)";
            Add(insert, "$id", Text(reader, "id")); Add(insert, "$name", Text(reader, "name")); Add(insert, "$color", Text(reader, "color", "#3B82F6"));
            Add(insert, "$visible", Number(reader, "is_visible", 1)); Add(insert, "$system", Number(reader, "is_system", 0));
            Add(insert, "$created", Text(reader, "created_at", "1970-01-01 00:00:00")); Add(insert, "$updated", Text(reader, "updated_at", "1970-01-01 00:00:00"));
            count += insert.ExecuteNonQuery();
        }
        return count;
    }

    private static int CopySemesters(SqliteConnection source, SqliteConnection target, SqliteTransaction transaction)
    {
        if (!HasTable(source, "semesters")) return 0;
        using var reader = ReadSource(source, "semesters", ["id", "name", "start_date", "weeks", "end_date", "is_active", "periods_json", "weekday_count_json", "special_weeks_json", "created_at", "updated_at"]);
        var count = 0;
        while (reader.Read())
        {
            using var insert = target.CreateCommand(); insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO semesters (id,name,start_date,weeks,end_date,is_active,periods_json,weekday_count_json,special_weeks_json,created_at,updated_at) VALUES ($id,$name,$start,$weeks,$end,$active,$periods,$weekday,$special,$created,$updated)";
            Add(insert, "$id", Text(reader, "id")); Add(insert, "$name", Text(reader, "name")); Add(insert, "$start", Text(reader, "start_date")); Add(insert, "$weeks", Number(reader, "weeks", 18)); Add(insert, "$end", Text(reader, "end_date"));
            Add(insert, "$active", Number(reader, "is_active", 0)); Add(insert, "$periods", Text(reader, "periods_json", "[]")); Add(insert, "$weekday", Text(reader, "weekday_count_json", DefaultWeekdayCount)); Add(insert, "$special", Text(reader, "special_weeks_json", "{}"));
            Add(insert, "$created", Text(reader, "created_at", "1970-01-01 00:00:00")); Add(insert, "$updated", Text(reader, "updated_at", "1970-01-01 00:00:00")); count += insert.ExecuteNonQuery();
        }
        return count;
    }

    private static int CopyCourses(SqliteConnection source, SqliteConnection target, SqliteTransaction transaction)
    {
        if (!HasTable(source, "courses")) return 0;
        using var reader = ReadSource(source, "courses", ["id", "semester_id", "name", "weekday", "start_period", "duration", "location", "teacher", "color", "weeks_json", "periods_json", "slots_json", "created_at", "updated_at"]);
        var count = 0;
        while (reader.Read())
        {
            using var insert = target.CreateCommand(); insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO courses (id,semester_id,name,weekday,start_period,duration,location,teacher,color,weeks_json,periods_json,slots_json,created_at,updated_at) VALUES ($id,$semester,$name,$weekday,$start,$duration,$location,$teacher,$color,$weeks,$periods,$slots,$created,$updated)";
            Add(insert, "$id", Text(reader, "id")); Add(insert, "$semester", Text(reader, "semester_id")); Add(insert, "$name", Text(reader, "name")); Add(insert, "$weekday", Number(reader, "weekday", 1)); Add(insert, "$start", Number(reader, "start_period", 1)); Add(insert, "$duration", Number(reader, "duration", 1));
            Add(insert, "$location", Text(reader, "location", "")); Add(insert, "$teacher", Text(reader, "teacher", "")); Add(insert, "$color", Text(reader, "color", "#3b82f6")); Add(insert, "$weeks", Text(reader, "weeks_json", "[]")); Add(insert, "$periods", Text(reader, "periods_json", "[]")); Add(insert, "$slots", Text(reader, "slots_json", "[]"));
            Add(insert, "$created", Text(reader, "created_at", "1970-01-01 00:00:00")); Add(insert, "$updated", Text(reader, "updated_at", "1970-01-01 00:00:00")); count += insert.ExecuteNonQuery();
        }
        return count;
    }

    private static int CopyEvents(SqliteConnection source, SqliteConnection target, SqliteTransaction transaction)
    {
        using var reader = ReadSource(source, "events", ["id", "calendar_id", "title", "description", "location", "start_at", "end_at", "is_all_day", "timezone", "rrule_str", "exdates", "reminders", "priority", "status", "item_type", "is_completed", "created_at", "updated_at"]);
        var count = 0;
        while (reader.Read())
        {
            using var insert = target.CreateCommand(); insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO events (id,calendar_id,title,description,location,start_at,end_at,is_all_day,timezone,rrule_str,exdates,reminders,priority,status,item_type,is_completed,created_at,updated_at) VALUES ($id,$calendar,$title,$description,$location,$start,$end,$allDay,$timezone,$rrule,$exdates,$reminders,$priority,$status,$itemType,$completed,$created,$updated)";
            Add(insert, "$id", Text(reader, "id")); Add(insert, "$calendar", Text(reader, "calendar_id", "default")); Add(insert, "$title", Text(reader, "title")); Add(insert, "$description", Text(reader, "description", "")); Add(insert, "$location", Text(reader, "location", "")); Add(insert, "$start", Text(reader, "start_at")); Add(insert, "$end", Text(reader, "end_at"));
            Add(insert, "$allDay", Number(reader, "is_all_day", 0)); Add(insert, "$timezone", Text(reader, "timezone", "Asia/Shanghai")); Add(insert, "$rrule", Value(reader, "rrule_str") ?? DBNull.Value); Add(insert, "$exdates", Text(reader, "exdates", "[]")); Add(insert, "$reminders", Text(reader, "reminders", "[]"));
            Add(insert, "$priority", Number(reader, "priority", 0)); Add(insert, "$status", Text(reader, "status", "confirmed")); Add(insert, "$itemType", Text(reader, "item_type", "plan")); Add(insert, "$completed", Number(reader, "is_completed", 0)); Add(insert, "$created", Text(reader, "created_at", "1970-01-01 00:00:00")); Add(insert, "$updated", Text(reader, "updated_at", "1970-01-01 00:00:00")); count += insert.ExecuteNonQuery();
        }
        return count;
    }

    private static int CopyReminders(SqliteConnection source, SqliteConnection target, SqliteTransaction transaction)
    {
        if (!HasTable(source, "reminders")) return 0;
        using var reader = ReadSource(source, "reminders", ["id", "event_id", "trigger_at", "minutes_before", "dismissed", "dismissed_at", "snoozed_until", "triggered_at", "created_at"]);
        var count = 0;
        while (reader.Read())
        {
            using var insert = target.CreateCommand(); insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO reminders (id,event_id,trigger_at,minutes_before,dismissed,dismissed_at,snoozed_until,triggered_at,created_at) VALUES ($id,$event,$trigger,$minutes,$dismissed,$dismissedAt,$snoozed,$triggered,$created)";
            Add(insert, "$id", Text(reader, "id")); Add(insert, "$event", Text(reader, "event_id")); Add(insert, "$trigger", Text(reader, "trigger_at")); Add(insert, "$minutes", Number(reader, "minutes_before", 0)); Add(insert, "$dismissed", Number(reader, "dismissed", 0));
            Add(insert, "$dismissedAt", Value(reader, "dismissed_at") ?? DBNull.Value); Add(insert, "$snoozed", Value(reader, "snoozed_until") ?? DBNull.Value); Add(insert, "$triggered", Value(reader, "triggered_at") ?? DBNull.Value); Add(insert, "$created", Text(reader, "created_at", "1970-01-01 00:00:00")); count += insert.ExecuteNonQuery();
        }
        return count;
    }

    private static int CopySpecialDates(SqliteConnection source, SqliteConnection target, SqliteTransaction transaction)
    {
        if (!HasTable(source, "special_dates")) return 0;
        using var reader = ReadSource(source, "special_dates", ["id", "date", "type", "label", "created_at"]);
        var count = 0;
        while (reader.Read())
        {
            using var insert = target.CreateCommand(); insert.Transaction = transaction;
            insert.CommandText = "INSERT OR IGNORE INTO special_dates (id,date,type,label,created_at) VALUES ($id,$date,$type,$label,$created)";
            Add(insert, "$id", Text(reader, "id")); Add(insert, "$date", Text(reader, "date")); Add(insert, "$type", Text(reader, "type", "holiday")); Add(insert, "$label", Text(reader, "label", "")); Add(insert, "$created", Text(reader, "created_at", "1970-01-01 00:00:00")); count += insert.ExecuteNonQuery();
        }
        return count;
    }

    private static SqliteDataReader ReadSource(SqliteConnection source, string table, IReadOnlyCollection<string> expected)
    {
        var columns = GetColumns(source, table);
        var select = expected.Select(column => columns.Contains(column) ? Quote(column) : DefaultColumn(column));
        var command = source.CreateCommand();
        command.CommandText = "SELECT " + string.Join(", ", select) + " FROM " + Quote(table);
        return command.ExecuteReader();
    }

    private static string DefaultColumn(string name) => name switch
    {
        "rrule_str" or "dismissed_at" or "snoozed_until" or "triggered_at" => "NULL AS " + Quote(name),
        "is_visible" => "1 AS " + Quote(name),
        "weeks" => "18 AS " + Quote(name),
        "weekday" or "start_period" or "duration" => "1 AS " + Quote(name),
        "created_at" or "updated_at" => "'1970-01-01 00:00:00' AS " + Quote(name),
        "timezone" => "'Asia/Shanghai' AS " + Quote(name),
        "color" => "'#3B82F6' AS " + Quote(name),
        "exdates" or "reminders" or "periods_json" or "weeks_json" or "slots_json" => "'[]' AS " + Quote(name),
        "weekday_count_json" => "'{}' AS " + Quote(name),
        "special_weeks_json" => "'{}' AS " + Quote(name),
        "item_type" => "'plan' AS " + Quote(name),
        "status" => "'confirmed' AS " + Quote(name),
        _ => "0 AS " + Quote(name)
    };
    private static HashSet<string> GetColumns(SqliteConnection db, string table)
    {
        using var command = db.CreateCommand(); command.CommandText = "PRAGMA table_info(" + Quote(table) + ")";
        using var reader = command.ExecuteReader(); var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read()) columns.Add(reader.GetString(reader.GetOrdinal("name"))); return columns;
    }
    private static bool HasTable(SqliteConnection db, string table) { using var command = db.CreateCommand(); command.CommandText = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=$name"; command.Parameters.AddWithValue("$name", table); return command.ExecuteScalar() is not null; }
    private static bool HasMigrationMarker(SqliteConnection db) { using var command = db.CreateCommand(); command.CommandText = "SELECT 1 FROM migration_state WHERE key=$key"; command.Parameters.AddWithValue("$key", LegacyMigrationKey); return command.ExecuteScalar() is not null; }
    private static bool TargetHasNoUserData(SqliteConnection db) { using var command = db.CreateCommand(); command.CommandText = "SELECT (SELECT count(*) FROM events) + (SELECT count(*) FROM semesters) + (SELECT count(*) FROM courses) + (SELECT count(*) FROM special_dates)"; return Convert.ToInt64(command.ExecuteScalar()) == 0; }
    private static string Quote(string identifier) => '"' + identifier.Replace("\"", "\"\"") + '"';
    private static void Add(SqliteCommand command, string name, object value) => command.Parameters.AddWithValue(name, value);
    private static object? Value(SqliteDataReader reader, string column) => reader.IsDBNull(reader.GetOrdinal(column)) ? null : reader.GetValue(reader.GetOrdinal(column));
    private static string Text(SqliteDataReader reader, string column, string fallback = "") => Value(reader, column)?.ToString() ?? fallback;
    private static long Number(SqliteDataReader reader, string column, long fallback) => long.TryParse(Text(reader, column), out var value) ? value : fallback;
}
