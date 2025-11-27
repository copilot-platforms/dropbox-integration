import { logger, task } from '@trigger.dev/sdk/v3'
import { and, eq, isNotNull } from 'drizzle-orm'
import z from 'zod'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import { fileFolderSync } from '@/db/schema/fileFolderSync.schema'
import { MAX_FILES_LIMIT } from '@/features/sync/constant'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import { SyncService } from '@/features/sync/lib/Sync.service'
import {
  type AssemblyToDropboxSyncFilesPayload,
  type DropboxFileListFolderResultEntries,
  DropboxFileListFolderResultEntriesSchema,
  type DropboxToAssemblySyncFilesPayload,
  type WhereClause,
} from '@/features/sync/types'
import { DropboxWebhook } from '@/features/webhook/dropbox/lib/webhook.service'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type User from '@/lib/copilot/models/User.model'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import { withErrorLogging } from '@/utils/withErrorLogger'

type SyncTaskPayload = {
  dbxRootPath: string
  assemblyChannelId: string
  connectionToken: DropboxConnectionTokens
  user: User
}

type HandleChannelFilePayload = {
  files: DropboxFileListFolderResultEntries
  channelSyncId: string
  dbxRootPath: string
  assemblyChannelId: string
  user: User
  connectionToken: DropboxConnectionTokens
}

export const processDropboxChanges = task({
  id: 'process-dropbox-changes',
  queue: {
    name: 'process-dropbox-changes',
    concurrencyLimit: 1,
  },
  run: async (accountId: string) => {
    const dropboxWebhook = new DropboxWebhook()
    console.info(
      `processFileSync#processDropboxChanges, Process start for account ID: ${accountId}`,
    )
    await dropboxWebhook.fetchDropBoxChanges(accountId)
  },
})

export const bidirectionalMasterSync = task({
  id: 'bidirectional-master-sync',
  run: async (payload: SyncTaskPayload) => {
    try {
      await initiateAssemblyToDropboxSync.triggerAndWait(payload)
      logger.info('\n\n Synced Assembly files to Dropbox \n\n')
      await initiateDropboxToAssemblySync.triggerAndWait(payload)
    } catch (error: unknown) {
      logger.error('processFileSync#bidirectionalMasterSync', { error })
    }
  },
})

export const initiateDropboxToAssemblySync = task({
  id: 'initiate-dropbox-to-assembly-sync',
  run: async (payload: SyncTaskPayload) => {
    logger.info(
      'processFileSync#initiateDropboxToAssemblySync. Syncing files from Dropbox to Assembly',
    )
    const { dbxRootPath, assemblyChannelId, connectionToken, user } = payload
    const mapFilesService = new MapFilesService(user, connectionToken)

    // 1. get all the files folder from dropbox
    const dbxApi = new DropboxApi()
    const dbxClient = dbxApi.getDropboxClient(connectionToken.refreshToken)

    let dbxFiles = await dbxClient.filesListFolder({
      path: dbxRootPath,
      recursive: true,
      limit: MAX_FILES_LIMIT,
    })

    // biome-ignore lint/suspicious/noExplicitAny: just for awaiting purpose so its safe to ignore
    const batchPromises: Promise<any>[] = []

    // 2. loop over the dropbox files
    while (dbxFiles.result.entries.length) {
      const parsedDbxFiles = DropboxFileListFolderResultEntriesSchema.safeParse(
        dbxFiles.result.entries,
      )

      if (!parsedDbxFiles.success) {
        logger.error('Error parsing Dropbox files', { error: parsedDbxFiles.error })
        break
      }
      const parsedDbxEntries = parsedDbxFiles.data

      // check and filter out all the mapped files
      const filteredEntries = await mapFilesService.checkAndFilterDbxFiles(
        parsedDbxEntries,
        dbxRootPath,
        assemblyChannelId,
      )

      if (filteredEntries.length) {
        const batchPromise = syncDropboxFileToAssembly.batchTrigger(filteredEntries)
        batchPromises.push(batchPromise)
      }

      if (!dbxFiles.result.has_more) {
        // update channelSync with lastest cursor
        await mapFilesService.updateChannelMap(
          {
            dbxCursor: dbxFiles.result.cursor,
          },
          assemblyChannelId,
          dbxRootPath,
        )
        break
      }

      // continue pagination
      dbxFiles = await dbxClient.filesListFolderContinue({
        cursor: dbxFiles.result.cursor,
      })
    }

    /**
     * 3. await all the batch promises.
     * This is required to ensure that all the files are synced before indicating the sync is complete
     * */
    await Promise.all(batchPromises)
    await mapFilesService.updateChannelMap(
      {
        status: true,
        lastSyncedAt: new Date(),
      },
      assemblyChannelId,
      dbxRootPath,
    )
  },
})

export const syncDropboxFileToAssembly = task({
  id: 'sync-dropbox-file-to-assembly',
  queue: {
    name: 'sync-dropbox-file-to-assembly',
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: (payload: DropboxToAssemblySyncFilesPayload) => {
    logger.info('processFileSync#syncDropboxFileToAssembly')
    return withErrorLogging<DropboxToAssemblySyncFilesPayload>(payload, async () => {
      const { opts, entry } = payload
      const syncService = new SyncService(opts.user, opts.connectionToken)
      await syncService.syncDropboxFilesToAssembly({ entry, opts })
    })
  },
})

export const handleChannelFileChanges = task({
  id: 'handle-channel-file-changes',
  queue: {
    name: 'handle-channel-file-changes',
    concurrencyLimit: 1,
  },
  run: async (payload: HandleChannelFilePayload) => {
    const { files, channelSyncId, dbxRootPath, assemblyChannelId, user, connectionToken } = payload
    const mapFilesService = new MapFilesService(user, connectionToken)
    const mappedFiles = await mapFilesService.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        isNotNull(fileFolderSync.dbxFileId),
      ) as WhereClause,
    )
    const mappedIds = mappedFiles.map((item) => z.string().parse(item.dbxFileId))
    const deletedIds: string[] = []

    // TODO: need to refactor this function

    /**
     * Deleted files are handled in batch, so filtering out deleted files
     */
    const deletedFiles = files
      .map((entry) => {
        if (entry['.tag'] === 'deleted' && mappedIds.includes(entry.id)) {
          deletedIds.push(entry.id)
          return {
            payload: {
              opts: {
                dbxRootPath,
                assemblyChannelId,
                channelSyncId,
                user,
                connectionToken,
              },
              entry,
            },
          }
        }
        return null
      })
      .filter((item) => !!item)

    const remainingIds = mappedIds.filter((id) => !deletedIds.includes(id))
    const newFileIds: string[] = []

    /**
     * Files which are new are also processed in batch, so filtering out new files
     */
    const newFiles = files
      .map((entry) => {
        if (entry['.tag'] !== 'deleted' && !remainingIds.includes(entry.id)) {
          newFileIds.push(entry.id)
          return {
            payload: {
              opts: {
                dbxRootPath,
                assemblyChannelId,
                channelSyncId,
                user,
                connectionToken,
              },
              entry,
            },
          }
        }
        return null
      })
      .filter((item) => !!item)

    /**
     * First create and then delete the files. This ensures the files safety.
     * This section should handle file rename, folder rename cases
     */
    if (newFiles.length) await syncDropboxFileToAssembly.batchTriggerAndWait(newFiles)
    if (deletedFiles.length) await deleteDropboxFileInAssembly.batchTriggerAndWait(deletedFiles)

    // Filtering out remaining files that are not new files and are not deleted. Only content updated files are handled below this.
    const remainingFiles = files.filter(
      (singleFile) => singleFile['.tag'] !== 'deleted' && !newFileIds.includes(singleFile.id),
    )

    if (remainingFiles.length) {
      for (const file of remainingFiles) {
        const existingFile = mappedFiles.find((item) => item.dbxFileId === file.id)

        if (existingFile?.contentHash && existingFile.contentHash !== file.content_hash) {
          await updateDropboxFileInAssembly.trigger({
            opts: {
              dbxRootPath,
              assemblyChannelId,
              channelSyncId,
              user,
              connectionToken,
            },
            entry: file,
          })
        }
      }
    }
  },
})

export const deleteDropboxFileInAssembly = task({
  id: 'delete-dropbox-file-in-assembly',
  queue: {
    name: 'delete-dropbox-file-in-assembly',
    concurrencyLimit: 1,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: DropboxToAssemblySyncFilesPayload) => {
    const { opts, entry } = payload
    const { channelSyncId, user, connectionToken, dbxRootPath } = opts
    const syncService = new SyncService(user, connectionToken)
    await syncService.removeFileFromAssembly(channelSyncId, dbxRootPath, entry)
  },
})

export const updateDropboxFileInAssembly = task({
  id: 'update-dropbox-file-in-assembly',
  queue: {
    name: 'update-dropbox-file-in-assembly',
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: DropboxToAssemblySyncFilesPayload) => {
    await deleteDropboxFileInAssembly.triggerAndWait(payload)
    await syncDropboxFileToAssembly.trigger(payload)
  },
})

export const initiateAssemblyToDropboxSync = task({
  id: 'initiate-assembly-to-dropbox-sync',
  run: async (payload: SyncTaskPayload) => {
    logger.info(
      'processFileSync#initiateAssemblyToDropboxSync. Syncing files from Assembly to Dropbox',
    )

    const { user, connectionToken, dbxRootPath, assemblyChannelId } = payload
    const mapFilesService = new MapFilesService(user, connectionToken)

    // refresh dropbox access token
    const dbxApi = new DropboxApi()
    dbxApi.refreshAccessToken(connectionToken.refreshToken)

    // 1. get al the files from the assembly
    const copilotApi = new CopilotAPI(payload.user.token)
    let files = await copilotApi.listFiles(payload.assemblyChannelId)

    // biome-ignore lint/suspicious/noExplicitAny: just for awaiting purpose so its safe to ignore
    const batchPromises: Promise<any>[] = []

    while (files.data.length) {
      // 2. check and filter out all the mapped files
      const filteredEntries = await mapFilesService.checkAndFilterAssemblyFiles(
        files.data,
        dbxRootPath,
        assemblyChannelId,
      )

      if (filteredEntries.length) {
        const batchPromise = syncAssemblyFileToDropbox.batchTrigger(filteredEntries)
        batchPromises.push(batchPromise)
      }

      if (!files.nextToken) {
        break
      }

      files = await copilotApi.listFiles(payload.assemblyChannelId, files.nextToken)
    }
    /**
     * 3. await all the batch promises.
     * This is required to ensure that all the files are synced to Dropbox first before syncing dropbox to assembly
     * */
    await Promise.all(batchPromises)
  },
})

export const syncAssemblyFileToDropbox = task({
  id: 'sync-assembly-file-to-dropbox',
  queue: {
    name: 'sync-assembly-file-to-dropbox',
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: (payload: AssemblyToDropboxSyncFilesPayload) => {
    logger.info('processFileSync#syncAssemblyFileToDropbox')
    return withErrorLogging<AssemblyToDropboxSyncFilesPayload>(payload, async () => {
      const { opts, file } = payload
      const syncService = new SyncService(opts.user, opts.connectionToken)
      await syncService.syncAssemblyFilesToDropbox({ file, opts })
    })
  },
})

export const deleteAssemblyFileInDropbox = task({
  id: 'delete-assembly-file-in-dropbox',
  queue: {
    name: 'delete-assembly-file-in-dropbox',
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: AssemblyToDropboxSyncFilesPayload) => {
    const { opts } = payload

    const syncService = new SyncService(opts.user, opts.connectionToken)
    await syncService.removeFileFromDropbox(payload)
  },
})

export const updateAssemblyFileInDropbox = task({
  id: 'update-assembly-file-in-dropbox',
  queue: {
    name: 'update-assembly-file-in-dropbox',
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: AssemblyToDropboxSyncFilesPayload) => {
    await deleteAssemblyFileInDropbox.triggerAndWait(payload)
    await syncAssemblyFileToDropbox.trigger(payload)
  },
})
