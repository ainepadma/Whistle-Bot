import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { Empty, Loading } from '@/components/TodoCard'

export default function UpcomingCard(): JSX.Element {
    const [items, setItems] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            try {
                const now = dayjs()
                const events = await window.electronAPI.event.query({ start: now.toISOString(), end: now.add(12, 'hour').toISOString() }) as Event[]
                if (mounted) setItems(events.filter((event) => event.item_type !== 'todo').sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 6))
            } finally {
                if (mounted) setLoading(false)
            }
        }
        void load()
        const timer = window.setInterval(() => void load(), 60_000)
        const unsubscribe = window.electronAPI.on('schedule:changed', () => void load())
        return () => { mounted = false; window.clearInterval(timer); unsubscribe() }
    }, [])

    return (
        <section className="mx-3 mb-3 max-h-[calc(100vh-3.75rem)] overflow-y-auto py-3">
            <p className="mb-2 text-[11px] text-zinc-500">未来 12 小时</p>
            {loading ? <Loading /> : items.length === 0 ? <Empty text="未来 12 小时没有安排" /> : (
                <div className="space-y-1.5">
                    {items.map((event) => (
                        <button key={event.id} onClick={() => void window.electronAPI.window.openEdit(event)} className="flex w-full items-center gap-2 rounded-lg border border-zinc-100 px-2 py-2 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                            <span className="w-12 shrink-0 text-[11px] font-medium text-primary-600 dark:text-primary-300">{event.is_all_day ? '全天' : dayjs(event.start_at).format('HH:mm')}</span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{event.title}</span>
                        </button>
                    ))}
                </div>
            )}
            <button onClick={() => void window.electronAPI.window.openConsole()} className="mt-3 w-full rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">打开日程控制台</button>
        </section>
    )
}
