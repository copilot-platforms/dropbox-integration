import { redirect } from 'next/navigation'
import type { PageProps } from '@/app/(home)/types'
import User from '@/lib/copilot/models/User.model'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AuthInitiatePage = async ({ searchParams }: PageProps) => {
  const sp = await searchParams
  const user = await User.authenticate(sp.token)
  const dbx = new DropboxApi()
  const authUrl = await dbx.getAuthUrl(user.token)
  redirect(authUrl.toString())
}

export default AuthInitiatePage
