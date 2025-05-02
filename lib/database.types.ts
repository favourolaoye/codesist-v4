export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      challenges: {
        Row: {
          id: string
          title: string
          description: string | null
          language: string
          difficulty: string
          code: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          language: string
          difficulty: string
          code: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          language?: string
          difficulty?: string
          code?: string
          created_at?: string
        }
      }
      challenge_attempts: {
        Row: {
          id: string
          user_id: string
          challenge_id: string
          wpm: number
          accuracy: number
          time_seconds: number
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          challenge_id: string
          wpm: number
          accuracy: number
          time_seconds: number
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          challenge_id?: string
          wpm?: number
          accuracy?: number
          time_seconds?: number
          completed?: boolean
          created_at?: string
        }
      }
    }
  }
}
