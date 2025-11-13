'use client'

import { Button, Icon } from 'copilot-design-system'
import { Loader } from '@/components/layouts/Loader'
import { CopilotSelector } from '@/components/ui/CopilotSelector'
import TreeSelect from '@/components/ui/dropbox/tree-select/TreeSelect'
import { getCompanySelectorValue } from '@/features/sync/helper/sync.helper'
import { useFolder } from '@/features/sync/hooks/useFolder'
import { useTable } from '@/features/sync/hooks/useTable'
import { useUserChannel } from '@/features/sync/hooks/useUserChannel'
import { cn } from '@/lib/utils'
import { generateRandomString } from '@/utils/random'

const MappingTableRow = () => {
  const {
    handleItemRemove,
    handleSync,
    onUserSelectorValueChange,
    filteredValue,
    onDropboxFolderChange,
  } = useTable()
  const { tempMapList, userChannelList } = useUserChannel()
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
      {tempMapList.map((mapItem, index) => (
        <tr key={`${generateRandomString(8)}-${index}`}>
          <td className="whitespace-nowrap px-6 py-2">
            <CopilotSelector
              name="File channel"
              initialValue={getCompanySelectorValue(userChannelList, mapItem.fileChannelValue[0])}
              onChange={(val) => onUserSelectorValueChange(val, index)}
            />
          </td>
          <td className="whitespace-nowrap px-6 py-2">
            <TreeSelect
              value={filteredValue?.[index] || mapItem.dbxRootPath}
              onChange={(val) => onDropboxFolderChange(val, index)}
              options={folderTree}
              placeholder="Select Dropbox folder"
            />
          </td>
          <td className="whitespace-nowrap px-6 py-2 text-gray-500 text-sm">-</td>
          <td className="whitespace-nowrap px-6 py-2">
            <div className="flex items-center gap-2">
              {mapItem.status ? (
                <span className="text-green-700 text-sm">Active</span>
              ) : (
                <span className="text-gray-500 text-sm">Inactive</span>
              )}
            </div>
          </td>
          <td className="whitespace-nowrap px-6 py-2">
            {mapItem.status ? (
              <span className="cursor-pointer text-red-700" title="Disconnet sync">
                <Icon icon="Disconnect" width={16} height={16} />
              </span>
            ) : !mapItem.dbxRootPath || !mapItem.fileChannelValue.length ? (
              <span className="cursor-pointer text-red-700" title="Remove">
                <Icon icon="Trash" width={16} height={16} onClick={() => handleItemRemove(index)} />
              </span>
            ) : (
              <Button
                label={mapItem.status === null ? 'Syncing ...' : 'Confirm sync'}
                size="sm"
                disabled={mapItem.status === null ? true : mapItem.status}
                onClick={() => handleSync(index)}
                className={`${mapItem.status === null ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              />
            )}
          </td>
        </tr>
      ))}
    </>
  )
}

export const MappingTable = () => {
  const columns = [
    { title: 'File Channel', key: 'fileChannel', className: 'w-72' },
    { title: 'Dropbox Folder', key: 'dropboxFolder', className: 'w-96' },
    { title: 'Last Updated', key: 'lastUpdated', className: 'w-[200px]' },
    { title: 'Status', key: 'status', className: 'w-[125px]' },
    { title: 'Actions', key: 'actions', className: 'w-[150px]' },
  ]

  return (
    <div className="m-10 mt-0 rounded-lg border border-gray-200 bg-white">
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
