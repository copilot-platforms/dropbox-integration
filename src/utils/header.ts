/**
 * Converts a JS object into a Dropbox-compatible header string.
 * Ensures the header is ASCII-safe by escaping all unicode characters.
 */
export function dropboxArgHeader(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(
    /[\u007F-\uFFFF]/g,
    // biome-ignore lint/style/useTemplate: try
    (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4),
  )
}
