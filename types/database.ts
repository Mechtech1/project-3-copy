export interface Database {
  public: {
    Tables: {
      user_vehicles: {
        Row: {
          id: string;
          user_id: string;
          vin: string;
          make: string;
          model: string;
          year: number;
          trim: string | null;
          engine: string | null;
          body_style: string | null;
          drivetrain: string | null;
          market: string | null;
          steering: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vin: string;
          make: string;
          model: string;
          year: number;
          trim?: string | null;
          engine?: string | null;
          body_style?: string | null;
          drivetrain?: string | null;
          market?: string | null;
          steering?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vin?: string;
          make?: string;
          model?: string;
          year?: number;
          trim?: string | null;
          engine?: string | null;
          body_style?: string | null;
          drivetrain?: string | null;
          market?: string | null;
          steering?: string | null;
          created_at?: string;
        };
      };
      repair_tasks: {
        Row: {
          id: string;
          name: string;
          description: string;
          estimated_time: string;
          difficulty: 'Easy' | 'Medium' | 'Hard';
          vehicle_make: string;
          vehicle_model: string | null;
          vehicle_year_min: number | null;
          vehicle_year_max: number | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description: string;
          estimated_time: string;
          difficulty: 'Easy' | 'Medium' | 'Hard';
          vehicle_make: string;
          vehicle_model?: string | null;
          vehicle_year_min?: number | null;
          vehicle_year_max?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          estimated_time?: string;
          difficulty?: 'Easy' | 'Medium' | 'Hard';
          vehicle_make?: string;
          vehicle_model?: string | null;
          vehicle_year_min?: number | null;
          vehicle_year_max?: number | null;
          created_at?: string;
        };
      };
      repair_tools: {
        Row: {
          id: string;
          repair_task_id: string;
          name: string;
          description: string;
          required: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          repair_task_id: string;
          name: string;
          description: string;
          required?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          repair_task_id?: string;
          name?: string;
          description?: string;
          required?: boolean;
          created_at?: string;
        };
      };
      repair_steps: {
        Row: {
          id: string;
          repair_task_id: string;
          step_number: number;
          instruction: string;
          tool_required: string | null;
          part_name: string;
          overlay_target: string;
          audio_script: string;
          created_at: string;
        };
        Insert: {
          id: string;
          repair_task_id: string;
          step_number: number;
          instruction: string;
          tool_required?: string | null;
          part_name: string;
          overlay_target: string;
          audio_script: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          repair_task_id?: string;
          step_number?: number;
          instruction?: string;
          tool_required?: string | null;
          part_name?: string;
          overlay_target?: string;
          audio_script?: string;
          created_at?: string;
        };
      };
      repair_sessions: {
        Row: {
          id: string;
          vehicle_vin: string;
          task_id: string;
          task_name: string;
          start_time: string;
          end_time: string | null;
          status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
          current_step_index: number;
          steps_completed: number;
          total_steps: number;
          step_log: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          vehicle_vin: string;
          task_id: string;
          task_name: string;
          start_time: string;
          end_time?: string | null;
          status?: 'in_progress' | 'paused' | 'completed' | 'cancelled';
          current_step_index?: number;
          steps_completed?: number;
          total_steps: number;
          step_log?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_vin?: string;
          task_id?: string;
          task_name?: string;
          start_time?: string;
          end_time?: string | null;
          status?: 'in_progress' | 'paused' | 'completed' | 'cancelled';
          current_step_index?: number;
          steps_completed?: number;
          total_steps?: number;
          step_log?: string[];
          created_at?: string;
        };
      };
      voice_logs: {
        Row: {
          id: string;
          session_id: string;
          timestamp: string;
          type: 'user' | 'assistant';
          text: string;
          audio_generated: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          session_id: string;
          timestamp: string;
          type: 'user' | 'assistant';
          text: string;
          audio_generated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          timestamp?: string;
          type?: 'user' | 'assistant';
          text?: string;
          audio_generated?: boolean;
          created_at?: string;
        };
      };
      gpt_repair_cache: {
        Row: {
          id: string;
          vin: string;
          repair_type: string;
          make: string;
          model: string;
          year: string;
          engine_type: string;
          gpt_response: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          vin: string;
          repair_type: string;
          make: string;
          model: string;
          year: string;
          engine_type: string;
          gpt_response: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          vin?: string;
          repair_type?: string;
          make?: string;
          model?: string;
          year?: string;
          engine_type?: string;
          gpt_response?: any;
          created_at?: string;
        };
      };
      overlay_packs: {
        Row: {
          id: string;
          vehicle_family: string;
          workspace_type: string;
          parts: any;
          layers: any;
          access_paths: any;
          baseline_dimensions: any;
          workspace_svg: string | null;
          image_url: string;
          gpt_model: string;
          usage_count: number;
          created_at: string;
          updated_at: string;
          generated_at: string;
        };
        Insert: {
          id: string;
          vehicle_family: string;
          workspace_type: string;
          parts: any;
          layers?: any;
          access_paths?: any;
          baseline_dimensions?: any;
          workspace_svg?: string | null;
          image_url: string;
          gpt_model: string;
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_family?: string;
          workspace_type?: string;
          parts?: any;
          layers?: any;
          access_paths?: any;
          baseline_dimensions?: any;
          workspace_svg?: string;
          image_url?: string;
          gpt_model?: string;
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
          generated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}