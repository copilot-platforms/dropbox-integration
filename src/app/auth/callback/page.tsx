import Script from 'next/script'
import type { PageProps } from '@/app/(home)/types'
import AuthService from '@/features/auth/lib/Auth.service'
import User from '@/lib/copilot/models/User.model'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CallbackPage = async ({ searchParams }: PageProps) => {
  const sp = await searchParams
  const user = await User.authenticate(sp.state)
  delete sp.state

  if (sp.error) throw new Error(`${sp.error}: ${sp.error_description}`)

  const authService = new AuthService(user)
  await authService.handleDropboxCallback(sp)

  return (
    <div className="px-2 py-4">
      Connecting Dropbox Integration...
      <Script id="dpx-confirmation-close" strategy="afterInteractive">
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
