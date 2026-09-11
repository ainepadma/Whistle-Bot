import { useEffect, useState } from 'react'
import type { Event } from '@shared/types/event'
import dayjs from 'dayjs'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'
import { isRecurringEvent } from '@/utils/recurrence'

interface EventDetailProps {
    event: Event
    onClose: () => void
    onEdit: () => void
    onDelete: () => void | Promise<void>
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
    const recurring = isRecurringEvent(event)
    const [confirmAction, setConfirmAction] = useState<'delete' | 'complete' | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => { setConfirmAction(null); setError(null) }, [event.id, event.is_completed])

    const runAction = async (action: 'delete' | 'complete') => {
        if (busy) return
        if ((action === 'delete' || recurring) && confirmAction !== action) {
            setConfirmAction(action)
            return
        }
        setBusy(true)
        setError(null)
        try {
            if (action === 'delete') await onDelete()
            else await onToggleComplete?.()
            setConfirmAction(null)
        } catch (err) { setError(String(err)) }
        finally { setBusy(false) }
    }

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

            {recurring && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">编辑、删除和完成操作会影响整个重复日程（所有日期）。</p>}
            {confirmAction && <p role="alert" className="text-xs text-red-500">{confirmAction === 'delete' ? (recurring ? '将删除所有重复日期，再次点击确认删除。' : '再次点击确认删除此日程。') : `将${event.is_completed ? '重新打开' : '完成'}整个重复待办，再次点击确认。`} <button onClick={() => setConfirmAction(null)} className="underline">取消</button></p>}
            {error && <p role="alert" className="text-xs text-red-500">操作失败：{error}</p>}
            {/* 操作按钮 */}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {event.item_type === 'todo' && onToggleComplete && (
                    <button
                        disabled={busy}
                        onClick={() => void runAction('complete')}
                        className="px-4 py-2 text-sm border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400
                         rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                        {confirmAction === 'complete' ? '确认' : ''}{event.is_completed ? (recurring ? '重新打开整个待办' : '重新打开') : (recurring ? '完成整个重复待办' : '标记完成')}
                    </button>
                )}

                <button
                    disabled={busy}
                    onClick={() => void runAction('delete')}
                    className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                     rounded-lg transition-colors"
                >
                    {confirmAction === 'delete' ? '确认删除' : '删除'}{recurring ? '整系列' : ''}
                </button>
                <button
                    onClick={onEdit}
                    className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg
                     hover:bg-primary-600 transition-colors"
                >
                    {recurring ? '编辑整系列' : '编辑'}
                </button>
            </div>
        </div>
    )
}
