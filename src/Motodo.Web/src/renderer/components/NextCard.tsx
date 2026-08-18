import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import FocusCard from '@/components/FocusCard'
import { useEventUiStore } from '@/stores/event-ui.store'

/** The action card deliberately limits each list: it is a decision surface, not a second dashboard. */
export default function NextCard(): JSX.Element {
    const [todos, setTodos] = useState<Event[]>([])
    const [upcoming, setUpcoming] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const contentRef = useRef<HTMLElement>(null)
    const openCreate = useEventUiStore((state) => state.openCreate)
    const openDetail = useEventUiStore((state) => state.openDetail)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            try {
                const now = dayjs()
                const [allTodos, planned] = await Promise.all([
                    window.electronAPI.event.query({
                        start: '2000-01-01T00:00:00.000Z', end: '2100-01-01T00:00:00.000Z',
                        item_type: 'todo', is_completed: false, expand: false
                    }) as Promise<Event[]>,
                    window.electronAPI.event.query({ start: now.toISOString(), end: now.add(12, 'hour').toISOString() }) as Promise<Event[]>
                ])
                if (!mounted) return
                setTodos(allTodos.sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 3))
                setUpcoming(planned
                    .filter((event) => event.item_type !== 'todo' && !event.is_completed)
                    .sort((a, b) => a.start_at.localeCompare(b.start_at))
                    .slice(0, 2))
            } finally {
                if (mounted) setLoading(false)
            }
        }
        void load()
        const timer = window.setInterval(() => void load(), 60_000)
        const unsubscribe = window.electronAPI.on('schedule:changed', () => void load())
        return () => { mounted = false; window.clearInterval(timer); unsubscribe() }
    }, [])

    useLayoutEffect(() => {
        const element = contentRef.current
        if (!element) return
        let frame = 0
        const resize = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                void window.electronAPI.card.resize('next', 390, Math.ceil(element.scrollHeight + 44))
            })
        }
        const observer = new ResizeObserver(resize)
        observer.observe(element)
        resize()
        return () => { observer.disconnect(); cancelAnimationFrame(frame) }
    }, [])
    const completeTodo = async (event: Event) => {
        await window.electronAPI.event.update(event.id, { is_completed: true })
    }

    const openFocusedEvent = async (eventId: string) => {
        const events = await window.electronAPI.event.query({ start: '2000-01-01T00:00:00.000Z', end: '2100-01-01T00:00:00.000Z', expand: false }) as Event[]
        const event = events.find((item) => item.id === eventId)
        if (event) openDetail(event)
    }

    return (
        <section ref={contentRef} className="mx-3 my-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
            <FocusCard cardKind="next" autoResize={false} onOpenEvent={(eventId) => void openFocusedEvent(eventId)} />

            <div className="mt-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-medium text-zinc-500">待完成</p>
                    <button onClick={() => openCreate('todo')} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950/40">+ 待办</button>
                </div>
                {loading ? <div className="h-8 animate-pulse rounded-md bg-zinc-50 dark:bg-zinc-900" /> : todos.length === 0 ? (
                    <p className="rounded-md bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-400 dark:bg-zinc-900">没有待完成事项</p>
                ) : <div className="space-y-1">{todos.map((event) => (
                    <div key={event.id} className="flex items-center gap-2 rounded-md border border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
                        <button onClick={() => void completeTodo(event)} aria-label={`完成 ${event.title}`} className="h-3.5 w-3.5 shrink-0 rounded border border-amber-400 hover:bg-amber-400" />
                        <button onClick={() => openDetail(event)} className="min-w-0 flex-1 truncate text-left text-[11px] font-medium hover:text-primary-600">{event.title}</button>
                        <span className="shrink-0 text-[9px] text-amber-600 dark:text-amber-300">{event.is_all_day ? dayjs(event.start_at).format('M/D') : dayjs(event.start_at).format('HH:mm')}</span>
                    </div>
                ))}</div>}
            </div>

            <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-medium text-zinc-500">即将开始</p>
                    <button onClick={() => openCreate('plan')} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950/40">+ 计划</button>
                </div>
                {loading ? <div className="h-8 animate-pulse rounded-md bg-zinc-50 dark:bg-zinc-900" /> : upcoming.length === 0 ? (
                    <p className="rounded-md bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-400 dark:bg-zinc-900">未来 12 小时没有安排</p>
                ) : <div className="space-y-1">{upcoming.map((event) => (
                    <button key={event.id} onClick={() => openDetail(event)} className="flex w-full items-center gap-2 rounded-md border border-zinc-100 px-2 py-1.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                        <span className="w-9 shrink-0 text-[10px] font-medium text-primary-600 dark:text-primary-300">{event.is_all_day ? '全天' : dayjs(event.start_at).format('HH:mm')}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{event.title}</span>
                    </button>
                ))}</div>}
            </div>
        </section>
    )
}