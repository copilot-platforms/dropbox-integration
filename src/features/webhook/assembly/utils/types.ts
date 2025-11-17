import z from 'zod'
import { CopilotFileRetrieveSchema } from '@/lib/copilot/types'

export enum DISPATCHABLE_HANDLEABLE_EVENT {
  FileCreated = 'file.created',
  FileUpdated = 'file.updated',
  FileDeleted = 'file.deleted',
}

export const AssemblyWebhookSchema = z.object({
  eventType: z.string(),
  created: z.string().optional(),
  object: z.string().optional(),
  data: CopilotFileRetrieveSchema, //add proper format later
})

export type AssemblyWebhookEvent = z.infer<typeof AssemblyWebhookSchema>
