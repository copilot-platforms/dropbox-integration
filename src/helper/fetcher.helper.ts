import fetch from 'node-fetch'

export const putFetcher = async (
  url: string,
  headers: Record<string, string>,
  options: Record<string, string | NodeJS.ReadableStream | null>,
) => {
  return await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...headers,
    },
    ...options,
  })
}

export const getFetcher = async (url: string) => {
  return await fetch(url)
}
