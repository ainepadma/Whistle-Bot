type CardKind = 'calendar' | 'today' | 'next' | 'manage'

const CARDS: { kind: CardKind; label: string }[] = [
    { kind: 'next', label: '行动' },
    { kind: 'today', label: '今天' },
    { kind: 'calendar', label: '日历' },
    { kind: 'manage', label: '管理' }
]

/** Unpinned cards switch in place; pinned cards keep their spot and open the target alongside them. */
export default function CardLinks({ current, pinned }: { current: CardKind; pinned: boolean }): JSX.Element {
    const open = (target: CardKind) => {
        if (target === current) return
        if (pinned) void window.electronAPI.card.show(target)
        else void window.electronAPI.card.switch(current, target)
    }

    return (
        <div className="flex items-center gap-0.5">
            {CARDS.map(({ kind, label }) => (
                <button key={kind} onClick={() => open(kind)} title={pinned ? `添加${label}卡片` : `切换到${label}`}
                    className={`rounded px-1.5 py-1 text-[10px] transition-colors ${kind === current ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}>
                    {label}
                </button>
            ))}
        </div>
    )
}