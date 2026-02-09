import httpStatus from 'http-status'
import { type NextRequest, NextResponse } from 'next/server'
import env from '@/config/server.env'
import APIError from '@/errors/APIError'
import { ResyncService } from '@/features/workers/resync-failed-files/lib/resync-failed-files.service'

export const resyncFailedFiles = async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    throw new APIError('Unauthorized', httpStatus.UNAUTHORIZED)
  }

  const resyncService = new ResyncService()
  await resyncService.resyncFailedFiles()
  return NextResponse.json({ message: 'Succeslyfully trigger re syncing of files.' })
}
