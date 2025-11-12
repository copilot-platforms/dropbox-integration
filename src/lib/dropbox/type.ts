import z from 'zod'

export const DropboxAuthResponseSchema = z.object({
  refreshToken: z.string().min(1),
  accountId: z.string().min(1),
})
export type DropboxAuthResponseType = z.infer<typeof DropboxAuthResponseSchema>

export const DropboxFileMetadataSchema = z.object({
  name: z.string(),
  pathDisplay: z.string().min(1),
  id: z.string().min(1),
  size: z.number(),
  contentHash: z.string(),
})
export type DropboxFileMetadata = z.infer<typeof DropboxFileMetadataSchema>
