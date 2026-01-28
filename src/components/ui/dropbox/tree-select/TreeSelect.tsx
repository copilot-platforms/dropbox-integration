'use client'

import { Icon, Tooltip } from 'copilot-design-system'
import { Loader } from '@/components/layouts/Loader'
import TreeNode from '@/components/ui/dropbox/tree-select/TreeNode'
import { useTreeSelect } from '@/components/ui/dropbox/useDropbox'
import { cn } from '@/components/utils'

// TODO: update css

export interface TreeSelectNode {
  path: string
  label: string
  children?: TreeSelectNode[]
  disabled?: boolean
}

interface TreeSelectProps {
  value: string | null
  onChange: (val: string | null) => void
  options: TreeSelectNode[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

function CloseIconComponent({ onChange }: { onChange: (val: string | null) => void }) {
  return (
    <div className="absolute inset-y-0 right-3 flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onChange(null)
        }}
        className="cursor-pointer"
      >
        <div className="bg-white p-1">
          <Icon
            icon="Close"
            width={16}
            height={16}
            className="transition-opacity hover:opacity-70"
          />
        </div>
      </button>
    </div>
  )
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
    isSearching,
  } = useTreeSelect({ options, value, onChange })

  const searchFilterValue = filterValue === null ? selectedLabel || '' : filterValue

  return (
    <div ref={containerRef} className={cn('relative w-80', className)}>
      {isOpen ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchFilterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className={cn(
              'w-full rounded-sm border px-3 py-2 text-left text-sm',
              'border-input-border transition-colors hover:border-ring',
              'focus:outline-none focus:ring-1 focus:ring-ring',
              'placeholder-text-secondary disabled:opacity-50',
              'border-ring ring-1 ring-ring/50',
            )}
          />
          {searchFilterValue && <CloseIconComponent onChange={onChange} />}
        </div>
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: allow interation for this div
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full rounded-sm border bg-background px-3 py-2 text-left text-sm',
            'border-input border-input-border transition-colors',
            'flex items-center justify-between',
            'relative cursor-pointer placeholder-text-secondary disabled:opacity-50',
            disabled && 'opacity-65',
          )}
        >
          {selectedLabel && <Icon icon="Files" width={16} height={16} className="me-2" />}
          <span
            className={cn(
              'flex-1 truncate',
              !selectedLabel && 'text-[var(--color-text-secondary)]',
            )}
          >
            <Tooltip content={selectedLabel || ''} position="bottom" tooltipClassname="text-xs">
              {selectedLabel || placeholder}
            </Tooltip>
          </span>
          {selectedLabel && !disabled && <CloseIconComponent onChange={onChange} />}
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
            {isSearching ? (
              <div className="flex items-center justify-center">
                <Loader size={5} />
              </div>
            ) : displayNodes.length === 0 ? (
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
