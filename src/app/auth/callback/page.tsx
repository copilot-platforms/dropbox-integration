import Script from 'next/script'
import type { PageProps } from '@/app/(home)/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CallbackPage = ({ searchParams }: PageProps) => {
  console.info({ searchParams })

  return (
    <div className="px-2 py-4">
      <div>Connecting Dropbox Integration...</div>
      <Script id="drx-confirmation-close" strategy="afterInteractive">
        {`
          setTimeout(() => {
            window.close();
          }, 1000)
        `}
      </Script>
    </div>
  )
}

export default CallbackPage
