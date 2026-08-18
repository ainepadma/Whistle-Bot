using System.Globalization;
using System.Text;
using System.Text.Json;

namespace PetApp.Schedule;

/// <summary>Native file-dialog and interchange implementation for the planner.</summary>
internal sealed class ScheduleTransferService
{
    private readonly ScheduleStore _store;
    private readonly Form _owner;
    private string? _selectedImportPath;

    public ScheduleTransferService(ScheduleStore store, Form owner)
    {
        _store = store;
        _owner = owner;
    }

    public string ExportJson(IReadOnlyCollection<string> ids) => JsonSerializer.Serialize(new
    {
        version = 1,
        exported_at = DateTimeOffset.UtcNow.ToString("O"),
        events = _store.ListEventsForTransfer(ids)
    }, new JsonSerializerOptions { WriteIndented = true });

    public string ExportIcs(IReadOnlyCollection<string> ids)
    {
        var builder = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\nPRODID:-//BanyaoPet//Schedule//ZH\r\n");
        foreach (var item in _store.ListEventsForTransfer(ids))
        {
            var allDay = (bool)item["is_all_day"]!;
            builder.Append("BEGIN:VEVENT\r\n")
                .Append("UID:").Append(item["id"]).Append("\r\n")
                .Append("DTSTAMP:").Append(DateTimeOffset.UtcNow.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture)).Append("\r\n")
                .Append("DTSTART").Append(allDay ? ";VALUE=DATE:" : ":").Append(IcsTime((string)item["start_at"]!, allDay, false)).Append("\r\n")
                .Append("DTEND").Append(allDay ? ";VALUE=DATE:" : ":").Append(IcsTime((string)item["end_at"]!, allDay, allDay)).Append("\r\n")
                .Append("SUMMARY:").Append(EscapeIcs((string)item["title"]!)).Append("\r\n");
            AppendIcsText(builder, "DESCRIPTION", (string)item["description"]!);
            AppendIcsText(builder, "LOCATION", (string)item["location"]!);
            if (item["rrule_str"] is string rrule && !string.IsNullOrWhiteSpace(rrule)) builder.Append("RRULE:").Append(rrule).Append("\r\n");
            if (item["exdates"] is JsonElement exdates && exdates.ValueKind == JsonValueKind.Array)
            {
                var values = exdates.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String)
                    .Select(x => IcsTime(x.GetString()!, allDay, false)).ToArray();
                if (values.Length > 0) builder.Append("EXDATE").Append(allDay ? ";VALUE=DATE:" : ":").Append(string.Join(",", values)).Append("\r\n");
            }
            builder.Append("STATUS:").Append(((string)item["status"]!).ToUpperInvariant()).Append("\r\nEND:VEVENT\r\n");
        }
        return builder.Append("END:VCALENDAR\r\n").ToString();
    }

    public string? SelectImportFile()
    {
        using var dialog = new OpenFileDialog { Filter = "日程文件|*.ics;*.json|iCalendar|*.ics|JSON 备份|*.json", Multiselect = false, Title = "导入日程" };
        if (dialog.ShowDialog(_owner) != DialogResult.OK) return null;
        _selectedImportPath = dialog.FileName;
        return _selectedImportPath;
    }

    public Dictionary<string, object?> SaveFile(JsonElement input)
    {
        var suggested = Required(input, "suggestedName");
        var content = Required(input, "content");
        var kind = Required(input, "kind");
        var extension = kind == "ics" ? "ics" : kind == "json" ? "json" : throw new InvalidOperationException("不支持的导出格式");
        using var dialog = new SaveFileDialog
        {
            Filter = extension == "ics" ? "iCalendar|*.ics" : "JSON 备份|*.json",
            DefaultExt = extension,
            AddExtension = true,
            FileName = Path.GetFileName(suggested),
            Title = "导出日程"
        };
        if (dialog.ShowDialog(_owner) != DialogResult.OK) return new Dictionary<string, object?> { ["canceled"] = true };
        File.WriteAllText(dialog.FileName, content, new UTF8Encoding(false));
        return new Dictionary<string, object?> { ["canceled"] = false, ["filePath"] = dialog.FileName };
    }

    public int ImportJson(string path)
    {
        VerifySelectedImportPath(path, ".json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var source = document.RootElement.ValueKind == JsonValueKind.Array
            ? document.RootElement : document.RootElement.GetProperty("events");
        if (source.ValueKind != JsonValueKind.Array) throw new InvalidOperationException("JSON 备份中没有日程数组");
        var count = 0;
        foreach (var item in source.EnumerateArray()) { ImportEvent(item); count++; }
        return count;
    }

    public int ImportIcs(string path)
    {
        VerifySelectedImportPath(path, ".ics");
        var count = 0;
        Dictionary<string, string>? fields = null;
        foreach (var line in UnfoldIcs(File.ReadAllLines(path)))
        {
            if (line == "BEGIN:VEVENT") { fields = new(StringComparer.OrdinalIgnoreCase); continue; }
            if (line == "END:VEVENT" && fields != null) { ImportIcsEvent(fields); count++; fields = null; continue; }
            if (fields == null) continue;
            var colon = line.IndexOf(':');
            if (colon <= 0) continue;
            var name = line[..colon].Split(';')[0];
            fields[name] = line[(colon + 1)..];
        }
        return count;
    }

    private void ImportEvent(JsonElement raw)
    {
        var input = new Dictionary<string, object?>
        {
            ["calendar_id"] = "default",
            ["title"] = String(raw, "title", "未命名日程"),
            ["description"] = String(raw, "description", ""), ["location"] = String(raw, "location", ""),
            ["start_at"] = Required(raw, "start_at"), ["end_at"] = Required(raw, "end_at"),
            ["is_all_day"] = Bool(raw, "is_all_day"), ["timezone"] = String(raw, "timezone", "Asia/Shanghai"),
            ["rrule_str"] = raw.TryGetProperty("rrule_str", out var rrule) ? rrule.Clone() : null,
            ["exdates"] = raw.TryGetProperty("exdates", out var exdates) ? exdates.Clone() : JsonSerializer.SerializeToElement(Array.Empty<string>()),
            ["reminders"] = raw.TryGetProperty("reminders", out var reminders) ? reminders.Clone() : JsonSerializer.SerializeToElement(Array.Empty<object>()),
            ["priority"] = Int(raw, "priority", 0), ["status"] = String(raw, "status", "confirmed"),
            ["item_type"] = String(raw, "item_type", "plan"), ["is_completed"] = Bool(raw, "is_completed")
        };
        CreateImportedEvent(JsonSerializer.SerializeToElement(input));
    }

    private void ImportIcsEvent(IReadOnlyDictionary<string, string> fields)
    {
        if (!fields.TryGetValue("DTSTART", out var start)) throw new InvalidOperationException("ICS 日程缺少 DTSTART");
        var allDay = start.Length == 8;
        var startAt = ParseIcsTime(start, allDay);
        var endAt = fields.TryGetValue("DTEND", out var end) ? ParseIcsTime(end, end.Length == 8) : startAt.AddHours(allDay ? 24 : 1);
        var input = new Dictionary<string, object?>
        {
            ["calendar_id"] = "default", ["title"] = UnescapeIcs(fields.GetValueOrDefault("SUMMARY") ?? "未命名日程"),
            ["description"] = UnescapeIcs(fields.GetValueOrDefault("DESCRIPTION") ?? ""), ["location"] = UnescapeIcs(fields.GetValueOrDefault("LOCATION") ?? ""),
            ["start_at"] = startAt.ToString("O"), ["end_at"] = endAt.ToString("O"), ["is_all_day"] = allDay,
            ["rrule_str"] = fields.GetValueOrDefault("RRULE"), ["exdates"] = Array.Empty<string>(), ["reminders"] = Array.Empty<object>(),
            ["priority"] = 0, ["status"] = (fields.GetValueOrDefault("STATUS") ?? "confirmed").ToLowerInvariant(), ["item_type"] = "plan", ["is_completed"] = false
        };
        CreateImportedEvent(JsonSerializer.SerializeToElement(input));
    }

    private void CreateImportedEvent(JsonElement input)
    {
        var item = _store.CreateEvent(input);
        _store.ReplaceEventRemindersForEvent(item);
    }

    private void VerifySelectedImportPath(string path, string extension)
    {
        if (!string.Equals(path, _selectedImportPath, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("请通过文件选择器导入文件");
        if (!path.EndsWith(extension, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("文件格式不匹配");
    }

    private static IEnumerable<string> UnfoldIcs(IEnumerable<string> lines)
    {
        string? current = null;
        foreach (var line in lines)
        {
            if ((line.StartsWith(' ') || line.StartsWith('\t')) && current != null) { current += line[1..]; continue; }
            if (current != null) yield return current;
            current = line;
        }
        if (current != null) yield return current;
    }

    private static string IcsTime(string iso, bool allDay, bool exclusiveEnd)
    {
        var time = DateTimeOffset.Parse(iso);
        if (allDay) return time.LocalDateTime.Date.AddDays(exclusiveEnd ? 1 : 0).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        return time.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
    }
    private static DateTimeOffset ParseIcsTime(string value, bool allDay)
    {
        if (allDay) return new DateTimeOffset(DateTime.ParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture), TimeSpan.Zero);
        if (value.EndsWith('Z')) return DateTimeOffset.ParseExact(value, "yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);
        return new DateTimeOffset(DateTime.ParseExact(value, "yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture), TimeZoneInfo.Local.GetUtcOffset(DateTime.Now));
    }
    private static void AppendIcsText(StringBuilder builder, string key, string value) { if (!string.IsNullOrWhiteSpace(value)) builder.Append(key).Append(':').Append(EscapeIcs(value)).Append("\r\n"); }
    private static string EscapeIcs(string value) => value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r\n", "\\n").Replace("\n", "\\n");
    private static string UnescapeIcs(string value) => value.Replace("\\n", "\n").Replace("\\,", ",").Replace("\\;", ";").Replace("\\\\", "\\");
    private static string Required(JsonElement item, string name) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()! : throw new InvalidOperationException($"导入数据缺少 {name}");
    private static string String(JsonElement item, string name, string fallback) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : fallback;
    private static bool Bool(JsonElement item, string name) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;
    private static int Int(JsonElement item, string name, int fallback) => item.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : fallback;
}

