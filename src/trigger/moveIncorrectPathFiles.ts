import { logger, task } from '@trigger.dev/sdk'
import env from '@/config/server.env'
import type { ChannelSyncSelectType } from '@/db/schema/channelSync.schema'
import type { FileSyncSelectType } from '@/db/schema/fileFolderSync.schema'
import type { IncorrectPathFilesSelectType } from '@/db/schema/incorrectPathFiles.schema'
import { MoveFilesService } from '@/features/workers/move-files/lib/moveFiles.service'
import { copilotBottleneck } from '@/lib/copilot/bottleneck'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type { CopilotFileList } from '@/lib/copilot/types'
import { sanitizeFileNameForAssembly } from '@/utils/filePath'

export const startFileMoveProcess = task({
  id: 'incorrect-path-file-move-process',
  machine: env.TRIGGER_MACHINE,
  queue: {
    name: 'incorrect-path-file-move-process',
    concurrencyLimit: 5,
  },
  run: async (payload: {
    channel: ChannelSyncSelectType
    allFilesForChannel: CopilotFileList
    mapFiles: FileSyncSelectType[]
    token: string
    movedFiles: IncorrectPathFilesSelectType
  }) => {
    const { channel, allFilesForChannel, mapFiles, token, movedFiles } = payload
    console.info(
      `moveIncorrectPathFiles#startFileMoveProcess, Process start for channel ID: ${channel.assemblyChannelId}`,
    )

    const filePaths = allFilesForChannel.data.map((file) => `/${file.path}`)
    const filePromises = []
    const copilotApi = new CopilotAPI(token)
    const moveFileService = new MoveFilesService()

    for (const mapFile of mapFiles) {
      if (!mapFile.itemPath || filePaths.includes(sanitizeFileNameForAssembly(mapFile.itemPath))) {
        !mapFile.itemPath
          ? console.info('Skipping file. No path:', mapFile.id, '\n')
          : console.info('Skipping file. Already in correct path:', mapFile.itemPath, '\n')

        const existingIds = movedFiles.fileIds
        existingIds.push(mapFile.id)

        await moveFileService.updateIncorrectPathFilesTable(
          movedFiles.portalId,
          movedFiles.channelId,
          {
            fileIds: existingIds,
          },
        )
        continue
      }

      const fileDetail = allFilesForChannel.data.find((file) => file.id === mapFile.assemblyFileId)

      if (!fileDetail || fileDetail.status === 'pending') {
        console.error('File not found in Copilot. Skipping file:', mapFile.itemPath, '\n')

        // logic to upload in pending status and update file folder sync table

        const existingIds = movedFiles.fileIds
        existingIds.push(mapFile.id)

        await moveFileService.updateIncorrectPathFilesTable(
          movedFiles.portalId,
          movedFiles.channelId,
          {
            fileIds: existingIds,
          },
        )
        continue
      }

      logger.info(
        `file to transfer: id: ${mapFile.id} dbx_id: ${mapFile.dbxFileId} contentHash: ${mapFile.contentHash} assembly id: ${mapFile.assemblyFileId}  \n`,
        mapFile,
      )
      console.info(`file to transfer: ${mapFile.itemPath}\n`)

      const prm = copilotBottleneck.schedule(() => {
        return moveFileService.moveFileToCorrectPath({
          pathToUpload: mapFile.itemPath as string,
          existingFile: fileDetail,
          copilotApi,
          fileFolderid: mapFile.id,
          movedFiles,
        })
      })
      filePromises.push(prm)
    }
    await Promise.all(filePromises)
  },
})
