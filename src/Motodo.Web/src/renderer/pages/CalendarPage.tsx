import { useEffect } from 'react'
import { useViewStore } from '@/stores/view.store'
import { useEvents } from '@/hooks/useEvents'
import { useSpecialDatesStore } from '@/stores/special-dates.store'
import { ViewType } from '@shared/constants/enums'
import CalendarHeader from '@/components/calendar/CalendarHeader'
import MonthView from '@/components/calendar/MonthView'
import WeekView from '@/components/calendar/WeekView'
import DayView from '@/components/calendar/DayView'
import MiniCalendar from '@/components/MiniCalendar'

export default function CalendarPage({ showMiniCalendar = false }: { showMiniCalendar?: boolean }): JSX.Element {
    const { currentView } = useViewStore()
    const { loading, error } = useEvents()
    const loadSpecialDates = useSpecialDatesStore((s) => s.loadAll)

    useEffect(() => { loadSpecialDates() }, [loadSpecialDates])

    return (
        <div className="flex h-full min-h-0">
            {showMiniCalendar && (
                <aside className="w-44 shrink-0 border-r border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <MiniCalendar />
                </aside>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
                <CalendarHeader />
                <div className="flex-1 overflow-hidden">
                    {loading && <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950 dark:border-zinc-800 dark:border-t-zinc-50" /></div>}
                    {error && <div className="flex h-full items-center justify-center p-6"><div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">加载失败：{error}</div></div>}
                    {!loading && !error && <>
                        {currentView === ViewType.MONTH && <MonthView />}
                        {currentView === ViewType.WEEK && <WeekView />}
                        {currentView === ViewType.DAY && <DayView />}
                    </>}
                </div>
            </div>
        </div>
    )
}