'use client'

import { Button } from 'copilot-design-system'
import { useAuthContext } from '@/features/auth/hooks/useAuth'

export const authInitUrl = `/auth/initiate?token=`

export const Callout = () => {
  const { user, connectionStatus } = useAuthContext()

  return (
    <div className="flex items-center justify-center py-5">
      {!connectionStatus ? (
        <Button
          label="Initiate Dropbox connection"
          onClick={() => window.open(`${authInitUrl}${user.token}`)}
        />
      ) : (
        <div className="font-bold text-xl">Connected to Dropbox</div>
      )}
    </div>
  )
}
