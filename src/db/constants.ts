export enum ObjectType {
  FILE = 'file',
  FOLDER = 'folder',
}
export type ObjectTypeValue = (typeof ObjectType)[keyof typeof ObjectType]

export enum DropboxClientType {
  ROOT = 'root',
  NAMESPACE_ID = 'namespace_id',
}
export type DropboxClientTypeValue = (typeof DropboxClientType)[keyof typeof DropboxClientType]
