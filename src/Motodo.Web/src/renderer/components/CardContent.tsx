import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Measures natural content, never the window-height-dependent outer surface. */
export default function CardContent({ kind, children }: { kind: string; children: ReactNode }): JSX.Element {
    const container = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const content = useRef<HTMLDivElement>(null)
    const [paging, setPaging] = useState({ needed: false, before: false, after: false })

    useLayoutEffect(() => {
        const view = viewport.current
        const body = content.current
        const surface = container.current
        if (!view || !body || !surface) return
        let frame = 0
        let lastHeight = 0
        let active = true
        const measure = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                if (!active) return
                const height = Math.ceil(body.getBoundingClientRect().height + 42)
                if (height !== lastHeight) {
                    lastHeight = height
                    void window.electronAPI.card.fitContent(kind, height).catch(() => {})
                }
                const next = {
                    // Count the space the pager could release, so it cannot keep itself visible.
                    needed: body.getBoundingClientRect().height > surface.getBoundingClientRect().height + 1,
                    before: view.scrollTop > 1,
                    after: view.scrollTop + view.clientHeight < view.scrollHeight - 1
                }
                setPaging(previous => previous.needed === next.needed && previous.before === next.before && previous.after === next.after ? previous : next)
            })
        }
        const observer = new ResizeObserver(measure)
        observer.observe(body)
        observer.observe(view)
        observer.observe(surface)
        view.addEventListener('scroll', measure)
        measure()
        return () => {
            active = false
            cancelAnimationFrame(frame)
            observer.disconnect()
            view.removeEventListener('scroll', measure)
        }
    }, [kind])

    const turnPage = (direction: number) => {
        const view = viewport.current
        if (view) view.scrollBy({ top: direction * Math.max(40, view.clientHeight - 24), behavior: 'auto' })
    }
    return (
        <div ref={container} className="card-content-frame">
            <div ref={viewport} className="card-content-viewport">
                <div ref={content} className="card-natural-content">{children}</div>
            </div>
            {paging.needed && <nav className="card-content-pages" aria-label="卡片内容翻页">
                <button disabled={!paging.before} onClick={() => turnPage(-1)}>↑ 上一页</button>
                <button disabled={!paging.after} onClick={() => turnPage(1)}>下一页 ↓</button>
            </nav>}
        </div>
    )
}
