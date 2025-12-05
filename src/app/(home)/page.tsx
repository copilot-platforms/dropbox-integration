import type { PageProps } from '@/app/(home)/types'
import { CheckConnection } from '@/components/layouts/CheckConnection'
import { Callout } from '@/features/auth/components/Callout'
import { RealtimeDropboxConnections } from '@/features/auth/components/RealtimeDropboxConnections'
import { AuthContextProvider } from '@/features/auth/context/AuthContext'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import { RealtimeSync } from '@/features/sync/components/RealtimeSync'
import { SubHeader } from '@/features/sync/components/SubHeader'
import { MappingTable } from '@/features/sync/components/Table'
import { UserChannelContextProvider } from '@/features/sync/context/UserChannelContext'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import { UserService } from '@/features/sync/lib/User.service'
import type { MapList } from '@/features/sync/types'
import { serializeClientUser } from '@/lib/copilot/models/ClientUser.model'
import User from '@/lib/copilot/models/User.model'

const Home = async ({ searchParams }: PageProps) => {
  const sp = await searchParams
  const user = await User.authenticate(sp.token)
  const clientUser = serializeClientUser(user)

  const dpxConnectionService = new DropboxConnectionsService(user)
  const connection = await dpxConnectionService.getConnectionForWorkspace()

  const userService = new UserService(user)
  const users = await userService.getSelectorClientsCompanies()
  let mapList: MapList[] = [],
    tempMapList: MapList[] = []

  if (connection.refreshToken && connection.accountId) {
    const connectionToken = {
      refreshToken: connection.refreshToken,
      accountId: connection.accountId,
      rootNamespaceId: connection.rootNamespaceId,
    }

    const mapService = new MapFilesService(user, connectionToken)
    mapList = await mapService.listFormattedChannelMap()
    tempMapList = structuredClone(mapList)
  }

  return (
    <AuthContextProvider user={clientUser} connectionStatus={connection.status}>
      <RealtimeDropboxConnections user={clientUser} />
      <Callout />
      <UserChannelContextProvider
        userChannelList={users}
        mapList={mapList}
        tempMapList={tempMapList}
      >
        <RealtimeSync user={clientUser} />
        <CheckConnection>
          <SubHeader />
          <MappingTable />
        </CheckConnection>
      </UserChannelContextProvider>
    </AuthContextProvider>
  )
}

export default Home
