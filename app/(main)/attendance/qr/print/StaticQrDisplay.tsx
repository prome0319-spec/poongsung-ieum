'use client'

import QRCode from 'react-qr-code'

export default function StaticQrDisplay({ checkinUrl }: { checkinUrl: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🔲</div>
      <div style={{
        display: 'inline-block',
        padding: 16,
        background: '#fff',
        borderRadius: 12,
        border: '1.5px solid var(--border)',
      }}>
        <QRCode value={checkinUrl} size={240} />
      </div>
      <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        출석 체크인 QR
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
        만료 없음 · 오늘 날짜로 자동 기록
      </div>
      <button
        onClick={() => window.print()}
        style={{
          marginTop: 16,
          padding: '10px 24px',
          borderRadius: 'var(--r-lg)',
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        🖨️ 인쇄하기
      </button>
    </div>
  )
}
