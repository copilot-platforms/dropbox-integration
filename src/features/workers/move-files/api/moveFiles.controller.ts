import httpStatus from 'http-status'
import { type NextRequest, NextResponse } from 'next/server'
import env from '@/config/server.env'
import APIError from '@/errors/APIError'
import { MoveFilesService } from '@/features/workers/move-files/lib/moveFiles.service'

export const moveFilesToCorrectPath = async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    throw new APIError('Unauthorized', httpStatus.UNAUTHORIZED)
  }

  const resyncService = new MoveFilesService()
  await resyncService.initiateFileMove()
  return NextResponse.json({ message: 'Successfully triggered the folder-move process.' })
}

export const moveFoldersToCorrectPath = async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    throw new APIError('Unauthorized', httpStatus.UNAUTHORIZED)
  }

  const resyncService = new MoveFilesService()
  await resyncService.initiateFolderMove()
  return NextResponse.json({ message: 'Succeslyfully triggered the file-move process.' })
}
