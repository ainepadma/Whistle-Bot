import { useEffect, useState } from 'react'
import SchedulePopups from '@/components/calendar/SchedulePopups'
import TodayCard from '@/components/TodayCard'
import CreateCard from '@/components/CreateCard'
import EventFlow from '@/components/EventFlow'
import NextCard from '@/components/NextCard'
import CardLinks from '@/components/CardLinks'
import Icon from '@/components/ui/Icons'
import CalendarCard from '@/components/CalendarCard'
import ManagementCard from '@/components/ManagementCard'

type CardKind = 'calendar' | 'today' | 'next' | 'manage'

interface CardPresentation {
    kind: string
    visible: boolean
    pinned: boolean
    alwaysOnTop: boolean
}

function readKind(): CardKind {
    const kind = new URLSearchParams(window.location.search).get('type')
    if (kind === 'calendar') return 'calendar'
    if (kind === 'manage') return 'manage'
    // Existing pinned cards continue working after the three-card migration.
    if (kind === 'next' || kind === 'focus' || kind === 'todo' || kind === 'upcoming') return 'next'
    return 'today'
}


export default function CardApp(): JSX.Element {
    const kind = readKind()
    const [view, setView] = useState<'content' | 'create'>('content')
    const [createKey, setCreateKey] = useState(0)
    const [presentation, setPresentation] = useState<CardPresentation>({ kind, visible: true, pinned: false, alwaysOnTop: false })

    useEffect(() => {
        let mounted = true
        void window.electronAPI.card.getState(kind).then((next: CardPresentation) => {
            if (mounted) setPresentation(next)
        })
        const unsubscribe = window.electronAPI.on('card:state', (next: CardPresentation) => {
            if (next?.kind === kind) setPresentation(next)
        })
        return () => { mounted = false; unsubscribe() }
    }, [kind])

    const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if (presentation.pinned || (event.target as HTMLElement).closest('button, input, textarea, select')) return
        if (event.button === 0) void window.electronAPI.card.beginDrag(kind)
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden rounded-[18px] border border-slate-200/90 bg-slate-50 text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
            <div onPointerDown={startDrag}
                className={`flex h-10 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 text-xs shadow-[0_1px_0_rgba(15,23,42,0.02)] select-none dark:border-zinc-800 dark:bg-zinc-950 ${presentation.pinned ? 'cursor-default' : 'cursor-move'}`}>
                <div className="flex min-w-0 items-center"><CardLinks current={kind} pinned={presentation.pinned} /></div>
                <div className="flex items-center gap-1">
                    <button onClick={() => void window.electronAPI.card.togglePinned(kind)} aria-label={presentation.pinned ? '解除固定' : '固定在桌面'}
                        className={`group relative flex h-7 w-7 items-center justify-center rounded-md transition-colors ${presentation.pinned ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : 'text-zinc-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-zinc-800'}`}>
                        <Icon name="pin" className="h-3.5 w-3.5" />
                        <span role="tooltip" className="pointer-events-none absolute right-0 top-8 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">{presentation.pinned ? '已固定 · 点击解除' : '固定在桌面'}</span>
                    </button>
                    <button onClick={() => void window.electronAPI.card.close(kind)} aria-label="关闭卡片" className="group relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-zinc-800"><Icon name="close" className="h-3.5 w-3.5" /><span role="tooltip" className="pointer-events-none absolute right-0 top-8 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">关闭卡片</span></button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
                {view === 'create' ? (
                    <CreateCard key={createKey} onCancel={() => setView('content')} onSaved={() => { setCreateKey((value) => value + 1); setView('content') }} />
                ) : kind === 'calendar' ? <CalendarCard /> : kind === 'next' ? <NextCard /> : kind === 'manage' ? <ManagementCard /> : (
                    <TodayCard onClose={() => void window.electronAPI.card.close(kind)} onCreate={() => setView('create')} />
                )}
            </div>
            <SchedulePopups />
            <EventFlow />
        </div>
    )
}