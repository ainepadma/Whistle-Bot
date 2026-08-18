import { useEffect, useState } from 'react'

type CardKind = 'calendar' | 'today' | 'next' | 'manage'
interface CardPresentation { kind: string; visible: boolean; pinned: boolean; alwaysOnTop: boolean }
interface Props { onBack: () => void }

const CARDS: { kind: CardKind; title: string; description: string }[] = [
    { kind: 'calendar', title: '日历', description: '保留月、周、日视图，在桌面直接浏览、新建和编辑日程。' },
    { kind: 'today', title: '今天', description: '查看当天安排、课程和待办，并可快速新建。' },
    { kind: 'next', title: '行动', description: '把番茄钟、待办和即将开始的安排收在一张行动卡片中。' },
    { kind: 'manage', title: '管理', description: '集中处理计划、待办、课程、搜索、数据和应用设置。' }
]

export default function CardManagementPage({ onBack }: Props): JSX.Element {
    const [states, setStates] = useState<Record<string, CardPresentation>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            const entries = await Promise.all(CARDS.map(async ({ kind }) => [kind, await window.electronAPI.card.getState(kind)] as const))
            if (mounted) { setStates(Object.fromEntries(entries)); setLoading(false) }
        }
        void load()
        const unsubscribe = window.electronAPI.on('card:state', (state: CardPresentation) => {
            if (state?.kind) setStates((current) => ({ ...current, [state.kind]: state }))
        })
        return () => { mounted = false; unsubscribe() }
    }, [])

    const toggle = async (kind: CardKind) => {
        const state = await window.electronAPI.card.toggle(kind) as CardPresentation
        setStates((current) => ({ ...current, [kind]: state }))
    }
    const pin = async (kind: CardKind) => {
        const state = await window.electronAPI.card.togglePinned(kind) as CardPresentation
        setStates((current) => ({ ...current, [kind]: state }))
    }

    return (
        <div className="flex h-full flex-col">
            <div className="ui-page-header">
                <button onClick={onBack} className="ui-icon-button" aria-label="返回">←</button>
                <div><h2 className="ui-page-title">桌面卡片</h2><p className="ui-page-description">在桌面上就能完成浏览、创建、编辑和专注。</p></div>
            </div>
            <div className="ui-page-content grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {CARDS.map((card) => {
                    const state = states[card.kind]
                    return <article key={card.kind} className="ui-card flex min-h-40 flex-col p-4">
                        <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{card.title}</h3><p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{card.description}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${state?.visible ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{state?.visible ? '显示中' : loading ? '读取中' : '已收起'}</span></div>
                        <div className="mt-auto flex gap-2 pt-4"><button onClick={() => void toggle(card.kind)} className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950">{state?.visible ? '收起卡片' : '显示卡片'}</button><button onClick={() => void pin(card.kind)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">{state?.pinned ? '解除固定' : '固定位置'}</button></div>
                    </article>
                })}
            </div>
        </div>
    )
}