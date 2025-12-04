'use client'

import { Button } from 'copilot-design-system'
import { useSubHeader } from '@/features/sync/hooks/useSubHeader'

export const SubHeader = () => {
  const { handleAddRule } = useSubHeader()

  return (
    <div className="mx-10 mb-5 flex items-center justify-between">
      <div className="font-bold text-lg">Sync Rules</div>
      <div className="revert-svg">
        <Button label="Add" prefixIcon="Plus" onClick={handleAddRule} />
      </div>
    </div>
  )
}
