import { useEffect, useRef, useState } from 'react'
import type { TreeSelectNode } from '@/components/ui/dropbox/tree-select/TreeSelect'

type UseTreeSelectProps = {
  options: TreeSelectNode[]
  value: string | null
  onChange: (value: string | null) => void
}

export const useTreeSelect = ({ options, value, onChange }: UseTreeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filterValue, setFilterValue] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setFilterValue(null)
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

  const filterNodes = (nodes: TreeSelectNode[], query: string | null): TreeSelectNode[] => {
    if (!query) return nodes
    const flatTree = flattenTree(nodes)

    return flatTree
      .filter((node) => {
        return (
          node.label.toLowerCase().includes(query.toLowerCase()) ||
          node.path.toLowerCase().includes(query.toLowerCase())
        )
      })
      .map((node) => ({
        ...node,
        label: node.path,
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
