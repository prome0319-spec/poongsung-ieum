'use client'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'

type Props = {
  urls: string[]
}

export default function ImageLightbox({ urls }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const close = useCallback(() => setActiveIndex(null), [])

  const prev = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i - 1 + urls.length) % urls.length))
  }, [urls.length])

  const next = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i + 1) % urls.length))
  }, [urls.length])

  useEffect(() => {
    if (activeIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [activeIndex, close, prev, next])

  return (
    <>
      {/* Image grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: urls.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        marginTop: 4,
      }}>
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{
              display: 'block',
              borderRadius: 'var(--r-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              cursor: 'zoom-in',
              padding: 0,
              background: 'none',
              width: '100%',
            }}
            aria-label={`이미지 ${i + 1} 크게 보기`}
          >
            <Image
              src={url}
              alt={`첨부 이미지 ${i + 1}`}
              width={600}
              height={400}
              style={{
                width: '100%',
                height: urls.length === 1 ? 'auto' : '160px',
                objectFit: 'cover',
                display: 'block',
              }}
              unoptimized
            />
          </button>
        ))}
      </div>

      {/* Lightbox overlay */}
      {activeIndex !== null && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 8000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          {/* Close */}
          <button
            onClick={close}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="닫기"
          >
            ✕
          </button>

          {/* Counter */}
          {urls.length > 1 && (
            <div style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              fontWeight: 700,
            }}>
              {activeIndex + 1} / {urls.length}
            </div>
          )}

          {/* Prev */}
          {urls.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 22,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="이전"
            >
              ‹
            </button>
          )}

          {/* Image */}
          <div onClick={(e) => e.stopPropagation()}>
            <Image
              src={urls[activeIndex]}
              alt={`첨부 이미지 ${activeIndex + 1}`}
              width={1200}
              height={900}
              style={{
                maxWidth: 'min(90vw, 800px)',
                maxHeight: '82vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 12,
                display: 'block',
              }}
              unoptimized
            />
          </div>

          {/* Next */}
          {urls.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 22,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="다음"
            >
              ›
            </button>
          )}

          {/* Dot indicators */}
          {urls.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 6,
            }}>
              {urls.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveIndex(i) }}
                  style={{
                    width: i === activeIndex ? 18 : 7,
                    height: 7,
                    borderRadius: 999,
                    border: 'none',
                    background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'width 0.2s ease, background 0.2s ease',
                  }}
                  aria-label={`이미지 ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
