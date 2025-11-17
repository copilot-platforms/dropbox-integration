import { type NextRequest, NextResponse } from 'next/server'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import User from '@/lib/copilot/models/User.model'
import { AssemblyWebhookService } from '../lib/webhook.service'
import { DISPATCHABLE_HANDLEABLE_EVENT } from '../utils/types'

export const handleWebhookEvent = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token')

  const user = await User.authenticate(token)

  const dropboxConnectionService = new DropboxConnectionsService(user)
  const connection = await dropboxConnectionService.getConnectionForWorkspace()

  if (!connection.refreshToken) throw new Error('No refresh token found')
  if (!connection.accountId) throw new Error('No accountId found')

  const assemblyWebhookService = new AssemblyWebhookService(user, {
    refreshToken: connection.refreshToken,
    accountId: connection.accountId,
  })

  const webhookEvent = await assemblyWebhookService.parseWebhook(req)
  const eventType = assemblyWebhookService.validateHandleableEvent(webhookEvent)
  if (!eventType) {
    return NextResponse.json({})
  }

  switch (eventType) {
    case DISPATCHABLE_HANDLEABLE_EVENT.FileCreated:
      await assemblyWebhookService.handleFileCreated(webhookEvent)
      break
    case DISPATCHABLE_HANDLEABLE_EVENT.FileUpdated:
      await assemblyWebhookService.handleFileUpdated(webhookEvent)
      break
    default:
      await assemblyWebhookService.handleFileDeleted(webhookEvent)
  }

  return NextResponse.json({ message: `${eventType} webhook request handled successfully` })
}
