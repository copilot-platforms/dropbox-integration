export function buildPathArray(path: string): string[] {
  // Split the path into parts, ignoring any empty segments
  const parts = path.split('/').filter(Boolean)

  // Accumulate the parts into full paths
  const result: string[] = []
  let current = ''

  for (const part of parts) {
    current += `/${part}`
    result.push(current)
  }

  return result
}
