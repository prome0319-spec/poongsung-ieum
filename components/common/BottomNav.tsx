'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type MenuItem = {
  href: string
  label: string
  icon: (active: boolean) => React.ReactNode
}

type BottomNavProps = {
  unreadNotifications?: number
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4L20 10.5V19C20 19.5523 19.5523 20 19 20H15V14H9V20H5C4.44772 20 4 19.5523 4 19V10.5Z"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.15' : '0'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C7.02944 3 3 6.57 3 10.95C3 13.25 4.15 15.32 6 16.77V20L9.56 18.18C10.34 18.38 11.16 18.5 12 18.5C16.9706 18.5 21 14.93 21 10.95C21 6.57 16.9706 3 12 3Z"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.15' : '0'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CommunityIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3.5"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.1' : '0'}
      />
      <path d="M8 8.5H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 12H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 15.5H12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="3"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.1' : '0'}
      />
      <path d="M8 3.5V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 3.5V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 9.5H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {active && (
        <circle cx="12" cy="14" r="2" fill="currentColor" opacity="0.7" />
      )}
    </svg>
  )
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C8.686 3 6 5.686 6 9V14L4 16V17H20V16L18 14V9C18 5.686 15.314 3 12 3Z"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.15' : '0'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18C10 19.1046 10.8954 20 12 20C13.1046 20 14 19.1046 14 18"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        strokeLinecap="round"
      />
    </svg>
  )
}

function MyIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.2' : '0'}
      />
      <path
        d="M5 19C6.2 15.9 8.7 14.5 12 14.5C15.3 14.5 17.8 15.9 19 19"
        stroke="currentColor"
        strokeWidth={active ? '2.2' : '1.7'}
        strokeLinecap="round"
      />
    </svg>
  )
}

const menus: MenuItem[] = [
  { href: '/home', label: '홈', icon: (a) => <HomeIcon active={a} /> },
  { href: '/chat', label: '채팅', icon: (a) => <ChatIcon active={a} /> },
  { href: '/community', label: '커뮤니티', icon: (a) => <CommunityIcon active={a} /> },
  { href: '/calendar', label: '캘린더', icon: (a) => <CalendarIcon active={a} /> },
  { href: '/notifications', label: '알림', icon: (a) => <BellIcon active={a} /> },
  { href: '/my', label: '마이', icon: (a) => <MyIcon active={a} /> },
]

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

export default function BottomNav({ unreadNotifications = 0 }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {menus.map((menu) => {
        const isActive = pathname ? isActivePath(pathname, menu.href) : false
        const isNotif = menu.href === '/notifications'
        const showBadge = isNotif && unreadNotifications > 0

        return (
          <Link
            key={menu.href}
            href={menu.href}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="nav-icon-wrap" style={{ position: 'relative' }}>
              {menu.icon(isActive)}
              {showBadge && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                  border: '1.5px solid #fff',
                }}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </span>
            <span>{menu.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
