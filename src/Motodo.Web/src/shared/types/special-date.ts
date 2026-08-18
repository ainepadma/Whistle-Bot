// 特殊日期实体（节假日 / 特殊日期）

export type SpecialDateType = 'holiday' | 'special'

export interface SpecialDate {
    id: string
    date: string // YYYY-MM-DD
    type: SpecialDateType
    label: string
    created_at: string
}

export interface SpecialDateCreateInput {
    date: string // YYYY-MM-DD
    type: SpecialDateType
    label?: string
}
