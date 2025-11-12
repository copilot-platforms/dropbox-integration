import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import z from 'zod'
import env from '@/config/server.env'
import db from '@/db'
import { channelSync } from '@/db/schema/channelSync.schema'
import { generateToken } from '@/lib/copilot/generateToken'
import User from '@/lib/copilot/models/User.model'
import { initiateDropboxToAssemblySync } from '@/trigger/processFileSync'
import { type DropboxChange, getDropboxChanges } from './getDropboxChanges'

export const handleWebhookUrlVerification = (req: NextRequest) => {
  try {
    const challenge = req.nextUrl.searchParams.get('challenge')
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    console.error(`error: ${error}`)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export const handleWebhookEvents = async (req: NextRequest) => {
  try {
    const signature = req.headers.get('X-Dropbox-Signature')
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const body = await req.text()
    const computedSignature = crypto
      .createHmac('sha256', env.DROPBOX_APP_SECRET)
      .update(body)
      .digest('hex')

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computedSignature, 'hex'),
    )

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const payload = JSON.parse(body)
    const accounts = payload.list_folder.accounts
    if (accounts.length) {
      for (let i = 0; i < accounts.length; i++) {
        await fetchDropBoxChanges(accounts[i])
      }
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    console.error(`error: ${error}`)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

async function fetchDropBoxChanges(accountId: string) {
  const connection = await db.query.dropboxConnections.findFirst({
    where: (dropboxConnections, { eq, and }) =>
      and(
        eq(dropboxConnections.status, true),
        eq(dropboxConnections.accountId, z.string().parse(accountId)),
      ),
    columns: {
      portalId: true,
      initiatedBy: true,
      refreshToken: true,
    },
  })
  if (!connection || !connection?.refreshToken) {
    return NextResponse.json({ error: 'Connection not activated' }, { status: 500 })
  }

  const { portalId, initiatedBy, refreshToken } = connection

  const connectionToken = {
    refreshToken,
    accountId,
  }
  const token = generateToken(env.COPILOT_API_KEY, {
    workspaceId: portalId,
    internalUserId: initiatedBy,
  })

  const user = await User.authenticate(token)

  const channels = await db.query.channelSync.findMany({
    where: (channelSync, { eq, and }) =>
      and(eq(channelSync.dbxAccountId, accountId), eq(channelSync.status, true)),
    columns: {
      id: true,
      dbxRootPath: true,
      dbxCursor: true,
      assemblyChannelId: true,
    },
  })

  for (let i = 0; i < channels.length; i++) {
    const { id: channelSyncId, dbxRootPath, assemblyChannelId, dbxCursor } = channels[i]
    if (!dbxCursor) {
      //First time sync should do full sync
      const payload = {
        dbxRootPath,
        assemblyChannelId,
        connectionToken,
        user,
      }
      await initiateDropboxToAssemblySync.trigger(payload)
    }

    let hasMore = true
    let currentCursor = dbxCursor ?? ''
    const allChanges: DropboxChange[] = []

    while (hasMore) {
      const {
        changes,
        newCursor,
        hasMore: more,
      } = await getDropboxChanges(connectionToken.refreshToken, currentCursor, dbxRootPath)

      allChanges.push(...changes)
      currentCursor = newCursor
      hasMore = more
    }

    if (allChanges.length) {
      for (let j = 0; j < allChanges.length; j++) {
        const file = allChanges[j]
        if (file.type === 'deleted') {
          handleFileDelete(file)
        } else {
          const fileData = await db.query.fileFolderSync.findFirst({
            where: (fileFolderSync, { eq }) =>
              eq(fileFolderSync.dbxFileId, z.string().parse(file.id)),
          })
          fileData ? handleFileUpdate(file) : handleFileInsert(file)

          console.info('handle insert and update accordingly')
        }
      }
    }

    await db
      .update(channelSync)
      .set({ dbxCursor: currentCursor })
      .where(eq(channelSync.id, channelSyncId))

    console.info('logging')
    console.info('allchanges', allChanges)
  }
}

function handleFileInsert(file: DropboxChange) {
  console.info('handles file insert', file)
}

function handleFileDelete(file: DropboxChange) {
  console.info('handles file delete', file)
}

function handleFileUpdate(file: DropboxChange) {
  console.info('handles file update', file)
}
