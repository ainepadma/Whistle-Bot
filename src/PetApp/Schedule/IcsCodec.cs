using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PetApp.Schedule;

/// <summary>iCalendar conversion without file dialogs or access to user data.</summary>
internal static class IcsCodec
{
    private sealed record Property(string Name, string Value, Dictionary<string, string> Parameters);

    internal static IReadOnlyList<JsonElement> Parse(string text)
    {
        var result = new List<JsonElement>();
        List<Property>? fields = null;
        List<Property>? alarm = null;
        var alarms = new List<List<Property>>();
        foreach (var line in Unfold(text))
        {
            if (line.Equals("BEGIN:VEVENT", StringComparison.OrdinalIgnoreCase))
            {
                if (fields != null) throw new InvalidOperationException("ICS 日程嵌套格式无效");
                fields = []; alarms = []; continue;
            }
            if (fields == null) continue;
            if (line.Equals("BEGIN:VALARM", StringComparison.OrdinalIgnoreCase)) { alarm = []; continue; }
            if (line.Equals("END:VALARM", StringComparison.OrdinalIgnoreCase))
            {
                if (alarm != null) alarms.Add(alarm);
                alarm = null; continue;
            }
            if (line.Equals("END:VEVENT", StringComparison.OrdinalIgnoreCase))
            {
                if (alarm != null) throw new InvalidOperationException("ICS 提醒缺少结束标记");
                result.Add(ParseEvent(fields, alarms)); fields = null; continue;
            }
            var property = ReadProperty(line);
            if (property != null) (alarm ?? fields).Add(property);
        }
        if (fields != null) throw new InvalidOperationException("ICS 日程缺少结束标记");
        return result;
    }

    private static JsonElement ParseEvent(List<Property> fields, List<List<Property>> alarms)
    {
        Property? Find(string name) => fields.FirstOrDefault(p => p.Name == name);
        var start = Find("DTSTART") ?? throw new InvalidOperationException("ICS 日程缺少 DTSTART");
        var allDay = IsDate(start);
        var startAt = ParseTime(start);
        var end = Find("DTEND");
        if (end != null && IsDate(end) != allDay) throw new InvalidOperationException("ICS 起止时间的日期类型不一致");
        var endAt = end != null ? ParseTime(end)
            : Find("DURATION") is { } duration ? startAt + ParseDuration(duration.Value)
            : allDay ? AtLocalTime(startAt.DateTime.AddDays(1), TimeZoneInfo.Local) : startAt.AddHours(1);
        if (endAt <= startAt) throw new InvalidOperationException("ICS 结束时间必须晚于开始时间");
        // Existing planner data uses the last included instant for an all-day end.
        // iCalendar uses the following date (exclusive); convert exactly once.
        if (allDay) endAt = endAt.AddMilliseconds(-1);
        var exdates = fields.Where(p => p.Name == "EXDATE")
            .SelectMany(p => p.Value.Split(',').Select(value => ParseTime(p with { Value = value }).ToString("O"))).ToArray();
        var reminders = new HashSet<int>();
        foreach (var entries in alarms)
        {
            var trigger = entries.FirstOrDefault(p => p.Name == "TRIGGER")
                ?? throw new InvalidOperationException("ICS 提醒缺少 TRIGGER");
            if (entries.Any(p => p.Name == "REPEAT")) throw new InvalidOperationException("暂不支持循环闹铃，请先转换为普通提前提醒");
            var action = entries.FirstOrDefault(p => p.Name == "ACTION")?.Value;
            if (action != null && action is not ("DISPLAY" or "AUDIO"))
                throw new InvalidOperationException($"暂不支持 ICS 提醒方式：{action}");
            var absolute = trigger.Parameters.GetValueOrDefault("VALUE")?.Equals("DATE-TIME", StringComparison.OrdinalIgnoreCase) == true;
            var anchor = trigger.Parameters.GetValueOrDefault("RELATED")?.Equals("END", StringComparison.OrdinalIgnoreCase) == true
                ? (allDay ? endAt.AddMilliseconds(1) : endAt) : startAt;
            var instant = absolute ? ParseTime(trigger) : anchor + ParseDuration(trigger.Value);
            var minutes = (startAt - instant).TotalMinutes;
            if (minutes < 0 || minutes > 10080 || Math.Abs(minutes - Math.Round(minutes)) > 0.000001)
                throw new InvalidOperationException("ICS 提醒必须为开始前 0 到 10080 个整分钟，未导入此文件");
            reminders.Add((int)Math.Round(minutes));
        }
        var timezone = allDay ? TimeZoneInfo.Local.Id
            : start.Parameters.GetValueOrDefault("TZID") ?? (start.Value.EndsWith('Z') ? "UTC" : TimeZoneInfo.Local.Id);
        var title = Unescape(Find("SUMMARY")?.Value ?? "").Trim();
        return JsonSerializer.SerializeToElement(new Dictionary<string, object?>
        {
            ["calendar_id"] = "default", ["title"] = title.Length == 0 ? "未命名日程" : title,
            ["description"] = Unescape(Find("DESCRIPTION")?.Value ?? ""), ["location"] = Unescape(Find("LOCATION")?.Value ?? ""),
            ["start_at"] = startAt.ToString("O"), ["end_at"] = endAt.ToString("O"), ["is_all_day"] = allDay,
            ["timezone"] = timezone, ["rrule_str"] = Find("RRULE")?.Value, ["exdates"] = exdates,
            ["reminders"] = reminders.Order().Select(minutes => new { minutes }).ToArray(),
            ["status"] = (Find("STATUS")?.Value ?? "confirmed").ToLowerInvariant(), ["item_type"] = "plan"
        });
    }

    internal static string Export(IReadOnlyList<Dictionary<string, object?>> events)
    {
        var lines = new List<string> { "BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "PRODID:-//BanyaoPet//Schedule//ZH" };
        foreach (var item in events)
        {
            var allDay = (bool)item["is_all_day"]!;
            var zoneId = item.GetValueOrDefault("timezone") as string;
            var zone = string.IsNullOrWhiteSpace(zoneId) ? TimeZoneInfo.Local : ResolveZone(zoneId);
            var parameter = allDay ? ";VALUE=DATE" : zone.Equals(TimeZoneInfo.Utc) ? "" : ";TZID=" + zone.Id;
            string Time(string iso, bool end = false)
            {
                var value = DateTimeOffset.Parse(iso, CultureInfo.InvariantCulture);
                if (allDay)
                {
                    var local = TimeZoneInfo.ConvertTime(value, zone).DateTime;
                    // Also accept an explicitly exclusive midnight from JSON imports.
                    var date = local.Date.AddDays(end && local.TimeOfDay != TimeSpan.Zero ? 1 : 0);
                    return date.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
                }
                return zone.Equals(TimeZoneInfo.Utc)
                    ? value.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture)
                    : TimeZoneInfo.ConvertTime(value, zone).ToString("yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture);
            }
            lines.AddRange(["BEGIN:VEVENT", "UID:" + item["id"], "DTSTAMP:" + DateTime.UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture),
                "DTSTART" + parameter + ":" + Time((string)item["start_at"]!),
                "DTEND" + parameter + ":" + Time((string)item["end_at"]!, true), "SUMMARY:" + Escape((string)item["title"]!)]);
            foreach (var field in new[] { "description", "location" })
                if (item[field] is string value && value.Length > 0) lines.Add(field.ToUpperInvariant() + ":" + Escape(value));
            if (item["rrule_str"] is string rule && !string.IsNullOrWhiteSpace(rule)) lines.Add("RRULE:" + rule);
            if (item["exdates"] is JsonElement excluded && excluded.ValueKind == JsonValueKind.Array)
            {
                var dates = excluded.EnumerateArray().Select(p => Time(p.GetString()!)).ToArray();
                if (dates.Length > 0) lines.Add("EXDATE" + parameter + ":" + string.Join(',', dates));
            }
            if (item["reminders"] is JsonElement reminders && reminders.ValueKind == JsonValueKind.Array)
                foreach (var reminder in reminders.EnumerateArray())
                    lines.AddRange(["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + Escape((string)item["title"]!),
                        "TRIGGER:-PT" + reminder.GetProperty("minutes").GetInt32().ToString(CultureInfo.InvariantCulture) + "M", "END:VALARM"]);
            lines.Add("STATUS:" + ((string)item["status"]!).ToUpperInvariant());
            lines.Add("END:VEVENT");
        }
        lines.Add("END:VCALENDAR");
        return string.Concat(lines.Select(line => Fold(line) + "\r\n"));
    }

    internal static TimeZoneInfo ResolveZone(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        { throw new InvalidOperationException($"无法识别日程时区：{id}，请先转换为 UTC 后导入", ex); }
    }

    internal static DateTimeOffset AtLocalTime(DateTime value, TimeZoneInfo zone)
    {
        value = DateTime.SpecifyKind(value, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(value)) throw new InvalidOperationException($"日程时间位于夏令时跳过的时段：{value:yyyy-MM-dd HH:mm}");
        // RFC 5545 chooses the first occurrence when a local time repeats.
        var offset = zone.IsAmbiguousTime(value) ? zone.GetAmbiguousTimeOffsets(value).Max() : zone.GetUtcOffset(value);
        return new DateTimeOffset(value, offset);
    }

    private static DateTimeOffset ParseTime(Property property)
    {
        var value = property.Value;
        if (IsDate(property)) return AtLocalTime(DateTime.ParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture), TimeZoneInfo.Local);
        if (value.EndsWith('Z')) return DateTimeOffset.ParseExact(value, "yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);
        var zone = property.Parameters.TryGetValue("TZID", out var id) ? ResolveZone(id) : TimeZoneInfo.Local;
        return AtLocalTime(DateTime.ParseExact(value, "yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture), zone);
    }

    private static bool IsDate(Property p) => p.Parameters.GetValueOrDefault("VALUE")?.Equals("DATE", StringComparison.OrdinalIgnoreCase) == true || p.Value.Length == 8;
    private static TimeSpan ParseDuration(string value)
    {
        var match = Regex.Match(value, @"^(?<sign>[+-])?P(?:(?<weeks>\d+)W)?(?:(?<days>\d+)D)?(?:T(?:(?<hours>\d+)H)?(?:(?<minutes>\d+)M)?(?:(?<seconds>\d+)S)?)?$", RegexOptions.IgnoreCase);
        if (!match.Success || !new[] { "weeks", "days", "hours", "minutes", "seconds" }.Any(k => match.Groups[k].Success))
            throw new InvalidOperationException("ICS 时长格式无效");
        double Number(string key) => match.Groups[key].Success ? double.Parse(match.Groups[key].Value, CultureInfo.InvariantCulture) : 0;
        var seconds = Number("weeks") * 604800 + Number("days") * 86400 + Number("hours") * 3600 + Number("minutes") * 60 + Number("seconds");
        return TimeSpan.FromSeconds(match.Groups["sign"].Value == "-" ? -seconds : seconds);
    }

    private static Property? ReadProperty(string line)
    {
        var quoted = false; var colon = -1;
        for (var i = 0; i < line.Length; i++)
        {
            if (line[i] == '"') quoted = !quoted;
            if (line[i] == ':' && !quoted) { colon = i; break; }
        }
        if (colon <= 0) return null;
        var segments = line[..colon].Split(';');
        var parameters = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var segment in segments.Skip(1))
        {
            var pair = segment.Split('=', 2);
            if (pair.Length == 2) parameters[pair[0]] = pair[1].Trim('"');
        }
        return new Property(segments[0].ToUpperInvariant(), line[(colon + 1)..], parameters);
    }

    private static IEnumerable<string> Unfold(string text)
    {
        string? current = null;
        foreach (var line in text.Replace("\r\n", "\n").Split('\n'))
        {
            if ((line.StartsWith(' ') || line.StartsWith('\t')) && current != null) { current += line[1..]; continue; }
            if (current != null) yield return current;
            current = line.TrimStart('\uFEFF');
        }
        if (current != null) yield return current;
    }

    private static string Escape(string value) => value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r\n", "\\n").Replace("\n", "\\n").Replace("\r", "\\n");
    private static string Unescape(string value) => Regex.Replace(value, @"\\([nN,;\\])", m => m.Groups[1].Value is "n" or "N" ? "\n" : m.Groups[1].Value);
    private static string Fold(string line)
    {
        var result = new StringBuilder(); var bytes = 0;
        foreach (var rune in line.EnumerateRunes())
        {
            if (bytes + rune.Utf8SequenceLength > 75) { result.Append("\r\n "); bytes = 1; }
            result.Append(rune.ToString()); bytes += rune.Utf8SequenceLength;
        }
        return result.ToString();
    }
}
