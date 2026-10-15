'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ImageProps } from 'next/image'
import Image from './Image'

const basePath = process.env.BASE_PATH

const ZoomImage = ({ alt, ...rest }: ImageProps) => {
  const [open, setOpen] = useState(false)
  const src = typeof rest.src === 'string' ? `${basePath || ''}${rest.src}` : null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!src) return <Image alt={alt} {...rest} />

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block cursor-zoom-in"
        aria-label={`Zoom image: ${alt}`}
      >
        <Image alt={alt} {...rest} />
      </button>
      {open &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close image"
              className="flex h-full w-full cursor-zoom-out items-center justify-center bg-black/90 p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
            </button>
          </div>,
          document.body
        )}
    </>
  )
}

export default ZoomImage
