import httpStatus from 'http-status'
import { type NextRequest, NextResponse } from 'next/server'
import z from 'zod'
import db from '@/db'
import APIError from '@/errors/APIError'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import { AssemblyWebhookService } from '@/features/webhook/assembly/lib/webhook.service'
import { DISPATCHABLE_HANDLEABLE_EVENT } from '@/features/webhook/assembly/utils/types'
import User from '@/lib/copilot/models/User.model'
import logger from '@/lib/logger'

export const handleWebhookEvent = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token')

  const user = await User.authenticate(token)

  const dropboxConnectionService = new DropboxConnectionsService(user)
  const connection = await dropboxConnectionService.getConnectionForWorkspace()

  if (!connection.refreshToken) throw new APIError('No refresh token found', httpStatus.NOT_FOUND)
  if (!connection.accountId) throw new APIError('No accountId found', httpStatus.NOT_FOUND)

  const assemblyWebhookService = new AssemblyWebhookService(user, {
    refreshToken: connection.refreshToken,
    accountId: connection.accountId,
  })
  const webhookEvent = await assemblyWebhookService.parseWebhook(req)
  logger.info(`Event triggered. Type: ${webhookEvent.eventType}`)

  const eventType = await assemblyWebhookService.validateHandleableEvent(webhookEvent)
  if (!eventType) {
    return NextResponse.json({})
  }

  const existingFile = await db.query.fileFolderSync.findFirst({
    where: (fileFolderSync, { eq }) =>
      eq(fileFolderSync.assemblyFileId, z.string().parse(webhookEvent.data.id)),
  })

  switch (eventType) {
    case DISPATCHABLE_HANDLEABLE_EVENT.FileCreated:
    case DISPATCHABLE_HANDLEABLE_EVENT.FolderCreated:
      if (!existingFile) {
        await assemblyWebhookService.handleFileCreated(webhookEvent)
      }
      break
    case DISPATCHABLE_HANDLEABLE_EVENT.FileUpdated:
    case DISPATCHABLE_HANDLEABLE_EVENT.FolderUpdated:
      if (webhookEvent.data.previousAttributes) {
        //doing this check because copilot.uploadFile method also triggers a file.updated webhook but without previousAttributes.
        await assemblyWebhookService.handleFileUpdated(webhookEvent)
      }
      break
    default:
      if (existingFile) {
        //only proceed with deleting file if there is existing row in the filefoldersync table.
        await assemblyWebhookService.handleFileDeleted(webhookEvent)
      }
  }

  return NextResponse.json({ message: `${eventType} webhook request handled successfully` })
}
