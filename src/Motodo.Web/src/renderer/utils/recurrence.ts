import type { Event } from '@shared/types/event'

export const isRecurringEvent = (event: Event): boolean => Boolean(event.recurrence_parent_id || event.rrule_str)
export const seriesId = (event: Event): string => event.recurrence_parent_id ?? event.id

export async function loadSeriesEvent(event: Event): Promise<Event> {
    if (!event.recurrence_parent_id) return event
    const root = await window.electronAPI.event.getById(event.recurrence_parent_id) as Event | null
    if (!root) throw new Error('该重复日程已被删除，请关闭后刷新列表。')
    return root
}

export type RepeatChoice = 'none' | 'daily' | 'weekly' | 'monthly' | 'preserve'

export function repeatChoice(rule: string | null | undefined): RepeatChoice {
    if (!rule) return 'none'
    const simple = /^FREQ=(DAILY|WEEKLY|MONTHLY)$/i.exec(rule)
    return simple ? simple[1].toLowerCase() as RepeatChoice : 'preserve'
}

export function ruleForSave(choice: RepeatChoice, original: string | null | undefined): string | null {
    if (choice === 'preserve') return original ?? null
    return choice === 'none' ? null : `FREQ=${choice.toUpperCase()}`
}
