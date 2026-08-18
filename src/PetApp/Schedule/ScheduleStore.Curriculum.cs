using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    private static void EnsureCurriculumSchema(SqliteConnection db)
    {
        using var command = db.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS semesters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                weeks INTEGER NOT NULL CHECK (weeks > 0),
                end_date TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                periods_json TEXT NOT NULL DEFAULT '[]',
                weekday_count_json TEXT NOT NULL DEFAULT '{}',
                special_weeks_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_semesters_active ON semesters(is_active);

            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                weekday INTEGER NOT NULL DEFAULT 1,
                start_period INTEGER NOT NULL DEFAULT 1,
                duration INTEGER NOT NULL DEFAULT 1,
                location TEXT NOT NULL DEFAULT '',
                teacher TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '#3b82f6',
                weeks_json TEXT NOT NULL DEFAULT '[]',
                periods_json TEXT NOT NULL DEFAULT '[]',
                slots_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester_id);

            CREATE TABLE IF NOT EXISTS special_dates (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL CHECK (type IN ('holiday', 'special')) DEFAULT 'holiday',
                label TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """;
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<Dictionary<string, object?>> ListSemesters()
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM semesters ORDER BY is_active DESC, start_date DESC";
        return ReadSemesters(command);
    }

    public Dictionary<string, object?>? GetActiveSemester()
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM semesters WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1";
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadSemester(reader) : null;
    }

    public Dictionary<string, object?> CreateSemester(JsonElement input)
    {
        var name = RequiredString(input, "name").Trim();
        var startDate = RequiredString(input, "start_date");
        var weeks = IntOr(input, "weeks", 18);
        ValidateSemester(startDate, weeks);
        var id = Guid.NewGuid().ToString();
        var isActive = BoolOr(input, "is_active") || GetActiveSemester() is null;

        using var db = Open();
        db.Open();
        using var transaction = db.BeginTransaction();
        if (isActive) SetActiveSemester(db, id, transaction);
        using var command = db.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO semesters (id, name, start_date, weeks, end_date, is_active, periods_json, weekday_count_json, special_weeks_json)
            VALUES ($id, $name, $startDate, $weeks, $endDate, $active, $periods, $weekdayCount, $specialWeeks)
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", name);
        command.Parameters.AddWithValue("$startDate", startDate);
        command.Parameters.AddWithValue("$weeks", weeks);
        command.Parameters.AddWithValue("$endDate", SemesterEndDate(startDate, weeks));
        command.Parameters.AddWithValue("$active", isActive ? 1 : 0);
        command.Parameters.AddWithValue("$periods", JsonOr(input, "periods", "[]"));
        command.Parameters.AddWithValue("$weekdayCount", JsonOr(input, "weekday_count", DefaultWeekdayCount));
        command.Parameters.AddWithValue("$specialWeeks", JsonOr(input, "special_weeks", "{}"));
        command.ExecuteNonQuery();
        transaction.Commit();
        return GetSemester(id)!;
    }

    public Dictionary<string, object?> UpdateSemester(string id, JsonElement input)
    {
        var existing = GetSemester(id) ?? throw new InvalidOperationException("学期不存在");
        var startDate = StringOr(input, "start_date", (string)existing["start_date"]!);
        var weeks = IntOr(input, "weeks", (int)existing["weeks"]!);
        ValidateSemester(startDate, weeks);

        using var db = Open();
        db.Open();
        using var transaction = db.BeginTransaction();
        if (BoolOr(input, "is_active")) SetActiveSemester(db, id, transaction);
        using var command = db.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            UPDATE semesters SET
                name = $name, start_date = $startDate, weeks = $weeks, end_date = $endDate,
                is_active = $active, periods_json = $periods, weekday_count_json = $weekdayCount,
                special_weeks_json = $specialWeeks, updated_at = datetime('now')
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", StringOr(input, "name", (string)existing["name"]!));
        command.Parameters.AddWithValue("$startDate", startDate);
        command.Parameters.AddWithValue("$weeks", weeks);
        command.Parameters.AddWithValue("$endDate", SemesterEndDate(startDate, weeks));
        command.Parameters.AddWithValue("$active", input.TryGetProperty("is_active", out var active) && active.ValueKind == JsonValueKind.False ? 0 : (bool)existing["is_active"]! || BoolOr(input, "is_active") ? 1 : 0);
        command.Parameters.AddWithValue("$periods", JsonOr(input, "periods", JsonSerializer.Serialize(existing["periods"])));
        command.Parameters.AddWithValue("$weekdayCount", JsonOr(input, "weekday_count", JsonSerializer.Serialize(existing["weekday_count"])));
        command.Parameters.AddWithValue("$specialWeeks", JsonOr(input, "special_weeks", JsonSerializer.Serialize(existing["special_weeks"])));
        command.ExecuteNonQuery();
        transaction.Commit();
        return GetSemester(id)!;
    }

    public void RemoveSemester(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM semesters WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<Dictionary<string, object?>> ListCoursesBySemester(string semesterId)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM courses WHERE semester_id = $semesterId ORDER BY name COLLATE NOCASE";
        command.Parameters.AddWithValue("$semesterId", semesterId);
        return ReadCourses(command);
    }

    public Dictionary<string, object?> CreateCourse(JsonElement input)
    {
        var semesterId = RequiredString(input, "semester_id");
        if (GetSemester(semesterId) is null) throw new InvalidOperationException("所属学期不存在");
        var name = RequiredString(input, "name").Trim();
        var slots = JsonOr(input, "slots", "[]");
        var id = Guid.NewGuid().ToString();

        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO courses (id, semester_id, name, location, teacher, color, slots_json)
            VALUES ($id, $semesterId, $name, $location, $teacher, $color, $slots)
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$semesterId", semesterId);
        command.Parameters.AddWithValue("$name", name);
        command.Parameters.AddWithValue("$location", StringOr(input, "location", ""));
        command.Parameters.AddWithValue("$teacher", StringOr(input, "teacher", ""));
        command.Parameters.AddWithValue("$color", StringOr(input, "color", "#3b82f6"));
        command.Parameters.AddWithValue("$slots", slots);
        command.ExecuteNonQuery();
        return GetCourse(id)!;
    }

    public Dictionary<string, object?> UpdateCourse(string id, JsonElement input)
    {
        var existing = GetCourse(id) ?? throw new InvalidOperationException("课程不存在");
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            UPDATE courses SET name = $name, location = $location, teacher = $teacher,
                color = $color, slots_json = $slots, updated_at = datetime('now') WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", StringOr(input, "name", (string)existing["name"]!));
        command.Parameters.AddWithValue("$location", StringOr(input, "location", (string)existing["location"]!));
        command.Parameters.AddWithValue("$teacher", StringOr(input, "teacher", (string)existing["teacher"]!));
        command.Parameters.AddWithValue("$color", StringOr(input, "color", (string)existing["color"]!));
        command.Parameters.AddWithValue("$slots", JsonOr(input, "slots", JsonSerializer.Serialize(existing["slots"])));
        command.ExecuteNonQuery();
        return GetCourse(id)!;
    }

    public void RemoveCourse(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM courses WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<Dictionary<string, object?>> ListSpecialDates()
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM special_dates ORDER BY date";
        using var reader = command.ExecuteReader();
        var dates = new List<Dictionary<string, object?>>();
        while (reader.Read()) dates.Add(ReadSpecialDate(reader));
        return dates;
    }

    public Dictionary<string, object?> CreateSpecialDate(JsonElement input)
    {
        var date = RequiredString(input, "date");
        if (!DateOnly.TryParse(date, out _)) throw new InvalidOperationException("日期格式无效");
        var type = StringOr(input, "type", "holiday");
        if (type is not ("holiday" or "special")) throw new InvalidOperationException("特殊日期类型无效");
        var id = Guid.NewGuid().ToString();
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO special_dates (id, date, type, label) VALUES ($id, $date, $type, $label)
            ON CONFLICT(date) DO UPDATE SET type = excluded.type, label = excluded.label
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$date", date);
        command.Parameters.AddWithValue("$type", type);
        command.Parameters.AddWithValue("$label", StringOr(input, "label", ""));
        command.ExecuteNonQuery();
        return GetSpecialDateByDate(date)!;
    }

    public void RemoveSpecialDate(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM special_dates WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    private Dictionary<string, object?>? GetSemester(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM semesters WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadSemester(reader) : null;
    }

    private Dictionary<string, object?>? GetCourse(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM courses WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadCourse(reader) : null;
    }

    private Dictionary<string, object?>? GetSpecialDateByDate(string date)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM special_dates WHERE date = $date";
        command.Parameters.AddWithValue("$date", date);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadSpecialDate(reader) : null;
    }

    private static IReadOnlyList<Dictionary<string, object?>> ReadSemesters(SqliteCommand command)
    {
        using var reader = command.ExecuteReader();
        var items = new List<Dictionary<string, object?>>();
        while (reader.Read()) items.Add(ReadSemester(reader));
        return items;
    }

    private static IReadOnlyList<Dictionary<string, object?>> ReadCourses(SqliteCommand command)
    {
        using var reader = command.ExecuteReader();
        var items = new List<Dictionary<string, object?>>();
        while (reader.Read()) items.Add(ReadCourse(reader));
        return items;
    }

    private static Dictionary<string, object?> ReadSemester(SqliteDataReader row) => new()
    {
        ["id"] = row.GetString(row.GetOrdinal("id")), ["name"] = row.GetString(row.GetOrdinal("name")),
        ["start_date"] = row.GetString(row.GetOrdinal("start_date")), ["weeks"] = row.GetInt32(row.GetOrdinal("weeks")),
        ["end_date"] = row.GetString(row.GetOrdinal("end_date")), ["is_active"] = row.GetInt64(row.GetOrdinal("is_active")) != 0,
        ["periods"] = JsonSerializer.Deserialize<JsonElement>(row.GetString(row.GetOrdinal("periods_json"))),
        ["weekday_count"] = JsonSerializer.Deserialize<JsonElement>(row.GetString(row.GetOrdinal("weekday_count_json"))),
        ["special_weeks"] = JsonSerializer.Deserialize<JsonElement>(row.GetString(row.GetOrdinal("special_weeks_json"))),
        ["created_at"] = row.GetString(row.GetOrdinal("created_at")), ["updated_at"] = row.GetString(row.GetOrdinal("updated_at"))
    };

    private static Dictionary<string, object?> ReadCourse(SqliteDataReader row) => new()
    {
        ["id"] = row.GetString(row.GetOrdinal("id")), ["semester_id"] = row.GetString(row.GetOrdinal("semester_id")),
        ["name"] = row.GetString(row.GetOrdinal("name")), ["location"] = row.GetString(row.GetOrdinal("location")),
        ["teacher"] = row.GetString(row.GetOrdinal("teacher")), ["color"] = row.GetString(row.GetOrdinal("color")),
        ["slots"] = JsonSerializer.Deserialize<JsonElement>(row.GetString(row.GetOrdinal("slots_json"))),
        ["created_at"] = row.GetString(row.GetOrdinal("created_at")), ["updated_at"] = row.GetString(row.GetOrdinal("updated_at"))
    };

    private static Dictionary<string, object?> ReadSpecialDate(SqliteDataReader row) => new()
    {
        ["id"] = row.GetString(row.GetOrdinal("id")), ["date"] = row.GetString(row.GetOrdinal("date")),
        ["type"] = row.GetString(row.GetOrdinal("type")), ["label"] = row.GetString(row.GetOrdinal("label")),
        ["created_at"] = row.GetString(row.GetOrdinal("created_at"))
    };

    private static void SetActiveSemester(SqliteConnection db, string id, SqliteTransaction transaction)
    {
        using var command = db.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "UPDATE semesters SET is_active = CASE WHEN id = $id THEN 1 ELSE 0 END, updated_at = datetime('now')";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    private static void ValidateSemester(string startDate, int weeks)
    {
        if (!DateOnly.TryParse(startDate, out _)) throw new InvalidOperationException("开学日期格式无效");
        if (weeks is < 1 or > 104) throw new InvalidOperationException("学期周数必须在 1 到 104 之间");
    }

    private static string SemesterEndDate(string startDate, int weeks) => DateOnly.Parse(startDate).AddDays(weeks * 7 - 1).ToString("yyyy-MM-dd");
    private const string DefaultWeekdayCount = "{\"1\":13,\"2\":13,\"3\":13,\"4\":13,\"5\":13,\"6\":0,\"7\":0}";
}


