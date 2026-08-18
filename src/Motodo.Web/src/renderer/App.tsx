import { useEffect } from 'react'
import CalendarPage from '@/pages/CalendarPage'
import ReminderAlert from '@/components/ReminderAlert'
import EventFlow from '@/components/EventFlow'
import SchedulePopups from '@/components/calendar/SchedulePopups'
import { useViewStore } from '@/stores/view.store'
import { useEventUiStore } from '@/stores/event-ui.store'
import { ViewType } from '@shared/constants/enums'

/**
 * 日程控制台现在只承担大屏日历浏览。
 * 原侧栏的管理功能全部迁入可固定的“管理”桌面卡片。
 */
export default function App(): JSX.Element {
    const { setView } = useViewStore()
    const openCreate = useEventUiStore((s) => s.openCreate)
    const openEdit = useEventUiStore((s) => s.openEdit)

    useEffect(() => {
        const unsubs: (() => void)[] = []
        unsubs.push(window.electronAPI.on('navigate', (path: unknown) => {
            if (typeof path !== 'string') return
            if (path === '/event/new') { openCreate(); return }
            if (path !== '/calendar') void window.electronAPI.card.show('manage')
        }))
        unsubs.push(window.electronAPI.on('switch-view', (view: unknown) => {
            if (typeof view === 'string' && Object.values(ViewType).includes(view as ViewType)) setView(view as ViewType)
        }))
        unsubs.push(window.electronAPI.on('export-calendar', () => void window.electronAPI.card.show('manage')))
        unsubs.push(window.electronAPI.on('event:edit', (payload: unknown) => {
            if (payload && typeof payload === 'object' && 'id' in payload) openEdit(payload as import('@shared/types/event').Event)
        }))
        return () => unsubs.forEach((unsubscribe) => unsubscribe())
    }, [setView, openCreate, openEdit])

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 p-2 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
            <main className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <CalendarPage />
            </main>
            <ReminderAlert />
            <EventFlow />
            <SchedulePopups />
        </div>
    )
}