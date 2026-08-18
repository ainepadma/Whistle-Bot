import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'

export const DEFAULT_SNAP_MIN = 5
export const MIN_RESIZE_MIN = 30
export const CLICK_THRESHOLD_PX = 4

/** 将分钟数吸附到最近的整格（默认 5 分钟） */
export function snapMinute(min: number, snap = DEFAULT_SNAP_MIN): number {
    return Math.round(min / snap) * snap
}

/**
 * 由指针 Y 坐标换算为时间轴上的绝对分钟数（已吸附）。
 * 返回的 rawMin 可能超过 1440（跨午夜窗口的次日凌晨）。
 */
export function pointerToTime(
    clientY: number,
    axisTop: number,
    scrollTop: number,
    pxPerMin: number,
    startMin: number,
    snap = DEFAULT_SNAP_MIN
): { rawMin: number; dayOffset: number; minOfDay: number } {
    const rel = clientY - axisTop + scrollTop
    const rawMin = snapMinute(startMin + rel / pxPerMin, snap)
    const dayOffset = Math.floor(rawMin / 1440)
    const minOfDay = ((rawMin % 1440) + 1440) % 1440
    return { rawMin, dayOffset, minOfDay }
}

/** 计算两次指针位置之间的分钟差（支持跨天与跨午夜） */
export function computeDeltaMinutes(
    grab: { dayIndex: number; rawMin: number },
    target: { dayIndex: number; rawMin: number }
): number {
    return target.dayIndex * 1440 + target.rawMin - (grab.dayIndex * 1440 + grab.rawMin)
}

/** 拖拽移动：整体平移起止时间；待办只移动截止时间（结束 = 开始 + 1 分钟） */
export function applyMove(
    startAt: string,
    endAt: string,
    deltaMin: number,
    isTodo = false
): { start_at: string; end_at: string } {
    const start = dayjs(startAt).add(deltaMin, 'minute')
    const end = isTodo ? start.add(1, 'minute') : dayjs(endAt).add(deltaMin, 'minute')
    return { start_at: start.toISOString(), end_at: end.toISOString() }
}

/** 缩放：仅调整结束时间，保证最短时长 */
export function applyResize(
    startAt: string,
    endAt: string,
    deltaMin: number,
    minDurationMin = MIN_RESIZE_MIN
): { end_at: string } {
    const start = dayjs(startAt)
    const minEnd = start.add(minDurationMin, 'minute')
    const end = dayjs(endAt).add(deltaMin, 'minute')
    return { end_at: (end.isBefore(minEnd) ? minEnd : end).toISOString() }
}

/** 月视图拖拽：按天平移起止时间 */
export function shiftEventByDays(
    startAt: string,
    endAt: string,
    days: number,
    isTodo = false
): { start_at: string; end_at: string } {
    const start = dayjs(startAt).add(days, 'day')
    const end = isTodo ? start.add(1, 'minute') : dayjs(endAt).add(days, 'day')
    return { start_at: start.toISOString(), end_at: end.toISOString() }
}

/** 日程是否允许拖拽/缩放：课程与重复日程保持只读 */
export function canEditSchedule(event: Event): boolean {
    return !event.is_course && !event.rrule_str
}

/** 筛选某一天时间窗口内的日程（含课程，节假日课程自动隐藏） */
export function getDayItemsInWindow(
    day: Date,
    events: Event[],
    courseItems: Event[],
    startMin: number,
    endMin: number,
    holidayDates: Set<string>
): Event[] {
    const ws = dayjs(day)
        .hour(Math.floor(startMin / 60))
        .minute(startMin % 60)
        .second(0)
        .millisecond(0)
    const we = (endMin <= startMin ? ws.add(1, 'day') : ws)
        .hour(Math.floor(endMin / 60))
        .minute(endMin % 60)
    return events
        .filter((e) => dayjs(e.start_at).isBefore(we) && dayjs(e.end_at).isAfter(ws))
        .concat(
            courseItems.filter(
                (ci) =>
                    dayjs(ci.start_at).isBefore(we) &&
                    dayjs(ci.end_at).isAfter(ws) &&
                    !holidayDates.has(dayjs(ci.start_at).format('YYYY-MM-DD'))
            )
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
}
