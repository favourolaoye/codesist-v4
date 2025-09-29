"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/database.types"

// Single instance of the client
let client: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const createClient = () => {
  if (client) return client

  client = createClientComponentClient<Database>() 
  return client
}
