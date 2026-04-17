import './globals.css'
import type { Metadata } from 'next'
import ActionAlert from '@/components/common/ActionAlert'
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: '풍성이음',
  description: '교회 청년부 전용 웹앱',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '풍성이음',
  },
  formatDetection: {
    telephone: false,
  },
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
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}