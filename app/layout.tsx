import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '풍성이음',
  description: '교회 청년부 전용 웹앱',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}