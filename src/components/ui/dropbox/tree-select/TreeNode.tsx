'use client'

import { Icon, IconButton, Tooltip } from 'copilot-design-system'
import type { TreeSelectNode } from '@/components/ui/dropbox/tree-select/TreeSelect'
import { cn } from '@/components/utils'

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
          node.disabled && 'opacity-50',
          'hover:bg-gray-100',
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => !node.disabled && onSelect(node)}
        onKeyDown={() => !node.disabled && onSelect(node)}
      >
        {hasChildren && (
          <IconButton
            icon="ChevronRight"
            size="sm"
            variant="minimal"
            className={cn('me-1 transition-transform', isExpanded && 'rotate-90')}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.path)
            }}
          />
        )}

        {/* {!hasChildren && <div className="w-8" />} */}

        <Icon icon="Files" color="#80A1BA" width={16} height={16} />
        <span className="flex-1 truncate text-sm">{node.label}</span>
        <Tooltip content={node.label} position="bottom" tooltipClassname="text-xs">
          <Icon icon="Info" width={16} height={16} className="ml-1" />
        </Tooltip>
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
