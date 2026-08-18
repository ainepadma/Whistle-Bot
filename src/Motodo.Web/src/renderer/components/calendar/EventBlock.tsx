import type { Event } from '@shared/types/event'
import dayjs from 'dayjs'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'

interface EventBlockProps {
    event: Event
    compact?: boolean // 月视图紧凑模式
    onClick?: (e: React.MouseEvent) => void
    onPointerDown?: (e: React.PointerEvent, event: Event) => void
}

export default function EventBlock({ event, compact = false, onClick, onPointerDown }: EventBlockProps): JSX.Element {
    const start = dayjs(event.start_at)
    const timeFormat = useSettingsStore((s) => s.timeFormat)

    return (
        <div
            data-schedule-block
            onClick={onClick ? (e) => onClick(e) : undefined}
            onPointerDown={onPointerDown ? (e) => onPointerDown(e, event) : undefined}
            className={`event-block bg-primary-500 text-white select-none
        ${compact ? 'text-[10px] leading-tight truncate' : 'text-xs'}
        ${event.is_completed ? 'opacity-60 line-through' : ''}
      `}
            style={
                event.is_course && event.color
                    ? { backgroundColor: event.color }
                    : event.item_type === 'todo'
                        ? { backgroundColor: '#F59E0B' }
                        : undefined
            }
            title={`${event.title}\n${start.format('MM-DD HH:mm')}`}
        >
            {!event.is_all_day && !compact && (
                <span className="text-white/70 mr-1">{formatClock(start, timeFormat)}</span>
            )}
            <span className="font-medium">{event.title}</span>
        </div>
    )
}
