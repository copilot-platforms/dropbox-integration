import { useEffect, useRef, useState } from 'react'
import type { TreeSelectNode } from '@/components/ui/dropbox/tree-select/TreeSelect'

type UseTreeSelectProps = {
  options: TreeSelectNode[]
  value: string | null
  onChange: (value: string | null) => void
}

export const useTreeSelect = ({ options, value, onChange }: UseTreeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filterValue, setFilterValue] = useState('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  const getSelectedLabel = () => {
    if (!value) return null

    const findLabel = (nodes: TreeSelectNode[]): string | null => {
      for (const node of nodes) {
        if (node.path === value) return node.path
        if (node.children) {
          const found = findLabel(node.children)
          if (found) return found
        }
      }
      return null
    }
    return findLabel(options)
  }

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
    setFilterValue('')
  }

  const filterNodes = (nodes: TreeSelectNode[], query: string): TreeSelectNode[] => {
    if (!query) return nodes

    return nodes
      .filter((node) => {
        const matches = node.label.toLowerCase().includes(query.toLowerCase())
        const hasMatchingChildren = node.children && filterNodes(node.children, query).length > 0
        return matches || hasMatchingChildren
      })
      .map((node) => ({
        ...node,
        children: node.children ? filterNodes(node.children, query) : undefined,
      }))
  }

  const displayNodes = filterNodes(options, filterValue)
  const selectedLabel = getSelectedLabel()

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
    selectedLabel,
    expandedPaths,
  }
}
