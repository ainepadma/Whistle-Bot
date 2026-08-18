import { create } from 'zustand'
import type { Event } from '@shared/types/event'

type EventUiMode = 'closed' | 'create' | 'detail' | 'edit'

export interface EventDraft {
    start_at?: string
    end_at?: string
    is_all_day?: boolean
}

interface EventUiStore {
    mode: EventUiMode
    event: Event | null
    initialType: 'plan' | 'todo' | 'course' | null
    draft: EventDraft | null
    openCreate: (type?: 'plan' | 'todo' | 'course', draft?: EventDraft) => void
    openDetail: (event: Event) => void
    openEdit: (event: Event) => void
    close: () => void
}

export const useEventUiStore = create<EventUiStore>((set) => ({
    mode: 'closed',
    event: null,
    initialType: null,
    draft: null,

    openCreate: (type = 'plan', draft) =>
        set({ mode: 'create', event: null, initialType: type, draft: draft ?? null }),
    openDetail: (event) => set({ mode: 'detail', event }),
    openEdit: (event) => set({ mode: 'edit', event }),
    close: () => set({ mode: 'closed', event: null, initialType: null, draft: null })
}))
