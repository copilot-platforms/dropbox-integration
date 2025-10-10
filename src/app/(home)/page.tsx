import type { PageProps } from './types'

const Home = ({ searchParams }: PageProps) => {
  console.info({ searchParams })

  return 'Dropbox Integration'
}

export default Home
