import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
import ReactTimeAgo from 'react-time-ago'

TimeAgo.addLocale(en)

export default function LastSyncAt({ date }: { date: Date | null }) {
  if (!date) return

  return <ReactTimeAgo date={date} locale="en-US" />
}
