import { lazy, Suspense, useEffect, useState } from 'react'
import type { Event } from '@shared/types/event'
import Modal from './ui/Modal'
import { useEventUiStore } from '@/stores/event-ui.store'
import { useEventStore } from '@/stores/event.store'
import { isRecurringEvent, loadSeriesEvent, seriesId } from '@/utils/recurrence'

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
                            const updated = await updateEvent(seriesId(event), { is_completed: !event.is_completed })
                            useEventUiStore.getState().openDetail(updated)
                        }}
                        onDelete={async () => { await removeEvent(seriesId(event)); close() }}
                    />
                </Suspense>
            </Modal>
        )
    }

    if (mode === 'edit' && event) {
        return (
            <Modal onClose={close} title={isRecurringEvent(event) ? '编辑整个重复日程' : '编辑日程'}>
                <Suspense fallback={null}>
                    <ExistingEventEditor key={event.id} selected={event} close={close} />
                </Suspense>
            </Modal>
        )
    }

    return null
}

function ExistingEventEditor({ selected, close }: { selected: Event; close: () => void }): JSX.Element {
    const [event, setEvent] = useState<Event | null>(null)
    const [error, setError] = useState<string | null>(null)
    const updateEvent = useEventStore((s) => s.updateEvent)
    useEffect(() => {
        let mounted = true
        void loadSeriesEvent(selected).then((root) => { if (mounted) setEvent(root) }, (err) => {
            if (mounted) setError(String(err))
        })
        return () => { mounted = false }
    }, [selected])
    if (error) return <p role="alert" className="text-sm text-red-500">{error}</p>
    if (!event) return <p className="text-sm text-zinc-500">正在读取日程…</p>
    return <>
        {isRecurringEvent(event) && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">正在编辑整个重复日程。下面显示首次日程的日期；保存会影响所有重复日期。</p>}
        <EventEdit event={event} onCancel={close} onSave={async (data) => {
            await updateEvent(event.id, data)
            close()
        }} />
    </>
}
