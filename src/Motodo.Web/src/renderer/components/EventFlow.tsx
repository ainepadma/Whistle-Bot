import { lazy, Suspense } from 'react'
import Modal from './ui/Modal'
import { useEventUiStore } from '@/stores/event-ui.store'
import { useEventStore } from '@/stores/event.store'

const EventEdit = lazy(() => import('@/pages/EventEdit'))
const EventDetail = lazy(() => import('@/pages/EventDetail'))

/**
 * 日程新建 / 详情 / 编辑弹窗统一出口。
 * 卡片窗口位置保持不变；表单在当前窗口内自适应，空间不足时可滚动但不显示滚动条。
 */
export default function EventFlow(): JSX.Element | null {
    const { mode, event, initialType } = useEventUiStore()
    const draft = useEventUiStore((s) => s.draft)
    const close = useEventUiStore((s) => s.close)
    const openEdit = useEventUiStore((s) => s.openEdit)
    const { createEvent, updateEvent, removeEvent } = useEventStore()

    if (mode === 'closed') return null

    if (mode === 'create') {
        return (
            <Modal onClose={close} title="新建日程">
                <Suspense fallback={null}>
                    <EventEdit
                        initialType={initialType ?? undefined}
                        initialStartAt={draft?.start_at}
                        initialEndAt={draft?.end_at}
                        initialIsAllDay={draft?.is_all_day}
                        onSave={async (data) => { await createEvent(data); close() }}
                        onCancel={close}
                        onCourseCreated={close}
                    />
                </Suspense>
            </Modal>
        )
    }

    if (mode === 'detail' && event) {
        return (
            <Modal onClose={close} title="日程详情">
                <Suspense fallback={null}>
                    <EventDetail
                        event={event}
                        onClose={close}
                        onEdit={() => openEdit(event)}
                        onToggleComplete={async () => {
                            const updated = await updateEvent(event.id, { is_completed: !event.is_completed })
                            useEventUiStore.getState().openDetail(updated)
                        }}
                        onDelete={async () => { await removeEvent(event.id); close() }}
                    />
                </Suspense>
            </Modal>
        )
    }

    if (mode === 'edit' && event) {
        return (
            <Modal onClose={close} title="编辑日程">
                <Suspense fallback={null}>
                    <EventEdit
                        event={event}
                        onSave={async (data) => {
                            const { calendar_id: _calendarId, ...input } = data
                            await updateEvent(event.id, input)
                            close()
                        }}
                        onCancel={close}
                    />
                </Suspense>
            </Modal>
        )
    }

    return null
}