import type User from '@/lib/copilot/models/User.model'

export type ClientUser = Omit<User, 'copilot'>

export const serializeClientUser = (user: User): ClientUser => ({
  internalUserId: user.internalUserId,
  portalId: user.portalId,
  token: user.token,
})
