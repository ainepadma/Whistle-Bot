import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'

export default function TodoCard(): JSX.Element {
    const [items, setItems] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            try {
                const events = await window.electronAPI.event.query({
                    start: '2000-01-01T00:00:00.000Z', end: '2100-01-01T00:00:00.000Z', item_type: 'todo', is_completed: false, expand: false
                }) as Event[]
                if (mounted) setItems(events.sort((a, b) => a.start_at.localeCompare(b.start_at)))
            } finally {
                if (mounted) setLoading(false)
            }
        }
        void load()
        const unsubscribe = window.electronAPI.on('schedule:changed', () => void load())
        return () => { mounted = false; unsubscribe() }
    }, [])

    const finish = async (event: Event) => {
        await window.electronAPI.event.update(event.id, { is_completed: true })
    }

    return (
        <section className="mx-3 mb-3 max-h-[calc(100vh-3.75rem)] overflow-y-auto py-3">
            <p className="mb-2 text-[11px] text-zinc-500">未完成待办 · 按截止时间排序</p>
            {loading ? <Loading /> : items.length === 0 ? <Empty text="所有待办已完成" /> : (
                <div className="space-y-1.5">
                    {items.slice(0, 3).map((event) => (
                        <div key={event.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 px-2 py-2 dark:border-zinc-800">
                            <button onClick={() => void finish(event)} aria-label={`完成 ${event.title}`} className="h-4 w-4 shrink-0 rounded border border-amber-400 hover:bg-amber-400" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{event.title}</p>
                                <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-300">{event.is_all_day ? dayjs(event.start_at).format('M月D日 截止') : dayjs(event.start_at).format('M月D日 HH:mm')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <button onClick={() => void window.electronAPI.window.openConsole()} className="mt-3 w-full rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">管理全部待办</button>
        </section>
    )
}

export function Loading(): JSX.Element { return <div className="flex h-24 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950 dark:border-zinc-800 dark:border-t-zinc-50" /></div> }
export function Empty({ text }: { text: string }): JSX.Element { return <div className="rounded-lg border border-dashed border-zinc-200 py-7 text-center text-xs text-zinc-400 dark:border-zinc-800">{text}</div> }
