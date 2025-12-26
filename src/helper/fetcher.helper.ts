export const postFetcher = async (
  url: string,
  headers: Record<string, string>,
  options: Record<string, string>,
) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...options,
  })
  if (!response.ok) {
    throw new Error('Failed to post data')
  }
  return response
}

export const deleteFetcher = async (
  url: string,
  headers: Record<string, string>,
  options: Record<string, string>,
) => {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...options,
  })
  if (!response.ok) {
    throw new Error('Failed to delete data')
  }
  return response
}
