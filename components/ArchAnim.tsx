'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

export type ArchRow = {
  /** stable id, referenced from frames as "panelId.rowId" */
  id: string
  /** field name, left column */
  k: string
  /** field value, right column */
  v?: string
}

export type ArchPanel = {
  id: string
  label: string
  sub?: string
  rows: ArchRow[]
  /** visual family: proc = the running thread, stack = its memory, dyld = loader state */
  tone?: 'proc' | 'stack' | 'dyld' | 'lock'
  /** column span out of 12 on wide screens */
  span?: number
}

export type ArchLink = {
  /** "panelId.rowId" */
  from: string
  /** "panelId.rowId" */
  to: string
  label?: string
  /** danger = an attacker-steered access */
  tone?: 'normal' | 'danger'
}

export type ArchFrame = {
  caption: string
  detail?: string
  /** "panelId" or "panelId.rowId" */
  active?: string[]
  danger?: string[]
  ok?: string[]
  muted?: string[]
  /** "panelId.rowId" -> replacement value for this frame onward */
  values?: Record<string, string>
  link?: ArchLink
}

type Props = {
  title?: string
  panels: ArchPanel[]
  frames: ArchFrame[]
  speed?: number
  autoPlay?: boolean
}

const PANEL_TONE: Record<string, string> = {
  proc: 'border-sky-300 dark:border-sky-800',
  stack: 'border-amber-300 dark:border-amber-800',
  dyld: 'border-violet-300 dark:border-violet-800',
  lock: 'border-rose-300 dark:border-rose-900',
}

const PANEL_HEAD: Record<string, string> = {
  proc: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40',
  stack: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40',
  dyld: 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40',
  lock: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30',
}

const ROW_TONE = {
  idle: 'bg-transparent text-gray-500 dark:text-gray-400',
  active: 'bg-primary-50 dark:bg-primary-900/30 text-gray-900 dark:text-gray-50 font-medium',
  danger: 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 font-medium',
  ok: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-medium',
  muted: 'bg-transparent text-gray-300 dark:text-gray-700',
}

function pick(key: string, panelId: string, f: ArchFrame) {
  const hit = (list?: string[]) => list?.includes(key) || list?.includes(panelId)
  if (hit(f.danger)) return ROW_TONE.danger
  if (hit(f.ok)) return ROW_TONE.ok
  if (hit(f.active)) return ROW_TONE.active
  if (hit(f.muted)) return ROW_TONE.muted
  return ROW_TONE.idle
}

export default function ArchAnim({ title, panels, frames, speed = 3000, autoPlay = true }: Props) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [path, setPath] = useState<string | null>(null)
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const nodes = useRef(new Map<string, HTMLElement>())

  const reduced = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }, [])

  useEffect(() => {
    if (autoPlay && !reduced) setPlaying(true)
  }, [autoPlay, reduced])

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current)
      return
    }
    timer.current = setInterval(() => setI((p) => (p + 1) % frames.length), speed)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing, speed, frames.length])

  const f = frames[i]

  // values accumulate: a value set on frame N stays until overwritten
  const values = useMemo(() => {
    const acc: Record<string, string> = {}
    for (let n = 0; n <= i; n++) Object.assign(acc, frames[n].values ?? {})
    return acc
  }, [frames, i])

  const draw = useCallback(() => {
    const wrap = wrapRef.current
    const link = frames[i].link
    if (!wrap || !link) {
      setPath(null)
      setLabelPos(null)
      return
    }
    const a = nodes.current.get(link.from)
    const b = nodes.current.get(link.to)
    if (!a || !b) {
      setPath(null)
      setLabelPos(null)
      return
    }
    const W = wrap.getBoundingClientRect()
    const s = a.getBoundingClientRect()
    const t = b.getBoundingClientRect()
    const sL = s.left - W.left
    const sT = s.top - W.top
    const tL = t.left - W.left
    const tT = t.top - W.top
    const sMidX = sL + s.width / 2
    const sMidY = sT + s.height / 2
    const tMidX = tL + t.width / 2
    const tMidY = tT + t.height / 2

    // Route by band, not by centre distance. Two rows sitting in different horizontal
    // bands (a panel above another panel) must be joined vertically - going sideways
    // makes the line loop back and clip whatever panel happens to sit between them.
    const stacked = tT >= sT + s.height - 2 || sT >= tT + t.height - 2

    let d: string
    let lx: number
    let ly: number

    if (stacked) {
      const down = tMidY >= sMidY
      const y1 = down ? sT + s.height : sT
      const y2 = down ? tT : tT + t.height
      const bend = Math.max(22, Math.abs(y2 - y1) * 0.5)
      const c1y = down ? y1 + bend : y1 - bend
      const c2y = down ? y2 - bend : y2 + bend
      d = `M ${sMidX} ${y1} C ${sMidX} ${c1y}, ${tMidX} ${c2y}, ${tMidX} ${y2}`
      // sit the label beside the curve, not on top of it
      lx = (sMidX + tMidX) / 2 + 40
      ly = (y1 + y2) / 2 + 4
    } else {
      const rightward = tMidX >= sMidX
      const x1 = rightward ? sL + s.width : sL
      const x2 = rightward ? tL : tL + t.width
      const bend = Math.max(30, Math.abs(x2 - x1) * 0.28)
      // bow the curve upward so a long sideways hop passes over any panel in between
      const lift = Math.min(26, Math.abs(x2 - x1) * 0.1)
      d = `M ${x1} ${sMidY} C ${rightward ? x1 + bend : x1 - bend} ${sMidY - lift}, ${
        rightward ? x2 - bend : x2 + bend
      } ${tMidY - lift}, ${x2} ${tMidY}`
      lx = (x1 + x2) / 2
      ly = (sMidY + tMidY) / 2 - lift - 6
    }

    setPath(d)
    setLabelPos({ x: lx, y: ly })
  }, [frames, i])

  useLayoutEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => draw())
    ro.observe(wrap)
    window.addEventListener('resize', draw)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', draw)
    }
  }, [draw])

  const go = (n: number) => {
    setPlaying(false)
    setI(((n % frames.length) + frames.length) % frames.length)
  }

  const linkDanger = f.link?.tone === 'danger'
  const stroke = linkDanger ? '#ef4444' : '#10b981'

  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      {title && (
        <div className="border-b border-gray-200 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {title}
        </div>
      )}

      <div className="overflow-x-auto p-4">
        <div ref={wrapRef} className="relative grid min-w-[640px] grid-cols-12 gap-3">
          {panels.map((pn) => (
            <div
              key={pn.id}
              style={{ gridColumn: `span ${pn.span ?? 4} / span ${pn.span ?? 4}` }}
              className={`overflow-hidden rounded-lg border bg-white dark:bg-gray-900 ${
                PANEL_TONE[pn.tone ?? 'dyld']
              }`}
            >
              <div
                className={`px-3 py-1.5 font-mono text-[11.5px] ${PANEL_HEAD[pn.tone ?? 'dyld']}`}
              >
                {pn.label}
                {pn.sub && <span className="ml-1.5 opacity-60">{pn.sub}</span>}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {pn.rows.map((r) => {
                  const key = `${pn.id}.${r.id}`
                  return (
                    <div
                      key={r.id}
                      ref={(el) => {
                        if (el) nodes.current.set(key, el)
                        else nodes.current.delete(key)
                      }}
                      className={`flex items-baseline justify-between gap-2 px-3 py-1.5 font-mono text-[11.5px] transition-colors duration-500 ${pick(
                        key,
                        pn.id,
                        f
                      )}`}
                    >
                      <span className="shrink-0">{r.k}</span>
                      <span className="truncate text-right opacity-80">{values[key] ?? r.v}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <marker
                id={`ah-${stroke.slice(1)}`}
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 z" fill={stroke} />
              </marker>
            </defs>
            {path && (
              <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeDasharray="6 4"
                markerEnd={`url(#ah-${stroke.slice(1)})`}
                className="motion-safe:animate-[archdash_1s_linear_infinite]"
              />
            )}
            {path && labelPos && f.link?.label && (
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                className="fill-gray-700 font-mono text-[10.5px] dark:fill-gray-200"
              >
                {f.link.label}
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* All captions occupy the SAME grid cell, so the block is always as tall as the
          longest one and the page never reflows while the animation plays. */}
      <div className="grid border-t border-gray-200 dark:border-gray-700">
        {frames.map((fr, n) => (
          <div
            key={n}
            aria-hidden={n !== i}
            className={`col-start-1 row-start-1 px-4 py-3 ${n === i ? '' : 'invisible'}`}
          >
            <p className="m-0 text-sm text-gray-800 dark:text-gray-200">
              <span className="mr-2 font-mono text-xs text-gray-400 dark:text-gray-500">
                {String(n + 1).padStart(2, '0')}/{String(frames.length).padStart(2, '0')}
              </span>
              {fr.caption}
            </p>
            {fr.detail && (
              <p className="mb-0 mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                {fr.detail}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-2 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-md border border-gray-300 px-2.5 py-1 font-mono text-xs text-gray-600 hover:border-primary-500 hover:text-primary-500 dark:border-gray-600 dark:text-gray-300"
          aria-label={playing ? 'Pause animation' : 'Play animation'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          onClick={() => go(i - 1)}
          className="rounded-md border border-gray-300 px-2.5 py-1 font-mono text-xs text-gray-600 hover:border-primary-500 hover:text-primary-500 dark:border-gray-600 dark:text-gray-300"
          aria-label="Previous step"
        >
          &larr;
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          className="rounded-md border border-gray-300 px-2.5 py-1 font-mono text-xs text-gray-600 hover:border-primary-500 hover:text-primary-500 dark:border-gray-600 dark:text-gray-300"
          aria-label="Next step"
        >
          &rarr;
        </button>
        <div className="ml-1 flex flex-wrap gap-1">
          {frames.map((fr, n) => (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              title={fr.caption}
              aria-label={`Step ${n + 1}: ${fr.caption}`}
              className={`h-1.5 w-5 rounded-full transition-colors ${
                n === i ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </figure>
  )
}
