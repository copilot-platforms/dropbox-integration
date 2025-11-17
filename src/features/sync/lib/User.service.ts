import { MAX_FETCH_COPILOT_RESOURCES } from '@/constants/limits'

import {
  ClientsResponseSchema,
  CompaniesResponseSchema,
  type SelectorClientsCompanies,
  type UserClientsCompanies,
} from '@/features/sync/types'
import { copilotBottleneck } from '@/lib/copilot/bottleneck'
import BaseService from '@/lib/copilot/services/base.service'
import { type CopilotFileChannelRetrieve, FileChannelMembership } from '@/lib/copilot/types'

export class UserService extends BaseService {
  async getClientsCompanies(limit?: number): Promise<UserClientsCompanies> {
    const [clients, companies] = await Promise.all([
      this.copilot.getClients({ limit }),
      this.copilot.getCompanies({ limit, isPlaceholder: false }),
    ])

    return {
      clients: ClientsResponseSchema.parse(clients.data),
      companies: CompaniesResponseSchema.parse(companies.data),
    }
  }

  async getSelectorClientsCompanies(): Promise<SelectorClientsCompanies> {
    const users = await this.getClientsCompanies(MAX_FETCH_COPILOT_RESOURCES)
    const fileChannels = await this.copilot.listFileChannels()

    return {
      clients: users.clients
        ?.flatMap((client) => {
          if (client.companyIds?.length) {
            return client.companyIds.map((companyId) => ({
              value: client.id,
              label: `${client.givenName} ${client.familyName}`,
              avatarSrc: client.avatarImageUrl,
              avatarFallbackColor: client.fallbackColor,
              companyId,
              type: 'client' as const,
              fileChannelId: fileChannels.find(
                (fileChannel) =>
                  fileChannel.companyId === companyId && fileChannel.clientId === client.id,
              )?.id,
            }))
          }
          return [
            {
              value: client.id,
              label: `${client.givenName} ${client.familyName}`,
              avatarSrc: client.avatarImageUrl,
              avatarFallbackColor: client.fallbackColor,
              companyId: client.companyId,
              type: 'client' as const,
              fileChannelId: fileChannels.find(
                (fileChannel) =>
                  fileChannel.clientId === client.id && fileChannel.companyId === client.companyId,
              )?.id,
            },
          ]
        })
        .filter((client) => !!client.fileChannelId),
      companies: users.companies
        ?.map((company) => ({
          value: company.id,
          label: company.name,
          avatarSrc: company.iconImageUrl,
          avatarFallbackColor: company.fallbackColor,
          companyId: company.id,
          type: 'company' as const,
          fileChannelId: fileChannels.find((fileChannel) => fileChannel.companyId === company.id)
            ?.id,
        }))
        .filter((company) => !!company.fileChannelId),
    }
  }

  async getFileChannelsForDropdown() {
    const fileChannels = await this.copilot.listFileChannels()

    const fileChannelPromises = []
    for (const fileChannel of fileChannels) {
      fileChannelPromises.push(
        copilotBottleneck.schedule(() => {
          return this.formatFileChannels(fileChannel)
        }),
      )
    }

    const formattedFileChannels = await Promise.all(fileChannelPromises)
    return formattedFileChannels.flat().filter((channel) => !!channel)
  }

  private async formatFileChannels(fileChannel: CopilotFileChannelRetrieve) {
    if (fileChannel.membershipType === FileChannelMembership.INDIVIDUAL && fileChannel.clientId) {
      const client = await this.copilot.getClient(fileChannel.clientId)

      if (client.companyIds?.length) {
        return client.companyIds.map((companyId) => {
          return {
            value: companyId,
            label: `${client.givenName} ${client.familyName}`,
            avatarSrc: client.avatarImageUrl,
            fallbackColor: client.fallbackColor,
            companyId,
          }
        })
      }
      return {
        value: fileChannel.id,
        label: `${client.givenName} ${client.familyName}`,
        avatarSrc: client.avatarImageUrl,
        fallbackColor: client.fallbackColor,
        companyId: client.companyId,
      }
    } else if (
      fileChannel.membershipType === FileChannelMembership.COMPANY &&
      fileChannel.companyId
    ) {
      const company = await this.copilot.getCompany(fileChannel.companyId)
      return {
        value: fileChannel.id,
        label: company.name,
        avatarSrc: company.iconImageUrl,
        fallbackColor: company.fallbackColor,
        companyId: company.id,
      }
    }
  }
}
