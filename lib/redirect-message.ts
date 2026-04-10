import { redirect } from 'next/navigation'

export function buildPathWithMessage(path: string, message: string) {
  const [pathname, queryString] = path.split('?')
  const params = new URLSearchParams(queryString ?? '')

  params.set('message', message)

  const nextQuery = params.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

export function redirectWithMessage(path: string, message: string): never {
  redirect(buildPathWithMessage(path, message))
}