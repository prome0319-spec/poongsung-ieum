import './globals.css'
import type { Metadata } from 'next'
import ActionAlert from '@/components/common/ActionAlert'

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
      <body>
        <ActionAlert />
        {children}
      </body>
    </html>
  )
}