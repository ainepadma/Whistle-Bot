using System.Globalization;
using System.Text.Json;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    private static IReadOnlyList<Dictionary<string, object?>> ExpandRecurringEvents(
        IReadOnlyList<Dictionary<string, object?>> events, string rangeStart, string rangeEnd)
    {
        if (!DateTimeOffset.TryParse(rangeStart, out var start) || !DateTimeOffset.TryParse(rangeEnd, out var end))
            throw new InvalidOperationException("查询时间范围无效");

        var result = new List<Dictionary<string, object?>>();
        foreach (var item in events)
        {
            if (item["rrule_str"] is not string rule || string.IsNullOrWhiteSpace(rule))
            {
                result.Add(item);
                continue;
            }
            result.AddRange(ExpandOne(item, rule, start, end));
        }
        return result.OrderBy(x => DateTimeOffset.Parse((string)x["start_at"]!, CultureInfo.InvariantCulture)).ToArray();
    }

    private static IEnumerable<Dictionary<string, object?>> ExpandOne(
        Dictionary<string, object?> root, string rrule, DateTimeOffset rangeStart, DateTimeOffset rangeEnd)
    {
        if (!DateTimeOffset.TryParse((string)root["start_at"]!, out var occurrence) ||
            !DateTimeOffset.TryParse((string)root["end_at"]!, out var originalEnd)) yield break;
        TimeZoneInfo? zone = null;
        if (root.GetValueOrDefault("timezone") is string zoneId && !string.IsNullOrWhiteSpace(zoneId))
        {
            try { zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId); }
            catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { }
        }
        if (zone != null)
        {
            occurrence = TimeZoneInfo.ConvertTime(occurrence, zone);
            originalEnd = TimeZoneInfo.ConvertTime(originalEnd, zone);
        }
        var rule = ParseRRule(rrule);
        if (!rule.TryGetValue("FREQ", out var frequency))
        {
            if (Intersects(occurrence, originalEnd, rangeStart, rangeEnd)) yield return root;
            yield break;
        }
        frequency = frequency.ToUpperInvariant();
        var interval = ParsePositive(rule, "INTERVAL", 1);
        var maxCount = ParsePositive(rule, "COUNT", int.MaxValue);
        var until = ParseUntil(rule.GetValueOrDefault("UNTIL"), zone, occurrence.Offset);
        var excludedDates = ReadExcludedDates(root["exdates"], zone);
        var duration = originalEnd - occurrence;
        var rootStart = occurrence;
        var weekdaySet = ReadWeekdays(rule.GetValueOrDefault("BYDAY"), occurrence.DayOfWeek);
        var monthDay = ParsePositive(rule, "BYMONTHDAY", occurrence.Day);
        var emitted = 0;

        // The upper limit protects the host against malformed unbounded rules while
        // still covering daily recurrences for more than a century.
        for (var guard = 0; guard < 50000 && emitted < maxCount && occurrence < rangeEnd; guard++)
        {
            var valid = frequency switch
            {
                "DAILY" => true,
                "WEEKLY" => weekdaySet.Contains(occurrence.DayOfWeek) && WeeksSince(rootStart, occurrence) % interval == 0,
                "MONTHLY" => occurrence.Day == monthDay,
                "YEARLY" => true,
                _ => false
            };
            if (zone?.IsInvalidTime(occurrence.DateTime) == true) valid = false;
            if (!valid && frequency is not ("DAILY" or "WEEKLY" or "MONTHLY" or "YEARLY")) yield break;
            if (until.HasValue && occurrence > until.Value) yield break;
            if (valid)
            {
                emitted++;
                var instance = CreateOccurrence(root, occurrence, duration, zone);
                var end = DateTimeOffset.Parse((string)instance["end_at"]!, CultureInfo.InvariantCulture);
                if (Intersects(occurrence, end, rangeStart, rangeEnd) && !excludedDates.Contains(occurrence.Date))
                    yield return instance;
            }

            occurrence = frequency switch
            {
                "DAILY" => occurrence.AddDays(interval),
                "WEEKLY" => occurrence.AddDays(1),
                "MONTHLY" => NextMonth(occurrence, interval, monthDay),
                "YEARLY" => occurrence.AddYears(interval),
                _ => rangeEnd
            };
            // Repeat at the same local clock time across daylight-saving changes.
            if (zone != null)
            {
                var wallTime = occurrence.DateTime;
                var offset = zone.IsAmbiguousTime(wallTime) ? zone.GetAmbiguousTimeOffsets(wallTime).Max() : zone.GetUtcOffset(wallTime);
                occurrence = new DateTimeOffset(wallTime, offset);
            }
        }


    }

    private static Dictionary<string, object?> CreateOccurrence(Dictionary<string, object?> root, DateTimeOffset start, TimeSpan duration, TimeZoneInfo? zone)
    {
        var end = start.Add(duration);
        if (root.GetValueOrDefault("is_all_day") is true && zone != null)
        {
            var rootStart = TimeZoneInfo.ConvertTime(DateTimeOffset.Parse((string)root["start_at"]!), zone);
            var rootEnd = TimeZoneInfo.ConvertTime(DateTimeOffset.Parse((string)root["end_at"]!), zone);
            end = IcsCodec.AtLocalTime(start.DateTime + (rootEnd.DateTime - rootStart.DateTime), zone);
        }
        var occurrence = new Dictionary<string, object?>(root)
        {
            ["id"] = root["id"] + "@" + start.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture),
            ["recurrence_parent_id"] = root["id"],
            ["start_at"] = start.ToString("O"),
            ["end_at"] = end.ToString("O")
        };
        return occurrence;
    }

    private static Dictionary<string, string> ParseRRule(string raw) => raw.Trim()
        .Replace("RRULE:", "", StringComparison.OrdinalIgnoreCase)
        .Split(';', StringSplitOptions.RemoveEmptyEntries)
        .Select(part => part.Split('=', 2))
        .Where(pair => pair.Length == 2)
        .ToDictionary(pair => pair[0].Trim().ToUpperInvariant(), pair => pair[1].Trim(), StringComparer.OrdinalIgnoreCase);

    private static int ParsePositive(IReadOnlyDictionary<string, string> rule, string key, int fallback) =>
        rule.TryGetValue(key, out var text) && int.TryParse(text, out var value) && value > 0 ? value : fallback;

    private static DateTimeOffset? ParseUntil(string? value, TimeZoneInfo? zone, TimeSpan offset)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateTimeOffset.TryParseExact(value, "yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var exact)) return exact;
        if (DateOnly.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return zone == null ? new DateTimeOffset(date.ToDateTime(TimeOnly.MaxValue), offset)
                : IcsCodec.AtLocalTime(date.ToDateTime(TimeOnly.MaxValue), zone);
        return DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;
    }

    private static HashSet<DateTime> ReadExcludedDates(object? value, TimeZoneInfo? zone)
    {
        var dates = new HashSet<DateTime>();
        if (value is not JsonElement json || json.ValueKind != JsonValueKind.Array) return dates;
        foreach (var item in json.EnumerateArray())
            if (item.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(item.GetString(), out var date))
                dates.Add(zone == null ? date.Date : TimeZoneInfo.ConvertTime(date, zone).Date);
        return dates;
    }

    private static HashSet<DayOfWeek> ReadWeekdays(string? value, DayOfWeek fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return [fallback];
        var map = new Dictionary<string, DayOfWeek>(StringComparer.OrdinalIgnoreCase)
        {
            ["SU"] = DayOfWeek.Sunday, ["MO"] = DayOfWeek.Monday, ["TU"] = DayOfWeek.Tuesday, ["WE"] = DayOfWeek.Wednesday,
            ["TH"] = DayOfWeek.Thursday, ["FR"] = DayOfWeek.Friday, ["SA"] = DayOfWeek.Saturday
        };
        return value.Split(',', StringSplitOptions.RemoveEmptyEntries).Where(map.ContainsKey).Select(day => map[day]).ToHashSet();
    }

    private static int WeeksSince(DateTimeOffset first, DateTimeOffset occurrence) => Math.Max(0, (int)((occurrence.Date - first.Date).TotalDays / 7));
    private static DateTimeOffset NextMonth(DateTimeOffset value, int interval, int day)
    {
        var target = value.AddMonths(interval);
        var actualDay = Math.Min(day, DateTime.DaysInMonth(target.Year, target.Month));
        return new DateTimeOffset(target.Year, target.Month, actualDay, target.Hour, target.Minute, target.Second, target.Offset);
    }
    private static bool Intersects(DateTimeOffset start, DateTimeOffset end, DateTimeOffset rangeStart, DateTimeOffset rangeEnd) => start < rangeEnd && end > rangeStart;
}


