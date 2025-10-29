import type { SQL } from 'drizzle-orm'
import z from 'zod'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import type User from '@/lib/copilot/models/User.model'
// import type { SyncService } from './lib/Sync.service'

export type WhereClause = SQL<unknown>

export const DropboxFileListFolderSingleEntrySchema = z.object({
  '.tag': z.string(),
  name: z.string(),
  path_display: z.string(),
  id: z.string(),
  is_downloadable: z.boolean().optional(),
  content_hash: z.string().optional(),
})
export type DropboxFileListFolderSingleEntry = z.infer<
  typeof DropboxFileListFolderSingleEntrySchema
>

export const DropboxFileListFolderResultEntriesSchema = z.array(
  DropboxFileListFolderSingleEntrySchema,
)
export type DropboxFileListFolderResultEntries = z.infer<
  typeof DropboxFileListFolderResultEntriesSchema
>

export type DropboxToAssemblySyncTaskPayload = {
  resultEntries: DropboxFileListFolderResultEntries
  dbxRootPath: string
  assemblyChannelId: string
  channelSyncId: string
  user: User
  connectionToken: DropboxConnectionTokens
}

export type DropboxToAssemblySyncFilesPayload = {
  entry: DropboxFileListFolderSingleEntry
  opts: Omit<DropboxToAssemblySyncTaskPayload, 'resultEntries'>
}
