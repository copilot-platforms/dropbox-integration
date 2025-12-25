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
      // Note: if in case the UI responsive issue does not work in the future, need to create a custom react portal and wrap this component with it.
      // Since we are using the same input field given by this selector component for now, need to create a separate input field for this implementation
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
