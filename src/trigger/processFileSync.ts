import { task } from '@trigger.dev/sdk/v3'
import { ObjectType } from '@/db/constants'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import { SyncService } from '@/features/sync/lib/Sync.service'
import type {
  DropboxToAssemblySyncFilesPayload,
  DropboxToAssemblySyncTaskPayload,
} from '@/features/sync/types'

export const processDropboxSyncToAssemblyTask = task({
  id: 'process-dropbox-sync-to-assembly',
  run: async (payload: DropboxToAssemblySyncTaskPayload) => {
    const { resultEntries, ...restPayload } = payload

    const mapFilesService = new MapFilesService(restPayload.user, restPayload.connectionToken)

    const mappedEntries = await Promise.all(
      resultEntries.map(async (entry) => {
        const fileObjectType = entry['.tag']
        if (
          (fileObjectType === ObjectType.FOLDER &&
            entry.path_display !== restPayload.dbxRootPath) ||
          fileObjectType === ObjectType.FILE
        ) {
          const basePath = entry.path_display.replace(restPayload.dbxRootPath, '') // removes the base folder path
          const isMapped = await mapFilesService.getMappedDbxFile(
            basePath,
            entry.id,
            restPayload.channelSyncId,
          )
          if (!isMapped) return { opts: restPayload, entry }

          return null
        }
      }),
    )
    const filteredEntries = mappedEntries.filter((entry) => !!entry)

    if (!filteredEntries.length) {
      console.info('No new files to sync')
      return
    }

    await syncDropboxFileToAssemblyTask.batchTrigger(
      filteredEntries.map((entry) => ({
        payload: entry,
      })),
    )
  },
})

export const syncDropboxFileToAssemblyTask = task({
  id: 'sync-dropbox-file-to-assembly',
  queue: {
    name: 'sync-dropbox-file-to-assembly',
    concurrencyLimit: 20,
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
