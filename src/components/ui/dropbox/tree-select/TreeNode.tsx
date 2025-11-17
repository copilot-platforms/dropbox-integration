'use client'

import { Icon } from 'copilot-design-system'
import type { TreeSelectNode } from '@/components/ui/dropbox/tree-select/TreeSelect'
import { cn } from '@/lib/utils'

interface TreeNodeProps {
  node: TreeSelectNode
  expandedPaths: Set<string>
  onToggle: (key: string) => void
  onSelect: (node: TreeSelectNode) => void
  value: string | null
  level: number
}

export default function TreeNode({
  node,
  expandedPaths,
  onToggle,
  onSelect,
  value,
  level,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path)
  const hasChildren = node.children && node.children.length > 0

  let isSelected = false
  isSelected = value === node.path

  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: allow interation for this div */}
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5',
          isSelected && 'bg-accent text-accent-foreground',
          node.disabled && 'cursor-not-allowed opacity-50',
          'hover:bg-gray-50',
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => !node.disabled && onSelect(node)}
        onKeyDown={() => !node.disabled && onSelect(node)}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.path)
            }}
            className="rounded p-0.5 transition-colors hover:bg-accent/30"
          >
            <Icon
              icon="ChevronRight"
              width={12}
              height={12}
              className={cn('transition-transform', isExpanded && 'rotate-90')}
            />
          </button>
        )}

        {!hasChildren && <div className="w-4" />}

        <Icon icon="Files" color="#80A1BA" width={16} height={16} />
        <span className="flex-1 truncate text-sm">{node.label}</span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
              value={value}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
