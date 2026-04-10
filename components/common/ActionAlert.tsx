'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function ActionAlert() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const message = searchParams.get('message')

    if (!message || !pathname) {
      return
    }

    const dedupeKey = `action-alert:${pathname}:${message}`

    if (sessionStorage.getItem(dedupeKey) === 'shown') {
      return
    }

    sessionStorage.setItem(dedupeKey, 'shown')

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('message')

    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname

    window.history.replaceState(null, '', nextUrl)
    window.alert(message)

    window.setTimeout(() => {
      sessionStorage.removeItem(dedupeKey)
    }, 0)
  }, [pathname, searchParams])

  return null
}