'use client'

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef } from 'react'
import getSupabaseClient from '@/lib/supabase/SupabaseClient'
import { generateRandomString } from '@/utils/random'

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

/**
 * Subscribes to Postgres changes for a single table.
 * Generic over TRow to keep typing reusable across tables.
 */
export const useRealtime = <T extends Record<string, unknown>>(
  portalId: string,
  table: string,
  filter: string,
  event: RealtimeEvent,
  onEvent: (payload: RealtimePostgresChangesPayload<T>) => unknown,
) => {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const latestCallback = useRef<typeof onEvent>(onEvent)
  const channelIdRef = useRef<string>(generateRandomString(16))

  useEffect(() => {
    latestCallback.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!portalId) return

    const channelName = `realtime_${table}_${channelIdRef.current}`

    const channel = supabase
      .channel(channelName)
      .on<T>(
        'postgres_changes',
        {
          // biome-ignore lint/suspicious/noExplicitAny: event is totally safe
          event: event as any,
          schema: 'public',
          table,
          filter,
        },
        latestCallback.current,
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [supabase, portalId, table, event, filter])
}
