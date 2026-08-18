import { useEffect, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { useViewStore } from '@/stores/view.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getMonthGrid, getWeekdayLabels, isToday } from '@shared/utils/date'
import Icon from '@/components/ui/Icons'
import YearCalendarPopover from '@/components/YearCalendar'

export default function MiniCalendar(): JSX.Element {
    const { currentDate, navigateDate } = useViewStore()
    const weekStartsOn = useSettingsStore((s) => s.weekStartsOn)
    const [expanded, setExpanded] = useState(false)
    const [displayMonth, setDisplayMonth] = useState<Dayjs>(() => dayjs(currentDate).startOf('month'))
    const cardRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setDisplayMonth(dayjs(currentDate).startOf('month'))
    }, [currentDate])

    const weekdayLabels = getWeekdayLabels(weekStartsOn)
    const days = getMonthGrid(displayMonth.toDate(), weekStartsOn)

    const pickDate = (date: Date) => {
        navigateDate(date)
        setExpanded(false)
    }

    const iconButtonClass =
        'flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors ' +
        'hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'

    return (
        <div ref={cardRef} className="select-none">
            {/* 卡片头部：月份 + 翻页 + 展开年历 */}
            <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {displayMonth.format('YYYY年M月')}
                </span>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setDisplayMonth((m) => m.subtract(1, 'month'))}
                        aria-label="上个月"
                        className={iconButtonClass}
                    >
                        <Icon name="chevron-left" className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setDisplayMonth((m) => m.add(1, 'month'))}
                        aria-label="下个月"
                        className={iconButtonClass}
                    >
                        <Icon name="chevron-right" className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        aria-label={expanded ? '收起年历' : '展开年历'}
                        className={`${iconButtonClass} ${expanded ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200' : ''}`}
                    >
                        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* 月历网格 */}
            <div className="grid grid-cols-7 gap-0.5">
                {weekdayLabels.map((label, i) => (
                    <div
                        key={i}
                        className={`py-0.5 text-center text-[10px] font-medium
                            ${i === 6 || (weekStartsOn === 0 && i === 0)
                                ? 'text-zinc-300 dark:text-zinc-600'
                                : 'text-zinc-400'
                            }`}
                    >
                        {label}
                    </div>
                ))}
                {days.map((day, idx) => {
                    const isOtherMonth = day.getMonth() !== displayMonth.month()
                    const today = isToday(day)
                    return (
                        <button
                            key={idx}
                            onClick={() => pickDate(day)}
                            className={`aspect-square flex items-center justify-center rounded-md text-xs
                                transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700
                                ${isOtherMonth ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-700 dark:text-zinc-300'}
                                ${today ? 'bg-zinc-950 font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200' : ''}`}
                        >
                            {day.getDate()}
                        </button>
                    )
                })}
            </div>

            {/* 年历浮层：右侧显示，不改变主内容布局 */}
            {expanded && <YearCalendarPopover anchorRef={cardRef} onClose={() => setExpanded(false)} />}
        </div>
    )
}
