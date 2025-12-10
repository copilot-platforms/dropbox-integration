'use client'

import { Callout as CalloutComponent } from 'copilot-design-system'
import { useAuthContext } from '@/features/auth/hooks/useAuth'

export const authInitUrl = `/auth/initiate?token=`

export const Callout = () => {
  const { user, connectionStatus } = useAuthContext()

  return (
    <div className="revert-svg px-10 py-5">
      {!connectionStatus ? (
        <CalloutComponent
          title={'Authorize your account'}
          description={'Log into Dropbox to get started.'}
          variant={'info'}
          actionProps={{
            variant: 'primary',
            label: 'Connect to Dropbox',
            prefixIcon: 'Check',
            onClick: (_e: unknown) => {
              window.open(`${authInitUrl}${user.token}`, '_blank', 'noopener,noreferrer')
            },
          }}
        />
      ) : null}
    </div>
  )
}
