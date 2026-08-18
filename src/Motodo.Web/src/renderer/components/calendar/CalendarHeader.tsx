import dayjs from 'dayjs'
import { useViewStore } from '@/stores/view.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getWeekStart, getIsoWeek } from '@shared/utils/date'
import { ViewType } from '@shared/constants/enums'
import Icon, { type IconName } from '@/components/ui/Icons'

const VIEW_OPTIONS: { key: ViewType; label: string; icon: IconName }[] = [
    { key: ViewType.MONTH, label: '月', icon: 'view-month' },
    { key: ViewType.WEEK, label: '周', icon: 'view-week' },
    { key: ViewType.DAY, label: '日', icon: 'view-day' }
]

export default function CalendarHeader(): JSX.Element {
    const { currentView, currentDate, goNext, goPrev, goToday, setView } = useViewStore()
    const weekStartsOn = useSettingsStore((s) => s.weekStartsOn)
    const d = dayjs(currentDate)

    const title = (() => {
        switch (currentView) {
            case ViewType.MONTH:
                return d.format('YYYY 年 M 月')
            case ViewType.WEEK: {
                const weekStart = dayjs(getWeekStart(d.toDate(), weekStartsOn))
                const weekEnd = weekStart.add(6, 'day')
                if (weekStart.month() === weekEnd.month()) {
                    return `${weekStart.format('YYYY 年 M 月 D 日')} - ${weekEnd.format('D 日')}`
                }
                return `${weekStart.format('M 月 D 日')} - ${weekEnd.format('M 月 D 日')}`
            }
            case ViewType.DAY:
                return d.format('YYYY 年 M 月 D 日 dddd')
        }
    })()

    const weekSubtitle =
        currentView === ViewType.WEEK ? `第 ${getIsoWeek(getWeekStart(d.toDate(), weekStartsOn))} 周` : null

    const isCurrentPeriod = (() => {
        if (currentView === ViewType.MONTH) return d.isSame(dayjs(), 'month')
        if (currentView === ViewType.DAY) return d.isSame(dayjs(), 'day')
        return (
            getWeekStart(d.toDate(), weekStartsOn).getTime() ===
            getWeekStart(new Date(), weekStartsOn).getTime()
        )
    })()

    return (
        <div
            className="flex min-h-14 items-center justify-between gap-3 border-b border-zinc-200
             bg-white/80 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70"
        >
            {/* 左侧：标题 + 周数徽标 */}
            <div className="flex min-w-0 items-center gap-3">
                <h2 className="select-none truncate text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {title}
                </h2>
                {weekSubtitle && (
                    <span
                        className="hidden shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5
                         text-[10px] font-medium text-zinc-500 sm:inline-block dark:border-zinc-800
                         dark:bg-zinc-900 dark:text-zinc-400"
                    >
                        {weekSubtitle}
                    </span>
                )}
            </div>

            {/* 右侧：日期导航 + 视图切换 */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={goPrev}
                        aria-label="上一段"
                        className="ui-icon-button border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    >
                        <Icon name="arrow-left" className="h-4 w-4" />
                    </button>
                    <button
                        onClick={goToday}
                        className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors
                            ${isCurrentPeriod
                                ? 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
                                : 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200'
                            }`}
                    >
                        今天
                    </button>
                    <button
                        onClick={goNext}
                        aria-label="下一段"
                        className="ui-icon-button border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    >
                        <Icon name="arrow-left" className="h-4 w-4 rotate-180" />
                    </button>
                </div>

                {/* 视图切换 */}
                <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
                    {VIEW_OPTIONS.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() => setView(key)}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors
                                ${currentView === key
                                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                        >
                            <Icon name={icon} className="h-3.5 w-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
