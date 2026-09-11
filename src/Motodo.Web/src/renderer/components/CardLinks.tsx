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
                <button key={kind} onClick={() => open(kind)} aria-current={kind === current ? 'page' : undefined} title={pinned ? `添加${label}卡片` : `切换到${label}`}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${kind === current ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}>
                    {label}
                </button>
            ))}
        </div>
    )
}
