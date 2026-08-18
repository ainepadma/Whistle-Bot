import type { ClassPeriod } from '@shared/types/semester'

export interface TimelineRow {
    key: string
    label: string // 节数标签，如 "第1节"；过渡行留空
    sublabel: string // 时间范围，如 "08:00-08:45"
    startMin: number
    endMin: number
    height: number // px
}

export function parseTimeToMin(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

function formatMin(min: number): string {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 按学期节次生成时间轴行：过渡行 + 每一节一行，行高 = 时长 × pxPerMin。
 * 支持自定义窗口 [startMin, endMin]；endMin <= startMin 时视为跨午夜（顺延到次日）。
 */
export function buildTimeline(
    periods: ClassPeriod[],
    pxPerMin: number,
    startMin: number,
    endMin: number
): TimelineRow[] {
    const timelineEnd = endMin <= startMin ? endMin + 1440 : endMin
    const sorted = [...periods].sort((a, b) => parseTimeToMin(a.start) - parseTimeToMin(b.start))
    const inRange = sorted.filter((p) => {
        const s = parseTimeToMin(p.start)
        const e = parseTimeToMin(p.end)
        return s >= startMin && s < timelineEnd && e > s
    })
    const rows: TimelineRow[] = []
    const firstStart = inRange.length > 0 ? parseTimeToMin(inRange[0].start) : timelineEnd
    const lastEnd = inRange.length > 0 ? parseTimeToMin(inRange[inRange.length - 1].end) : startMin

    if (firstStart > startMin) {
        rows.push({
            key: 'lead',
            label: '',
            sublabel: formatMin(startMin % 1440),
            startMin,
            endMin: firstStart,
            height: Math.max((firstStart - startMin) * pxPerMin, 20)
        })
    }

    for (let i = 0; i < inRange.length; i++) {
        const p = inRange[i]
        const s = parseTimeToMin(p.start)
        const e = parseTimeToMin(p.end)
        rows.push({
            key: `p${p.period}`,
            label: `第${p.period}节`,
            sublabel: `${p.start}-${p.end}`,
            startMin: s,
            endMin: e,
            height: Math.max((e - s) * pxPerMin, 20)
        })

        // 节次之间的空隙行，保证总高度 = 窗口时长 × pxPerMin
        const next = inRange[i + 1]
        if (next) {
            const ns = parseTimeToMin(next.start)
            if (ns > e) {
                rows.push({
                    key: `g${p.period}`,
                    label: '',
                    sublabel: '',
                    startMin: e,
                    endMin: ns,
                    height: Math.max((ns - e) * pxPerMin, 2)
                })
            }
        }
    }

    if (lastEnd < timelineEnd) {
        rows.push({
            key: 'tail',
            label: '',
            sublabel: formatMin(timelineEnd % 1440),
            startMin: lastEnd,
            endMin: timelineEnd,
            height: Math.max((timelineEnd - lastEnd) * pxPerMin, 20)
        })
    }

    return rows
}

/** 窗口内的整点刻度（分钟数，可跨午夜） */
export function hourMarksInRange(startMin: number, endMin: number): number[] {
    const timelineEnd = endMin <= startMin ? endMin + 1440 : endMin
    const marks: number[] = []
    for (let m = Math.ceil(startMin / 60) * 60; m <= timelineEnd; m += 60) {
        marks.push(m)
    }
    return marks
}

/** 相邻线间隔小于 minGapMin 分钟时合并为一条，取位置靠下（时间更大）的那条 */
export function mergeLinePositions(positions: number[], minGapMin = 10): number[] {
    const sorted = [...positions].sort((a, b) => a - b)
    const merged: number[] = []
    for (const m of sorted) {
        const last = merged[merged.length - 1]
        if (last !== undefined && m - last < minGapMin) {
            merged[merged.length - 1] = m
        } else {
            merged.push(m)
        }
    }
    return merged
}
