export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      repair_sessions: {
        Row: {
          created_at: string | null
          current_step_index: number | null
          end_time: string | null
          id: string
          start_time: string
          status: string
          step_log: string[] | null
          steps_completed: number | null
          task_id: string
          task_name: string
          total_steps: number
          vehicle_vin: string
        }
        Insert: {
          created_at?: string | null
          current_step_index?: number | null
          end_time?: string | null
          id: string
          start_time: string
          status?: string
          step_log?: string[] | null
          steps_completed?: number | null
          task_id: string
          task_name: string
          total_steps: number
          vehicle_vin: string
        }
        Update: {
          created_at?: string | null
          current_step_index?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          status?: string
          step_log?: string[] | null
          steps_completed?: number | null
          task_id?: string
          task_name?: string
          total_steps?: number
          vehicle_vin?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "repair_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_sessions_vehicle_vin_fkey"
            columns: ["vehicle_vin"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vin"]
          },
        ]
      }
      repair_steps: {
        Row: {
          audio_script: string
          created_at: string | null
          id: string
          instruction: string
          overlay_target: string
          part_name: string
          repair_task_id: string
          step_number: number
          tool_required: string | null
        }
        Insert: {
          audio_script: string
          created_at?: string | null
          id: string
          instruction: string
          overlay_target: string
          part_name: string
          repair_task_id: string
          step_number: number
          tool_required?: string | null
        }
        Update: {
          audio_script?: string
          created_at?: string | null
          id?: string
          instruction?: string
          overlay_target?: string
          part_name?: string
          repair_task_id?: string
          step_number?: number
          tool_required?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_steps_repair_task_id_fkey"
            columns: ["repair_task_id"]
            isOneToOne: false
            referencedRelation: "repair_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tasks: {
        Row: {
          created_at: string | null
          description: string
          difficulty: string
          estimated_time: string
          id: string
          name: string
          vehicle_make: string
          vehicle_model: string | null
          vehicle_year_max: number | null
          vehicle_year_min: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          difficulty: string
          estimated_time: string
          id: string
          name: string
          vehicle_make: string
          vehicle_model?: string | null
          vehicle_year_max?: number | null
          vehicle_year_min?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          difficulty?: string
          estimated_time?: string
          id?: string
          name?: string
          vehicle_make?: string
          vehicle_model?: string | null
          vehicle_year_max?: number | null
          vehicle_year_min?: number | null
        }
        Relationships: []
      }
      repair_tools: {
        Row: {
          created_at: string | null
          description: string
          id: string
          name: string
          repair_task_id: string
          required: boolean | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id: string
          name: string
          repair_task_id: string
          required?: boolean | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          repair_task_id?: string
          required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_tools_repair_task_id_fkey"
            columns: ["repair_task_id"]
            isOneToOne: false
            referencedRelation: "repair_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string | null
          make: string
          model: string
          trim: string | null
          vin: string
          year: number
        }
        Insert: {
          created_at?: string | null
          make: string
          model: string
          trim?: string | null
          vin: string
          year: number
        }
        Update: {
          created_at?: string | null
          make?: string
          model?: string
          trim?: string | null
          vin?: string
          year?: number
        }
        Relationships: []
      }
      voice_logs: {
        Row: {
          audio_generated: boolean | null
          created_at: string | null
          id: string
          session_id: string
          text: string
          timestamp: string
          type: string
        }
        Insert: {
          audio_generated?: boolean | null
          created_at?: string | null
          id: string
          session_id: string
          text: string
          timestamp: string
          type: string
        }
        Update: {
          audio_generated?: boolean | null
          created_at?: string | null
          id?: string
          session_id?: string
          text?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "repair_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
