export const customFetcher = async (
  method: 'GET' | 'POST' | 'DELETE' | 'PUT',
  url: string,
  headers: Record<string, string>,
  options: Record<string, string>,
) => {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`Fetch failed with status code: ${response.status}`)
  }
  return response
}
