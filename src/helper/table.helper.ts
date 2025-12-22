import type { Folder, MapList } from '@/features/sync/types'

export function getFreshFolders(mapList: MapList[], folders?: Folder[]) {
  if (!folders) return []
  const rootPathList = mapList.map((mapItem) => mapItem.dbxRootPath)
  return folders.filter((folder) => !rootPathList.includes(folder.path))
}
