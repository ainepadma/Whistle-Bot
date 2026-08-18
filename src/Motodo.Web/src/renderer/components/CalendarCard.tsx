import { useState } from 'react'
import CalendarPage from '@/pages/CalendarPage'
import Icon from '@/components/ui/Icons'

/** Full calendar remains primary; the old console mini calendar is an on-demand date navigator. */
export default function CalendarCard(): JSX.Element {
    const [showNavigator, setShowNavigator] = useState(false)
    return (
        <div className="flex h-full min-h-0">
            <aside className="flex w-10 shrink-0 flex-col items-center border-r border-zinc-100 bg-zinc-50/70 pt-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                <button onClick={() => setShowNavigator((value) => !value)} title={showNavigator ? '收起日期导航' : '打开日期导航'}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${showNavigator ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                    <Icon name="calendar" className="h-4 w-4" />
                </button>
                <span className="mt-2 [writing-mode:vertical-rl] text-[10px] tracking-wider text-zinc-400">日期</span>
            </aside>
            <div className="min-w-0 flex-1"><CalendarPage showMiniCalendar={showNavigator} /></div>
        </div>
    )
}