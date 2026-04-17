import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '풍성이음',
    short_name: '풍성이음',
    description: '교회 청년부 전용 웹앱',
    start_url: '/home',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#6d28d9',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    categories: ['social', 'lifestyle'],
    lang: 'ko',
    dir: 'ltr',
    shortcuts: [
      {
        name: '채팅',
        short_name: '채팅',
        description: '채팅방 목록 보기',
        url: '/chat',
        icons: [{ src: '/logo.svg', sizes: 'any' }],
      },
      {
        name: '캘린더',
        short_name: '캘린더',
        description: '일정 확인',
        url: '/calendar',
        icons: [{ src: '/logo.svg', sizes: 'any' }],
      },
    ],
  }
}
