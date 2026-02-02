import { useCallback, useEffect, useRef, useState } from 'react'
import type { TreeSelectNode } from '@/components/ui/dropbox/tree-select/TreeSelect'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import { useUserChannel } from '@/features/sync/hooks/useUserChannel'
import type { Folder } from '@/features/sync/types'

type UseTreeSelectProps = {
  options: TreeSelectNode[]
  value: string | null
  onChange: (value: string | null) => void
}

const useDebounce = <T>(value: T, delay: number = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

export const useTreeSelect = ({ options, value, onChange }: UseTreeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [displayNodes, setDisplayNodes] = useState<TreeSelectNode[]>(options)
  const [filterValue, setFilterValue] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuthContext()
  const debouncedQuery = useDebounce(filterValue, 1000)
  const [isSearching, setIsSearching] = useState(false)
  const { tempMapList } = useUserChannel()

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setFilterValue(null)
        setDisplayNodes(options)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, options])

  const handleNodeToggle = (path: string) => {
    const newExpandedKeys = new Set(expandedPaths)
    if (newExpandedKeys.has(path)) {
      newExpandedKeys.delete(path)
    } else {
      newExpandedKeys.add(path)
    }
    setExpandedPaths(newExpandedKeys)
  }

  const handleNodeSelect = (node: TreeSelectNode) => {
    onChange(node.path)
    setIsOpen(false)
    setFilterValue(null)
  }

  const disabledSyncedFolders = (folders: Folder[]) => {
    const mappedPaths = tempMapList.map((item) => item.dbxRootPath)
    return folders.map((folder) => {
      if (mappedPaths.includes(folder.path)) {
        return {
          ...folder,
          disabled: true,
        }
      }
      return folder
    })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: aoid disabledSyncedFolders as dependency
  const searchFolderInDropbox = useCallback(async () => {
    if (!debouncedQuery || !filterValue) return

    setIsSearching(true)
    const response = await fetch(
      `/api/dropbox/folder-tree?token=${user.token}&search=${encodeURIComponent(filterValue.trim())}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    const resp = await response.json()
    const folders: Folder[] = resp.folders || []

    // disable the mapped folders
    const updatedFolders = disabledSyncedFolders(folders)
    setDisplayNodes(updatedFolders)
    setIsOpen(true)
    setIsSearching(false)
  }, [filterValue, user.token, debouncedQuery])

  const filterNodes = async () => {
    if (!debouncedQuery || !filterValue) {
      setDisplayNodes(options)
      return
    }

    // only trigger server filtering if there are no results
    await searchFolderInDropbox()
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: avoid filterNodes as dependency as it causes infinite loop
  useEffect(() => {
    // biome-ignore lint/nursery/noFloatingPromises: floating promises are fine here
    filterNodes()
  }, [debouncedQuery])

  return {
    inputRef,
    containerRef,
    isOpen,
    setIsOpen,
    filterValue,
    setFilterValue,
    handleNodeToggle,
    handleNodeSelect,
    displayNodes,
    selectedLabel: value || null,
    expandedPaths,
    isSearching,
  }
}
