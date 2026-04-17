'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

type AvatarUploadProps = {
  currentUrl: string | null
  isSoldier: boolean
  action: (formData: FormData) => Promise<void>
}

export default function AvatarUpload({ currentUrl, isSoldier, action }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fallback = isSoldier ? '/avatar-soldier.svg' : '/avatar-default.svg'
  const displaySrc = preview ?? currentUrl ?? fallback

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!inputRef.current?.files?.[0]) {
      inputRef.current?.click()
      return
    }
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await action(fd)
    setLoading(false)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* 아바타 미리보기 */}
        <div
          style={{
            position: 'relative',
            width: 88,
            height: 88,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid var(--primary-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            cursor: 'pointer',
          }}
          onClick={() => inputRef.current?.click()}
          title="클릭하여 사진 변경"
        >
          <Image
            src={displaySrc}
            alt="프로필 사진"
            width={88}
            height={88}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            unoptimized
          />
          {/* 오버레이 */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.15s',
          }}
            className="avatar-overlay"
          >
            <span style={{ fontSize: 22 }}>📷</span>
          </div>
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={inputRef}
          type="file"
          name="avatar"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="button secondary"
            style={{ fontSize: 13, minHeight: 36, padding: '0 14px' }}
          >
            사진 선택
          </button>
          {preview && (
            <button
              type="submit"
              disabled={loading}
              className="button"
              style={{ fontSize: 13, minHeight: 36, padding: '0 14px' }}
            >
              {loading ? '업로드 중…' : '저장'}
            </button>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', textAlign: 'center' }}>
          JPG · PNG · WEBP · GIF / 최대 5MB
        </p>
      </div>

      <style>{`
        div:hover > .avatar-overlay { opacity: 1 !important; }
      `}</style>
    </form>
  )
}
