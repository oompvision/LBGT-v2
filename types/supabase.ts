export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          strokes_given: number | null
          is_admin: boolean
          created_at: string
          profile_picture_url: string | null
        }
        Insert: {
          id: string
          name: string
          email: string
          strokes_given?: number | null
          is_admin?: boolean
          created_at?: string
          profile_picture_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          strokes_given?: number | null
          is_admin?: boolean
          created_at?: string
          profile_picture_url?: string | null
        }
      }
      tee_times: {
        Row: {
          id: string
          date: string
          time: string
          max_players: number
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          time: string
          max_players?: number
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          time?: string
          max_players?: number
          created_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          user_id: string
          tee_time_id: string
          slots: number
          player_names: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tee_time_id: string
          slots: number
          player_names?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tee_time_id?: string
          slots?: number
          player_names?: string[] | null
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: string
          date: string
          submitted_by: string
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          submitted_by: string
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          submitted_by?: string
          created_at?: string
        }
      }
      scores: {
        Row: {
          id: string
          round_id: string
          user_id: string
          total_score: number
          net_total_score: number | null
          hole_1: number
          hole_2: number
          hole_3: number
          hole_4: number
          hole_5: number
          hole_6: number
          hole_7: number
          hole_8: number
          hole_9: number
          hole_10: number
          hole_11: number
          hole_12: number
          hole_13: number
          hole_14: number
          hole_15: number
          hole_16: number
          hole_17: number
          hole_18: number
          net_hole_1: number | null
          net_hole_2: number | null
          net_hole_3: number | null
          net_hole_4: number | null
          net_hole_5: number | null
          net_hole_6: number | null
          net_hole_7: number | null
          net_hole_8: number | null
          net_hole_9: number | null
          net_hole_10: number | null
          net_hole_11: number | null
          net_hole_12: number | null
          net_hole_13: number | null
          net_hole_14: number | null
          net_hole_15: number | null
          net_hole_16: number | null
          net_hole_17: number | null
          net_hole_18: number | null
          created_at: string
        }
        Insert: {
          id?: string
          round_id: string
          user_id: string
          total_score: number
          net_total_score?: number | null
          hole_1: number
          hole_2: number
          hole_3: number
          hole_4: number
          hole_5: number
          hole_6: number
          hole_7: number
          hole_8: number
          hole_9: number
          hole_10: number
          hole_11: number
          hole_12: number
          hole_13: number
          hole_14: number
          hole_15: number
          hole_16: number
          hole_17: number
          hole_18: number
          net_hole_1?: number | null
          net_hole_2?: number | null
          net_hole_3?: number | null
          net_hole_4?: number | null
          net_hole_5?: number | null
          net_hole_6?: number | null
          net_hole_7?: number | null
          net_hole_8?: number | null
          net_hole_9?: number | null
          net_hole_10?: number | null
          net_hole_11?: number | null
          net_hole_12?: number | null
          net_hole_13?: number | null
          net_hole_14?: number | null
          net_hole_15?: number | null
          net_hole_16?: number | null
          net_hole_17?: number | null
          net_hole_18?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          round_id?: string
          user_id?: string
          total_score?: number
          net_total_score?: number | null
          hole_1?: number
          hole_2?: number
          hole_3?: number
          hole_4?: number
          hole_5?: number
          hole_6?: number
          hole_7?: number
          hole_8?: number
          hole_9?: number
          hole_10?: number
          hole_11?: number
          hole_12?: number
          hole_13?: number
          hole_14?: number
          hole_15?: number
          hole_16?: number
          hole_17?: number
          hole_18?: number
          net_hole_1?: number | null
          net_hole_2?: number | null
          net_hole_3?: number | null
          net_hole_4?: number | null
          net_hole_5?: number | null
          net_hole_6?: number | null
          net_hole_7?: number | null
          net_hole_8?: number | null
          net_hole_9?: number | null
          net_hole_10?: number | null
          net_hole_11?: number | null
          net_hole_12?: number | null
          net_hole_13?: number | null
          net_hole_14?: number | null
          net_hole_15?: number | null
          net_hole_16?: number | null
          net_hole_17?: number | null
          net_hole_18?: number | null
          created_at?: string
        }
      }
    }
  }
}
