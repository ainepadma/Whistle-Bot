import { create } from 'zustand'
import type { Event, EventCreateInput, EventUpdateInput, EventQueryInput } from '@shared/types/event'
import dayjs from 'dayjs'

interface EventStore {
    events: Event[]
    loading: boolean
    error: string | null

    loadEvents: (query: EventQueryInput) => Promise<void>
    createEvent: (data: EventCreateInput) => Promise<Event>
    updateEvent: (id: string, data: EventUpdateInput) => Promise<Event>
    removeEvent: (id: string) => Promise<void>
    getEventsForDate: (date: Date) => Event[]
}

export const useEventStore = create<EventStore>((set, get) => ({
    events: [],
    loading: false,
    error: null,

    loadEvents: async (query) => {
        set({ loading: true, error: null })
        try {
            const events = await window.electronAPI.event.query(query)
            set({ events, loading: false })
        } catch (err) {
            set({ error: String(err), loading: false })
        }
    },

    createEvent: async (data) => {
        const event = await window.electronAPI.event.create(data)
        set({ events: [...get().events, event] })
        return event
    },

    updateEvent: async (id, data) => {
        const event = await window.electronAPI.event.update(id, data)
        set({ events: get().events.map(e => (e.id === id ? event : e)) })
        return event
    },

    removeEvent: async (id) => {
        await window.electronAPI.event.remove(id)
        set({ events: get().events.filter(e => e.id !== id) })
    },

    getEventsForDate: (date) => {
        const dayStart = dayjs(date).startOf('day')
        const dayEnd = dayjs(date).endOf('day')
        return get().events.filter(e => {
            const eventStart = dayjs(e.start_at)
            const eventEnd = dayjs(e.end_at)
            return eventStart.isBefore(dayEnd) && eventEnd.isAfter(dayStart)
        })
    }
}))
