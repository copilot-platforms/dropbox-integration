import { Callout } from '@/features/auth/components/Callout'
import { AuthContextProvider } from '@/features/auth/context/AuthContext'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import { serializeClientUser } from '@/lib/copilot/models/ClientUser.model'
import User from '@/lib/copilot/models/User.model'
import type { PageProps } from './types'

const Home = async ({ searchParams }: PageProps) => {
  const sp = await searchParams
  const user = await User.authenticate(sp.token)
  const clientUser = serializeClientUser(user)

  const dpxConnectionService = new DropboxConnectionsService(user)
  const connection = await dpxConnectionService.getConnectionForWorkspace()

  return (
    <AuthContextProvider user={clientUser} connectionStatus={connection.status}>
      <Callout />
    </AuthContextProvider>
  )
}

export default Home
