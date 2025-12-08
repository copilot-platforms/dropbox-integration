import { useCallback, useEffect, useRef, useState } from 'react'
import type { TreeSelectNode } from '@/components/ui/dropbox/tree-select/TreeSelect'
import { useAuthContext } from '@/features/auth/hooks/useAuth'

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
  const debouncedQuery = useDebounce(filterValue)
  const [isSearching, setIsSearching] = useState(false)

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

  const flattenTree = (nodes: TreeSelectNode[]): TreeSelectNode[] => {
    const flattenedNodes: TreeSelectNode[] = []
    for (const node of nodes) {
      const cloneNode = structuredClone(node)
      delete cloneNode.children
      flattenedNodes.push(cloneNode)
      if (node.children?.length) {
        flattenedNodes.push(...flattenTree(node.children))
      }
    }

    return flattenedNodes
  }

  const searchFolderInDropbox = useCallback(async () => {
    if (!debouncedQuery) return

    setIsSearching(true)
    const response = await fetch(
      `/api/dropbox/folder-tree?token=${user.token}&search=${filterValue}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    const resp = await response.json()
    setDisplayNodes(resp.folders || [])
    setIsOpen(true)
    setIsSearching(false)
  }, [filterValue, user.token, debouncedQuery])

  const filterNodes = async () => {
    if (!debouncedQuery || !filterValue) {
      setDisplayNodes(options)
      return
    }

    const flatTree = flattenTree(options)

    const result = flatTree
      .filter((node) => {
        return node.label.toLowerCase().includes(filterValue.toLowerCase())
      })
      .map((node) => ({
        ...node,
        label: node.path,
      }))
    if (result.length === 0) {
      // only trigger server filtering if there are no results
      await searchFolderInDropbox()
      return
    }
    setDisplayNodes(result)
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
