import { lazy, Suspense, useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icons'

type ManagementPage = 'home' | 'plan' | 'todo' | 'semester' | 'course' | 'calendar-settings' | 'cards' | 'search' | 'data' | 'settings'

const PlanManagementPage = lazy(() => import('@/pages/PlanManagementPage'))
const TodoManagementPage = lazy(() => import('@/pages/TodoManagementPage'))
const SemesterPage = lazy(() => import('@/pages/SemesterPage'))
const CoursePage = lazy(() => import('@/pages/CoursePage'))
const CalendarSettingsPage = lazy(() => import('@/pages/CalendarSettingsPage'))
const CardManagementPage = lazy(() => import('@/pages/CardManagementPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const DataTransferPage = lazy(() => import('@/pages/DataTransferPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

const ACTIONS: { page: Exclude<ManagementPage, 'home'>; label: string; description: string; icon: IconName }[] = [
    { page: 'plan', label: '计划', description: '管理全部计划与重复安排', icon: 'plan' },
    { page: 'todo', label: '待办', description: '整理、筛选与完成任务', icon: 'todo' },
    { page: 'semester', label: '学期', description: '设置学期与教学周', icon: 'semester' },
    { page: 'course', label: '课程', description: '维护课程与上课时间', icon: 'course' },
    { page: 'calendar-settings', label: '日历设置', description: '工作周、显示与节次', icon: 'calendar-settings' },
    { page: 'cards', label: '桌面卡片', description: '显示、固定与整理卡片', icon: 'card' },
    { page: 'search', label: '搜索', description: '跨日程与待办查找', icon: 'search' },
    { page: 'data', label: '导入与导出', description: 'ICS、JSON 与备份', icon: 'transfer' },
    { page: 'settings', label: '设置', description: '主题、提醒与应用偏好', icon: 'settings' }
]

/** Holds every non-calendar console tool while preserving the original icon language. */
export default function ManagementCard(): JSX.Element {
    const [page, setPage] = useState<ManagementPage>('home')
    const back = () => setPage('home')

    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/80 dark:bg-zinc-950">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/75 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/75">
                <div>{page === 'home' ? <p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-zinc-300">日程管理工具</p> : <button onClick={back} className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-zinc-800">← 返回管理</button>}</div>

            </div>
            {page === 'home' ? (
                <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-3">
                    {ACTIONS.map((action) => (
                        <button key={action.page} onClick={() => setPage(action.page)} className="flex min-h-24 flex-col rounded-xl border border-slate-200/90 bg-white p-3 text-left shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:border-primary-300 hover:bg-primary-50/40 hover:shadow-[0_8px_18px_rgba(37,99,235,0.10)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-primary-800 dark:hover:bg-primary-950/20">
                            <Icon name={action.icon} className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                            <span className="mt-2 text-xs font-semibold">{action.label}</span>
                            <span className="mt-1 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">{action.description}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" /></div>}>
                        {page === 'plan' && <PlanManagementPage onBack={back} />}
                        {page === 'todo' && <TodoManagementPage onBack={back} />}
                        {page === 'semester' && <SemesterPage onBack={back} />}
                        {page === 'course' && <CoursePage onBack={back} />}
                        {page === 'calendar-settings' && <CalendarSettingsPage onBack={back} />}
                        {page === 'cards' && <CardManagementPage onBack={back} />}
                        {page === 'search' && <SearchPage onBack={back} />}
                        {page === 'data' && <DataTransferPage onBack={back} />}
                        {page === 'settings' && <SettingsPage onBack={back} />}
                    </Suspense>
                </div>
            )}
        </section>
    )
}