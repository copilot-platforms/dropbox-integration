import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import type { Folder } from '../types'

export const useFolder = () => {
  const { user } = useAuthContext()
  const [options, setOptions] = useState<Folder[]>([])

  const getPathOptions = useCallback(async () => {
    // api call to get all the folders
    const response = await fetch(`/api/dropbox/folder-tree?token=${user.token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const resp = await response.json()
    setOptions(resp.folders)
  }, [user.token])

  useEffect(() => {
    // biome-ignore lint/nursery/noFloatingPromises: test
    getPathOptions()
  }, [getPathOptions])

  return { options }
}
