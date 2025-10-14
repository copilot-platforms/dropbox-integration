'use client'

import { SilentError } from '@/components/layouts/SilentError'
import { authInitUrl } from './Callout'

export const AuthError = ({ error, token }: { error: string; token: string }) => {
  return (
    <div className="flex items-center justify-center px-2 py-4">
      <SilentError message={error} resetFn={() => window.open(`${authInitUrl}${token}`, '_self')} />
    </div>
  )
}
