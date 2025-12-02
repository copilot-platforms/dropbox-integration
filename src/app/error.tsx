'use client'

import { Button } from 'copilot-design-system'
import { useRouter, useSearchParams } from 'next/navigation'
import Linkify from 'react-linkify'
import { authInitUrl } from '@/features/auth/components/Callout'

export default function ClientErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const isAuthError = searchParams.get('error') === 'access_denied'

  const handleAuthReset = () => {
    const token = searchParams.get('state')
    if (token) {
      router.push(authInitUrl + token) // token is set in state
      return
    }
    console.error('Token is not available')
  }

  return (
    <main>
      <div className="flex flex-col items-center justify-center pt-52 pb-4">
        <p className="mb-2 [&>a:hover]:underline [&>a]:block">
          <Linkify
            componentDecorator={(decoratedHref, decoratedText, key) => (
              <a target="_blank" rel="noopener noreferrer" href={decoratedHref} key={key}>
                {decoratedText}
              </a>
            )}
          >
            {error.message}.
          </Linkify>
        </p>
        <Button label="Try again" onClick={isAuthError ? handleAuthReset : reset} />
      </div>
    </main>
  )
}
