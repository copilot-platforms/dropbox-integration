import type { UserCompanySelectorInputValue } from '@/lib/copilot/types'
import type { SelectorClientsCompanies } from '../types'

export const getCompanySelectorValue = (
  userChannelList: SelectorClientsCompanies,
  fileChannelValue: UserCompanySelectorInputValue,
) => {
  if (!fileChannelValue) return []

  if (fileChannelValue.object === 'company') {
    const companyDetail = userChannelList.companies?.find(
      (company) => company.value === fileChannelValue.id,
    )
    return companyDetail ? [companyDetail] : []
  } else {
    const clientDetail = userChannelList.clients?.find(
      (client) =>
        client.value === fileChannelValue.id && client.companyId === fileChannelValue.companyId,
    )
    return clientDetail ? [clientDetail] : []
  }
}
