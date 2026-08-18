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
        return result.OrderBy(x => (string)x["start_at"]!).ToArray();
    }

    private static IEnumerable<Dictionary<string, object?>> ExpandOne(
        Dictionary<string, object?> root, string rrule, DateTimeOffset rangeStart, DateTimeOffset rangeEnd)
    {
        if (!DateTimeOffset.TryParse((string)root["start_at"]!, out var occurrence) ||
            !DateTimeOffset.TryParse((string)root["end_at"]!, out var originalEnd)) yield break;
        var rule = ParseRRule(rrule);
        if (!rule.TryGetValue("FREQ", out var frequency))
        {
            if (Intersects(occurrence, originalEnd, rangeStart, rangeEnd)) yield return root;
            yield break;
        }
        frequency = frequency.ToUpperInvariant();
        var interval = ParsePositive(rule, "INTERVAL", 1);
        var maxCount = ParsePositive(rule, "COUNT", int.MaxValue);
        var until = ParseUntil(rule.GetValueOrDefault("UNTIL"));
        var excludedDates = ReadExcludedDates(root["exdates"]);
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
            if (!valid && frequency is not ("DAILY" or "WEEKLY" or "MONTHLY" or "YEARLY")) yield break;
            if (until.HasValue && occurrence > until.Value) yield break;
            if (valid)
            {
                emitted++;
                if (Intersects(occurrence, occurrence + duration, rangeStart, rangeEnd) && !excludedDates.Contains(occurrence.Date))
                    yield return CreateOccurrence(root, occurrence, duration);
            }

            occurrence = frequency switch
            {
                "DAILY" => occurrence.AddDays(interval),
                "WEEKLY" => occurrence.AddDays(1),
                "MONTHLY" => NextMonth(occurrence, interval, monthDay),
                "YEARLY" => occurrence.AddYears(interval),
                _ => rangeEnd
            };
        }


    }

    private static Dictionary<string, object?> CreateOccurrence(Dictionary<string, object?> root, DateTimeOffset start, TimeSpan duration)
    {
        var occurrence = new Dictionary<string, object?>(root)
        {
            ["id"] = root["id"] + "@" + start.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture),
            ["recurrence_parent_id"] = root["id"],
            ["start_at"] = start.ToString("O"),
            ["end_at"] = start.Add(duration).ToString("O")
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

    private static DateTimeOffset? ParseUntil(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateTimeOffset.TryParseExact(value, "yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var exact)) return exact;
        if (DateOnly.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return new DateTimeOffset(date.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);
        return DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;
    }

    private static HashSet<DateTime> ReadExcludedDates(object? value)
    {
        var dates = new HashSet<DateTime>();
        if (value is not JsonElement json || json.ValueKind != JsonValueKind.Array) return dates;
        foreach (var item in json.EnumerateArray())
            if (item.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(item.GetString(), out var date)) dates.Add(date.Date);
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


