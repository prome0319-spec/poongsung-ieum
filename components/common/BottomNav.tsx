import Link from 'next/link'

const menus = [
  { href: '/home', label: '홈' },
  { href: '/chat', label: '채팅' },
  { href: '/community', label: '커뮤니티' },
  { href: '/calendar', label: '캘린더' },
  { href: '/my', label: '마이' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {menus.map((menu) => (
        <Link key={menu.href} href={menu.href}>
          {menu.label}
        </Link>
      ))}
    </nav>
  )
}