'use client'

import { Icon } from 'copilot-design-system'
import type React from 'react'
import type { Dispatch, SetStateAction } from 'react'
import TreeNode from '@/components/ui/dropbox/tree-select/TreeNode'
import { useTreeSelect } from '@/components/ui/dropbox/useDropbox'
import { cn } from '@/lib/utils'

// TODO: update css

export interface TreeSelectNode {
  path: string
  label: string
  icon?: React.ReactNode
  children?: TreeSelectNode[]
  disabled?: boolean
}

interface TreeSelectProps {
  value: string | null
  onChange: Dispatch<SetStateAction<string | null>>
  options: TreeSelectNode[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function TreeSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an item',
  disabled = false,
  className = '',
}: TreeSelectProps) {
  const {
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
  } = useTreeSelect({ options, value, onChange })

  return (
    <div ref={containerRef} className={cn('relative w-96', className)}>
      {isOpen ? (
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className={cn(
            'w-full rounded-md border px-3 py-2 text-left text-sm',
            'border-input transition-colors hover:border-ring',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'border-gray-300 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: allow interation for this div
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full rounded-md border bg-background px-3 py-2 text-left text-sm',
            'border-input transition-colors hover:border-ring',
            'flex items-center justify-between',
            'cursor-pointer border-gray-300 disabled:cursor-not-allowed disabled:opacity-50',
            isOpen && 'border-ring ring-1 ring-ring/50',
          )}
        >
          {selectedLabel && <Icon icon="Files" width={16} height={16} className="me-2" />}
          <span className={cn('flex-1', !selectedLabel && 'text-gray-500')}>
            {selectedLabel || placeholder}
          </span>
          <div className="flex items-center gap-2">
            {selectedLabel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                className="transition-opacity hover:opacity-70"
              >
                <Icon icon="Close" width={16} height={16} />
              </button>
            )}
            <Icon
              icon="ChevronDown"
              width={16}
              height={16}
              className={cn('transition-transform', isOpen && 'rotate-180')}
            />
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className={cn(
            'absolute top-full right-0 left-0 z-50 mt-1',
            'rounded-sm border border-gray-200 bg-white',
            'max-h-96 overflow-y-auto',
          )}
        >
          <div className="p-2 shadow-lg">
            {displayNodes.length === 0 ? (
              <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                No items found
              </div>
            ) : (
              displayNodes.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  expandedPaths={expandedPaths}
                  onToggle={handleNodeToggle}
                  onSelect={handleNodeSelect}
                  value={value}
                  level={0}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
