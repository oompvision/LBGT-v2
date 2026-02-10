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
          max_slots: number
          is_available: boolean
          season: number | null
          booking_opens_at: string | null
          booking_closes_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          time: string
          max_slots?: number
          is_available?: boolean
          season?: number | null
          booking_opens_at?: string | null
          booking_closes_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          time?: string
          max_slots?: number
          is_available?: boolean
          season?: number | null
          booking_opens_at?: string | null
          booking_closes_at?: string | null
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
          play_for_money: boolean[] | null
          season: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tee_time_id: string
          slots: number
          player_names?: string[] | null
          play_for_money?: boolean[] | null
          season?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tee_time_id?: string
          slots?: number
          player_names?: string[] | null
          play_for_money?: boolean[] | null
          season?: number | null
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: string
          date: string
          submitted_by: string
          season: number
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          submitted_by: string
          season: number
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          submitted_by?: string
          season?: number
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
          strokes_given: number
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
          strokes_given?: number
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
          strokes_given?: number
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
      applications: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          hometown: string
          handicap: string
          referral_source: string
          notes: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          hometown: string
          handicap: string
          referral_source: string
          notes?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          hometown?: string
          handicap?: string
          referral_source?: string
          notes?: string | null
          status?: string
          created_at?: string
        }
      }
      tour_comments: {
        Row: {
          id: string
          user_id: string
          comment: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          comment: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          comment?: string
          created_at?: string
        }
      }
      seasons: {
        Row: {
          id: string
          year: number
          name: string
          start_date: string
          end_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          year: number
          name: string
          start_date: string
          end_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          year?: number
          name?: string
          start_date?: string
          end_date?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tee_time_availability: {
        Row: {
          id: string
          tee_time_id: string
          is_available: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          tee_time_id: string
          is_available: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          tee_time_id?: string
          is_available?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
      }
      site_messages: {
        Row: {
          id: string
          title: string | null
          content: string
          type: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title?: string | null
          content: string
          type?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string | null
          content?: string
          type?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      tee_time_templates: {
        Row: {
          id: string
          season_id: string
          day_of_week: number
          time_slots: string[]
          max_slots: number
          booking_opens_days_before: number
          booking_opens_time: string
          booking_closes_days_before: number
          booking_closes_time: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          season_id: string
          day_of_week?: number
          time_slots?: string[]
          max_slots?: number
          booking_opens_days_before?: number
          booking_opens_time?: string
          booking_closes_days_before?: number
          booking_closes_time?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          season_id?: string
          day_of_week?: number
          time_slots?: string[]
          max_slots?: number
          booking_opens_days_before?: number
          booking_opens_time?: string
          booking_closes_days_before?: number
          booking_closes_time?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      tee_time_logs: {
        Row: {
          id: string
          tee_time_id: string
          action: string
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          changed_at: string
        }
        Insert: {
          id?: string
          tee_time_id: string
          action: string
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          changed_at?: string
        }
        Update: {
          id?: string
          tee_time_id?: string
          action?: string
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          changed_at?: string
        }
      }
    }
    Views: {
      available_tee_times: {
        Row: {
          id: string
          date: string
          time: string
          max_slots: number
          is_available: boolean
          season: number | null
          reserved_slots: number
          available_slots: number
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
