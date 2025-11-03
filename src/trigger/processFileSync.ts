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
    await processAssemblyToDropboxSync.triggerAndWait(payload)
    console.info('\n\n Synced Assembly files to Dropbox \n\n')
    await processDropboxToAssemblySync.trigger(payload)
  },
})

export const processDropboxToAssemblySync = task({
  id: 'process-dropbox-sync-to-assembly',
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

      if (filteredEntries.length) await syncDropboxFileToAssembly.batchTrigger(filteredEntries)

      if (!dbxFiles.result.has_more) {
        // update channelSync with lastest cursor
        await mapFilesService.updateChannelMap({
          dbxCursor: dbxFiles.result.cursor,
        })
        break
      }

      // continue pagination
      dbxFiles = await dbxClient.filesListFolderContinue({
        cursor: dbxFiles.result.cursor,
      })
    }
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

export const processAssemblyToDropboxSync = task({
  id: 'process-assembly-sync-to-dropbox',
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
        // TODO: task to sync the files to dropbox
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
     * This is required to ensure that all the files are synced to assembly first before syncing assembly to dropbox
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
