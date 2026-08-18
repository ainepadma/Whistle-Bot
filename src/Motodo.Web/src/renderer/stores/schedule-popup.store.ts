import { create } from 'zustand'
import type { Event } from '@shared/types/event'

export interface CreatePopupPayload {
    x: number
    y: number
    date: string // YYYY-MM-DD（目标日期）
    timeMin: number | null // 当天 0-1439；null 表示未指定（月视图）
}

export interface DetailPopupPayload {
    event: Event
    x: number
    y: number
}

interface SchedulePopupStore {
    create: CreatePopupPayload | null
    detail: DetailPopupPayload | null
    openCreate: (payload: CreatePopupPayload) => void
    closeCreate: () => void
    openDetail: (event: Event, x: number, y: number) => void
    closeDetail: () => void
}

/** tui.calendar 风格的浮层：点击空白新建 / 点击日程看详情 */
export const useSchedulePopupStore = create<SchedulePopupStore>((set) => ({
    create: null,
    detail: null,
    openCreate: (payload) => set({ create: payload, detail: null }),
    closeCreate: () => set({ create: null }),
    openDetail: (event, x, y) => set({ detail: { event, x, y }, create: null }),
    closeDetail: () => set({ detail: null })
}))
