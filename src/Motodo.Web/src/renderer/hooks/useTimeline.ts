import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settings.store'
import { useSemesterStore } from '@/stores/semester.store'
import {
    buildTimeline,
    hourMarksInRange,
    mergeLinePositions,
    parseTimeToMin
} from '@/utils/period-timeline'
import dayjs from 'dayjs'

/**
 * 周/日视图共用的时间轴计算：起止分钟、节次行、刻度、节次网格线、
 * 坐标换算与当前时间位置。pxPerMin 由视图自行决定行高密度。
 */
export function useTimeline(pxPerMin: number) {
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const dayStart = useSettingsStore((s) => s.dayStart)
    const dayEnd = useSettingsStore((s) => s.dayEnd)
    const dayBottomSpace = useSettingsStore((s) => s.dayBottomSpace)
    const activeSemester = useSemesterStore((s) => s.activeSemester)

    const startMin = parseTimeToMin(dayStart)
    const endMin = parseTimeToMin(dayEnd)
    const bottomSpace = dayBottomSpace * pxPerMin
    const periods = activeSemester?.periods ?? []

    const timeline = useMemo(
        () => buildTimeline(periods, pxPerMin, startMin, endMin),
        [periods, pxPerMin, startMin, endMin]
    )
    const hourMarks = useMemo(() => hourMarksInRange(startMin, endMin), [startMin, endMin])
    const periodLines = useMemo(() => {
        const bounds = [
            ...new Set(timeline.filter((r) => r.label).flatMap((r) => [r.startMin, r.endMin]))
        ]
        return mergeLinePositions(bounds)
    }, [timeline])

    /** 把某日 0-1439 分钟（跨午夜时可传入次日 0-239）换算为时间轴 top */
    const toTop = (minOfDay: number): number => {
        const rel = minOfDay - startMin
        return (rel < 0 ? rel + 1440 : rel) * pxPerMin
    }

    const now = dayjs()
    const nowMin = now.hour() * 60 + now.minute()
    const nowInWindow = endMin <= startMin ? true : nowMin >= startMin && nowMin < endMin
    const nowTop = toTop(nowMin)

    return {
        timeFormat,
        startMin,
        endMin,
        bottomSpace,
        timeline,
        hourMarks,
        periodLines,
        toTop,
        nowInWindow,
        nowTop
    }
}
