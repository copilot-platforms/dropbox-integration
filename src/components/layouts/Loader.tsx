'use client'

import { Spinner } from 'copilot-design-system'

export const Loader = ({ size = 10 }: { size?: 5 | 10 }) => {
  return (
    // biome-ignore lint/a11y/useSemanticElements: output tag is not semantic here
    <div role="status" className="flex flex-col items-center justify-center">
      <Spinner size={size} />
    </div>
  )
}
