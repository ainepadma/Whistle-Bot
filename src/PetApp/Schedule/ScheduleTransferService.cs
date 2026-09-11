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

    public string ExportIcs(IReadOnlyCollection<string> ids) => IcsCodec.Export(_store.ListEventsForTransfer(ids));

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
        return ImportIcsContent(File.ReadAllText(path));
    }

    internal int ImportIcsContent(string content)
    {
        // Validate the entire file before writing any imported events.
        var events = IcsCodec.Parse(content);
        foreach (var item in events) CreateImportedEvent(item);
        return events.Count;
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

    private static string Required(JsonElement item, string name) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()! : throw new InvalidOperationException($"导入数据缺少 {name}");
    private static string String(JsonElement item, string name, string fallback) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : fallback;
    private static bool Bool(JsonElement item, string name) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;
    private static int Int(JsonElement item, string name, int fallback) => item.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : fallback;
}

