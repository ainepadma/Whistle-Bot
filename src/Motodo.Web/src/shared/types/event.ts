// ═══════════════════════════════════════════
// 日程实体
// ═══════════════════════════════════════════

import type { ReminderConfig } from './reminder'

export type EventPriority = 0 | 1 | 2 | 3 // 无 / 低 / 中 / 高
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'
export type EventType = 'plan' | 'todo'

export interface Event {
    id: string
    calendar_id: string
    title: string
    description: string
    location: string
    start_at: string // ISO 8601
    end_at: string // ISO 8601
    is_all_day: boolean
    timezone: string
    rrule_str: string | null
    recurrence_parent_id?: string
    exdates: string[] // ISO 8601 日期数组
    reminders: ReminderConfig[]
    priority: EventPriority
    status: EventStatus
    is_course?: boolean
    color?: string
    item_type?: EventType
    is_completed?: boolean
    created_at: string
    updated_at: string
}

export interface EventCreateInput {
    calendar_id: string
    title: string
    description?: string
    location?: string
    start_at: string
    end_at: string
    is_all_day?: boolean
    timezone?: string
    rrule_str?: string | null
    reminders?: ReminderConfig[]
    priority?: EventPriority
    item_type?: EventType
    is_completed?: boolean
}

export interface EventUpdateInput {
    calendar_id?: string
    title?: string
    description?: string
    location?: string
    start_at?: string
    end_at?: string
    is_all_day?: boolean
    timezone?: string
    rrule_str?: string | null
    reminders?: ReminderConfig[]
    priority?: EventPriority
    status?: EventStatus
    item_type?: EventType
    is_completed?: boolean
}

export interface DateRange {
    start: string // ISO 8601
    end: string // ISO 8601
}

export interface EventQueryInput extends DateRange {
    item_type?: EventType
    is_completed?: boolean
    expand?: boolean // 是否展开重复日程（管理列表传 false）
}
