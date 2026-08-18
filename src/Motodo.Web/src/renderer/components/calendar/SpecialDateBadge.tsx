import type { SpecialDate } from '@shared/types/special-date'

interface SpecialDateBadgeProps {
    special?: SpecialDate | null
    className?: string
}

/** 节假日/特殊日期徽标，月/周/日视图共用 */
export default function SpecialDateBadge({ special, className = '' }: SpecialDateBadgeProps): JSX.Element | null {
    if (!special) return null
    return (
        <span
            className={`inline-block text-[9px] leading-tight px-1 py-px rounded ${className} ${
                special.type === 'holiday'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
        >
            {special.label || (special.type === 'holiday' ? '节假日' : '特殊')}
        </span>
    )
}
