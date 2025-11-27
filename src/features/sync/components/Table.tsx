'use client'

import { IconButton, Tooltip } from 'copilot-design-system'
import TimeAgo from 'react-timeago'
import { Loader } from '@/components/layouts/Loader'
import { CopilotSelector } from '@/components/ui/CopilotSelector'
import TreeSelect from '@/components/ui/dropbox/tree-select/TreeSelect'
import { cn } from '@/components/utils'
import { getCompanySelectorValue } from '@/features/sync/helper/sync.helper'
import { useFolder } from '@/features/sync/hooks/useFolder'
import { useTable } from '@/features/sync/hooks/useTable'
import { useUserChannel } from '@/features/sync/hooks/useUserChannel'
import { generateRandomString } from '@/utils/random'

const MappingTableStatus = ({
  status,
  percentage,
}: {
  status: boolean | null
  percentage: number
}) => {
  if (status === null) return <span className="text-gray-500 text-sm">{percentage}% completed</span>

  return (
    <>
      {status ? (
        <span className="text-green-700 text-sm">Active</span>
      ) : (
        <span className="text-gray-500 text-sm">Inactive</span>
      )}
    </>
  )
}

const MappingTableRow = () => {
  const {
    handleSyncStatusChange,
    handleItemRemove,
    handleSync,
    onUserSelectorValueChange,
    filteredValue,
    onDropboxFolderChange,
  } = useTable()
  const { tempMapList, userChannelList, syncedPercentage } = useUserChannel()
  const { folderTree, isFolderTreeLoading } = useFolder()

  if (isFolderTreeLoading) {
    return (
      <tr>
        <td colSpan={5} className="py-4">
          <Loader size={5} />
        </td>
      </tr>
    )
  }

  return (
    <>
      {tempMapList.length &&
        tempMapList.map((mapItem, index) => (
          <tr key={`${generateRandomString(8)}-${index}`}>
            <td className="w-80 whitespace-nowrap px-6 py-2">
              <CopilotSelector
                name="File channel"
                initialValue={getCompanySelectorValue(
                  userChannelList,
                  mapItem.fileChannelValue?.[0],
                )}
                onChange={(val) => onUserSelectorValueChange(val, index)}
              />
            </td>
            <td className="w-96 whitespace-nowrap px-6 py-2">
              <TreeSelect
                value={filteredValue?.[index] || mapItem.dbxRootPath}
                onChange={(val) => onDropboxFolderChange(val, index)}
                options={folderTree}
                placeholder="Search Dropbox folder"
              />
            </td>
            <td className="w-[200px] whitespace-nowrap px-6 py-2 text-gray-500 text-sm">
              {mapItem.status && mapItem.lastSyncedAt ? (
                <TimeAgo date={mapItem.lastSyncedAt} />
              ) : (
                '-'
              )}
            </td>
            <td className="w-[160px] whitespace-nowrap px-6 py-2">
              <div className="flex items-center gap-2">
                <MappingTableStatus
                  status={mapItem.status}
                  percentage={syncedPercentage?.[index] || 0}
                />
              </div>
            </td>
            <td className="w-[150px] whitespace-nowrap px-6 py-2">
              {mapItem.id ? (
                <Tooltip
                  content={`${mapItem.status ? 'Disconnect' : 'Enable'} Sync`}
                  position="bottom"
                  tooltipClassname="text-sm"
                >
                  <IconButton
                    icon={`${mapItem.status ? 'Disconnect' : 'Repeat'}`}
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSyncStatusChange(index)}
                    color={`${mapItem.status ? '#b91c1c' : '#15803d'}`}
                    className="cursor-pointer"
                  />
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3">
                  {mapItem.dbxRootPath && mapItem.fileChannelValue.length && (
                    <Tooltip
                      content={mapItem.status === null ? 'Syncing ...' : 'Confirm Sync'}
                      position="bottom"
                      tooltipClassname="text-sm"
                    >
                      <IconButton
                        icon="Check"
                        variant="primary"
                        size="sm"
                        onClick={() => handleSync(index)}
                        disabled={mapItem.status === null ? true : mapItem.status}
                        className={`${mapItem.status === null ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </Tooltip>
                  )}
                  <Tooltip content="Remove" position="bottom" tooltipClassname="text-sm">
                    <IconButton
                      icon="Trash"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleItemRemove(index)}
                    />
                  </Tooltip>
                </div>
              )}
            </td>
          </tr>
        ))}
    </>
  )
}

export const MappingTable = () => {
  const columns = [
    { title: 'File Channel', key: 'fileChannel', className: 'w-80' },
    { title: 'Dropbox Folder', key: 'dropboxFolder', className: 'w-96' },
    { title: 'Last Updated', key: 'lastUpdated', className: 'w-[200px]' },
    { title: 'Status', key: 'status', className: 'w-[160px]' },
    { title: 'Actions', key: 'actions', className: 'w-[150px]' },
  ]

  return (
    <div className="m-10 mt-0 border border-gray-200 bg-white">
      <div className="">
        <table className="w-full">
          <thead className="border-gray-200 border-b bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase',
                    column.className,
                  )}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            <MappingTableRow />
          </tbody>
        </table>
      </div>
    </div>
  )
}
