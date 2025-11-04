import z from 'zod'

export const DropboxAuthResponseSchema = z.object({
  refreshToken: z.string(),
  accountId: z.string(),
})
export type DropboxAuthResponseType = z.infer<typeof DropboxAuthResponseSchema>

export const DropboxFileMetadataSchema = z.object({
  name: z.string(),
  pathDisplay: z.string(),
  id: z.string(),
  size: z.number(),
  contentHash: z.string(),
})
export type DropboxFileMetadata = z.infer<typeof DropboxFileMetadataSchema>
