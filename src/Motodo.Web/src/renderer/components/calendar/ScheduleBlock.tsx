import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'
import { canEditSchedule } from '@/utils/timeline-interaction'

interface ScheduleBlockProps {
    event: Event
    top: number
    height: number
    dayIndex: number
    isDragging?: boolean
    showResizeHandle?: boolean
    onPointerDown: (e: React.PointerEvent, event: Event, dayIndex: number) => void
    onResizePointerDown?: (e: React.PointerEvent, event: Event, dayIndex: number) => void
    onClick?: (e: React.MouseEvent, event: Event) => void
}

/** 周/日视图时间槽内的日程块，支持拖拽与底部缩放手柄 */
export default function ScheduleBlock({
    event,
    top,
    height,
    dayIndex,
    isDragging = false,
    showResizeHandle = true,
    onPointerDown,
    onResizePointerDown,
    onClick
}: ScheduleBlockProps): JSX.Element {
    const timeFormat = useSettingsStore((s) => s.timeFormat)
    const start = dayjs(event.start_at)
    const end = dayjs(event.end_at)
    const editable = canEditSchedule(event)
    const resizable = editable && event.item_type !== 'todo'
    const backgroundColor = event.is_course
        ? (event.color ?? '#3B82F6')
        : event.item_type === 'todo'
            ? '#F59E0B'
            : '#3B82F6'

    return (
        <div
            data-schedule-block
            onClick={(e) => {
                if (editable) return
                e.stopPropagation()
                onClick?.(e, event)
            }}
            onPointerDown={(e) => {
                if (editable) e.preventDefault()
                e.stopPropagation()
                onPointerDown(e, event, dayIndex)
            }}
            className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-xs overflow-hidden
                transition-[filter,box-shadow] duration-100 select-none touch-none
                ${editable ? 'cursor-grab' : 'cursor-pointer'}
                hover:brightness-95 hover:shadow-sm
                ${isDragging ? 'event-drag-preview cursor-grabbing' : ''}`}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                backgroundColor,
                color: 'white',
                opacity: event.is_completed ? 0.6 : 1,
                zIndex: isDragging ? 20 : 5
            }}
            title={`${event.title}\n${start.format('MM-DD HH:mm')} - ${end.format('MM-DD HH:mm')}`}
        >
            <div className="font-medium truncate">{event.title}</div>
            {height > 32 && (
                <div className="text-white/70 truncate">
                    {formatClock(start, timeFormat)} - {formatClock(end, timeFormat)}
                </div>
            )}
            {showResizeHandle && resizable && onResizePointerDown && (
                <div
                    data-resize-handle
                    onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onResizePointerDown(e, event, dayIndex)
                    }}
                    className="absolute bottom-0 left-1 right-1 h-1.5 rounded-b cursor-ns-resize
                     bg-black/10 hover:bg-black/25 transition-colors"
                />
            )}
        </div>
    )
}
