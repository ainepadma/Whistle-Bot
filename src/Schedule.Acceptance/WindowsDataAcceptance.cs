using System.Text;
using System.Text.Json;
using PetApp;
using PetApp.Schedule;

namespace Schedule.Acceptance;

internal static class WindowsDataAcceptance
{
    internal static void Run(string directory, Action<bool, string> pass)
    {
        var store = new ScheduleStore(Path.Combine(directory, "windows-regressions.db"), migrateLegacy: false);
        store.Initialize();
        JsonElement Json(object item) => JsonSerializer.SerializeToElement(item);
        var recurring = store.CreateEvent(Json(new
        {
            title = "repeat", start_at = "2026-09-07T09:00:00Z", end_at = "2026-09-07T10:00:00Z", rrule_str = "FREQ=DAILY"
        }));
        var query = Json(new { start = "2000-01-01T00:00:00Z", end = "2100-01-01T00:00:00Z", expand = false });
        var roots = store.QueryEvents(query);
        pass(roots.Count == 1 && (string)roots[0]["id"]! == (string)recurring["id"]!, "Management query returns one editable recurrence root");
        var id = (string)roots[0]["id"]!;
        store.UpdateEvent(id, Json(new { title = "edited root" }));
        pass(store.GetEvent(id)?["title"] as string == "edited root", "Management recurrence edit persists");
        store.RemoveEvent(id);
        pass(store.QueryEvents(query).Count == 0, "Management recurrence removal deletes the series");

        store.CreateEvent(Json(new { title = "offset", start_at = "2026-09-07T23:00:00+08:00", end_at = "2026-09-07T23:30:00+08:00" }));
        var matches = store.QueryEvents(Json(new { start = "2026-09-06T16:00:00.000Z", end = "2026-09-07T16:00:00.000Z" }));
        pass(matches.Count == 1, "UTC day query includes equivalent offset timestamps");
        var after = store.QueryEvents(Json(new { start = "2026-09-07T15:30:00Z", end = "2026-09-07T16:30:00Z" }));
        pass(after.Count == 0, "Date query keeps the exclusive end boundary");

        using var owner = new Form();
        var transfer = new ScheduleTransferService(store, owner);
        const string allDay = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260907\r\nDTEND;VALUE=DATE:20260908\r\nSUMMARY:单日\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        var parsed = IcsCodec.Parse(allDay).Single();
        var start = DateTimeOffset.Parse(parsed.GetProperty("start_at").GetString()!);
        var end = DateTimeOffset.Parse(parsed.GetProperty("end_at").GetString()!);
        pass(start.LocalDateTime == new DateTime(2026, 9, 7) && end.LocalDateTime.Date == start.LocalDateTime.Date,
            "ICS single-day import stays on the intended local date");
        transfer.ImportIcsContent(allDay);
        var singleDay = store.SearchEvents("单日").Single();
        var exported = transfer.ExportIcs([(string)singleDay["id"]!]);
        pass(exported.Contains("DTSTART;VALUE=DATE:20260907") && exported.Contains("DTEND;VALUE=DATE:20260908"),
            "ICS single-day round trip does not add a day");
        pass(IcsCodec.Parse(exported).Single().GetProperty("end_at").GetString() == parsed.GetProperty("end_at").GetString(),
            "ICS repeated round trips retain the all-day endpoint");

        var multiDay = IcsCodec.Parse(allDay.Replace("20260908", "20260910")).Single();
        pass(DateTimeOffset.Parse(multiDay.GetProperty("end_at").GetString()!).LocalDateTime.Date == new DateTime(2026, 9, 9),
            "ICS multi-day import excludes DTEND's date");

        const string zoned = """
            BEGIN:VCALENDAR
            BEGIN:VEVENT
            DTSTART;TZID=America/New_York:20261031T090000
            DTEND;TZID=America/New_York:20261031T100000
            RRULE:FREQ=DAILY;COUNT=3
            EXDATE;TZID=America/New_York:20261101T090000
            SUMMARY:纽约会议
            BEGIN:VALARM
            ACTION:DISPLAY
            DESCRIPTION:不要覆盖日程标题
            TRIGGER:-PT15M
            END:VALARM
            BEGIN:VALARM
            ACTION:DISPLAY
            TRIGGER:PT0M
            END:VALARM
            END:VEVENT
            END:VCALENDAR
            """;
        var timed = IcsCodec.Parse(zoned).Single();
        pass(DateTimeOffset.Parse(timed.GetProperty("start_at").GetString()!).UtcDateTime == new DateTime(2026, 10, 31, 13, 0, 0),
            "ICS TZID converts New York time to the correct instant");
        pass(timed.GetProperty("title").GetString() == "纽约会议" && timed.GetProperty("description").GetString() == "" &&
             timed.GetProperty("reminders").GetArrayLength() == 2 && timed.GetProperty("exdates").GetArrayLength() == 1,
            "ICS nested alarms preserve event fields, zero-minute reminders and EXDATE");
        transfer.ImportIcsContent(zoned);
        var timedRoot = store.SearchEvents("纽约会议").Single();
        var roundTrip = IcsCodec.Parse(transfer.ExportIcs([(string)timedRoot["id"]!])).Single();
        pass(roundTrip.GetProperty("reminders").GetArrayLength() == 2 && roundTrip.GetProperty("exdates").GetArrayLength() == 1 &&
             DateTimeOffset.Parse(roundTrip.GetProperty("start_at").GetString()!) == DateTimeOffset.Parse(timed.GetProperty("start_at").GetString()!),
            "ICS round trip retains reminders, exclusions and clock instant");
        var instances = store.QueryEvents(Json(new { start = "2026-10-30T00:00:00Z", end = "2026-11-04T00:00:00Z" }));
        pass(instances.Count == 2 && DateTimeOffset.Parse((string)instances[1]["start_at"]!).UtcDateTime == new DateTime(2026, 11, 2, 14, 0, 0),
            "Recurring local clock time survives DST while excluded occurrence stays absent");

        var daylightStore = new ScheduleStore(Path.Combine(directory, "daylight.db"), migrateLegacy: false);
        daylightStore.Initialize();
        daylightStore.CreateEvent(Json(new { title = "spring day", start_at = "2026-03-08T00:00:00-05:00", end_at = "2026-03-08T23:59:59.999-04:00",
            timezone = "America/New_York", is_all_day = true, rrule_str = "FREQ=DAILY" }));
        var lateAutumn = daylightStore.QueryEvents(Json(new { start = "2026-11-01T23:15:00-05:00", end = "2026-11-01T23:30:00-05:00" }));
        pass(lateAutumn.Count == 1, "All-day recurrence query includes late hours after a DST change");
        var nextSpringDay = daylightStore.QueryEvents(Json(new { start = "2026-03-09T00:15:00-04:00", end = "2026-03-09T00:30:00-04:00" }));
        pass(nextSpringDay.Count == 1 && DateTimeOffset.Parse((string)nextSpringDay[0]["start_at"]!).Day == 9,
            "All-day recurrence never leaks into the next date across DST");
        var until = daylightStore.CreateEvent(Json(new { title = "until", start_at = "2026-09-07T00:00:00+08:00", end_at = "2026-09-07T23:59:59+08:00",
            timezone = "Asia/Shanghai", is_all_day = true, rrule_str = "FREQ=DAILY;UNTIL=20260907" }));
        var untilMatches = daylightStore.QueryEvents(Json(new { start = "2026-09-06T00:00:00Z", end = "2026-09-10T00:00:00Z" }))
            .Where(item => (string)item["recurrence_parent_id"]! == (string)until["id"]!).ToArray();
        pass(untilMatches.Length == 1, "Date-only recurrence UNTIL uses the event's local date");
        pass(IcsCodec.Parse(allDay.Replace("SUMMARY:单日", "SUMMARY:  ")).Single().GetProperty("title").GetString() == "未命名日程",
            "Empty optional ICS summary receives a valid title before persistence");

        var beforeInvalidImport = store.ListEventsForTransfer([]).Count;
        var rejected = false;
        try { transfer.ImportIcsContent(allDay + zoned.Replace("America/New_York", "Unknown/Zone")); }
        catch (InvalidOperationException) { rejected = true; }
        pass(rejected && store.ListEventsForTransfer([]).Count == beforeInvalidImport,
            "Unsupported time zone rejects the file before importing any events");

        var longTitle = string.Concat(Enumerable.Repeat("日程，说明；", 30)) + "\\literal\\n";
        store.UpdateEvent((string)timedRoot["id"]!, Json(new { title = longTitle }));
        var folded = transfer.ExportIcs([(string)timedRoot["id"]!]);
        pass(folded.Split("\r\n").All(line => Encoding.UTF8.GetByteCount(line) <= 75) &&
             IcsCodec.Parse(folded).Single().GetProperty("title").GetString() == longTitle,
            "ICS UTF-8 folding and escaped text round trip without corruption");

        pass(NativeInput.IdleSeconds(0x1000003E8UL, 1000) == 0 && NativeInput.IdleSeconds(0x1000003E8UL, uint.MaxValue - 999) == 2,
            "Windows idle detection handles 32-bit boot tick rollover");

        var guideDirectory = Path.Combine(directory, "guide-state");
        pass(GuideState.ShouldShow(guideDirectory), "Welcome guide is enabled before its first successful display");
        GuideState.MarkSeen(guideDirectory);
        pass(!GuideState.ShouldShow(guideDirectory) &&
             File.ReadAllText(Path.Combine(guideDirectory, "welcome-guide.seen")) == GuideState.CurrentRevision,
            "Welcome guide marker prevents repeat startup display without changing appearance settings");
        File.WriteAllText(Path.Combine(guideDirectory, "welcome-guide.seen"), "Preview v1.3.0");
        pass(GuideState.ShouldShow(guideDirectory),
            "Updated welcome guide is shown once to users of the earlier preview build");
    }
}
