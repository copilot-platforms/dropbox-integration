export const postFetcher = async (
  url: string,
  headers: Record<string, string>,
  options: Record<string, string>,
) => {
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...options,
  })
}

export const deleteFetcher = async (
  url: string,
  headers: Record<string, string>,
  options: Record<string, string>,
) => {
  return await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...options,
  })
}
