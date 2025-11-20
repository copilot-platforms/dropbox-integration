'use client'

import { Button } from 'copilot-design-system'
import { useAuthContext } from '@/features/auth/hooks/useAuth'

export const authInitUrl = `/auth/initiate?token=`

export const Callout = () => {
  const { user, connectionStatus } = useAuthContext()

  return (
    <div className="px-10 py-5">
      {!connectionStatus ? (
        <div className="flex justify-center">
          <Button
            label="Initiate Dropbox connection"
            onClick={() => window.open(`${authInitUrl}${user.token}`)}
          />
        </div>
      ) : null}
    </div>
  )
}
