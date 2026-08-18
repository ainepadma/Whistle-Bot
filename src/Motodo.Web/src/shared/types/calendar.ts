// ═══════════════════════════════════════════
// 日历实体
// ═══════════════════════════════════════════

export interface Calendar {
    id: string
    name: string
    color: string
    is_visible: boolean
    is_system: boolean
    created_at: string
    updated_at: string
}

export interface CalendarCreateInput {
    name: string
    color: string
}

export interface CalendarUpdateInput {
    name?: string
    color?: string
    is_visible?: boolean
}
