export enum ObjectType {
  FILE = 'file',
  FOLDER = 'folder',
}
export type ObjectTypeValue = (typeof ObjectType)[keyof typeof ObjectType]
