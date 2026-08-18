import { useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { useViewStore } from '@/stores/view.store'
import { useEventStore } from '@/stores/event.store'
import { useCourseCalendarStore } from '@/stores/course-calendar.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSpecialDatesStore } from '@/stores/special-dates.store'
import { useSchedulePopupStore } from '@/stores/schedule-popup.store'
import { getWeekStart, getWeekdayLabels, formatDate, isToday } from '@shared/utils/date'
import { ViewType } from '@shared/constants/enums'
import { useTimeline } from '@/hooks/useTimeline'
import { useTimelineInteractions } from '@/hooks/useTimelineInteractions'
import { getDayItemsInWindow } from '@/utils/timeline-interaction'
import { formatClock } from '@/utils/format'
import TimelineAxis from './TimelineAxis'
import ScheduleBlock from './ScheduleBlock'
import SpecialDateBadge from './SpecialDateBadge'

const PX_PER_MIN = 48 / 60
const SNAP_MIN = 5

export default function WeekView(): JSX.Element {
    const { currentDate, navigateDate, setView } = useViewStore()
    const events = useEventStore((s) => s.events)
    const updateEvent = useEventStore((s) => s.updateEvent)
    const courseItems = useCourseCalendarStore((s) => s.items)
    const weekStartsOn = useSettingsStore((s) => s.weekStartsOn)
    const workweek = useSettingsStore((s) => s.workweek)
    const scrollToNow = useSettingsStore((s) => s.scrollToNow)
    const specialDates = useSpecialDatesStore((s) => s.items)
    const openCreatePopup = useSchedulePopupStore((s) => s.openCreate)
    const openDetailPopup = useSchedulePopupStore((s) => s.openDetail)

    const holidayDates = new Set(
        specialDates.filter((x) => x.type === 'holiday').map((x) => x.date)
    )
    const tl = useTimeline(PX_PER_MIN)
    const weekdayLabels = getWeekdayLabels(weekStartsOn)
    const weekStart = getWeekStart(new Date(currentDate), weekStartsOn)
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        return d
    }).filter((d) => !workweek || (d.getDay() !== 0 && d.getDay() !== 6))

    const getItems = (day: Date) =>
        getDayItemsInWindow(day, events, courseItems, tl.startMin, tl.endMin, holidayDates)

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
        days: weekDays,
        pxPerMin: PX_PER_MIN,
        startMin: tl.startMin,
        containerRef,
        axisRef,
        snapMin: SNAP_MIN,
        onMove: (id, data) => updateEvent(id, data),
        onResize: (id, data) => updateEvent(id, data),
        onOpenDetail: (event, x, y) => openDetailPopup(event, x, y)
    })

    const handleColumnClick = (e: React.MouseEvent, dayIndex: number) => {
        if (interactions.suppressClick()) return
        const target = e.target as HTMLElement
        if (target.closest('[data-schedule-block]')) return
        const p = interactions.readPointer(e.clientY, dayIndex)
        if (!p) return
        const day = weekDays[p.dayIndex]
        if (!day) return
        const targetDate = new Date(day)
        targetDate.setDate(targetDate.getDate() + p.dayOffset)
        openCreatePopup({
            x: e.clientX,
            y: e.clientY,
            date: formatDate(targetDate),
            timeMin: p.minOfDay
        })
    }

    const openDay = (day: Date) => {
        navigateDate(day)
        setView(ViewType.DAY)
    }

    const drag = interactions.drag

    return (
        <div ref={containerRef} className="flex h-full flex-col overflow-auto calendar-grid">
            {/* 周导航条：点击任意一天直达日视图 */}
            <div
                className="sticky top-0 z-20 flex border-b border-zinc-200 bg-white/95
                 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
            >
                <div className="w-28 flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800" />
                {weekDays.map((day, i) => {
                    const today = isToday(day)
                    const weekend = day.getDay() === 0 || day.getDay() === 6
                    const special = specialDates.find((x) => x.date === formatDate(day))
                    return (
                        <button
                            key={i}
                            onClick={() => openDay(day)}
                            className={`group relative flex flex-1 flex-col items-center gap-0.5 border-l
                                border-zinc-100 py-2 transition-colors dark:border-zinc-800
                                ${weekend ? 'bg-zinc-50/70 dark:bg-zinc-900/40' : ''}
                                ${today ? '' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`}
                        >
                            {today && (
                                <span className="absolute inset-x-0 top-0 h-0.5 bg-zinc-950 dark:bg-zinc-50" />
                            )}
                            <span
                                className={`text-[10px] font-medium leading-none ${
                                    today ? 'text-zinc-950 dark:text-zinc-50' : 'text-zinc-400'
                                }`}
                            >
                                {weekdayLabels[(day.getDay() - weekStartsOn + 7) % 7]}
                            </span>
                            <span
                                className={`text-[13px] font-semibold leading-none transition-colors
                                    ${today
                                        ? 'text-zinc-950 dark:text-zinc-50'
                                        : 'text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-zinc-50'
                                    }`}
                            >
                                {day.getDate()}
                            </span>
                            {special ? (
                                <SpecialDateBadge special={special} />
                            ) : (
                                <span className="h-[18px]" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* 全天区域 */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-28 flex-shrink-0" />
                {weekDays.map((day, i) => {
                    const allDay = getItems(day).filter((e) => e.is_all_day)
                    return (
                        <div
                            key={i}
                            className="flex-1 space-y-0.5 border-l border-zinc-100 px-0.5 py-0.5
                             dark:border-zinc-800 min-h-7"
                        >
                            {allDay.map((e) => (
                                <div
                                    key={e.id}
                                    data-schedule-block
                                    onClick={(ev) => {
                                        ev.stopPropagation()
                                        openDetailPopup(e, ev.clientX, ev.clientY)
                                    }}
                                    className="truncate rounded bg-zinc-950 px-1.5 py-0.5 text-[10px] text-white
                                     transition-all hover:brightness-90 dark:bg-zinc-50 dark:text-zinc-950"
                                    style={e.item_type === 'todo' ? { backgroundColor: '#F59E0B' } : undefined}
                                >
                                    {e.title}
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>

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

                {weekDays.map((day, dayIdx) => {
                    const today = isToday(day)
                    const weekend = day.getDay() === 0 || day.getDay() === 6
                    const items = getItems(day).filter((e) => !e.is_all_day)
                    return (
                        <div
                            key={dayIdx}
                            ref={(el) => interactions.setDayRef(el, dayIdx)}
                            onClick={(e) => handleColumnClick(e, dayIdx)}
                            className={`relative flex-1 border-l border-zinc-100 dark:border-zinc-800
                                ${weekend ? 'bg-zinc-50/40 dark:bg-zinc-900/20' : ''}
                                ${today ? 'bg-zinc-100/40 dark:bg-zinc-900/40' : ''}`}
                        >
                            {tl.timeline.map((row) => (
                                <div key={row.key} style={{ height: `${row.height}px` }} />
                            ))}
                            <div style={{ height: `${tl.bottomSpace}px` }} />

                            {items.map((event) => {
                                if (drag?.id === event.id) return null
                                const start = dayjs(event.start_at)
                                const end = dayjs(event.end_at)
                                const top = tl.toTop(start.hour() * 60 + start.minute())
                                const height = Math.max(end.diff(start, 'hour', true) * 48, 24)
                                return (
                                    <ScheduleBlock
                                        key={event.id}
                                        event={event}
                                        top={top}
                                        height={height}
                                        dayIndex={dayIdx}
                                        onPointerDown={interactions.startMove}
                                        onResizePointerDown={interactions.startResize}
                                        onClick={(ev, event) => openDetailPopup(event, ev.clientX, ev.clientY)}
                                    />
                                )
                            })}

                            {/* 拖拽幽灵 */}
                            {drag && drag.targetDayIndex === dayIdx && (
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
                                            dayjs(drag.displayEndAt).diff(dayjs(drag.displayStartAt), 'hour', true) * 48,
                                            24
                                        )}
                                        dayIndex={dayIdx}
                                        isDragging={!drag.committing}
                                        showResizeHandle={false}
                                        onPointerDown={() => {}}
                                        onClick={() => {}}
                                    />
                                </div>
                            )}

                            {today && tl.nowInWindow && (
                                <div className="current-time-line" style={{ top: `${tl.nowTop}px` }}>
                                    <span className="current-time-dot" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* 拖拽时间浮标 */}
            {drag && !drag.committing && (
                <div
                    className="fixed z-50 pointer-events-none rounded-md bg-zinc-900/85 px-2 py-1 text-[11px]
                     font-medium text-white shadow-lg"
                    style={{ left: drag.cursorX + 14, top: drag.cursorY + 14 }}
                >
                    {formatClock(dayjs(drag.displayStartAt), tl.timeFormat)} -{' '}
                    {formatClock(dayjs(drag.displayEndAt), tl.timeFormat)}
                </div>
            )}
        </div>
    )
}
