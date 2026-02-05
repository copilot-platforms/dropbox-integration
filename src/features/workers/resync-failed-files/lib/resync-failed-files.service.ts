import { and, isNull } from 'drizzle-orm'
import db from '@/db'
import { ObjectType } from '@/db/constants'
import { resyncFailedFilesInAssembly } from '@/trigger/processFileSync'
import type { FailedSyncWorkspaceMap } from '../utils/types'

export class ResyncService {
  async resyncFailedFiles() {
    const failedSyncs = await db.query.fileFolderSync.findMany({
      where: (fileFolderSync, { eq }) =>
        and(
          isNull(fileFolderSync.contentHash),
          eq(fileFolderSync.object, ObjectType.FILE),
          isNull(fileFolderSync.deletedAt),
        ),
    })

    console.info('Total number of failed syncs: ', failedSyncs.length)
    const failedSyncWorkspaceMap: FailedSyncWorkspaceMap = failedSyncs.reduce(
      (acc: FailedSyncWorkspaceMap, failedSync) => {
        const portalId = failedSync.portalId

        if (!acc[portalId]) {
          acc[portalId] = []
        }

        acc[portalId].push(failedSync)
        return acc
      },
      {},
    )

    for (const portalId in failedSyncWorkspaceMap) {
      const failedSyncsForPortal = failedSyncWorkspaceMap[portalId]
      await resyncFailedFilesInAssembly.trigger({
        portalId,
        failedSyncs: failedSyncsForPortal,
      })
      console.info(
        `Enqueued resync job for portal: ${portalId} with ${failedSyncsForPortal.length} files`,
      )
    }
  }
}
