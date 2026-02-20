import { channelSync } from '@/db/schema/channelSync.schema'
import { dropboxConnections } from '@/db/schema/dropboxConnections.schema'
import { fileFolderSync } from '@/db/schema/fileFolderSync.schema'
import { incorrectPathFiles } from '@/db/schema/incorrectPathFiles.schema'
import { relations } from '@/db/schema/relations'

export const schema = {
  dropboxConnections,
  channelSync,
  fileFolderSync,
  incorrectPathFiles,
  ...relations,
}
