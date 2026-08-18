using System.Reflection;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PetApp.Schedule;

/// <summary>Maps the transplanted React UI onto the desktop-pet services.</summary>
internal sealed class ScheduleRpcBridge
{
    private readonly WebView2 _web;
    private readonly ScheduleStore _store;
    private readonly Form _host;
    private readonly IScheduleDesktopHost _desktop;
    private readonly ScheduleTransferService _transfer;
    private readonly IDisposable _eventSubscription;

    public ScheduleRpcBridge(WebView2 web, ScheduleStore store, Form host, IScheduleDesktopHost desktop)
    {
        _web = web;
        _store = store;
        _host = host;
        _desktop = desktop;
        _transfer = new ScheduleTransferService(_store, _host);
        _web.CoreWebView2.WebMessageReceived += OnMessage;
        _eventSubscription = ScheduleEventHub.Instance.Subscribe((channel, payload) => Publish(channel, payload));
    }

    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        var id = 0;
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            if (root.GetProperty("type").GetString() != "motodo:request") return;
            id = root.GetProperty("id").GetInt32();
            var method = root.GetProperty("method").GetString() ?? "";
            var args = root.TryGetProperty("args", out var rawArgs)
                ? rawArgs.EnumerateArray().Select(x => x.Clone()).ToArray()
                : [];
            var result = await Dispatch(method, args);
            Post(new { type = "motodo:response", id, ok = true, result });
        }
        catch (Exception ex)
        {
            Post(new { type = "motodo:response", id, ok = false, error = ex.Message });
        }
    }

    private Task<object?> Dispatch(string method, JsonElement[] args)
    {
        object? result = method switch
        {
            "event:query" => _store.QueryEvents(args[0]),
            "event:get-by-id" => _store.GetEvent(args[0].GetString() ?? ""),
            "event:create" => CreateEvent(args[0]),
            "event:update" => UpdateEvent(args[0].GetString() ?? "", args[1]),
            "event:remove" => RemoveEvent(args[0].GetString() ?? ""),
            "event:search" => _store.SearchEvents(args[0].GetString() ?? ""),

            "calendar:list" => _store.ListCalendars(),
            "calendar:create" => Changed(_store.CreateCalendar(args[0])),
            "calendar:update" => Changed(_store.UpdateCalendar(args[0].GetString() ?? "", args[1])),
            "calendar:remove" => Changed(RemoveCalendar(args[0].GetString() ?? "")),
            "calendar:toggle-visible" => Changed(_store.ToggleCalendarVisible(args[0].GetString() ?? "")),
            "semester:list" => _store.ListSemesters(),
            "semester:get-active" => _store.GetActiveSemester(),
            "semester:create" => Changed(_store.CreateSemester(args[0])),
            "semester:update" => Changed(_store.UpdateSemester(args[0].GetString() ?? "", args[1])),
            "semester:remove" => Changed(RemoveSemester(args[0].GetString() ?? "")),
            "course:list-by-semester" => _store.ListCoursesBySemester(args[0].GetString() ?? ""),
            "course:create" => Changed(_store.CreateCourse(args[0])),
            "course:update" => Changed(_store.UpdateCourse(args[0].GetString() ?? "", args[1])),
            "course:remove" => Changed(RemoveCourse(args[0].GetString() ?? "")),
            "special-date:list" => _store.ListSpecialDates(),
            "special-date:create" => Changed(_store.CreateSpecialDate(args[0])),
            "special-date:remove" => Changed(RemoveSpecialDate(args[0].GetString() ?? "")),
            "reminder:pending" => _store.ListPendingReminders(),
            "reminder:dismiss" => DismissReminder(args[0].GetString() ?? ""),
            "reminder:snooze" => SnoozeReminder(args[0].GetString() ?? "", args[1].GetInt32()),

            "export:ics" => _transfer.ExportIcs(ReadIds(args[0])),
            "export:json" => _transfer.ExportJson(ReadIds(args[0])),
            "export:import-ics" => Changed(_transfer.ImportIcs(args[0].GetString() ?? "")),
            "export:import-json" => Changed(_transfer.ImportJson(args[0].GetString() ?? "")),
            "export:select-file" => _transfer.SelectImportFile(),
            "export:save-file" => _transfer.SaveFile(args[0]),

            "system:app-version" => Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "dev",
            "system:platform" => "win32",
            "system:is-auto-start" => _desktop.IsAutostartEnabled(),
            "system:set-auto-start" => SetAutostart(args[0].GetBoolean()),
            "system:pet-color" => _desktop.GetPetColor(),
            "system:open-external" => OpenExternal(args[0].GetString()),

            "window:minimize" => Minimize(),
            "window:toggle-maximize" => ToggleMaximize(),
            "window:close" => CloseWindow(),
            "window:is-maximized" => _host.WindowState == FormWindowState.Maximized,
            "window:card-visible" => _desktop.IsCardVisible("today"),
            "window:toggle-card" => ToggleCard("today"),
            "window:close-card" => CloseCard("today"),
            "window:open-edit" => OpenEdit(args[0]),
            "window:open-console" => OpenConsole(),

            "card:get-state" => _desktop.GetCardPresentation(CardKind(args)),
            "card:show" => ShowCard(CardKind(args)),
            "card:switch" => SwitchCard(CardKind(args), CardKind(args.Skip(1).ToArray())),
            "card:toggle" => ToggleCard(CardKind(args)),
            "card:begin-drag" => BeginCardDrag(CardKind(args)),
            "card:toggle-pinned" => ToggleCardPinned(CardKind(args)),
            "card:drag" => MoveCard(CardKind(args), args[1].GetInt32(), args[2].GetInt32()),
            "card:resize" => ResizeCard(CardKind(args), args[1].GetInt32(), args[2].GetInt32()),
            "card:close" => CloseCard(CardKind(args)),

            "focus:state" => FocusSnapshot(),
            "focus:toggle" => FocusToggle(),
            "focus:reset" => FocusReset(),
            "focus:skip" => FocusSkip(),
            "focus:set-preset" => FocusPreset(args[0].GetString() ?? "25-5"),
            "focus:set-custom" => FocusCustom(args[0]),
            "focus:start-for-event" => StartFocusForEvent(args[0].GetString()),
            "focus:detach-event" => DetachFocusEvent(),
            "focus:sessions" => _store.ListFocusSessions(args[0].GetString() ?? ""),
            "focus:complete-event" => CompleteFocusEvent(),
            "focus:open-event" => OpenFocusEvent(),

            "update:check" or "update:download" or "update:install" => throw new InvalidOperationException("更新由小鹞 WhistleBot 发行服务统一管理，当前版本未配置在线更新源。"),
            _ => throw new InvalidOperationException($"暂不支持日程接口：{method}")
        };
        return Task.FromResult(result);
    }

    private Dictionary<string, object?> CreateEvent(JsonElement input)
    {
        var item = _store.CreateEvent(input);
        SyncEventReminders(item);
        return Changed(item);
    }

    private Dictionary<string, object?> UpdateEvent(string id, JsonElement input)
    {
        var item = _store.UpdateEvent(id, input);
        SyncEventReminders(item);
        return Changed(item);
    }

    private static IReadOnlyCollection<string> ReadIds(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Array) throw new InvalidOperationException("导出日程 ID 必须为数组");
        return element.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToArray();
    }

    private T Changed<T>(T result)
    {
        ScheduleEventHub.Instance.Publish("schedule:changed");
        return result;
    }

    private object? RemoveEvent(string id) { _store.RemoveEvent(id); return Changed<object?>(null); }
    private object? RemoveCalendar(string id) { _store.RemoveCalendar(id); return Changed<object?>(null); }
    private object? RemoveSemester(string id) { _store.RemoveSemester(id); return Changed<object?>(null); }
    private object? RemoveCourse(string id) { _store.RemoveCourse(id); return Changed<object?>(null); }
    private object? RemoveSpecialDate(string id) { _store.RemoveSpecialDate(id); return Changed<object?>(null); }
    private void SyncEventReminders(Dictionary<string, object?> item) => _store.ReplaceEventRemindersForEvent(item);

    private object? DismissReminder(string id) { _store.DismissReminder(id); return null; }
    private object? SnoozeReminder(string id, int minutes) { _store.SnoozeReminder(id, minutes); return null; }
    private object? SetAutostart(bool enabled) { _desktop.SetAutostartEnabled(enabled); return null; }
    private object? Minimize() { _host.WindowState = FormWindowState.Minimized; return null; }
    private object? ToggleMaximize()
    {
        _host.WindowState = _host.WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
        Publish("window:maximized", _host.WindowState == FormWindowState.Maximized);
        return null;
    }
    private object? CloseWindow() { _host.Hide(); return null; }
    private object? ToggleCard(string kind)
    {
        if (_desktop.IsCardVisible(kind)) _desktop.CloseCard(kind); else _desktop.ShowCard(kind);
        return _desktop.GetCardPresentation(kind);
    }
    private object? ShowCard(string kind) { _desktop.ShowCard(kind); return _desktop.GetCardPresentation(kind); }
    private object? SwitchCard(string fromKind, string toKind) { _desktop.SwitchCard(fromKind, toKind); return _desktop.GetCardPresentation(toKind); }
    private object? CloseCard(string kind) { _desktop.CloseCard(kind); return null; }
    private object? BeginCardDrag(string kind) { _desktop.BeginCardDrag(kind); return null; }
    private object? ToggleCardPinned(string kind) { _desktop.ToggleCardPinned(kind); return _desktop.GetCardPresentation(kind); }
    private object? MoveCard(string kind, int dx, int dy) { _desktop.MoveCard(kind, dx, dy); return null; }
    private object? ResizeCard(string kind, int width, int height) { _desktop.ResizeCard(kind, width, height); return null; }
    private object? OpenConsole() { _desktop.ShowPlanner(); return null; }
    private object? OpenEdit(JsonElement item)
    {
        _desktop.ShowPlanner();
        ScheduleEventHub.Instance.Publish("event:edit", item.Clone());
        return null;
    }
    private object? OpenExternal(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) throw new InvalidOperationException("无效链接");
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
        return null;
    }

    private object FocusSnapshot()
    {
        var state = _desktop.GetFocusState();
        return new { mode = state.Mode, status = state.Status, remainingSeconds = state.RemainingSeconds, totalSeconds = state.TotalSeconds, presetId = state.PresetId, cycleIndex = state.CycleIndex, customMinutes = state.CustomMinutes, customBreakMinutes = state.CustomBreakMinutes, customLongBreakMinutes = state.CustomLongBreakMinutes, customRounds = state.CustomRounds, label = state.Label, activeEventId = state.ActiveEventId, activeEvent = FocusContext(state.ActiveEventId) };
    }
    private object? FocusContext(string? eventId)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return null;
        var item = _store.GetEvent(eventId);
        if (item == null) return null;
        var sessions = _store.ListFocusSessions(eventId);
        return new
        {
            id = eventId,
            title = item["title"],
            itemType = item["item_type"],
            isCompleted = item["is_completed"],
            startAt = item["start_at"],
            focusCount = sessions.Count,
            focusSeconds = sessions.Sum(session => Convert.ToInt32(session["actual_seconds"]))
        };
    }
    private object? FocusToggle() { _desktop.ToggleFocus(); return null; }
    private object? FocusReset() { _desktop.ResetFocus(); return null; }
    private object? FocusSkip() { _desktop.SkipFocus(); return null; }
    private object? FocusPreset(string id) { _desktop.SetFocusPreset(id); return null; }
    private object? FocusCustom(JsonElement input)
    {
        _desktop.SetFocusCustom(Int(input, "minutes", 45), Int(input, "breakMinutes", 5), Int(input, "longBreakMinutes", 15), Int(input, "rounds", 4));
        return null;
    }
private object? StartFocusForEvent(string? eventId) { _desktop.StartFocusForEvent(eventId); return null; }
    private object? DetachFocusEvent() { _desktop.DetachFocusEvent(); return null; }
    private object? CompleteFocusEvent()
    {
        var eventId = _desktop.GetFocusState().ActiveEventId;
        if (string.IsNullOrWhiteSpace(eventId)) return null;
        return Changed(_store.UpdateEvent(eventId, JsonSerializer.SerializeToElement(new { is_completed = true })));
    }
    private object? OpenFocusEvent()
    {
        var eventId = _desktop.GetFocusState().ActiveEventId;
        if (string.IsNullOrWhiteSpace(eventId)) return null;
        var item = _store.GetEvent(eventId);
        if (item == null) return null;
        _desktop.ShowPlanner();
        ScheduleEventHub.Instance.Publish("event:edit", item);
        return null;
    }
    private static int Int(JsonElement input, string name, int fallback) => input.TryGetProperty(name, out var value) && value.TryGetInt32(out var number) ? number : fallback;
    private static string CardKind(JsonElement[] args) => args.Length > 0 && args[0].ValueKind == JsonValueKind.String ? args[0].GetString() ?? "today" : "today";

    public void Publish(string channel, object? payload) => Post(new { type = "motodo:event", channel, payload });
    private void Post(object message)
    {
        try { _web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message)); }
        catch { }
    }
}