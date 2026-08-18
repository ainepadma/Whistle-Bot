// ═══════════════════════════════════════════
// 提醒
// ═══════════════════════════════════════════

export interface ReminderConfig {
    minutes: number // 提前多少分钟提醒
}

export interface Reminder {
    id: string
    event_id: string
    trigger_at: string // ISO 8601 — 应触发时间
    minutes_before: number
    dismissed: boolean
    dismissed_at: string | null
    snoozed_until: string | null
    triggered_at?: string | null
    created_at: string
    // 查询时联表附带的事件摘要（用于提醒弹窗展示）
    event?: {
        id: string
        title: string
        start_at: string
    }
}
