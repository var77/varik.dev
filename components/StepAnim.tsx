'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type StepBox = {
  /** stable id referenced by frames */
  id: string
  /** top line, usually a symbol or address */
  label: string
  /** optional second line, usually a type or role */
  sub?: string
  /** start a new visual row before this box (layout="grid" only) */
  br?: boolean
}

export type StepFrame = {
  /** short imperative line shown in the step list */
  caption: string
  /** optional longer explanation shown under the diagram */
  detail?: string
  /** boxes highlighted as "currently executing / just touched" */
  active?: string[]
  /** boxes highlighted as attacker-controlled or faulting */
  danger?: string[]
  /** boxes highlighted as the desired end state */
  ok?: string[]
  /** boxes dimmed out (skipped branch) */
  muted?: string[]
  /** per-box value text, rendered monospace under the label */
  values?: Record<string, string>
}

type Props = {
  title?: string
  boxes: StepBox[]
  frames: StepFrame[]
  /** row = horizontal flow with arrows, col = stacked memory cells, grid = wrapped rows */
  layout?: 'row' | 'col' | 'grid'
  /** ms per frame when playing */
  speed?: number
  /** autoplay on mount (loops) */
  autoPlay?: boolean
}

const TONE = {
  idle: 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
  active: 'border-primary-500 bg-primary-50 text-gray-900 dark:bg-primary-900/30 dark:text-gray-50',
  danger: 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200',
  ok: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  muted:
    'border-dashed border-gray-200 bg-transparent text-gray-300 dark:border-gray-800 dark:text-gray-700',
}

function toneFor(id: string, f: StepFrame) {
  if (f.danger?.includes(id)) return TONE.danger
  if (f.ok?.includes(id)) return TONE.ok
  if (f.active?.includes(id)) return TONE.active
  if (f.muted?.includes(id)) return TONE.muted
  return TONE.idle
}

export default function StepAnim({
  title,
  boxes,
  frames,
  layout = 'row',
  speed = 2000,
  autoPlay = true,
}: Props) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const go = useCallback(
    (n: number) => {
      setPlaying(false)
      setI(((n % frames.length) + frames.length) % frames.length)
    },
    [frames.length]
  )

  const f = frames[i]
  const wrap =
    layout === 'col'
      ? 'flex flex-col gap-1.5'
      : layout === 'grid'
        ? 'flex flex-wrap items-stretch gap-2'
        : 'flex flex-wrap items-stretch gap-0'

  // every box that shows a value in at least one frame
  const valued = useMemo(() => {
    const s = new Set<string>()
    for (const fr of frames) for (const k of Object.keys(fr.values ?? {})) s.add(k)
    return s
  }, [frames])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      {title && (
        <div className="border-b border-gray-200 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {title}
        </div>
      )}

      <div className="overflow-x-auto p-4">
        <div className={wrap}>
          {boxes.map((b, n) => (
            <div key={b.id} className={layout === 'row' ? 'flex items-center' : ''}>
              {layout === 'row' && n > 0 && !b.br && (
                <span aria-hidden className="px-2 text-gray-300 dark:text-gray-600">
                  &rarr;
                </span>
              )}
              <div
                className={`min-w-[9rem] rounded-lg border px-3 py-2 transition-all duration-500 ${toneFor(
                  b.id,
                  f
                )}`}
              >
                <div className="break-words font-mono text-[12.5px] font-medium leading-tight">
                  {b.label}
                </div>
                {b.sub && <div className="mt-0.5 text-[11px] opacity-70">{b.sub}</div>}
                {/* reserve the value line on any box that carries one in ANY frame, so the
                    diagram keeps a constant height as the animation plays */}
                {valued.has(b.id) && (
                  <div className="mt-1 break-all font-mono text-[11.5px] opacity-90">
                    {f.values?.[b.id] ?? ' '}
                  </div>
                )}
              </div>
            </div>
          ))}
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
