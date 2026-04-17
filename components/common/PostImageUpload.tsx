'use client'

import { useRef, useState } from 'react'

const MAX_IMAGES = 3

export default function PostImageUpload({ defaultUrls = [] }: { defaultUrls?: string[] }) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([])
  const [kept, setKept] = useState<string[]>(defaultUrls) // 기존 이미지 (수정 시)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const remaining = MAX_IMAGES - previews.length - kept.length
    const added: { file: File; url: string }[] = []

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      added.push({ file, url: URL.createObjectURL(file) })
    }

    setPreviews((prev) => [...prev, ...added])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removePreview(idx: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  function removeKept(url: string) {
    setKept((prev) => prev.filter((u) => u !== url))
  }

  const total = previews.length + kept.length
  const canAdd = total < MAX_IMAGES

  return (
    <div>
      {/* 기존 유지 이미지 hidden inputs */}
      {kept.map((url) => (
        <input key={url} type="hidden" name="kept_image_urls" value={url} />
      ))}

      {/* 새 파일 hidden inputs */}
      {previews.map((p, i) => (
        <input
          key={i}
          type="file"
          name="images"
          style={{ display: 'none' }}
          ref={i === 0 ? undefined : undefined}
          // 실제 파일을 FormData에 넣기 위해 DataTransfer 사용
          data-file-idx={i}
        />
      ))}

      {/* 실제 업로드용 파일 input (hidden) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* 미리보기 그리드 */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {kept.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)' }}
              />
              <button
                type="button"
                onClick={() => removeKept(url)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--danger)', color: '#fff',
                  border: 'none', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, lineHeight: 1,
                }}
              >✕</button>
            </div>
          ))}

          {previews.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--primary-border)' }}
              />
              <button
                type="button"
                onClick={() => removePreview(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--danger)', color: '#fff',
                  border: 'none', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, lineHeight: 1,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 추가 버튼 */}
      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px',
            border: '1.5px dashed var(--border-strong)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg-section)',
            color: 'var(--text-muted)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'border-color var(--t-fast), color var(--t-fast)',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)' }}
          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          <span style={{ fontSize: 16 }}>📷</span>
          사진 추가 ({total}/{MAX_IMAGES})
        </button>
      )}

      {/* 파일을 FormData에 포함시키기 위한 숨김 form + script 대신
          DataTransfer 방식으로 파일 input 동적 추가 */}
      <FileInjector previews={previews} />
    </div>
  )
}

/* 미리보기 파일들을 실제 form input에 주입 */
function FileInjector({ previews }: { previews: { file: File; url: string }[] }) {
  return (
    <>
      {previews.map((p, i) => (
        <HiddenFileInput key={p.url} file={p.file} index={i} />
      ))}
    </>
  )
}

function HiddenFileInput({ file, index }: { file: File; index: number }) {
  const ref = useRef<HTMLInputElement>(null)

  // input에 File 주입
  if (ref.current) {
    const dt = new DataTransfer()
    dt.items.add(file)
    ref.current.files = dt.files
  }

  return (
    <input
      ref={(el) => {
        if (el) {
          const dt = new DataTransfer()
          dt.items.add(file)
          el.files = dt.files
        }
      }}
      type="file"
      name="images"
      accept="image/*"
      style={{ display: 'none' }}
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}
