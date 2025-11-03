export const putFetcher = async (url: string, body: Record<string, string | ArrayBuffer>) => {
  return await fetch(url, {
    method: 'PUT',
    ...body,
  })
}

export const getFetcher = async (url: string) => {
  return await fetch(url)
}
