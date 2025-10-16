'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SilentError } from '@/components/layouts/SilentError'
import { authInitUrl } from '@/features/auth/components/Callout'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const isAuthError = searchParams.get('error') === 'access_denied'

  const handleAuthReset = () => {
    router.push(authInitUrl + searchParams.get('state')) // token is set in state
  }

  return (
    <div className="flex items-center justify-center px-2 py-4">
      <SilentError
        message={error.message || 'Something went wrong'}
        resetFn={isAuthError ? handleAuthReset : reset}
      />
    </div>
  )
}
