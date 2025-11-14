import { UserCompanySelector } from 'copilot-design-system'
import { useUserChannel } from '@/features/sync/hooks/useUserChannel'
import type { SelectorValue } from '@/features/sync/types'
import type { UserCompanySelectorInputValue } from '@/lib/copilot/types'

type CopilotSelectorProps = {
  name: string
  initialValue?: SelectorValue[]
  onChange: (val: UserCompanySelectorInputValue[]) => void
}

export const CopilotSelector = ({ name, initialValue, onChange }: CopilotSelectorProps) => {
  const { userChannelList } = useUserChannel()

  if (typeof window !== 'undefined')
    return (
      <div className="w-72">
        <UserCompanySelector
          name={name}
          initialValue={initialValue}
          placeholder="Select File Channel"
          clientUsers={userChannelList.clients ?? []}
          companies={userChannelList.companies ?? []}
          grouped={true}
          limitSelectedOptions={1}
          onChange={onChange}
          className="py-0 text-sm"
        />
      </div>
    )
}
