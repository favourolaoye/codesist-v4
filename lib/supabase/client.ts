"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/database.types"

// Create a single instance of the client to prevent multiple instances
let client: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const createClient = () => {
  if (client) return client

  client = createClientComponentClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  })
  return client
}
