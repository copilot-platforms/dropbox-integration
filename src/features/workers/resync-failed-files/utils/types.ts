import type { FileSyncSelectType } from '@/db/schema/fileFolderSync.schema'

export type FailedSyncWorkspaceMap = Record<string, FileSyncSelectType[]>
