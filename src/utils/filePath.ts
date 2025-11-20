import * as p from 'node:path'
import dayjs from 'dayjs'
import { ObjectType } from '@/db/constants'

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

export function getFolderPath(path: string, type: ObjectType) {
  if (type === ObjectType.FOLDER) return path
  return p.dirname(path)
}

export function appendDateTimeToFilePath(filePath: string): string {
  // Extract directory, filename, and extension using regex
  const match = filePath.match(/^(.*\/)?([^/]+)\.([^.]+)$/)
  if (!match) throw new Error('Invalid file path format')

  const [, dir = '', filename, ext] = match

  // Create a timestamp in YYYY-MM-DD HH.mm.ss format
  const timestamp = dayjs().format('MM-DD-YYYY HH:mm:ss')

  // Return the new path
  return `${dir}${filename} (${timestamp}).${ext}`
}
