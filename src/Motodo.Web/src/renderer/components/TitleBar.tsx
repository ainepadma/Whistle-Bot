import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icons'

const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

/** 自绘标题栏：左侧 Logo，右侧 [隐藏] [卡片] [全屏] [关闭] */
export default function TitleBar(): JSX.Element {
    const [maximized, setMaximized] = useState(false)
    const [cardOpen, setCardOpen] = useState(false)

    useEffect(() => {
        let mounted = true
        window.electronAPI.window
            .isMaximized()
            .then((v: boolean) => {
                if (mounted) setMaximized(v)
            })
            .catch(() => {})
        const unsubscribe = window.electronAPI.on('window:maximized', (v: unknown) => {
            setMaximized(Boolean(v))
        })
        window.electronAPI.window.isCardVisible().then((v: boolean) => setCardOpen(v)).catch(() => {})
        const unsubscribeCard = window.electronAPI.on('window:card-changed', (v: unknown) => {
            setCardOpen(Boolean(v))
        })
        return () => {
            mounted = false
            unsubscribe()
            unsubscribeCard()
        }
    }, [])

    return (
        <div
            onDoubleClick={() => window.electronAPI.window.toggleMaximize()}
            style={dragRegion}
            className="flex h-9 shrink-0 select-none items-center justify-between border-b
             border-zinc-200 bg-zinc-100/90 pl-2.5 dark:border-zinc-800 dark:bg-zinc-950"
        >
            <div className="flex items-center gap-2">
                <img
                    src={new URL('../../../resources/icon.png', import.meta.url).href}
                    alt=""
                    className="h-5 w-5 rounded-md border border-zinc-200 dark:border-zinc-800"
                />
                <span className="text-xs font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
                    日程
                </span>
            </div>

            <div style={noDragRegion} className="flex h-full items-stretch">
                <ControlButton label="最小化" onClick={() => window.electronAPI.window.minimize()}>
                    <Icon name="minimize" className="h-3.5 w-3.5" />
                </ControlButton>
                <ControlButton
                    label="卡片模式"
                    active={cardOpen}
                    onClick={() => window.electronAPI.window.toggleCard()}
                >
                    <Icon name="card" className="h-3.5 w-3.5" />
                </ControlButton>
                <ControlButton
                    label={maximized ? '还原' : '最大化'}
                    onClick={() => window.electronAPI.window.toggleMaximize()}
                >
                    <Icon name={maximized ? 'restore' : 'maximize'} className="h-3.5 w-3.5" />
                </ControlButton>
                <ControlButton label="关闭" danger onClick={() => window.electronAPI.window.close()}>
                    <Icon name="close" className="h-3.5 w-3.5" />
                </ControlButton>
            </div>
        </div>
    )
}

function ControlButton({
    label,
    active = false,
    danger = false,
    onClick,
    children
}: {
    label: string
    active?: boolean
    danger?: boolean
    onClick: () => void
    children: React.ReactNode
}): JSX.Element {
    return (
        <button
            title={label}
            aria-label={label}
            onClick={onClick}
            className={`flex w-10 items-center justify-center text-zinc-500 transition-colors
                ${active
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                }
                ${danger ? 'hover:bg-red-500 hover:text-white' : ''}`}
        >
            {children}
        </button>
    )
}
