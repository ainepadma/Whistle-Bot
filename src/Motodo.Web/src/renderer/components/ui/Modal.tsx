interface ModalProps {
    onClose: () => void
    title?: string
    children: React.ReactNode
}

export default function Modal({ onClose, title, children }: ModalProps): JSX.Element {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/35"
                onClick={onClose}
            />

            {/* 弹窗本体 */}
            <div className="relative w-[calc(100%-2rem)] min-w-0 max-w-md max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl
                      border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                {title && (
                    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
                        <button
                            onClick={onClose}
                            className="ui-icon-button h-8 w-8"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <div className="p-4">{children}</div>
            </div>
        </div>
    )
}
