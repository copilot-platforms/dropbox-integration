import z from 'zod'

export const TriggerMachineSchema = z
  .enum(['micro', 'small-1x', 'small-2x', 'medium-1x', 'medium-2x', 'large-1x', 'large-2x'])
  .optional()

export type TriggerMachine = z.infer<typeof TriggerMachineSchema>
