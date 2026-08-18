import { useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { useViewStore } from '@/stores/view.store'
import { useEventStore } from '@/stores/event.store'
import { useCourseCalendarStore } from '@/stores/course-calendar.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSpecialDatesStore } from '@/stores/special-dates.store'
import { useSchedulePopupStore } from '@/stores/schedule-popup.store'
import { formatDate } from '@shared/utils/date'
import { useTimeline } from '@/hooks/useTimeline'
import { useTimelineInteractions } from '@/hooks/useTimelineInteractions'
import { getDayItemsInWindow } from '@/utils/timeline-interaction'
import { formatClock } from '@/utils/format'
import TimelineAxis from './TimelineAxis'
import ScheduleBlock from './ScheduleBlock'
import SpecialDateBadge from './SpecialDateBadge'

const PX_PER_MIN = 56 / 60
const SNAP_MIN = 5

export default function DayView(): JSX.Element {
    const { currentDate } = useViewStore()
    const events = useEventStore((s) => s.events)
    const updateEvent = useEventStore((s) => s.updateEvent)
    const courseItems = useCourseCalendarStore((s) => s.items)
    const scrollToNow = useSettingsStore((s) => s.scrollToNow)
    const specialDates = useSpecialDatesStore((s) => s.items)
    const openCreatePopup = useSchedulePopupStore((s) => s.openCreate)
    const openDetailPopup = useSchedulePopupStore((s) => s.openDetail)

    const holidayDates = new Set(
        specialDates.filter((x) => x.type === 'holiday').map((x) => x.date)
    )
    const tl = useTimeline(PX_PER_MIN)
    const day = new Date(currentDate)
    const days = [day]
    const items = getDayItemsInWindow(day, events, courseItems, tl.startMin, tl.endMin, holidayDates)
    const special = specialDates.find((x) => x.date === formatDate(day))

    const containerRef = useRef<HTMLDivElement>(null)
    const axisRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!scrollToNow) return
        const el = containerRef.current
        const axis = axisRef.current
        if (!el || !axis) return
        const now = dayjs()
        const nowMin = now.hour() * 60 + now.minute()
        const rel = nowMin - tl.startMin
        const nowTop = (rel < 0 ? rel + 1440 : rel) * PX_PER_MIN
        const axisTop = axis.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
        el.scrollTop = Math.max(0, axisTop + nowTop - 80)
    }, [scrollToNow, currentDate, tl.startMin, tl.endMin])

    const interactions = useTimelineInteractions({
        days,
        pxPerMin: PX_PER_MIN,
        startMin: tl.startMin,
        containerRef,
        axisRef,
        snapMin: SNAP_MIN,
        onMove: (id, data) => updateEvent(id, data),
        onResize: (id, data) => updateEvent(id, data),
        onOpenDetail: (event, x, y) => openDetailPopup(event, x, y)
    })

    const handleColumnClick = (e: React.MouseEvent) => {
        if (interactions.suppressClick()) return
        const target = e.target as HTMLElement
        if (target.closest('[data-schedule-block]')) return
        const p = interactions.readPointer(e.clientY, 0)
        if (!p) return
        const targetDate = new Date(day)
        targetDate.setDate(targetDate.getDate() + p.dayOffset)
        openCreatePopup({
            x: e.clientX,
            y: e.clientY,
            date: formatDate(targetDate),
            timeMin: p.minOfDay
        })
    }

    const drag = interactions.drag
    const timedItems = items.filter((e) => !e.is_all_day)
    const allDayItems = items.filter((e) => e.is_all_day)

    return (
        <div ref={containerRef} className="flex flex-col h-full overflow-auto calendar-grid">
            {/* 特殊日期标记 */}
            {special && (
                <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-1.5">
                    <SpecialDateBadge special={special} className="text-xs px-2 py-0.5" />
                </div>
            )}

            {/* 全天日程区域 */}
            {allDayItems.length > 0 && (
                <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-900/50">
                    <div className="text-xs text-gray-400 mb-1">全天</div>
                    <div className="flex flex-wrap gap-1">
                        {allDayItems.map((event) => (
                            <div
                                key={event.id}
                                data-schedule-block
                                onClick={(ev) => {
                                    ev.stopPropagation()
                                    openDetailPopup(event, ev.clientX, ev.clientY)
                                }}
                                className="px-2 py-1 text-xs rounded bg-primary-100 text-primary-700
                                 dark:bg-primary-900/30 dark:text-primary-300 cursor-pointer
                                 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                                style={event.item_type === 'todo' ? { backgroundColor: '#FDE68A', color: '#92400E' } : undefined}
                            >
                                {event.title}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 时间轴 */}
            <div ref={axisRef} className="flex flex-1">
                <TimelineAxis
                    timeline={tl.timeline}
                    hourMarks={tl.hourMarks}
                    periodLines={tl.periodLines}
                    startMin={tl.startMin}
                    bottomSpace={tl.bottomSpace}
                    pxPerMin={PX_PER_MIN}
                    timeFormat={tl.timeFormat}
                />

                <div
                    ref={(el) => interactions.setDayRef(el, 0)}
                    onClick={handleColumnClick}
                    className="flex-1 relative border-l border-gray-200 dark:border-gray-700"
                >
                    {tl.timeline.map((row) => (
                        <div key={row.key} style={{ height: `${row.height}px` }} />
                    ))}
                    <div style={{ height: `${tl.bottomSpace}px` }} />

                    {timedItems.map((event) => {
                        if (drag?.id === event.id) return null
                        const start = dayjs(event.start_at)
                        const end = dayjs(event.end_at)
                        const top = tl.toTop(start.hour() * 60 + start.minute())
                        const height = Math.max(end.diff(start, 'hour', true) * 56, 28)
                        return (
                            <ScheduleBlock
                                key={event.id}
                                event={event}
                                top={top}
                                height={height}
                                dayIndex={0}
                                onPointerDown={interactions.startMove}
                                onResizePointerDown={interactions.startResize}
                                onClick={(ev, event) => openDetailPopup(event, ev.clientX, ev.clientY)}
                            />
                        )
                    })}

                    {/* 拖拽幽灵 */}
                    {drag && drag.targetDayIndex === 0 && (
                        <div className="pointer-events-none">
                            <ScheduleBlock
                                event={{
                                    ...drag.event,
                                    start_at: drag.displayStartAt,
                                    end_at: drag.displayEndAt
                                }}
                                top={tl.toTop(
                                    dayjs(drag.displayStartAt).hour() * 60 +
                                        dayjs(drag.displayStartAt).minute()
                                )}
                                height={Math.max(
                                    dayjs(drag.displayEndAt).diff(dayjs(drag.displayStartAt), 'hour', true) * 56,
                                    28
                                )}
                                dayIndex={0}
                                isDragging={!drag.committing}
                                showResizeHandle={false}
                                onPointerDown={() => {}}
                                onClick={() => {}}
                            />
                        </div>
                    )}

                    {tl.nowInWindow && (
                        <div className="current-time-line" style={{ top: `${tl.nowTop}px` }}>
                            <span className="current-time-dot" />
                        </div>
                    )}
                </div>
            </div>

            {/* 拖拽时间浮标 */}
            {drag && !drag.committing && (
                <div
                    className="fixed z-50 pointer-events-none px-2 py-1 text-[11px] font-medium rounded-md
                     bg-gray-900/85 text-white shadow-lg"
                    style={{ left: drag.cursorX + 14, top: drag.cursorY + 14 }}
                >
                    {formatClock(dayjs(drag.displayStartAt), tl.timeFormat)} -{' '}
                    {formatClock(dayjs(drag.displayEndAt), tl.timeFormat)}
                </div>
            )}
        </div>
    )
}
