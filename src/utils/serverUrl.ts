import 'server-only'

import { headers } from 'next/headers'

export const getServerUrl = async (
  route: string,
  searchParams: {
    [key: string]: string | string[] | undefined
  },
) => {
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') ?? 'http'
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        query.append(key, v)
      })
    } else if (value !== undefined) {
      query.append(key, value)
    }
  }
  return `${protocol}://${host}${route}${query.toString() ? `?${query.toString()}` : ''}`
}
