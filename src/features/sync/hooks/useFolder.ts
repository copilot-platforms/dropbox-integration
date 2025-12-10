import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import type { Folder } from '@/features/sync/types'

export const useFolder = () => {
  const { user, connectionStatus } = useAuthContext()
  const [folderTree, setFolderTree] = useState<Folder[]>([])
  const [isFolderTreeLoading, setIsFolderTreeLoading] = useState(true)

  const getPathOptions = useCallback(async () => {
    if (!connectionStatus) {
      setIsFolderTreeLoading(false)
      return
    }
    setIsFolderTreeLoading(true)
    // api call to get all the folders
    const response = await fetch(`/api/dropbox/folder-tree?token=${user.token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const resp = await response.json()
    setFolderTree(resp.folders)
    setIsFolderTreeLoading(false)
  }, [user.token, connectionStatus])

  useEffect(() => {
    // biome-ignore lint/nursery/noFloatingPromises: floating promises are fine here
    getPathOptions()
  }, [getPathOptions])

  return { folderTree, isFolderTreeLoading }
}
