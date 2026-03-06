import { and, asc, eq, gte, ne } from 'drizzle-orm'
import httpStatus from 'http-status'
import { NextResponse } from 'next/server'
import { ApiError } from 'node_modules/copilot-node-sdk/dist/codegen/api'
import fetch from 'node-fetch'
import env from '@/config/server.env'
import db from '@/db'
import { ObjectType } from '@/db/constants'
import { channelSync } from '@/db/schema/channelSync.schema'
import { type FileSyncSelectType, fileFolderSync } from '@/db/schema/fileFolderSync.schema'
import {
  type IncorrectPathFilesSelectType,
  type IncorrectPathUpdatePayload,
  incorrectPathFiles,
} from '@/db/schema/incorrectPathFiles.schema'
import APIError from '@/errors/APIError'
import { copilotBottleneck } from '@/lib/copilot/bottleneck'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import { generateToken } from '@/lib/copilot/generateToken'
import type { CopilotFileRetrieve } from '@/lib/copilot/types'
import { withRetry } from '@/lib/withRetry'
import { startFileMoveProcess } from '@/trigger/moveIncorrectPathFiles'
import { getFaultyPath } from '@/utils/filePath'

const targetDate = new Date('2026-02-04T01:21:00Z')
const targetDate2 = new Date('2026-02-19T00:00:00Z')
const portalId = env.FILE_MIGRATION_PORTAL_ID

export class MoveFilesService {
  private async getPortalInfo(portalId: string) {
    const portalInfo = await db.query.dropboxConnections.findFirst({
      where: (dropboxConnections, { eq }) => eq(dropboxConnections.portalId, portalId),
    })
    if (!portalInfo) throw new APIError('Portal not found', httpStatus.NOT_FOUND)
    return portalInfo
  }

  private async getOrCreateMoveFilesForPortal(portalId: string, channelId: string) {
    const record = await db.query.incorrectPathFiles.findFirst({
      where: (incorrectPathFiles, { eq, and }) =>
        and(eq(incorrectPathFiles.portalId, portalId), eq(incorrectPathFiles.channelId, channelId)),
    })

    if (record) return record

    const [newRecord] = await db
      .insert(incorrectPathFiles)
      .values({ portalId, channelId, isMoveComplete: false })
      .returning()

    return newRecord
  }

  async initiateFolderMove() {
    if (!portalId) {
      console.error('Portal id is not set')
      return NextResponse.json({ error: 'Portal id is not set' }, { status: 400 })
    }

    // 1. get all faulty folders
    const faultyFolders = await db.query.fileFolderSync.findMany({
      where: (fileFolderSync, { eq, and, gt, lt }) =>
        and(
          eq(fileFolderSync.portalId, portalId),
          eq(fileFolderSync.object, ObjectType.FOLDER),
          gt(fileFolderSync.updatedAt, targetDate),
          lt(fileFolderSync.updatedAt, targetDate2),
        ),
      with: {
        channel: {
          columns: {
            id: true,
            assemblyChannelId: true,
          },
        },
      },
      orderBy: [asc(fileFolderSync.createdAt)],
    })
    const faultyChannelSync = [
      ...new Set(faultyFolders.map((folder) => folder.channel.assemblyChannelId)),
    ]

    const channelSyncs = await db.query.channelSync.findMany({
      where: (channelSync, { eq, and, inArray }) =>
        and(
          eq(channelSync.portalId, portalId),
          eq(channelSync.status, true),
          inArray(channelSync.assemblyChannelId, faultyChannelSync),
        ),
    })
    console.info({
      faultyFolders,
      channelSyncsCount: channelSyncs.length,
    })

    // 2. get all files from assembly

    if (!portalId) {
      console.error('Portal id is not set')
      return NextResponse.json({ error: 'Portal id is not set' }, { status: 400 })
    }

    const portalInfo = await this.getPortalInfo(portalId)
    const token = generateToken(env.COPILOT_API_KEY, {
      workspaceId: portalId,
      internalUserId: portalInfo.initiatedBy,
    })

    if (!token) throw new APIError('Failed to generate token', httpStatus.INTERNAL_SERVER_ERROR)
    const copilotApi = new CopilotAPI(token)

    const allPromises = []
    const allFilesPath: string[] = []
    for (const channel of channelSyncs) {
      // 1. get all files from assembly
      const promise = copilotBottleneck.schedule(() => {
        return this.getFilesForChannelFromAssembly(
          channel.assemblyChannelId,
          copilotApi,
          allFilesPath,
        )
      })
      allPromises.push(promise)
    }
    await Promise.all(allPromises)
    console.info(`all paths count: ${allFilesPath.length}`)

    const newPromises = []
    // check if folder exists, if not create
    for (const faultyFolder of faultyFolders) {
      if (!faultyFolder.itemPath) continue

      if (
        allFilesPath.includes(`${faultyFolder.itemPath}+${faultyFolder.channel.assemblyChannelId}`)
      )
        continue

      console.info(`Processing for folder: ${faultyFolder.itemPath}`)

      const newPromise = copilotBottleneck.schedule(() => {
        return this.checkAndCreateFolder(
          faultyFolder,
          faultyFolder.channel.assemblyChannelId,
          copilotApi,
        )
      })
      newPromises.push(newPromise)
    }
    await Promise.all(newPromises)

    return NextResponse.json({ success: true })
  }

  private async checkAndCreateFolder(
    faultyFolder: FileSyncSelectType,
    channelId: string,
    copilotApi: CopilotAPI,
  ) {
    const faultyFolderName = getFaultyPath(faultyFolder.itemPath as string)
    console.info(
      `\n\n checkAndCreateFolder. Folder path: ${faultyFolder.itemPath}. Folder id: ${faultyFolder.assemblyFileId}. Faulty folder name: ${faultyFolderName} \n\n`,
    )

    if (!faultyFolder.itemPath || !faultyFolder.assemblyFileId) return

    // next step: create folder in assembly
    try {
      const folderCreateResponse = await copilotApi.createFile(
        faultyFolder.itemPath,
        channelId,
        ObjectType.FOLDER,
      )
      console.info(`checkAndCreateFolder. Folder created. Folder ID: ${folderCreateResponse.id}`)

      console.info(
        `checkAndCreateFolder. Deleting faulty folder. Folder ID: ${faultyFolder.assemblyFileId}\n`,
      )
      await copilotApi.deleteFile(faultyFolder.assemblyFileId)

      // update folder id in db
      await db
        .update(fileFolderSync)
        .set({ assemblyFileId: folderCreateResponse.id })
        .where(eq(fileFolderSync.id, faultyFolder.id))
    } catch (error) {
      console.error(error)
      console.error({ err: JSON.stringify(error) })
      const sError = error as ApiError
      if (sError.status === 400 && sError.body.message === 'Folder already exists') {
        console.info('Folder already exists. Attempt to delete the older one')
        // await copilotApi.deleteFile(faultyFolder.assemblyFileId)
        return
      }
      console.info('Exists')
      return
    }
  }

  private async getFilesForChannelFromAssembly(
    channelId: string,
    copilotApi: CopilotAPI,
    allFilesPath: string[],
  ) {
    console.info(`getFilesForChannelFromAssembly. Channel ID: ${channelId}`)
    const files = await copilotApi.listFiles(channelId, undefined, 1500)
    const paths = files.data.map((file) => `/${file.path}+${channelId}`)
    allFilesPath.push(...paths)
    return allFilesPath
  }

  async initiateFileMove() {
    if (!portalId) {
      console.error('Portal id is not set')
      return NextResponse.json({ error: 'Portal id is not set' }, { status: 400 })
    }

    const portalInfo = await this.getPortalInfo(portalId)
    const token = generateToken(env.COPILOT_API_KEY, {
      workspaceId: portalId,
      internalUserId: portalInfo.initiatedBy,
    })

    if (!token) throw new APIError('Failed to generate token', httpStatus.INTERNAL_SERVER_ERROR)
    const copilotApi = new CopilotAPI(token)

    const processedChannels = await db.query.incorrectPathFiles.findMany({
      where: (incorrectPathFiles, { eq, and }) =>
        and(eq(incorrectPathFiles.portalId, portalId), eq(incorrectPathFiles.isMoveComplete, true)),
    })
    const mappedProcessedhannels = processedChannels.map((channel) => channel.channelId)

    const channelsToProcess = await db.query.channelSync.findMany({
      where: (channelSync, { eq, and, notInArray }) =>
        and(
          gte(channelSync.updatedAt, targetDate),
          eq(channelSync.portalId, portalId),
          notInArray(channelSync.assemblyChannelId, mappedProcessedhannels),
          ne(channelSync.id, '4267a14d-b2f1-4ae3-8111-2e634675982e'),
        ),
      orderBy: [asc(channelSync.syncedFilesCount)],
    })

    for (const channel of channelsToProcess) {
      console.info(`\n\n\n ##### New channel ${channel.assemblyChannelId} #####\n`)
      const movedFiles = await this.getOrCreateMoveFilesForPortal(
        portalId,
        channel.assemblyChannelId,
      )
      if (movedFiles.isMoveComplete) continue

      let loop = 5

      console.info({ channelKoRecord: channel })

      const tempidArray = movedFiles.fileIds
      while (loop > 0) {
        const mapFiles = await db.query.fileFolderSync.findMany({
          where: (fileFolderSync, { eq, and, isNull, notInArray }) =>
            and(
              gte(fileFolderSync.updatedAt, targetDate),
              eq(fileFolderSync.channelSyncId, channel.id),
              isNull(fileFolderSync.deletedAt),
              notInArray(fileFolderSync.id, tempidArray),
              eq(fileFolderSync.object, ObjectType.FILE),
            ),
          orderBy: [asc(fileFolderSync.createdAt)],
          limit: 100,
        })

        if (!mapFiles.length) {
          await this.updateIncorrectPathFilesTable(portalId, channel.assemblyChannelId, {
            isMoveComplete: true,
          })
          break
        }

        const mapFileIds = mapFiles.map((file) => file.id).filter((item) => item !== null)

        tempidArray.push(...mapFileIds)

        console.info({ mapFiles, tempidArray })

        // actual sync process
        const allFilesForChannel = await copilotApi.listFiles(
          channel.assemblyChannelId,
          undefined,
          1500, // custom limit
        )

        // trigger function to batch process files
        startFileMoveProcess.trigger({
          channel,
          allFilesForChannel,
          mapFiles,
          token,
          movedFiles,
        })

        loop--
      }
      console.info(`\n\n\n ##### Compelte${channel.assemblyChannelId} #####\n`)

      break
    }

    return NextResponse.json({ success: true })
  }

  async updateIncorrectPathFilesTable(
    portalId: string,
    channelId: string,
    payload: IncorrectPathUpdatePayload,
  ) {
    await db
      .update(incorrectPathFiles)
      .set(payload)
      .where(
        and(eq(incorrectPathFiles.portalId, portalId), eq(incorrectPathFiles.channelId, channelId)),
      )
  }

  async moveFileToCorrectPath({
    pathToUpload,
    existingFile,
    copilotApi,
    fileFolderid,
    movedFiles,
  }: {
    pathToUpload: string
    existingFile: CopilotFileRetrieve
    copilotApi: CopilotAPI
    fileFolderid: string
    movedFiles: IncorrectPathFilesSelectType
  }) {
    if (existingFile.downloadUrl) {
      const existingIds = movedFiles.fileIds
      // create file/folder
      try {
        const fileCreateResponse = await copilotApi.createFile(
          pathToUpload,
          existingFile.channelId,
          ObjectType.FILE,
        )
        if (!fileCreateResponse.uploadUrl) {
          console.error('\nFailed to upload file to Assembly. No upload url\n')
          return
        }

        try {
          existingIds.push(fileFolderid)

          // transfer file
          const success = await this.transferFile(
            existingFile.downloadUrl,
            fileCreateResponse.uploadUrl,
          )
          console.info(
            `\n\n\nmoveFilesService#movefileToCorrectPath. File upload success: ${success}. Uploaded file to path: ${fileCreateResponse.path}. New id: ${fileCreateResponse.id}`,
          )

          console.info(
            `updating file in db with assembly id: ${fileCreateResponse.id}. Map file id: ${fileFolderid}. Older file id: ${existingFile.id}`,
          )
          await db
            .update(fileFolderSync)
            .set({ assemblyFileId: fileCreateResponse.id })
            .where(eq(fileFolderSync.id, fileFolderid))

          await this.updateIncorrectPathFilesTable(movedFiles.portalId, movedFiles.channelId, {
            fileIds: existingIds,
          })

          console.info(
            `moveFilesService#movefileToCorrectPath. Deleting file. File ID: ${existingFile.id}`,
          )
          await copilotApi.deleteFile(existingFile.id)

          console.info(
            `\nmoveFilesService#movefileToCorrectPath. New file Id: ${fileCreateResponse.id}. Type: ${ObjectType.FILE}. File ID: ${fileFolderid} \n\n\n`,
          )
        } catch (error) {
          console.error(error)
          console.error({ err: JSON.stringify(error) })

          // delete new file created if file transfer fails
          await copilotApi.deleteFile(fileCreateResponse.id)
          return
        }
      } catch (error: unknown) {
        if (
          error instanceof ApiError &&
          error.status === 400 &&
          error.body.message === 'Parent folder does not exist'
        ) {
          console.error(
            `\nParent folder does not exist. Skipping file with map id: ${fileFolderid}\n`,
          )
          existingIds.push(fileFolderid)
          await this.updateIncorrectPathFilesTable(movedFiles.portalId, movedFiles.channelId, {
            fileIds: existingIds,
          })
        }
        console.error('Error occured while moving file', error)
        console.error({ err: JSON.stringify(error) })
      }
    }
  }

  private async _transferFile(downloadUrl: string, uploadUrl: string) {
    // Step 1: download
    const downloadRes = await fetch(downloadUrl)

    if (!downloadRes.ok) {
      const body = await downloadRes.text()
      console.error({ error: body })
      throw new Error('Download failed')
    }

    const contentLength = downloadRes.headers.get('content-length')

    if (!contentLength) {
      throw new Error('Missing content-length')
    }

    // Step 2: upload
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT', // presigned upload URLs use PUT
      body: downloadRes.body,
      headers: {
        'Content-Type': downloadRes.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': contentLength,
      },
    })

    if (!uploadRes.ok) {
      const body = await uploadRes.text()
      console.error({ error: body })
      throw new Error('Upload failed')
    }

    return true
  }

  private wrapWithRetry<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
  ): (...args: Args) => Promise<R> {
    return (...args: Args): Promise<R> => withRetry(fn.bind(this), args)
  }

  transferFile = this.wrapWithRetry(this._transferFile)
}
