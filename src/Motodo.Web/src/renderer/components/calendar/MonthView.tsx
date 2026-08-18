import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { useViewStore } from '@/stores/view.store'
import { useEventStore } from '@/stores/event.store'
import { useCourseCalendarStore } from '@/stores/course-calendar.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSpecialDatesStore } from '@/stores/special-dates.store'
import { useSchedulePopupStore } from '@/stores/schedule-popup.store'
import {
    getMonthGrid,
    getWeekStart,
    getIsoWeek,
    getWeekdayLabels,
    isToday,
    formatDate
} from '@shared/utils/date'
import { canEditSchedule, CLICK_THRESHOLD_PX, shiftEventByDays } from '@/utils/timeline-interaction'
import EventBlock from './EventBlock'
import SpecialDateBadge from './SpecialDateBadge'

interface MonthDragState {
    event: Event
    grabDate: string
    targetDate: string | null
    x: number
    y: number
    moved: boolean
    committing?: boolean
}

export default function MonthView(): JSX.Element {
    const { currentDate } = useViewStore()
    const { getEventsForDate } = useEventStore()
    const updateEvent = useEventStore((s) => s.updateEvent)
    const courseItems = useCourseCalendarStore((s) => s.items)
    const weekStartsOn = useSettingsStore((s) => s.weekStartsOn)
    const showWeekNumbers = useSettingsStore((s) => s.showWeekNumbers)
    const showExtraDays = useSettingsStore((s) => s.showExtraDays)
    const specialDates = useSpecialDatesStore((s) => s.items)
    const openCreatePopup = useSchedulePopupStore((s) => s.openCreate)
    const openDetailPopup = useSchedulePopupStore((s) => s.openDetail)

    const holidayDates = new Set(
        specialDates.filter((x) => x.type === 'holiday').map((x) => x.date)
    )
    const weekdayLabels = getWeekdayLabels(weekStartsOn)
    const anchor = new Date(currentDate)
    const currentMonth = anchor.getMonth()
    const weekRowStart = getWeekStart(anchor, weekStartsOn)
    const rowStartForRow = (row: number): Date =>
        new Date(weekRowStart.getFullYear(), weekRowStart.getMonth(), weekRowStart.getDate() + row * 7)
    const monthGrid = getMonthGrid(anchor, weekStartsOn)
    const realMonthCells = (): (Date | null)[] => {
        const year = anchor.getFullYear()
        const month = anchor.getMonth()
        const leading = (new Date(year, month, 1).getDay() - weekStartsOn + 7) % 7
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const trailing = (7 - ((leading + daysInMonth) % 7)) % 7
        return [
            ...Array.from({ length: leading }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
            ...Array.from({ length: trailing }, () => null)
        ]
    }
    const baseCells: (Date | null)[] = showExtraDays ? monthGrid : realMonthCells()
    const gridCells: (Date | null)[] = showWeekNumbers
        ? baseCells.flatMap((d, i) => (i % 7 === 0 ? [null as Date | null, d] : [d]))
        : baseCells

    // 月视图跨日拖拽
    const [monthDrag, setMonthDrag] = useState<MonthDragState | null>(null)
    const monthDragRef = useRef<MonthDragState | null>(null)
    const suppressCellClickRef = useRef(false)

    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            const d = monthDragRef.current
            if (!d) return
            const hit = document
                .elementsFromPoint(e.clientX, e.clientY)
                .find((el) => el instanceof HTMLElement && el.hasAttribute('data-date'))
            const targetDate = (hit as HTMLElement | undefined)?.getAttribute('data-date') ?? null
            const next: MonthDragState = {
                ...d,
                targetDate,
                x: e.clientX,
                y: e.clientY,
                moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= CLICK_THRESHOLD_PX
            }
            monthDragRef.current = next
            setMonthDrag(next)
        }

        const handleUp = async (_e: PointerEvent) => {
            const d = monthDragRef.current
            if (!d) return
            if (!d.moved) {
                monthDragRef.current = null
                setMonthDrag(null)
                return
            }
            suppressCellClickRef.current = true
            if (!d.targetDate || d.targetDate === d.grabDate) {
                monthDragRef.current = null
                setMonthDrag(null)
                return
            }
            // 保持幽灵在目标位置，直到保存完成，避免松手瞬间回跳旧状态
            const committing: MonthDragState = { ...d, committing: true }
            monthDragRef.current = committing
            setMonthDrag(committing)
            const dayDiff = dayjs(d.targetDate).diff(dayjs(d.grabDate), 'day')
            try {
                await updateEvent(
                    d.event.id,
                    shiftEventByDays(d.event.start_at, d.event.end_at, dayDiff, d.event.item_type === 'todo')
                )
            } finally {
                if (monthDragRef.current === committing) {
                    monthDragRef.current = null
                    setMonthDrag(null)
                }
            }
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
        window.addEventListener('pointercancel', handleUp)
        return () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
            window.removeEventListener('pointercancel', handleUp)
        }
    }, [updateEvent])

    const startMonthDrag = (e: React.PointerEvent, event: Event) => {
        if (!canEditSchedule(event)) return
        e.preventDefault()
        e.stopPropagation()
        const state: MonthDragState = {
            event,
            grabDate: formatDate(dayjs(event.start_at).toDate()),
            targetDate: null,
            x: e.clientX,
            y: e.clientY,
            moved: false
        }
        monthDragRef.current = state
        setMonthDrag(state)
    }

    const handleCellClick = (e: React.MouseEvent, day: Date) => {
        if (suppressCellClickRef.current) {
            suppressCellClickRef.current = false
            return
        }
        const target = e.target as HTMLElement
        if (target.closest('[data-schedule-block]')) return
        openCreatePopup({ x: e.clientX, y: e.clientY, date: formatDate(day), timeMin: null })
    }

    return (
        <div className="flex flex-col h-full calendar-grid">
            {/* 星期标题 */}
            <div
                className={`grid gap-1 px-2.5 pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 ${
                    showWeekNumbers ? 'grid-cols-8' : 'grid-cols-7'
                }`}
            >
                {showWeekNumbers && (
                    <div className="py-1 text-center text-xs font-semibold text-gray-400 select-none">周</div>
                )}
                {weekdayLabels.map((label, i) => (
                    <div
                        key={i}
                        className={`py-1 text-center text-xs font-semibold select-none
                            ${i === 6 || (weekStartsOn === 0 && i === 0)
                                ? 'text-gray-400 dark:text-gray-500'
                                : 'text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* 日期网格 */}
            <div
                className={`grid flex-1 auto-rows-fr gap-1 p-2 overflow-hidden ${
                    showWeekNumbers ? 'grid-cols-8' : 'grid-cols-7'
                }`}
            >
                {gridCells.map((day, idx) => {
                    if (day === null) {
                        return showWeekNumbers && idx % 8 === 0 ? (
                            <div
                                key={`week-${idx}`}
                                className="flex items-start justify-center pt-1 text-xs font-medium text-gray-400 select-none"
                            >
                                {getIsoWeek(rowStartForRow(Math.floor(idx / 8)))}
                            </div>
                        ) : (
                            <div key={`blank-${idx}`} />
                        )
                    }
                    const isOtherMonth = day.getMonth() !== currentMonth
                    const today = isToday(day)
                    const events = getEventsForDate(day)
                    const special = specialDates.find((x) => x.date === formatDate(day))
                    const dayCourses = courseItems.filter(
                        (ci) =>
                            dayjs(ci.start_at).isSame(dayjs(day), 'day') &&
                            !holidayDates.has(dayjs(ci.start_at).format('YYYY-MM-DD'))
                    )
                    const allItems = [...events, ...dayCourses].sort((a, b) =>
                        a.start_at.localeCompare(b.start_at)
                    )
                    const visibleItems = allItems.filter((e) => e.id !== monthDrag?.event.id)
                    const isDragTarget =
                        monthDrag?.targetDate != null && monthDrag.targetDate === formatDate(day)

                    return (
                        <div
                            key={`day-${idx}`}
                            data-date={formatDate(day)}
                            onClick={(e) => handleCellClick(e, day)}
                            className={`relative flex flex-col rounded-lg border p-0.5 transition-colors
                                ${isOtherMonth
                                    ? 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800'
                                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                                }
                                ${today
                                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-950/20'
                                    : ''
                                }
                                hover:bg-zinc-50 dark:hover:bg-zinc-900/60
                                ${isDragTarget ? 'ring-2 ring-primary-400 ring-inset' : ''}`}
                        >
                            <div className="flex justify-between items-start px-1 pt-0.5">
                                <span
                                    className={`text-xs font-medium leading-none px-1 py-0.5 rounded-full
                                        ${today
                                            ? 'bg-primary-500 text-white'
                                            : isOtherMonth
                                                ? 'text-gray-400'
                                                : 'text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {day.getDate()}
                                </span>
                                <SpecialDateBadge special={special} />
                            </div>

                            <div className="flex-1 overflow-y-auto px-0.5 mt-0.5 space-y-0.5">
                                {visibleItems.slice(0, 3).map((event) => (
                                    <EventBlock
                                        key={event.id}
                                        event={event}
                                        compact
                                        onPointerDown={startMonthDrag}
                                        onClick={(ev) => {
                                            if (suppressCellClickRef.current) {
                                                suppressCellClickRef.current = false
                                                return
                                            }
                                            ev.stopPropagation()
                                            openDetailPopup(event, ev.clientX, ev.clientY)
                                        }}
                                    />
                                ))}
                                {visibleItems.length > 3 && (
                                    <div className="text-xs text-gray-400 px-1.5">
                                        +{visibleItems.length - 3} 更多
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* 拖拽幽灵 */}
            {monthDrag && (
                <div
                    className="fixed z-50 pointer-events-none w-44 px-2.5 py-1.5 rounded-md text-[11px] truncate
                     bg-gray-900/85 text-white shadow-lg"
                    style={{ left: monthDrag.x + 12, top: monthDrag.y + 12 }}
                >
                    {monthDrag.event.title}
                </div>
            )}
        </div>
    )
}
