import { UserCompanySelector } from 'copilot-design-system'
import type { SelectorClientsCompanies, SelectorValue } from '@/features/sync/types'
import type { UserCompanySelectorInputValue } from '@/lib/copilot/types'

type CopilotSelectorProps = {
  name: string
  initialValue?: SelectorValue[]
  onChange: (val: UserCompanySelectorInputValue[]) => void
  options: SelectorClientsCompanies
  disabled?: boolean
}

export const CopilotSelector = ({
  name,
  initialValue,
  onChange,
  disabled,
  options,
}: CopilotSelectorProps) => {
  if (typeof window !== 'undefined')
    return (
      <div className="w-64">
        <UserCompanySelector
          name={name}
          initialValue={initialValue}
          placeholder="Select File Channel"
          clientUsers={options.clients ?? []}
          companies={options.companies ?? []}
          grouped={true}
          limitSelectedOptions={1}
          onChange={onChange}
          className={`py-0 text-sm ${disabled ? 'opacity-75' : ''}`}
          isDisabled={disabled}
        />
      </div>
    )
}
