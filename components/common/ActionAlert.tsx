'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ActionAlert() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const message = params.get('message')

    if (!message) {
      return
    }

    const dedupeKey = `action-alert:${pathname}:${message}`

    if (sessionStorage.getItem(dedupeKey) === 'shown') {
      return
    }

    sessionStorage.setItem(dedupeKey, 'shown')

    params.delete('message')

    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    window.history.replaceState(null, '', nextUrl)
    window.alert(message)

    window.setTimeout(() => {
      sessionStorage.removeItem(dedupeKey)
    }, 0)
  }, [pathname])

  return null
}