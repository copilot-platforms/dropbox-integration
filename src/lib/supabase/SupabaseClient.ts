'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import z from 'zod'

const supabaseUrl = z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL)
const supabaseKey = z.string().min(1).parse(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let client: SupabaseClient | null = null

const getSupabaseClient = () => {
  client ??= createClient(supabaseUrl, supabaseKey)
  return client
}

export default getSupabaseClient
