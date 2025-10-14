'use client'

import { useRouter } from 'next/navigation'
import { SilentError } from '@/components/layouts/SilentError'
import { authInitUrl } from './Callout'

export const AuthError = ({ error, token }: { error: string; token: string }) => {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center px-2 py-4">
      <SilentError message={error} resetFn={() => router.push(authInitUrl + token)} />
    </div>
  )
}
