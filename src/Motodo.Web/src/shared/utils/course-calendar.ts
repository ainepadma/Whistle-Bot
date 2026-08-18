import dayjs from 'dayjs'
import type { Course } from '../types/course'
import type { Semester } from '../types/semester'
import type { Event, DateRange } from '../types/event'

/**
 * 将活跃学期 + 课程时段展开为日历实例
 * - 每个 slot 的 weeks 为空时表示全学期
 * - 按学期起始日 + 周次 + 星期计算日期，按学期课时表取起止时间
 */
export function buildCourseInstances(
    semester: Semester,
    courses: Course[],
    range: DateRange
): Event[] {
    const result: Event[] = []
    const rangeStart = dayjs(range.start)
    const rangeEnd = dayjs(range.end)
    const semesterStart = dayjs(semester.start_date)
    const specialWeeks = semester.special_weeks ?? {}
    const periodsByNumber = new Map(
        (semester.periods ?? []).map((p) => [p.period, p] as const)
    )

    for (const course of courses) {
        for (const slot of course.slots) {
            const weeks =
                slot.weeks.length > 0
                    ? slot.weeks
                    : Array.from({ length: semester.weeks }, (_, i) => i + 1)

            for (const week of weeks) {
                // 考试周 / 假期不上课
                if (specialWeeks[week]) continue

                const date = semesterStart.add(
                    (week - 1) * 7 + (slot.weekday - 1),
                    'day'
                )
                if (date.isBefore(rangeStart, 'day') || date.isAfter(rangeEnd, 'day')) continue

                for (const periodNo of slot.periods) {
                    const period = periodsByNumber.get(periodNo)
                    if (!period) continue

                    const dayStr = date.format('YYYY-MM-DD')
                    result.push({
                        id: `course:${course.id}:${week}:${slot.weekday}:${periodNo}`,
                        calendar_id: course.semester_id,
                        title: course.name,
                        description: '',
                        location: course.location || '',
                        start_at: `${dayStr}T${period.start}:00`,
                        end_at: `${dayStr}T${period.end}:00`,
                        is_all_day: false,
                        timezone: 'Asia/Shanghai',
                        rrule_str: null,
                        exdates: [],
                        reminders: [],
                        priority: 0,
                        status: 'confirmed',
                        is_course: true,
                        color: course.color,
                        created_at: '',
                        updated_at: ''
                    })
                }
            }
        }
    }

    return result.sort((a, b) => a.start_at.localeCompare(b.start_at))
}
