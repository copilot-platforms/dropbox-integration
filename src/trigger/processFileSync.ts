import { task } from '@trigger.dev/sdk/v3'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import { MAX_FILES_LIMIT } from '@/features/sync/constant'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import { SyncService } from '@/features/sync/lib/Sync.service'
import {
  type AssemblyToDropboxSyncFilesPayload,
  DropboxFileListFolderResultEntriesSchema,
  type DropboxToAssemblySyncFilesPayload,
} from '@/features/sync/types'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type User from '@/lib/copilot/models/User.model'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'

type SyncTaskPayload = {
  dbxRootPath: string
  assemblyChannelId: string
  connectionToken: DropboxConnectionTokens
  user: User
}

export const bidirectionalMasterSync = task({
  id: 'bidirectional-master-sync',
  run: async (payload: SyncTaskPayload) => {
    await initiateAssemblyToDropboxSync.triggerAndWait(payload)
    console.info('\n\n Synced Assembly files to Dropbox \n\n')
    await initiateDropboxToAssemblySync.triggerAndWait(payload)
  },
})

export const initiateDropboxToAssemblySync = task({
  id: 'initiate-dropbox-to-assembly-sync',
  run: async (payload: SyncTaskPayload) => {
    const { dbxRootPath, assemblyChannelId, connectionToken, user } = payload
    const mapFilesService = new MapFilesService(user, connectionToken)

    // 1. get all the files folder from dropbox
    const dbxApi = new DropboxApi()
    dbxApi.refreshAccessToken(connectionToken.refreshToken)
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
        console.error('Error parsing Dropbox files', parsedDbxFiles.error)
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
  run: async (payload: DropboxToAssemblySyncFilesPayload) => {
    const { opts, entry } = payload
    const syncService = new SyncService(opts.user, opts.connectionToken)
    await syncService.syncDropboxFilesToAssembly({ entry, opts })
  },
})

export const deleteDropboxFileInAssembly = task({
  id: 'delete-dropbox-file-in-assembly',
  queue: {
    name: 'delete-dropbox-file-in-assembly',
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: DropboxToAssemblySyncFilesPayload) => {
    const { opts, entry } = payload
    const { channelSyncId, user, connectionToken } = opts
    const syncService = new SyncService(user, connectionToken)
    await syncService.removeFileFromAssembly(channelSyncId, entry)
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

    // TODO: implement bottleneck for copilot sdk
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
  run: async (payload: AssemblyToDropboxSyncFilesPayload) => {
    const { opts, file } = payload
    const syncService = new SyncService(opts.user, opts.connectionToken)
    await syncService.syncAssemblyFilesToDropbox({ file, opts })
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
