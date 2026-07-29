export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_daily: {
        Row: {
          count: number
          created_at: string
          id: string
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_decorations: {
        Row: {
          calendar_id: string
          created_at: string
          height_percent: number
          id: string
          image_url: string
          user_id: string
          width_percent: number
          x_percent: number
          y_percent: number
          z_index: number
        }
        Insert: {
          calendar_id: string
          created_at?: string
          height_percent?: number
          id?: string
          image_url: string
          user_id: string
          width_percent?: number
          x_percent?: number
          y_percent?: number
          z_index?: number
        }
        Update: {
          calendar_id?: string
          created_at?: string
          height_percent?: number
          id?: string
          image_url?: string
          user_id?: string
          width_percent?: number
          x_percent?: number
          y_percent?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_decorations_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          created_at: string
          frozen: boolean
          id: string
          niche: string
          posts: Json
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frozen?: boolean
          id?: string
          niche: string
          posts?: Json
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          frozen?: boolean
          id?: string
          niche?: string
          posts?: Json
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          created_at: string
          filename: string | null
          id: string
          image_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename?: string | null
          id?: string
          image_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string | null
          id?: string
          image_url?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_auto_comments: {
        Row: {
          attach_media: boolean
          comment_count: number
          comment_types: string[]
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attach_media?: boolean
          comment_count?: number
          comment_types?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attach_media?: boolean
          comment_count?: number
          comment_types?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_auto_reposts: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_reposted_at: string | null
          last_reposted_urn: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_reposted_at?: string | null
          last_reposted_urn?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_reposted_at?: string | null
          last_reposted_urn?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          linkedin_name: string | null
          linkedin_sub: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          linkedin_name?: string | null
          linkedin_sub: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          linkedin_name?: string | null
          linkedin_sub?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_post_log: {
        Row: {
          calendar_id: string
          error: string | null
          id: string
          linkedin_post_urn: string | null
          post_date: string
          post_index: number
          posted_at: string
          status: string
          user_id: string
        }
        Insert: {
          calendar_id: string
          error?: string | null
          id?: string
          linkedin_post_urn?: string | null
          post_date: string
          post_index?: number
          posted_at?: string
          status?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          error?: string | null
          id?: string
          linkedin_post_urn?: string | null
          post_date?: string
          post_index?: number
          posted_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      post_schedules: {
        Row: {
          calendar_id: string | null
          created_at: string
          enabled: boolean
          end_time: string
          id: string
          start_time: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string
          enabled?: boolean
          end_time?: string
          id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          created_at?: string
          enabled?: boolean
          end_time?: string
          id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_schedules_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          hashtags_enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hashtags_enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hashtags_enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
