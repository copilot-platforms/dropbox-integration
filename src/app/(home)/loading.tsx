import { Loader } from '@/components/layouts/Loader'

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center space-y-2.5 py-10">
      <Loader />
    </div>
  )
}
