import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface ActiveFocusEvent {
    id: string
    title: string
    itemType: string
    isCompleted: boolean
    startAt: string
    focusCount: number
    focusSeconds: number
}

interface FocusSnapshot {
    mode: string
    status: string
    remainingSeconds: number
    totalSeconds: number
    presetId: string
    cycleIndex: number
    customMinutes: number
    customBreakMinutes: number
    customLongBreakMinutes: number
    customRounds: number
    label: string
    activeEventId?: string | null
    activeEvent?: ActiveFocusEvent | null
}

const EMPTY: FocusSnapshot = {
    mode: 'idle', status: 'idle', remainingSeconds: 1500, totalSeconds: 1500,
    presetId: '25-5', cycleIndex: 0, customMinutes: 45, customBreakMinutes: 5,
    customLongBreakMinutes: 15, customRounds: 6, label: '准备专注'
}

const PRESETS = [
    { id: '25-5', label: '25 / 5' },
    { id: '45-10', label: '45 / 10' },
    { id: '60-15', label: '60 / 15' },
    { id: 'custom', label: '自定义' }
] as const

interface FocusCardProps {
    cardKind?: 'next' | 'focus'
    autoResize?: boolean
    onOpenEvent?: (eventId: string) => void
}

export default function FocusCard({ cardKind = 'focus', autoResize = true, onOpenEvent }: FocusCardProps): JSX.Element {
    const [state, setState] = useState<FocusSnapshot>(EMPTY)
    const [custom, setCustom] = useState({ minutes: 45, breakMinutes: 5, longBreakMinutes: 15, rounds: 6 })
    const contentRef = useRef<HTMLElement>(null)

    const loadState = async () => setState(await window.electronAPI.focus.getState() as FocusSnapshot)

    useEffect(() => {
        let mounted = true
        const refresh = () => void window.electronAPI.focus.getState().then((next: FocusSnapshot) => {
            if (mounted) setState(next)
        })
        refresh()
        const unsubscribers = [
            window.electronAPI.on('focus:state', refresh),
            window.electronAPI.on('focus:finished', refresh),
            window.electronAPI.on('schedule:changed', refresh)
        ]
        return () => {
            mounted = false
            unsubscribers.forEach((unsubscribe) => unsubscribe())
        }
    }, [])

    useEffect(() => {
        setCustom({
            minutes: state.customMinutes,
            breakMinutes: state.customBreakMinutes,
            longBreakMinutes: state.customLongBreakMinutes,
            rounds: state.customRounds
        })
    }, [state.customMinutes, state.customBreakMinutes, state.customLongBreakMinutes, state.customRounds])

    useLayoutEffect(() => {
        if (!autoResize) return
        const frame = requestAnimationFrame(() => {
            const contentHeight = contentRef.current?.scrollHeight ?? 166
            void window.electronAPI.card.resize(cardKind, 332, Math.ceil(contentHeight + 44))
        })
        return () => cancelAnimationFrame(frame)
    }, [autoResize, cardKind, state.presetId, state.activeEvent?.id, state.activeEvent?.isCompleted, state.activeEvent?.focusCount])
    const minutes = Math.floor(Math.max(0, state.remainingSeconds) / 60)
    const seconds = Math.max(0, state.remainingSeconds) % 60
    const progress = state.totalSeconds > 0
        ? Math.max(0, Math.min(100, (1 - state.remainingSeconds / state.totalSeconds) * 100))
        : 0
    const button = state.status === 'running' ? '暂停' : state.status === 'paused' ? '继续' : '开始'
    const rounds = state.presetId === 'custom' ? state.customRounds : 4
    const locked = state.status === 'running'

    const updateCustom = (key: keyof typeof custom, value: string) => {
        setCustom((current) => ({ ...current, [key]: Number(value) }))
    }

    const applyCustom = () => {
        void window.electronAPI.focus.setCustom({
            minutes: Math.max(1, Math.min(180, custom.minutes || 45)),
            breakMinutes: Math.max(1, Math.min(120, custom.breakMinutes || 5)),
            longBreakMinutes: Math.max(1, Math.min(240, custom.longBreakMinutes || 15)),
            rounds: Math.max(1, Math.min(8, custom.rounds || 6))
        })
    }

    const runAndRefresh = async (action: () => Promise<unknown>) => {
        await action()
        await loadState()
    }

    return (
        <section ref={contentRef} className="mx-0 mb-2 overflow-hidden py-0">
            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{state.label}</span>
                <span>第 {Math.min(rounds, state.cycleIndex + 1)}/{rounds} 轮</span>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
                {PRESETS.map((preset) => (
                    <button key={preset.id} disabled={locked}
                        onClick={() => void window.electronAPI.focus.setPreset(preset.id)}
                        className={`rounded-md border px-1 py-1.5 text-[11px] transition-colors disabled:cursor-default disabled:opacity-50 ${state.presetId === preset.id
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                            : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900'}`}>
                        {preset.label}
                    </button>
                ))}
            </div>

            {state.presetId === 'custom' && (
                <div className="mt-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/70">
                    <div className="grid grid-cols-4 gap-1.5">
                        <CustomInput label="专注" value={custom.minutes} max={180} disabled={locked} onChange={(value) => updateCustom('minutes', value)} />
                        <CustomInput label="短休" value={custom.breakMinutes} max={120} disabled={locked} onChange={(value) => updateCustom('breakMinutes', value)} />
                        <CustomInput label="长休" value={custom.longBreakMinutes} max={240} disabled={locked} onChange={(value) => updateCustom('longBreakMinutes', value)} />
                        <CustomInput label="轮数" value={custom.rounds} max={8} disabled={locked} onChange={(value) => updateCustom('rounds', value)} />
                    </div>
                    <button disabled={locked} onClick={applyCustom} className="mt-2 w-full rounded-md bg-primary-500 py-1 text-[11px] font-medium text-white disabled:opacity-50">应用自定义</button>
                </div>
            )}

            <div className="relative mt-2">
                <div className="text-center font-mono text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <div className="absolute bottom-1 right-1 flex items-center gap-1" aria-label={`第 ${Math.min(rounds, state.cycleIndex + 1)} / ${rounds} 轮`}>
                    {Array.from({ length: rounds }, (_, index) => (
                        <span key={index} className={`h-1.5 w-1.5 rounded-full ${index <= state.cycleIndex ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                    ))}
                </div>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-primary-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
                <button onClick={() => void window.electronAPI.focus.toggle()} className="rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600">{button}</button>
                <button onClick={() => void window.electronAPI.focus.reset()} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">重置</button>
                <button onClick={() => void window.electronAPI.focus.skip()} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">跳过</button>
            </div>

            {state.activeEvent && (
                <div className="mt-2 rounded-lg border border-primary-100 bg-primary-50/70 px-2.5 py-2 dark:border-primary-900 dark:bg-primary-950/30">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-primary-800 dark:text-primary-200">{state.activeEvent.title}</p>
                            <p className="mt-0.5 text-[10px] text-primary-600/80 dark:text-primary-400">已专注 {state.activeEvent.focusCount} 次 · 累计 {Math.round(state.activeEvent.focusSeconds / 60)} 分钟</p>
                        </div>
                        {state.activeEvent.isCompleted && <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-700">已完成</span>}
                    </div>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                        <button onClick={() => onOpenEvent ? onOpenEvent(state.activeEvent!.id) : void window.electronAPI.focus.openEvent()} className="rounded px-2 py-1 text-[10px] text-primary-700 hover:bg-primary-100">查看日程</button>
                        {state.activeEvent.itemType === 'todo' && !state.activeEvent.isCompleted && (
                            <button onClick={() => void runAndRefresh(() => window.electronAPI.focus.completeEvent())} className="rounded bg-primary-500 px-2 py-1 text-[10px] text-white hover:bg-primary-600">完成待办</button>
                        )}
                        <button onClick={() => void runAndRefresh(() => window.electronAPI.focus.detachEvent())} className="rounded px-2 py-1 text-[10px] text-zinc-500 hover:bg-white/70">解除关联</button>
                    </div>
                </div>
            )}
        </section>
    )
}

function CustomInput({ label, value, max, disabled, onChange }: {
    label: string
    value: number
    max: number
    disabled: boolean
    onChange: (value: string) => void
}): JSX.Element {
    return (
        <label className="text-[10px] text-zinc-500">
            <span className="mb-0.5 block text-center">{label}</span>
            <input type="number" min={1} max={max} value={value} disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded border border-zinc-200 bg-white px-1 py-1 text-center text-[11px] text-zinc-800 outline-none focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200" />
        </label>
    )
}