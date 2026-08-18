import { useEffect, useState } from 'react'
import type { Event } from '@shared/types/event'
import dayjs from 'dayjs'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'

interface EventDetailProps {
    event: Event
    onClose: () => void
    onEdit: () => void
    onDelete: () => void
    onToggleComplete?: () => void | Promise<void>
}

interface FocusSession {
    id: string
    ended_at: string
    planned_seconds: number
    actual_seconds: number
}

export default function EventDetail({ event, onClose, onEdit, onDelete, onToggleComplete }: EventDetailProps): JSX.Element {
    const start = dayjs(event.start_at)
    const end = dayjs(event.end_at)
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const focusEventId = event.recurrence_parent_id ?? event.id
    const [focusSessions, setFocusSessions] = useState<FocusSession[]>([])

    useEffect(() => {
        let mounted = true
        const load = () => void window.electronAPI.focus.sessions(focusEventId).then((items: FocusSession[]) => {
            if (mounted) setFocusSessions(items)
        })
        load()
        const unsubscribe = window.electronAPI.on('focus:finished', load)
        return () => { mounted = false; unsubscribe() }
    }, [focusEventId])

    const focusedSeconds = focusSessions.reduce((total, session) => total + session.actual_seconds, 0)

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{event.title}</h2>
                {event.item_type === 'todo' && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                        {event.is_completed ? '待办 · 已完成' : '待办'}
                    </span>
                )}
            </div>

            {/* 时间 */}
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-lg">🕐</span>
                <div>
                    {event.item_type === 'todo' ? (
                        <p>截止：{event.is_all_day ? start.format('YYYY 年 M 月 D 日') : `${start.format('YYYY 年 M 月 D 日')} ${formatClock(start, timeFormat)}`}</p>
                    ) : event.is_all_day ? (
                        <p>{start.format('YYYY 年 M 月 D 日')} — 全天</p>
                    ) : (
                        <p>
                            {start.format('YYYY 年 M 月 D 日')} {formatClock(start, timeFormat)} - {formatClock(end, timeFormat)}
                        </p>
                    )}
                    {event.rrule_str && (
                        <p className="text-xs text-primary-500 mt-0.5">🔄 重复日程</p>
                    )}
                </div>
            </div>

            {/* 地点 */}
            {event.location && (
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-lg">📍</span>
                    <p>{event.location}</p>
                </div>
            )}

            {/* 描述 */}
            {event.description && (
                <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-lg">📝</span>
                    <p className="whitespace-pre-wrap flex-1">{event.description}</p>
                </div>
            )}

            <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/30">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-primary-800 dark:text-primary-200">专注记录</p>
                        <p className="mt-0.5 text-xs text-primary-600 dark:text-primary-400">
                            {focusSessions.length > 0
                                ? `${focusSessions.length} 次 · 累计 ${Math.round(focusedSeconds / 60)} 分钟`
                                : '尚无记录，从本日程开始专注后会自动回写'}
                        </p>
                    </div>
                    <button onClick={() => { void window.electronAPI.focus.startForEvent(focusEventId); onClose() }}
                        className="shrink-0 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600">
                        {focusSessions.length > 0 ? '继续专注' : '开始专注'}
                    </button>
                </div>
                {focusSessions.length > 0 && (
                    <div className="mt-2 grid gap-1 sm:grid-cols-3">
                        {focusSessions.slice(0, 3).map((session) => (
                            <div key={session.id} className="rounded-md bg-white/80 px-2 py-1.5 text-[10px] text-zinc-500 dark:bg-zinc-900/70">
                                <p>{dayjs(session.ended_at).format('M月D日 HH:mm')}</p>
                                <p className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-300">{Math.max(1, Math.round(session.actual_seconds / 60))} 分钟</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {event.item_type === 'todo' && onToggleComplete && (
                    <button
                        onClick={onToggleComplete}
                        className="px-4 py-2 text-sm border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400
                         rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                        {event.is_completed ? '重新打开' : '标记完成'}
                    </button>
                )}

                <button
                    onClick={onDelete}
                    className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                     rounded-lg transition-colors"
                >
                    删除
                </button>
                <button
                    onClick={onEdit}
                    className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg
                     hover:bg-primary-600 transition-colors"
                >
                    编辑
                </button>
            </div>
        </div>
    )
}
