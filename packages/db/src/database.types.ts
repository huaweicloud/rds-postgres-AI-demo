// Generated from the database with `supabase gen types`; platform-only objects removed.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      agent_tasks: {
        Row: {
          agent: string;
          created_at: string | null;
          current_step: string | null;
          error: string | null;
          finished_at: string | null;
          heartbeat_at: string | null;
          id: string;
          llm_calls: number;
          pages_read: number;
          retries: number;
          run_id: string;
          searches: number;
          started_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          agent: string;
          created_at?: string | null;
          current_step?: string | null;
          error?: string | null;
          finished_at?: string | null;
          heartbeat_at?: string | null;
          id?: string;
          llm_calls?: number;
          pages_read?: number;
          retries?: number;
          run_id: string;
          searches?: number;
          started_at?: string | null;
          status?: string;
        };
        Update: {
          agent?: string;
          created_at?: string | null;
          current_step?: string | null;
          error?: string | null;
          finished_at?: string | null;
          heartbeat_at?: string | null;
          id?: string;
          llm_calls?: number;
          pages_read?: number;
          retries?: number;
          run_id?: string;
          searches?: number;
          started_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_tasks_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          description: string | null;
          domain: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          stack_embedding: string | null;
          summary: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          domain?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          stack_embedding?: string | null;
          summary?: string | null;
          updated_at?: string | null;
        };
        Update: {
          description?: string | null;
          domain?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          stack_embedding?: string | null;
          summary?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      company_stack: {
        Row: {
          agent_count: number;
          company_id: string;
          evidence_count: number;
          run_id: string | null;
          score: number;
          status: string;
          technology_id: number;
        };
        ComputedFields: never;
        Insert: {
          agent_count: number;
          company_id: string;
          evidence_count: number;
          run_id?: string | null;
          score: number;
          status: string;
          technology_id: number;
        };
        Update: {
          agent_count?: number;
          company_id?: string;
          evidence_count?: number;
          run_id?: string | null;
          score?: number;
          status?: string;
          technology_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "company_stack_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_stack_technology_id_fkey";
            columns: ["technology_id"];
            isOneToOne: false;
            referencedRelation: "technologies";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          agent: string;
          category: string | null;
          confidence: number;
          found_at: string | null;
          id: number;
          published_at: string | null;
          raw_name: string;
          run_id: string;
          snippet: string;
          source_title: string | null;
          source_url: string;
          task_id: string | null;
          technology_id: number | null;
          usage: string | null;
        };
        ComputedFields: never;
        Insert: {
          agent: string;
          category?: string | null;
          confidence: number;
          found_at?: string | null;
          id?: number;
          published_at?: string | null;
          raw_name: string;
          run_id: string;
          snippet: string;
          source_title?: string | null;
          source_url: string;
          task_id?: string | null;
          technology_id?: number | null;
          usage?: string | null;
        };
        Update: {
          agent?: string;
          category?: string | null;
          confidence?: number;
          found_at?: string | null;
          id?: number;
          published_at?: string | null;
          raw_name?: string;
          run_id?: string;
          snippet?: string;
          source_title?: string | null;
          source_url?: string;
          task_id?: string | null;
          technology_id?: number | null;
          usage?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "agent_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_technology_id_fkey";
            columns: ["technology_id"];
            isOneToOne: false;
            referencedRelation: "technologies";
            referencedColumns: ["id"];
          },
        ];
      };
      page_cache: {
        Row: {
          content_text: string | null;
          fetched_at: string;
          published_at: string | null;
          status: number;
          title: string | null;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          content_text?: string | null;
          fetched_at?: string;
          published_at?: string | null;
          status: number;
          title?: string | null;
          url: string;
        };
        Update: {
          content_text?: string | null;
          fetched_at?: string;
          published_at?: string | null;
          status?: number;
          title?: string | null;
          url?: string;
        };
        Relationships: [];
      };
      research_runs: {
        Row: {
          company_id: string | null;
          created_at: string | null;
          domain_hint: string | null;
          error: string | null;
          finished_at: string | null;
          id: string;
          merge_started_at: string | null;
          query: string;
          replay_of: string | null;
          requested_by: string | null;
          resolve_started_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          company_id?: string | null;
          created_at?: string | null;
          domain_hint?: string | null;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          merge_started_at?: string | null;
          query: string;
          replay_of?: string | null;
          requested_by?: string | null;
          resolve_started_at?: string | null;
          status?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string | null;
          domain_hint?: string | null;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          merge_started_at?: string | null;
          query?: string;
          replay_of?: string | null;
          requested_by?: string | null;
          resolve_started_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_runs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_runs_replay_of_fkey";
            columns: ["replay_of"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      search_cache: {
        Row: {
          fetched_at: string;
          provider: string;
          query: string;
          results: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          fetched_at?: string;
          provider: string;
          query: string;
          results: NonNullable<Json>;
        };
        Update: {
          fetched_at?: string;
          provider?: string;
          query?: string;
          results?: NonNullable<Json>;
        };
        Relationships: [];
      };
      technologies: {
        Row: {
          aliases: string[];
          category: string;
          id: number;
          name: string;
          name_embedding: string | null;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          category: string;
          id?: number;
          name: string;
          name_embedding?: string | null;
          slug: string;
        };
        Update: {
          aliases?: string[];
          category?: string;
          id?: number;
          name?: string;
          name_embedding?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      watchlist: {
        Row: {
          company_id: string;
          created_at: string | null;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string | null;
          note?: string | null;
          user_id?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string | null;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watchlist_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_merge: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_id: string | null;
          created_at: string | null;
          domain_hint: string | null;
          error: string | null;
          finished_at: string | null;
          id: string;
          merge_started_at: string | null;
          query: string;
          replay_of: string | null;
          requested_by: string | null;
          resolve_started_at: string | null;
          status: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "research_runs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_resolve: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_id: string | null;
          created_at: string | null;
          domain_hint: string | null;
          error: string | null;
          finished_at: string | null;
          id: string;
          merge_started_at: string | null;
          query: string;
          replay_of: string | null;
          requested_by: string | null;
          resolve_started_at: string | null;
          status: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "research_runs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_task: {
        Args: Record<PropertyKey, never>;
        Returns: {
          agent: string;
          created_at: string | null;
          current_step: string | null;
          error: string | null;
          finished_at: string | null;
          heartbeat_at: string | null;
          id: string;
          llm_calls: number;
          pages_read: number;
          retries: number;
          run_id: string;
          searches: number;
          started_at: string | null;
          status: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "agent_tasks";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      finish_task: {
        Args: { p_error?: string; p_status: string; p_task_id: string };
        Returns: boolean;
      };
      match_technology: {
        Args: { min_similarity?: number; query_embedding: string };
        Returns: {
          category: string;
          id: number;
          name: string;
          similarity: number;
          slug: string;
        }[];
      };
      purge_caches: { Args: Record<PropertyKey, never>; Returns: undefined };
      recover_runs: { Args: Record<PropertyKey, never>; Returns: undefined };
      similar_companies: {
        Args: { k?: number; target: string };
        Returns: {
          domain: string;
          id: string;
          name: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
