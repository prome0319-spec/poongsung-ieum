'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { HomeNotice } from '@/types/user'

const STORAGE_KEY_PREFIX = 'ieum_notice_hidden_'

function getTodayKey(noticeId: string) {
  const today = new Date().toISOString().slice(0, 10)
  return `${STORAGE_KEY_PREFIX}${noticeId}_${today}`
}

function isHiddenToday(noticeId: string) {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(getTodayKey(noticeId)) === '1'
}

function hideToday(noticeId: string) {
  localStorage.setItem(getTodayKey(noticeId), '1')
}

type Props = {
  notice: HomeNotice
}

export default function HomeNoticePopup({ notice }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isHiddenToday(notice.id)) {
      setVisible(true)
    }
  }, [notice.id])

  if (!visible) return null

  function handleHideToday() {
    hideToday(notice.id)
    setVisible(false)
  }

  function handleClose() {
    setVisible(false)
  }

  return (
    <div className="notice-overlay" onClick={handleClose}>
      {/* 클릭 전파 막기 */}
      <div
        className="notice-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={notice.title}
      >
        {notice.image_url && (
          <Image
            src={notice.image_url}
            alt={notice.title}
            width={720}
            height={280}
            className="notice-sheet-img"
            style={{ width: '100%', height: 'auto', maxHeight: '280px', objectFit: 'cover' }}
          />
        )}

        <div className="notice-sheet-body">
          <h2 className="notice-sheet-title">{notice.title}</h2>
          {notice.content && (
            <p className="notice-sheet-content">{notice.content}</p>
          )}
          {notice.link_url && (
            <a
              href={notice.link_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '14px',
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--primary)',
              }}
            >
              자세히 보기 →
            </a>
          )}
        </div>

        <div className="notice-sheet-footer">
          <button className="notice-today-btn" type="button" onClick={handleHideToday}>
            오늘 하루 보지 않기
          </button>
          <button className="notice-close-btn" type="button" onClick={handleClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
