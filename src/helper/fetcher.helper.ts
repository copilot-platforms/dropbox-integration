import fetch from 'node-fetch'

export const putFetcher = async (
  url: string,
  options: Record<string, string | NodeJS.ReadableStream | null>,
) => {
  return await fetch(url, {
    method: 'PUT',
    ...options,
  })
}

export const getFetcher = async (url: string) => {
  return await fetch(url)
}
