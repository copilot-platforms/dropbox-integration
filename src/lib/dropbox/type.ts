import z from 'zod'

export const DropboxAuthResponseSchema = z.object({
  refreshToken: z.string(),
  scope: z.string(),
  accountId: z.string(),
})
export type DropboxAuthResponseType = z.infer<typeof DropboxAuthResponseSchema>
