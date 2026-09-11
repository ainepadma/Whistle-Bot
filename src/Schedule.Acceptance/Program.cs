using System.Text.Json;
using Microsoft.Data.Sqlite;
using PetApp.DesktopCards;
using PetApp.Schedule;

namespace Schedule.Acceptance;

internal static class Program
{
    private static string _temporaryRoot = "";
    private static int _passed;

    [STAThread]
    private static int Main()
    {
        _temporaryRoot = Path.Combine(Path.GetTempPath(), "banyao-schedule-acceptance", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_temporaryRoot);

        try
        {
            VerifyScheduleLifecycle();
            VerifyCardLayoutMigration();
            WindowsDataAcceptance.Run(_temporaryRoot, Pass);
            WindowsLayoutAcceptance.Run(Pass);
            WindowsIntegrationAcceptance.Run(Pass);
            Console.WriteLine($"Schedule acceptance: {_passed} passed, 0 failed");
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"Schedule acceptance failed: {exception}");
            return 1;
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            if (Directory.Exists(_temporaryRoot)) Directory.Delete(_temporaryRoot, recursive: true);
        }
    }

    private static void VerifyScheduleLifecycle()
    {
        var store = new ScheduleStore(Path.Combine(_temporaryRoot, "schedule.db"), migrateLegacy: false);
        store.Initialize();

        var now = DateTimeOffset.UtcNow;
        var ordinary = store.CreateEvent(JsonSerializer.SerializeToElement(new
        {
            title = "完整验收日程",
            description = "第五阶段",
            location = "桌面",
            start_at = now.AddMinutes(-1).ToString("O"),
            end_at = now.AddMinutes(30).ToString("O"),
            reminders = new[] { new { minutes = 0 } }
        }));
        var ordinaryId = RequiredId(ordinary);
        Pass(store.GetEvent(ordinaryId)?["title"] as string == "完整验收日程", "CRUD create/read");

        store.ReplaceEventRemindersForEvent(ordinary);
        var pending = store.ListPendingReminders();
        Pass(pending.Count == 1, "Reminder create/pending");
        store.DismissReminder(RequiredId(pending[0]));
        Pass(store.ListPendingReminders().Count == 0, "Reminder dismiss");

        var updated = store.UpdateEvent(ordinaryId, JsonSerializer.SerializeToElement(new { title = "完整验收日程（已更新）" }));
        Pass(updated["title"] as string == "完整验收日程（已更新）", "CRUD update");
        Pass(store.SearchEvents("已更新").Any(item => RequiredId(item) == ordinaryId), "Search");

        var queried = store.QueryEvents(JsonSerializer.SerializeToElement(new
        {
            start = now.AddDays(-1).ToString("O"),
            end = now.AddDays(1).ToString("O")
        }));
        Pass(queried.Any(item => RequiredId(item) == ordinaryId), "Range query");

        store.RecordFocusSession(ordinaryId, 1500, 1490, now);
        var sessions = store.ListFocusSessions(ordinaryId);
        Pass(sessions.Count == 1 && Convert.ToInt32(sessions[0]["actual_seconds"]) == 1490, "Focus linkage");

        var recurringStart = new DateTimeOffset(2030, 1, 2, 9, 0, 0, TimeSpan.Zero);
        var recurring = store.CreateEvent(JsonSerializer.SerializeToElement(new
        {
            title = "重复日程验收",
            start_at = recurringStart.ToString("O"),
            end_at = recurringStart.AddHours(1).ToString("O"),
            rrule_str = "FREQ=DAILY;COUNT=3"
        }));
        var recurringId = RequiredId(recurring);
        var instances = store.QueryEvents(JsonSerializer.SerializeToElement(new
        {
            start = new DateTimeOffset(2030, 1, 1, 0, 0, 0, TimeSpan.Zero).ToString("O"),
            end = new DateTimeOffset(2030, 1, 10, 0, 0, 0, TimeSpan.Zero).ToString("O")
        })).Where(item => item.GetValueOrDefault("recurrence_parent_id") as string == recurringId).ToArray();
        Pass(instances.Length == 3, "Recurrence expansion");

        using var owner = new Form();
        var transfer = new ScheduleTransferService(store, owner);
        var ids = new[] { recurringId };
        using var json = JsonDocument.Parse(transfer.ExportJson(ids));
        var exportedEvents = json.RootElement.GetProperty("events");
        Pass(exportedEvents.GetArrayLength() == 1 && exportedEvents[0].GetProperty("title").GetString() == "重复日程验收", "JSON export");

        var ics = transfer.ExportIcs(ids);
        Pass(ics.Contains($"UID:{recurringId}", StringComparison.Ordinal) &&
             ics.Contains("RRULE:FREQ=DAILY;COUNT=3", StringComparison.Ordinal) &&
             ics.Contains("BEGIN:VEVENT", StringComparison.Ordinal), "ICS export");

        store.RemoveEvent(ordinaryId);
        store.RemoveEvent(recurringId);
        Pass(store.GetEvent(ordinaryId) is null && store.GetEvent(recurringId) is null, "CRUD delete");
    }

    private static void VerifyCardLayoutMigration()
    {
        var path = Path.Combine(_temporaryRoot, "cards.json");
        File.WriteAllText(path, """
            {
              "Version": 3,
              "Cards": {
                "focus": {
                  "Kind": "focus",
                  "X": 120,
                  "Y": 80,
                  "Width": 580,
                  "Height": 348,
                  "Visible": true,
                  "Pinned": true,
                  "AlwaysOnTop": true
                }
              }
            }
            """);

        var store = new CardLayoutStore(path);
        var action = store.Get("next");
        Pass(action.Width == 320 && action.Height == 320 && action.Pinned && action.Visible && action.X == 120 && action.Y == 80,
            "Card layout v3 -> v9 square action-card migration preserves placement and pinning");
        var calendar = store.Get("calendar");
        Pass(calendar.Width == 940 && calendar.Height == 660,
            "Calendar card default layout");

        var legacyPath = Path.Combine(_temporaryRoot, "cards-v6.json");
        File.WriteAllText(legacyPath, """
            {"Version":6,"Cards":{
              "today":{"Kind":"today","Width":352,"Height":320,"X":-1600,"Y":120,"Pinned":true,"Visible":true},
              "next":{"Kind":"next","Width":390,"Height":710,"X":80,"Y":60,"AlwaysOnTop":true},
              "calendar":{"Kind":"calendar","Width":960,"Height":640},
              "manage":{"Kind":"manage","Width":820,"Height":680}}}
            """);
        var migrated = new CardLayoutStore(legacyPath);
        Pass(migrated.Get("today").Width == migrated.Get("next").Width &&
             migrated.Get("today").Height == migrated.Get("next").Height &&
             migrated.Get("today").Width == 320 && migrated.Get("today").Height == 320 &&
             migrated.Get("calendar").Width == 940 && migrated.Get("calendar").Height == 660 &&
             migrated.Get("manage").Width == 720 && migrated.Get("manage").Height == 380,
            "Existing v6 layouts migrate to square compact cards and separate calendar and management sizes");
        var reopened = new CardLayoutStore(legacyPath);
        Pass(reopened.Get("today").X == -1600 && reopened.Get("today").Y == 120 &&
             reopened.Get("today").Pinned && reopened.Get("today").Visible && reopened.Get("next").AlwaysOnTop &&
             reopened.Get("next").Height == 320,
            "Square-card migration survives restart without losing positions or presentation settings");

        var v7Path = Path.Combine(_temporaryRoot, "cards-v7.json");
        File.WriteAllText(v7Path, """
            {"Version":7,"Cards":{
              "today":{"Kind":"today","Width":400,"Height":480,"X":120,"Y":90,"Pinned":true,"Visible":true},
              "next":{"Kind":"next","Width":400,"Height":480,"X":640,"Y":90,"AlwaysOnTop":true}}}
            """);
        var compact = new CardLayoutStore(v7Path);
        Pass(compact.Get("today").Width == 320 && compact.Get("today").Height == 320 &&
             compact.Get("next").Width == 320 && compact.Get("next").Height == 320 &&
             compact.Get("today").X == 120 && compact.Get("today").Pinned && compact.Get("next").AlwaysOnTop,
            "Existing v7 compact cards become square while preserving placement and presentation");

        var v8Path = Path.Combine(_temporaryRoot, "cards-v8.json");
        File.WriteAllText(v8Path, """
            {"Version":8,"Cards":{
              "today":{"Kind":"today","Width":400,"Height":300,"X":-1500,"Y":120,"Pinned":true,"Visible":true},
              "next":{"Kind":"next","Width":400,"Height":300,"X":640,"Y":90,"AlwaysOnTop":true},
              "calendar":{"Kind":"calendar","Width":960,"Height":680},
              "manage":{"Kind":"manage","Width":960,"Height":680}}}
            """);
        var latest = new CardLayoutStore(v8Path);
        Pass(latest.Get("today").Width == 320 && latest.Get("today").Height == 320 &&
             latest.Get("next").Width == 320 && latest.Get("next").Height == 320 &&
             latest.Get("calendar").Width == 940 && latest.Get("calendar").Height == 660 &&
             latest.Get("manage").Width == 720 && latest.Get("manage").Height == 380 &&
             !latest.Get("today").ManualSize && latest.Get("today").X == -1500 &&
             latest.Get("today").Pinned && latest.Get("today").Visible && latest.Get("next").AlwaysOnTop,
            "Existing v8 fixed sizes migrate once to v9 defaults with placement and pinning intact");

        var manuallySized = latest.Get("next");
        manuallySized.Width = 450;
        manuallySized.Height = 370;
        manuallySized.ManualSize = true;
        latest.Save(manuallySized);
        var remembered = new CardLayoutStore(v8Path).Get("next");
        Pass(remembered.Width == 450 && remembered.Height == 370 && remembered.ManualSize &&
             remembered.X == 640 && remembered.Y == 90 && remembered.AlwaysOnTop,
            "Manual width and height survive v9 reopen without being replaced by default dimensions");
    }

    private static string RequiredId(IReadOnlyDictionary<string, object?> item) =>
        item.TryGetValue("id", out var id) && id is string value && value.Length > 0
            ? value
            : throw new InvalidOperationException("验收数据缺少 id");

    private static void Pass(bool condition, string name)
    {
        if (!condition) throw new InvalidOperationException($"FAIL {name}");
        _passed++;
        Console.WriteLine($"PASS {name}");
    }
}
