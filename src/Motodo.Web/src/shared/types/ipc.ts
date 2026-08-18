// ═══════════════════════════════════════════
// IPC 请求/响应类型（契约）
// ═══════════════════════════════════════════

import type { Calendar, CalendarCreateInput, CalendarUpdateInput } from './calendar'
import type { Event, EventCreateInput, EventUpdateInput, EventQueryInput } from './event'
import type { Reminder } from './reminder'
import type { Semester, SemesterCreateInput, SemesterUpdateInput } from './semester'
import type { Course, CourseCreateInput, CourseUpdateInput } from './course'
import type { SpecialDate, SpecialDateCreateInput } from './special-date'

export interface IpcResponse<T = void> {
    success: boolean
    data?: T
    error?: string
}

// 日历 IPC
export interface CalendarIpc {
    'calendar:list': { result: Calendar[] }
    'calendar:create': { input: CalendarCreateInput; result: Calendar }
    'calendar:update': { input: { id: string; data: CalendarUpdateInput }; result: Calendar }
    'calendar:remove': { input: string; result: void }
    'calendar:toggle-visible': { input: string; result: Calendar }
}

// 日程 IPC
export interface EventIpc {
    'event:query': { input: EventQueryInput; result: Event[] }
    'event:get-by-id': { input: string; result: Event | null }
    'event:create': { input: EventCreateInput; result: Event }
    'event:update': { input: { id: string; data: EventUpdateInput }; result: Event }
    'event:remove': { input: string; result: void }
    'event:search': { input: string; result: Event[] }
}

// 提醒 IPC
export interface ReminderIpc {
    'reminder:pending': { result: Reminder[] }
    'reminder:dismiss': { input: string; result: void }
    'reminder:snooze': { input: { id: string; minutes: number }; result: void }
}

// 学期 IPC
export interface SemesterIpc {
    'semester:list': { result: Semester[] }
    'semester:get-active': { result: Semester | null }
    'semester:create': { input: SemesterCreateInput; result: Semester }
    'semester:update': { input: { id: string; data: SemesterUpdateInput }; result: Semester }
    'semester:remove': { input: string; result: void }
}

// 课程 IPC
export interface CourseIpc {
    'course:list-by-semester': { input: string; result: Course[] }
    'course:create': { input: CourseCreateInput; result: Course }
    'course:update': { input: { id: string; data: CourseUpdateInput }; result: Course }
    'course:remove': { input: string; result: void }
}

// 导入导出 IPC
export interface ExportIpc {
    'export:ics': { input: string[]; result: string }
    'export:json': { input: string[]; result: string }
    'export:import-ics': { input: string; result: number }
    'export:import-json': { input: string; result: number }
    'export:select-file': { result: string | null }
    'export:save-file': {
        input: { suggestedName: string; content: string; kind: 'ics' | 'json' }
        result: { canceled: boolean; filePath?: string }
    }
}

// 特殊日期 IPC
export interface SpecialDateIpc {
    'special-date:list': { result: SpecialDate[] }
    'special-date:create': { input: SpecialDateCreateInput; result: SpecialDate }
    'special-date:remove': { input: string; result: void }
}
