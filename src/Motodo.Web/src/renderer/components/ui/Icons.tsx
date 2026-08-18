export type IconName =
    | 'calendar'
    | 'semester'
    | 'course'
    | 'plan'
    | 'todo'
    | 'calendar-settings'
    | 'search'
    | 'transfer'
    | 'settings'
    | 'plus'
    | 'arrow-left'
    | 'view-month'
    | 'view-week'
    | 'view-day'
    | 'chevron-down'
    | 'chevron-up'
    | 'chevron-left'
    | 'chevron-right'
    | 'minimize'
    | 'maximize'
    | 'restore'
    | 'close'
    | 'card'
    | 'pin'

interface IconProps {
    name: IconName
    className?: string
}

export default function Icon({ name, className = 'h-4 w-4' }: IconProps): JSX.Element {
    const common = {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const
    }

    const paths: Record<IconName, JSX.Element> = {
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
        semester: <><path d="m3 8 9-5 9 5-9 5z" /><path d="M7 10.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5M21 8v6" /></>,
        course: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M8 7h8M8 11h6" /></>,
        plan: <><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M8 2v4M16 2v4M3 9h18M8 13h3M8 17h6" /></>,
        todo: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></>,
        'calendar-settings': <><path d="M16 3v4M8 3v4M4 10h16M5 5h14a2 2 0 0 1 2 2v6" /><circle cx="16" cy="17" r="3" /><path d="M16 12.5v1M16 20.5v1M11.5 17h1M19.5 17h1M12.8 13.8l.7.7M18.5 19.5l.7.7M19.2 13.8l-.7.7M13.5 19.5l-.7.7" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        transfer: <><path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3" /></>,
        settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.37.38.7.66.98.28.28.62.5 1 .62H21v4h-.09A1.7 1.7 0 0 0 19.4 15z" /></>,
        plus: <path d="M12 5v14M5 12h14" />,
        'arrow-left': <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
        'view-month': <><rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" /><rect x="3" y="15" width="7" height="7" rx="1" /><rect x="14" y="15" width="7" height="7" rx="1" /></>,
        'view-week': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
        'view-day': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 4v16" /></>,
        'chevron-down': <path d="m6 9 6 6 6-6" />,
        'chevron-up': <path d="m6 15 6-6 6 6" />,
        'chevron-left': <path d="m15 18-6-6 6-6" />,
        'chevron-right': <path d="m9 18 6-6-6-6" />,
        minimize: <path d="M5 12h14" />,
        maximize: <rect x="5" y="5" width="14" height="14" rx="1" />,
        restore: <><rect x="5" y="8" width="11" height="11" rx="1" /><path d="M8 5h9a2 2 0 0 1 2 2v9" /></>,
        close: <path d="M6 6l12 12M18 6L6 18" />,
        card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18" /></>,
        pin: <><path d="M12 17v4" /><path d="m8 3 8 0 1 6 2 2v2H5v-2l2-2 1-6z" /></>
    }

    return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" shapeRendering="geometricPrecision" {...common}>{paths[name]}</svg>
}
