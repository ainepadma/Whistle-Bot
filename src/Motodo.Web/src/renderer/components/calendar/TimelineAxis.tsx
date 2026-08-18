import dayjs from 'dayjs'
import { formatClock } from '@/utils/format'
import type { TimelineRow } from '@/utils/period-timeline'

interface TimelineAxisProps {
    timeline: TimelineRow[]
    hourMarks: number[]
    periodLines: number[]
    startMin: number
    bottomSpace: number
    pxPerMin: number
    timeFormat: '12h' | '24h'
}

/**
 * 时间轴左侧：时间刻度（左列） + 节次信息（右列，含节次网格线）。
 * 周视图与日视图共用。
 */
export default function TimelineAxis({
    timeline,
    hourMarks,
    periodLines,
    startMin,
    bottomSpace,
    pxPerMin,
    timeFormat
}: TimelineAxisProps): JSX.Element {
    return (
        <div className="w-24 flex-shrink-0 flex">
            {/* 时间刻度 */}
            <div className="w-11 flex-shrink-0 relative">
                {timeline.map((row) => <div key={row.key} style={{ height: `${row.height}px` }} />)}
                <div style={{ height: `${bottomSpace}px` }} />
                {hourMarks.map((m) => (
                    <div
                        key={`t${m}`}
                        className="absolute right-1 leading-none"
                        style={{ top: `${(m - startMin) * pxPerMin}px` }}
                    >
                        <span className="text-[9px] text-zinc-400">
                            {formatClock(dayjs().startOf('day').add(m, 'minute'), timeFormat)}
                        </span>
                    </div>
                ))}
            </div>

            {/* 节次信息 */}
            <div className="flex-1 relative border-l border-r border-zinc-200/80 dark:border-zinc-700/70">
                {timeline.map((row) => (
                    <div key={row.key} className="relative" style={{ height: `${row.height}px` }}>
                        {row.label && (
                            <div className="absolute left-1 top-0">
                                <div className="text-[9px] font-medium leading-tight text-zinc-600 dark:text-zinc-400">
                                    {row.label}
                                </div>
                                <div className="text-[8px] leading-tight text-zinc-500 dark:text-zinc-400">
                                    {row.sublabel}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div style={{ height: `${bottomSpace}px` }} />
                {periodLines.map((m) => (
                    <div
                        key={`pl${m}`}
                        className="absolute left-0 right-0 border-t border-zinc-300/80 dark:border-zinc-600/70"
                        style={{ top: `${(m - startMin) * pxPerMin}px` }}
                    />
                ))}
            </div>
        </div>
    )
}
