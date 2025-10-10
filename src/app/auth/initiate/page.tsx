import type { PageProps } from '@/app/(home)/types'
import User from '@/lib/copilot/models/User.model'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AuthInitiatePage = async ({ searchParams }: PageProps) => {
  const sp = await searchParams
  const user = await User.authenticate(sp.token)
  console.info({ user })

  // 1. initiate dropbox instance
  // 2. get consent url
  // 3. redirect to consent url
}

export default AuthInitiatePage
