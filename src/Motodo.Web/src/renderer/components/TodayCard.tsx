import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { useSettingsStore } from '@/stores/settings.store'
import { useSchedulePopupStore } from '@/stores/schedule-popup.store'
import { buildCourseInstances } from '@shared/utils/course-calendar'
import { formatClock } from '@/utils/format'

interface TodayCardProps {
    onCreate: () => void
}

/** 今日小卡片：紧凑展示今日日程，不做大号日期/时钟提示 */
export default function TodayCard({ onCreate }: TodayCardProps): JSX.Element {
    const [now, setNow] = useState(() => dayjs())
    const [events, setEvents] = useState<Event[]>([])
    const [courseItems, setCourseItems] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const openDetailPopup = useSchedulePopupStore((s) => s.openDetail)

    useEffect(() => {
        let mounted = true
        let revision = 0
        let loadedDate = dayjs().format('YYYY-MM-DD')
        const load = async () => {
            const request = ++revision
            setLoading(true)
            setError(null)
            const today = dayjs()
            loadedDate = today.format('YYYY-MM-DD')
            setNow(today)
            const range = {
                start: today.startOf('day').toISOString(),
                end: today.startOf('day').add(1, 'day').toISOString()
            }
            try {
                const [evts, courses] = await Promise.all([
                    window.electronAPI.event.query(range),
                    (async () => {
                        const active = await window.electronAPI.semester.getActive()
                        if (!active) return []
                        const items = await window.electronAPI.course.listBySemester(active.id)
                        return buildCourseInstances(active, items, range)
                    })()
                ])
                if (mounted && request === revision) {
                    setEvents(evts)
                    setCourseItems(courses)
                }
            } catch (err) {
                if (mounted && request === revision) setError(String(err))
            } finally {
                if (mounted && request === revision) setLoading(false)
            }
        }
        void load()
        const unsubscribe = window.electronAPI.on('schedule:changed', () => void load())
        const timer = window.setInterval(() => {
            const current = dayjs()
            setNow(current)
            if (current.format('YYYY-MM-DD') !== loadedDate) void load()
        }, 60_000)
        return () => {
            mounted = false
            revision++
            unsubscribe()
            window.clearInterval(timer)
        }
    }, [])

    const { allDay, timed } = useMemo(() => {
        const all = [...events, ...courseItems].filter((e) =>
            dayjs(e.start_at).isBefore(now.startOf('day').add(1, 'day')) && dayjs(e.end_at).isAfter(now.startOf('day')))
        return {
            allDay: all.filter((e) => e.is_all_day).sort((a, b) => a.title.localeCompare(b.title)),
            timed: all
                .filter((e) => !e.is_all_day)
                .sort((a, b) => a.start_at.localeCompare(b.start_at))
        }
    }, [events, courseItems, now])

    const todos = events.filter((e) => e.item_type === 'todo')
    const completedTodos = todos.filter((e) => e.is_completed).length
    const total = allDay.length + timed.length

    return (
        <div
            className="desktop-card-panel today-content"
        >
            <div className="mb-3 flex shrink-0 items-center justify-between">
                <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                    {now.format('M月D日 HH:mm')}
                </span>
                <span className="text-xs text-zinc-400">当天安排</span>
            </div>

            {error && <p role="alert" className="mb-2 text-xs text-red-500">加载失败：{error}</p>}
            {/* 今日日程 */}
            <div>
            {loading ? (
                <div className="flex h-28 items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950
                        dark:border-zinc-800 dark:border-t-zinc-50" />
                </div>
            ) : (
                <div className="space-y-1">
                    {allDay.map((event) => (
                        <AgendaItem
                            key={event.id}
                            event={event}
                            timeLabel="全天"
                            onOpen={(x, y) => openDetailPopup(event, x, y)}
                        />
                    ))}
                    {timed.map((event) => (
                        <AgendaItem
                            key={event.id}
                            event={event}
                            timeLabel={formatClock(dayjs(event.start_at), timeFormat)}
                            onOpen={(x, y) => openDetailPopup(event, x, y)}
                        />
                    ))}
                    {total === 0 && (
                        <div className="today-empty py-6 text-center
                            text-xs text-zinc-400 dark:border-zinc-800">
                            今天暂无日程
                        </div>
                    )}
                </div>
            )}

            </div>
            {/* Content grows the native window; the outer host pages only at the screen limit. */}
            <div className="mt-3 flex shrink-0 items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-400">
                    {total} 项 · 待办 {completedTodos}/{todos.length}
                </p>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={onCreate}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium
                         text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800
                         dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                        新建
                    </button>
                </div>
            </div>
        </div>
    )
}

function AgendaItem({
    event,
    timeLabel,
    onOpen
}: {
    event: Event
    timeLabel: string
    onOpen: (x: number, y: number) => void
}): JSX.Element {
    const color = event.is_course
        ? (event.color ?? '#3B82F6')
        : event.item_type === 'todo'
            ? '#F59E0B'
            : '#3B82F6'
    return (
        <button
            onClick={(e) => onOpen(e.clientX, e.clientY)}
            className="flex w-full items-center gap-2 rounded-lg border border-zinc-100 px-2 py-1.5
             text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="w-10 shrink-0 text-[11px] font-medium tabular-nums text-zinc-500">
                {timeLabel}
            </span>
            <span className={`min-w-0 flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-200
                ${event.is_completed ? 'text-zinc-400 line-through' : ''}`}>
                {event.title}
            </span>
            {event.is_course && (
                <span className="shrink-0 rounded bg-zinc-100 px-1 py-px text-[9px] text-zinc-500
                    dark:bg-zinc-800 dark:text-zinc-400">
                    课
                </span>
            )}
        </button>
    )
}
