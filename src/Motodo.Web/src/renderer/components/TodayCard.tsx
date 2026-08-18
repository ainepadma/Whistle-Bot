import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { useSemesterStore } from '@/stores/semester.store'
import { useCourseStore } from '@/stores/course.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSchedulePopupStore } from '@/stores/schedule-popup.store'
import { buildCourseInstances } from '@shared/utils/course-calendar'
import { formatClock } from '@/utils/format'
import Icon from '@/components/ui/Icons'

interface TodayCardProps {
    onClose: () => void
    onCreate: () => void
}

/** 今日小卡片：紧凑展示今日日程，不做大号日期/时钟提示 */
export default function TodayCard({ onClose, onCreate }: TodayCardProps): JSX.Element {
    const [now, setNow] = useState(() => dayjs())
    const [events, setEvents] = useState<Event[]>([])
    const [courseItems, setCourseItems] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const openDetailPopup = useSchedulePopupStore((s) => s.openDetail)

    useEffect(() => {
        const timer = window.setInterval(() => setNow(dayjs()), 60_000)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            const range = {
                start: dayjs().startOf('day').toISOString(),
                end: dayjs().endOf('day').add(1, 'day').toISOString()
            }
            try {
                const [evts] = await Promise.all([
                    window.electronAPI.event.query(range),
                    (async () => {
                        const semesterStore = useSemesterStore.getState()
                        if (semesterStore.semesters.length === 0 && !semesterStore.loading) {
                            await semesterStore.loadSemesters()
                        }
                        const active = useSemesterStore.getState().activeSemester
                        if (!active) return
                        await useCourseStore.getState().loadBySemester(active.id)
                        const courses = useCourseStore.getState().courses
                        setCourseItems(buildCourseInstances(active, courses, range))
                    })()
                ])
                if (mounted) setEvents(evts)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        void load()
        return () => {
            mounted = false
        }
    }, [])

    const { allDay, timed } = useMemo(() => {
        const all = [...events, ...courseItems].filter((e) => dayjs(e.start_at).isSame(now, 'day'))
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
            className="mx-3 mb-3 max-h-[calc(100vh-3.75rem)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950"
        >
            {/* 顶部：小标题 + 收起 */}
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                    {now.format('M月D日 HH:mm')}
                </span>
                <button
                    onClick={onClose}
                    aria-label="收起卡片"
                    title="收起卡片"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400
                     transition-colors hover:bg-zinc-100 hover:text-zinc-700
                     dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                    <Icon name="close" className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* 今日日程 */}
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
                        <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center
                            text-xs text-zinc-400 dark:border-zinc-800">
                            今天暂无日程
                        </div>
                    )}
                </div>
            )}

            {/* 底部：统计 + 操作 */}
            <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
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
