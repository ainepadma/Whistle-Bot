import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { useSchedulePopupStore } from '@/stores/schedule-popup.store'
import { useEventUiStore } from '@/stores/event-ui.store'
import { useEventStore } from '@/stores/event.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'

function useClampedPosition(x: number, y: number): {
    ref: React.RefObject<HTMLDivElement>
    pos: { x: number; y: number }
} {
    const ref = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ x, y })
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const nx = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8)
        const ny = Math.min(y + 14, window.innerHeight - r.height - 8)
        setPos({ x: Math.max(8, nx), y: Math.max(8, ny) })
    }, [x, y])
    return { ref, pos }
}

/** 点击日历空白处的新建弹窗 */
function CreatePopup(): JSX.Element | null {
    const payload = useSchedulePopupStore((s) => s.create)
    const close = useSchedulePopupStore((s) => s.closeCreate)
    const openCreate = useEventUiStore((s) => s.openCreate)
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const { ref, pos } = useClampedPosition(payload?.x ?? 0, payload?.y ?? 0)

    if (!payload) return null

    const d = dayjs(payload.date)
    const header =
        payload.timeMin != null
            ? `${d.format('M月D日 dddd')} ${formatClock(
                  d.startOf('day').add(payload.timeMin, 'minute'),
                  timeFormat
              )}`
            : d.format('M月D日 dddd')
    const startIso = (min: number): string =>
        dayjs(payload.date).startOf('day').add(min, 'minute').toISOString()

    const createTimed = (type: 'plan' | 'todo') => {
        const startMin = payload.timeMin ?? (type === 'todo' ? 18 * 60 : 9 * 60)
        const start = startIso(startMin)
        openCreate(type, {
            start_at: start,
            end_at:
                type === 'todo'
                    ? dayjs(start).add(1, 'minute').toISOString()
                    : dayjs(start).add(60, 'minute').toISOString()
        })
        close()
    }

    const createAllDay = () => {
        openCreate('plan', {
            start_at: dayjs(payload.date).startOf('day').toISOString(),
            end_at: dayjs(payload.date).endOf('day').toISOString(),
            is_all_day: true
        })
        close()
    }

    return (
        <div className="fixed inset-0 z-40" onClick={close}>
            <div
                ref={ref}
                onClick={(e) => e.stopPropagation()}
                className="absolute w-44 bg-white dark:bg-gray-900 rounded-xl shadow-2xl
                 border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
                style={{ left: pos.x, top: pos.y }}
            >
                <div className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 border-b
                    border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                    {header}
                </div>
                <div className="p-1.5 space-y-0.5">
                    <button
                        onClick={() => createTimed('plan')}
                        className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg text-gray-700 dark:text-gray-200
                         hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        计划
                    </button>
                    <button
                        onClick={() => createTimed('todo')}
                        className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg text-gray-700 dark:text-gray-200
                         hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                    >
                        待办
                    </button>
                    <button
                        onClick={createAllDay}
                        className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg text-gray-700 dark:text-gray-200
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        全天
                    </button>
                </div>
            </div>
        </div>
    )
}

/** 点击日程的详情弹窗（课程只读；计划/待办可编辑、删除、勾选完成） */
function DetailPopup(): JSX.Element | null {
    const payload = useSchedulePopupStore((s) => s.detail)
    const close = useSchedulePopupStore((s) => s.closeDetail)
    const openEdit = useEventUiStore((s) => s.openEdit)
    const { updateEvent, removeEvent } = useEventStore()
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const { ref, pos } = useClampedPosition(payload?.x ?? 0, payload?.y ?? 0)
    const [event, setEvent] = useState<Event | null>(payload?.event ?? null)
    const [confirmDelete, setConfirmDelete] = useState(false)

    useEffect(() => {
        setEvent(payload?.event ?? null)
        setConfirmDelete(false)
    }, [payload])

    if (!payload || !event) return null

    const start = dayjs(event.start_at)
    const end = dayjs(event.end_at)
    const isTodo = event.item_type === 'todo'
    const isCourse = Boolean(event.is_course)
    const timeText = isTodo
        ? `截止 ${event.is_all_day ? start.format('YYYY年M月D日') : `${start.format('YYYY年M月D日')} ${formatClock(start, timeFormat)}`}`
        : event.is_all_day
            ? `${start.format('YYYY年M月D日')} · 全天`
            : `${start.format('YYYY年M月D日')} ${formatClock(start, timeFormat)} - ${formatClock(end, timeFormat)}`

    const toggleComplete = async () => {
        const updated = await updateEvent(event.id, { is_completed: !event.is_completed })
        setEvent(updated)
        useSchedulePopupStore.setState({
            detail: { event: updated, x: payload.x, y: payload.y }
        })
    }

    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true)
            return
        }
        await removeEvent(event.id)
        close()
    }

    return (
        <div className="fixed inset-0 z-40" onClick={close}>
            <div
                ref={ref}
                onClick={(e) => e.stopPropagation()}
                className="absolute w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl
                 border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
                style={{ left: pos.x, top: pos.y }}
            >
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">
                            {event.title}
                        </h3>
                        <button
                            onClick={close}
                            className="p-0.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                             hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {isCourse && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-600
                             dark:bg-blue-900/40 dark:text-blue-300">课程</span>
                        )}
                        {isTodo && (
                            <span className={`px-1.5 py-0.5 text-[10px] rounded
                                ${event.is_completed
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'}`}
                            >
                                {event.is_completed ? '已完成' : '待办'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="px-4 py-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-start gap-2">
                        <span className="text-gray-400 flex-shrink-0">时间</span>
                        <span className="text-gray-700 dark:text-gray-300">{timeText}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-start gap-2">
                            <span className="text-gray-400 flex-shrink-0">地点</span>
                            <span className="text-gray-700 dark:text-gray-300">{event.location}</span>
                        </div>
                    )}
                    {event.description && (
                        <div className="flex items-start gap-2">
                            <span className="text-gray-400 flex-shrink-0">备注</span>
                            <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</span>
                        </div>
                    )}
                </div>

                {!isCourse && (
                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t
                     border-gray-100 dark:border-gray-800">
                        {isTodo && (
                            <button
                                onClick={toggleComplete}
                                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                                    ${event.is_completed
                                        ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                        : 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                            >
                                {event.is_completed ? '重新打开' : '标记完成'}
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                                ${confirmDelete
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : 'border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                        >
                            {confirmDelete ? '确认删除' : '删除'}
                        </button>
                        <button
                            onClick={() => {
                                openEdit(event)
                                close()
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-primary-500 text-white
                             hover:bg-primary-600 transition-colors"
                        >
                            编辑
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

/** 挂载在 App 上的日历浮层出口 */
export default function SchedulePopups(): JSX.Element | null {
    const hasCreate = useSchedulePopupStore((s) => s.create !== null)
    const hasDetail = useSchedulePopupStore((s) => s.detail !== null)
    if (!hasCreate && !hasDetail) return null
    return (
        <>
            <CreatePopup />
            <DetailPopup />
        </>
    )
}
