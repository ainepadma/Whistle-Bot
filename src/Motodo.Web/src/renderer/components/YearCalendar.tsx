import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { useViewStore } from '@/stores/view.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getMonthGrid, getWeekdayLabels, isToday } from '@shared/utils/date'
import Icon from '@/components/ui/Icons'

interface YearCalendarPopoverProps {
    anchorRef: React.RefObject<HTMLDivElement | null>
    onClose: () => void
}

/**
 * 年历浮层：锚定在左侧概览日历卡片的右侧，悬浮显示全年，
 * 不改变主内容布局、不铺全屏遮罩；点外部、选日期或点关闭时收起。
 */
export default function YearCalendarPopover({ anchorRef, onClose }: YearCalendarPopoverProps): JSX.Element {
    const { currentDate, navigateDate } = useViewStore()
    const weekStartsOn = useSettingsStore((s) => s.weekStartsOn)
    const [displayYear, setDisplayYear] = useState<number>(() => dayjs(currentDate).year())
    const panelRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ left: 0, top: 0 })

    useEffect(() => {
        setDisplayYear(dayjs(currentDate).year())
    }, [currentDate])

    useLayoutEffect(() => {
        const r = anchorRef.current?.getBoundingClientRect()
        if (!r) return
        const width = 420
        const left = Math.min(r.right + 8, Math.max(8, window.innerWidth - width - 8))
        setPos({ left, top: Math.max(8, r.top) })
    }, [anchorRef])

    // 点击浮层与触发卡片之外的位置时收起
    useEffect(() => {
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement
            if (panelRef.current?.contains(target)) return
            if (anchorRef.current?.contains(target)) return
            onClose()
        }
        window.addEventListener('pointerdown', handler)
        return () => window.removeEventListener('pointerdown', handler)
    }, [anchorRef, onClose])

    const months = Array.from({ length: 12 }, (_, i) => dayjs(new Date(displayYear, i, 1)))
    const pickDate = (date: Date) => {
        navigateDate(date)
        onClose()
    }
    const iconButtonClass =
        'flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors ' +
        'hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'

    return (
        <div
            ref={panelRef}
            className="fixed z-40 max-h-[calc(100vh-1rem)] w-[420px] overflow-y-auto rounded-xl border
             border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            style={{ left: pos.left, top: pos.top }}
        >
            <div className="mb-3 flex items-center justify-between">
                <button
                    onClick={() => setDisplayYear((y) => y - 1)}
                    aria-label="上一年"
                    className={iconButtonClass}
                >
                    <Icon name="chevron-left" className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{displayYear} 年</span>
                <button
                    onClick={() => setDisplayYear((y) => y + 1)}
                    aria-label="下一年"
                    className={iconButtonClass}
                >
                    <Icon name="chevron-right" className="h-4 w-4" />
                </button>
                <button onClick={onClose} aria-label="关闭年历" className={`${iconButtonClass} ml-2`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {months.map((month) => (
                    <YearMonthCell
                        key={month.month()}
                        month={month}
                        currentDate={currentDate}
                        weekStartsOn={weekStartsOn}
                        onPick={pickDate}
                    />
                ))}
            </div>
        </div>
    )
}

/** 年历中的单个月份：紧凑网格，今天高亮，当前月描边 */
function YearMonthCell({
    month,
    currentDate,
    weekStartsOn,
    onPick
}: {
    month: Dayjs
    currentDate: string
    weekStartsOn: 0 | 1
    onPick: (date: Date) => void
}): JSX.Element {
    const weekdayLabels = getWeekdayLabels(weekStartsOn)
    const days = getMonthGrid(month.toDate(), weekStartsOn)
    const isCurrentMonth = month.isSame(dayjs(currentDate), 'month')

    return (
        <div
            className={`rounded-lg border p-1.5 ${
                isCurrentMonth
                    ? 'border-zinc-950 dark:border-zinc-50'
                    : 'border-zinc-100 dark:border-zinc-800'
            }`}
        >
            <div className="mb-1 text-center text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                {month.format('M月')}
            </div>
            <div className="grid grid-cols-7">
                {weekdayLabels.map((label, i) => (
                    <span key={i} className="text-center text-[7px] leading-none text-zinc-400">
                        {label}
                    </span>
                ))}
                {days.map((day, i) => {
                    const isOther = day.getMonth() !== month.month()
                    const today = isToday(day)
                    return (
                        <button
                            key={i}
                            onClick={() => onPick(day)}
                            className={`aspect-square rounded-md text-center text-[9px] leading-none transition-colors
                                ${isOther ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-600 dark:text-zinc-400'}
                                ${today
                                    ? 'bg-zinc-950 font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950'
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {day.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
