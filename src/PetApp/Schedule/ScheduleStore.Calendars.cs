using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    public IReadOnlyList<Dictionary<string, object?>> ListCalendars()
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM calendars ORDER BY is_system DESC, created_at";
        using var reader = command.ExecuteReader();
        var calendars = new List<Dictionary<string, object?>>();
        while (reader.Read()) calendars.Add(ReadCalendar(reader));
        return calendars;
    }

    public Dictionary<string, object?> CreateCalendar(JsonElement input)
    {
        var name = RequiredString(input, "name").Trim();
        if (name.Length > 80) throw new InvalidOperationException("日历名称不能超过 80 个字符");
        var id = Guid.NewGuid().ToString();
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO calendars (id, name, color) VALUES ($id, $name, $color)";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", name);
        command.Parameters.AddWithValue("$color", ColorOr(input, "#3B82F6"));
        command.ExecuteNonQuery();
        return GetCalendar(id)!;
    }

    public Dictionary<string, object?> UpdateCalendar(string id, JsonElement input)
    {
        var existing = GetCalendar(id) ?? throw new InvalidOperationException("日历不存在");
        var fields = new List<string>();
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        if (input.TryGetProperty("name", out _))
        {
            var name = RequiredString(input, "name").Trim();
            if (name.Length is 0 or > 80) throw new InvalidOperationException("日历名称长度无效");
            fields.Add("name = $name");
            command.Parameters.AddWithValue("$name", name);
        }
        if (input.TryGetProperty("color", out _))
        {
            fields.Add("color = $color");
            command.Parameters.AddWithValue("$color", ColorOr(input, (string)existing["color"]!));
        }
        if (input.TryGetProperty("is_visible", out var visible))
        {
            fields.Add("is_visible = $visible");
            command.Parameters.AddWithValue("$visible", visible.GetBoolean() ? 1 : 0);
        }
        if (fields.Count == 0) return existing;
        fields.Add("updated_at = datetime('now')");
        command.CommandText = "UPDATE calendars SET " + string.Join(", ", fields) + " WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
        return GetCalendar(id)!;
    }

    public void RemoveCalendar(string id)
    {
        var calendar = GetCalendar(id) ?? throw new InvalidOperationException("日历不存在");
        if ((bool)calendar["is_system"]!) throw new InvalidOperationException("系统日历不能删除");
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM calendars WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public Dictionary<string, object?> ToggleCalendarVisible(string id)
    {
        var calendar = GetCalendar(id) ?? throw new InvalidOperationException("日历不存在");
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE calendars SET is_visible = $visible, updated_at = datetime('now') WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$visible", (bool)calendar["is_visible"]! ? 0 : 1);
        command.ExecuteNonQuery();
        return GetCalendar(id)!;
    }

    private Dictionary<string, object?>? GetCalendar(string id)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM calendars WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadCalendar(reader) : null;
    }

    private static Dictionary<string, object?> ReadCalendar(SqliteDataReader row) => new()
    {
        ["id"] = row.GetString(row.GetOrdinal("id")),
        ["name"] = row.GetString(row.GetOrdinal("name")),
        ["color"] = row.GetString(row.GetOrdinal("color")),
        ["is_visible"] = row.GetInt64(row.GetOrdinal("is_visible")) != 0,
        ["is_system"] = row.GetInt64(row.GetOrdinal("is_system")) != 0,
        ["created_at"] = row.GetString(row.GetOrdinal("created_at")),
        ["updated_at"] = row.GetString(row.GetOrdinal("updated_at"))
    };

    private static string ColorOr(JsonElement input, string fallback)
    {
        var color = StringOr(input, "color", fallback).Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(color, "^#[0-9a-fA-F]{6}$"))
            throw new InvalidOperationException("日历颜色必须为 #RRGGBB");
        return color;
    }
}
