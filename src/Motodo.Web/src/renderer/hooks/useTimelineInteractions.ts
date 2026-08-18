import { useCallback, useEffect, useRef, useState } from 'react'
import type { Event } from '@shared/types/event'
import {
    applyMove,
    applyResize,
    canEditSchedule,
    CLICK_THRESHOLD_PX,
    computeDeltaMinutes,
    pointerToTime
} from '@/utils/timeline-interaction'

export type DragMode = 'move' | 'resize'

/** 拉伸（调整结束时间）的默认吸附步长：5 分钟 */
const RESIZE_SNAP_MIN = 5

export interface TimelineDragState {
    id: string
    mode: DragMode
    event: Event
    startAt: string
    endAt: string
    displayStartAt: string
    displayEndAt: string
    grabDayIndex: number
    grabRawMin: number
    grabClientX: number
    grabClientY: number
    targetDayIndex: number
    targetMinOfDay: number
    cursorX: number
    cursorY: number
    moved: boolean
    committing?: boolean
}

export interface PointerTimeResult {
    dayIndex: number
    dayOffset: number
    minOfDay: number
    rawMin: number
}

interface UseTimelineInteractionsOptions {
    days: Date[]
    pxPerMin: number
    startMin: number
    containerRef: React.RefObject<HTMLDivElement | null>
    axisRef: React.RefObject<HTMLDivElement | null>
    snapMin?: number
    resizeSnapMin?: number
    onMove: (id: string, data: { start_at: string; end_at: string }) => void | Promise<unknown>
    onResize: (id: string, data: { end_at: string }) => void | Promise<unknown>
    onOpenDetail: (event: Event, x: number, y: number) => void
}

/**
 * 周/日视图共用的指针交互：按住日程拖拽移动、按住底部手柄缩放、
 * 位移小于阈值视为点击（打开详情弹窗），并输出“点击空白处”所需的时间换算。
 * 所有更新最终走现有 updateEvent 接口。
 */
export function useTimelineInteractions(options: UseTimelineInteractionsOptions) {
    const [drag, setDrag] = useState<TimelineDragState | null>(null)
    const dragRef = useRef<TimelineDragState | null>(null)
    const suppressClickRef = useRef(false)
    const optsRef = useRef(options)
    optsRef.current = options

    const dayRefs = useRef<(HTMLDivElement | null)[]>([])
    const setDayRef = useCallback((el: HTMLDivElement | null, index: number) => {
        dayRefs.current[index] = el
    }, [])

    const clampIndex = (i: number): number =>
        Math.max(0, Math.min(i, Math.max(0, options.days.length - 1)))

    const findDayIndex = (clientX: number): number => {
        let exact = -1
        dayRefs.current.forEach((el, i) => {
            if (!el) return
            const r = el.getBoundingClientRect()
            if (clientX >= r.left && clientX < r.right) exact = i
        })
        if (exact >= 0) return exact
        let nearest = 0
        let minDist = Infinity
        dayRefs.current.forEach((el, i) => {
            if (!el) return
            const r = el.getBoundingClientRect()
            const dist = Math.abs(clientX - (r.left + r.right) / 2)
            if (dist < minDist) {
                minDist = dist
                nearest = i
            }
        })
        return nearest
    }

    const readPointer = useCallback(
        (clientY: number, dayIndex: number, snap?: number): PointerTimeResult | null => {
        const o = optsRef.current
        const axis = o.axisRef.current
        const container = o.containerRef.current
        if (!axis || !container) return null
        const p = pointerToTime(
            clientY,
            axis.getBoundingClientRect().top,
            container.scrollTop,
            o.pxPerMin,
            o.startMin,
            snap ?? o.snapMin
        )
        return {
            dayIndex: clampIndex(dayIndex),
            dayOffset: p.dayOffset,
            minOfDay: p.minOfDay,
            rawMin: p.rawMin
        }
        },
        [options.days.length]
    )

    const startMove = useCallback((e: React.PointerEvent, event: Event, dayIndex: number) => {
        if (!canEditSchedule(event)) return
        const p = readPointer(e.clientY, dayIndex, optsRef.current.resizeSnapMin ?? RESIZE_SNAP_MIN)
        if (!p) return
        const state: TimelineDragState = {
            id: event.id,
            mode: 'move',
            event,
            startAt: event.start_at,
            endAt: event.end_at,
            displayStartAt: event.start_at,
            displayEndAt: event.end_at,
            grabDayIndex: p.dayIndex,
            grabRawMin: p.rawMin,
            grabClientX: e.clientX,
            grabClientY: e.clientY,
            targetDayIndex: p.dayIndex,
            targetMinOfDay: p.minOfDay,
            cursorX: e.clientX,
            cursorY: e.clientY,
            moved: false
        }
        dragRef.current = state
        setDrag(state)
    }, [readPointer])

    const startResize = useCallback((e: React.PointerEvent, event: Event, dayIndex: number) => {
        if (!canEditSchedule(event) || event.item_type === 'todo') return
        const p = readPointer(e.clientY, dayIndex)
        if (!p) return
        const state: TimelineDragState = {
            id: event.id,
            mode: 'resize',
            event,
            startAt: event.start_at,
            endAt: event.end_at,
            displayStartAt: event.start_at,
            displayEndAt: event.end_at,
            grabDayIndex: p.dayIndex,
            grabRawMin: p.rawMin,
            grabClientX: e.clientX,
            grabClientY: e.clientY,
            targetDayIndex: p.dayIndex,
            targetMinOfDay: p.minOfDay,
            cursorX: e.clientX,
            cursorY: e.clientY,
            moved: false
        }
        dragRef.current = state
        setDrag(state)
    }, [readPointer])

    const suppressClick = useCallback((): boolean => {
        const v = suppressClickRef.current
        suppressClickRef.current = false
        return v
    }, [])

    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            const d = dragRef.current
            if (!d) return
            const o = optsRef.current
            const axis = o.axisRef.current
            const container = o.containerRef.current
            if (!axis || !container) return
            const colIndex = d.mode === 'resize' ? d.grabDayIndex : findDayIndex(e.clientX)
            const p = pointerToTime(
                e.clientY,
                axis.getBoundingClientRect().top,
                container.scrollTop,
                o.pxPerMin,
                o.startMin,
                d.mode === 'resize'
                    ? (o.resizeSnapMin ?? RESIZE_SNAP_MIN)
                    : o.snapMin
            )
            const delta = computeDeltaMinutes(
                { dayIndex: d.grabDayIndex, rawMin: d.grabRawMin },
                { dayIndex: colIndex, rawMin: p.rawMin }
            )
            let displayStartAt = d.startAt
            let displayEndAt = d.endAt
            if (d.mode === 'move') {
                const moved = applyMove(d.startAt, d.endAt, delta, d.event.item_type === 'todo')
                displayStartAt = moved.start_at
                displayEndAt = moved.end_at
            } else {
                displayEndAt = applyResize(d.startAt, d.endAt, delta).end_at
            }
            const next: TimelineDragState = {
                ...d,
                displayStartAt,
                displayEndAt,
                targetDayIndex: colIndex,
                targetMinOfDay: p.minOfDay,
                cursorX: e.clientX,
                cursorY: e.clientY,
                moved:
                    d.moved ||
                    Math.hypot(e.clientX - d.grabClientX, e.clientY - d.grabClientY) >= CLICK_THRESHOLD_PX
            }
            dragRef.current = next
            setDrag(next)
        }

        const handleUp = (e: PointerEvent) => {
            const d = dragRef.current
            if (!d) return
            const o = optsRef.current
            if (!d.moved) {
                dragRef.current = null
                setDrag(null)
                if (d.mode === 'move') o.onOpenDetail(d.event, e.clientX, e.clientY)
                return
            }
            suppressClickRef.current = true
            // 保持新位置渲染，直到保存完成，避免松手瞬间回跳旧状态
            const committing: TimelineDragState = { ...d, committing: true }
            dragRef.current = committing
            setDrag(committing)
            const finish = () => {
                if (dragRef.current === committing) {
                    dragRef.current = null
                    setDrag(null)
                }
            }
            const task =
                d.mode === 'move'
                    ? o.onMove(d.id, { start_at: d.displayStartAt, end_at: d.displayEndAt })
                    : o.onResize(d.id, { end_at: d.displayEndAt })
            Promise.resolve(task).then(finish, finish)
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
        window.addEventListener('pointercancel', handleUp)
        return () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
            window.removeEventListener('pointercancel', handleUp)
        }
    }, [])

    return { drag, setDayRef, startMove, startResize, readPointer, suppressClick }
}
