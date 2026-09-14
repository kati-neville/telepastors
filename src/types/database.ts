export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      telepastors: {
        Row: {
          id: string;
          auth_user_id: string | null;
          name: string;
          phone: string;
          phone_normalized: string | null;
          address: string | null;
          profile_picture_url: string | null;
          date_of_birth: string | null;
          occupation: string | null;
          role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
          is_active: boolean;
          must_change_password: boolean;
          leader_id: string | null;
          governor_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          name: string;
          phone: string;
          phone_normalized: string | null;
          address?: string | null;
          profile_picture_url?: string | null;
          date_of_birth?: string | null;
          occupation?: string | null;
          role?: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
          is_active?: boolean;
          must_change_password?: boolean;
          leader_id?: string | null;
          governor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          name?: string;
          phone?: string;
          phone_normalized?: string | null;
          address?: string | null;
          profile_picture_url?: string | null;
          date_of_birth?: string | null;
          occupation?: string | null;
          role?: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
          is_active?: boolean;
          must_change_password?: boolean;
          leader_id?: string | null;
          governor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telepastors_auth_user_id_fkey";
            columns: ["auth_user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "telepastors_governor_id_fkey";
            columns: ["governor_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "telepastors_leader_id_fkey";
            columns: ["leader_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          event_date: string | null;
          status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
          call_script: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          event_date?: string | null;
          status?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
          call_script?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          event_date?: string | null;
          status?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
          call_script?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          id: string;
          campaign_id: string;
          name: string;
          phone: string;
          phone_normalized: string;
          import_id: string | null;
          import_row_number: number | null;
          import_metadata: Json | null;
          latest_response:
            | "COMING"
            | "NOT_COMING"
            | "UNREACHABLE"
            | "WRONG_NUMBER"
            | "OTHER"
            | null;
          latest_notes: string | null;
          latest_response_at: string | null;
          latest_recorded_by: string | null;
          held_for_own_calls: boolean;
          assignment_status:
            | "UNASSIGNED"
            | "ASSIGNED"
            | "IN_PROGRESS"
            | "COMPLETED";
          current_assignee_id: string | null;
          current_assignment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          name: string;
          phone: string;
          phone_normalized: string;
          import_id?: string | null;
          import_row_number?: number | null;
          import_metadata?: Json | null;
          latest_response?:
            | "COMING"
            | "NOT_COMING"
            | "UNREACHABLE"
            | "WRONG_NUMBER"
            | "OTHER"
            | null;
          latest_notes?: string | null;
          latest_response_at?: string | null;
          latest_recorded_by?: string | null;
          held_for_own_calls?: boolean;
          assignment_status?:
            | "UNASSIGNED"
            | "ASSIGNED"
            | "IN_PROGRESS"
            | "COMPLETED";
          current_assignee_id?: string | null;
          current_assignment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          name?: string;
          phone?: string;
          phone_normalized?: string;
          import_id?: string | null;
          import_row_number?: number | null;
          import_metadata?: Json | null;
          latest_response?:
            | "COMING"
            | "NOT_COMING"
            | "UNREACHABLE"
            | "WRONG_NUMBER"
            | "OTHER"
            | null;
          latest_notes?: string | null;
          latest_response_at?: string | null;
          latest_recorded_by?: string | null;
          held_for_own_calls?: boolean;
          assignment_status?:
            | "UNASSIGNED"
            | "ASSIGNED"
            | "IN_PROGRESS"
            | "COMPLETED";
          current_assignee_id?: string | null;
          current_assignment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_current_assignee_id_fkey";
            columns: ["current_assignee_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_current_assignment_id_fkey";
            columns: ["current_assignment_id"];
            isOneToOne: false;
            referencedRelation: "contact_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "contact_imports";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_assignments: {
        Row: {
          id: string;
          contact_id: string;
          campaign_id: string;
          assignee_id: string;
          assigned_by: string | null;
          assignee_role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
          status: "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
          assigned_at: string;
          ended_at: string | null;
          superseded_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          contact_id: string;
          campaign_id: string;
          assignee_id: string;
          assigned_by?: string | null;
          assignee_role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
          status?: "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
          assigned_at?: string;
          ended_at?: string | null;
          superseded_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          contact_id?: string;
          campaign_id?: string;
          assignee_id?: string;
          assigned_by?: string | null;
          assignee_role?: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
          status?: "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
          assigned_at?: string;
          ended_at?: string | null;
          superseded_by?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_assignments_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_assignments_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_assignments_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_assignments_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "contact_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      distribution_jobs: {
        Row: {
          id: string;
          campaign_id: string;
          actor_id: string;
          status: "pending" | "running" | "completed" | "failed";
          retain_count: number;
          pool_total: number;
          assigned_count: number;
          reassigned_count: number;
          progress_completed: number;
          progress_total: number;
          plan: Json;
          result: Json | null;
          error_message: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          actor_id: string;
          status?: "pending" | "running" | "completed" | "failed";
          retain_count?: number;
          pool_total?: number;
          assigned_count?: number;
          reassigned_count?: number;
          progress_completed?: number;
          progress_total?: number;
          plan?: Json;
          result?: Json | null;
          error_message?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          actor_id?: string;
          status?: "pending" | "running" | "completed" | "failed";
          retain_count?: number;
          pool_total?: number;
          assigned_count?: number;
          reassigned_count?: number;
          progress_completed?: number;
          progress_total?: number;
          plan?: Json;
          result?: Json | null;
          error_message?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "distribution_jobs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "distribution_jobs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      call_attempts: {
        Row: {
          id: string;
          contact_id: string;
          campaign_id: string;
          telepastor_id: string;
          assignment_id: string | null;
          response:
            | "COMING"
            | "NOT_COMING"
            | "UNREACHABLE"
            | "WRONG_NUMBER"
            | "OTHER";
          notes: string | null;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          campaign_id: string;
          telepastor_id: string;
          assignment_id?: string | null;
          response:
            | "COMING"
            | "NOT_COMING"
            | "UNREACHABLE"
            | "WRONG_NUMBER"
            | "OTHER";
          notes?: string | null;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          campaign_id?: string;
          telepastor_id?: string;
          assignment_id?: string | null;
          response?:
            | "COMING"
            | "NOT_COMING"
            | "UNREACHABLE"
            | "WRONG_NUMBER"
            | "OTHER";
          notes?: string | null;
          attempted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_attempts_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "contact_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_attempts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_attempts_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_attempts_telepastor_id_fkey";
            columns: ["telepastor_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_message_templates: {
        Row: {
          id: string;
          name: string;
          slug: string;
          body: string;
          is_default: boolean;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          body: string;
          is_default?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          body?: string;
          is_default?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      sms_broadcasts: {
        Row: {
          id: string;
          message: string;
          campaign_id: string | null;
          recipient_scope:
            | "ALL_CONTACTS"
            | "CAMPAIGN"
            | "SELECTED_CONTACTS"
            | "GOVERNOR_ORG"
            | "LEADER_ORG"
            | "TELEPASTOR_ASSIGNMENTS"
            | "RESPONSE_TYPE";
          scope_config: Json;
          recipient_count: number;
          estimated_sms_units: number | null;
          provider: string | null;
          status: "PENDING" | "SENDING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";
          delivered_count: number;
          failed_count: number;
          pending_count: number;
          created_by: string | null;
          confirmed_at: string | null;
          sent_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message: string;
          campaign_id?: string | null;
          recipient_scope:
            | "ALL_CONTACTS"
            | "CAMPAIGN"
            | "SELECTED_CONTACTS"
            | "GOVERNOR_ORG"
            | "LEADER_ORG"
            | "TELEPASTOR_ASSIGNMENTS"
            | "RESPONSE_TYPE";
          scope_config?: Json;
          recipient_count?: number;
          estimated_sms_units?: number | null;
          provider?: string | null;
          status?: "PENDING" | "SENDING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";
          delivered_count?: number;
          failed_count?: number;
          pending_count?: number;
          created_by?: string | null;
          confirmed_at?: string | null;
          sent_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message?: string;
          campaign_id?: string | null;
          recipient_scope?:
            | "CAMPAIGN"
            | "SELECTED_CONTACTS"
            | "GOVERNOR_ORG"
            | "LEADER_ORG"
            | "TELEPASTOR_ASSIGNMENTS"
            | "RESPONSE_TYPE";
          scope_config?: Json;
          recipient_count?: number;
          estimated_sms_units?: number | null;
          provider?: string | null;
          status?: "PENDING" | "SENDING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";
          delivered_count?: number;
          failed_count?: number;
          pending_count?: number;
          created_by?: string | null;
          confirmed_at?: string | null;
          sent_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_broadcasts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_broadcasts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      sms_broadcast_recipients: {
        Row: {
          id: string;
          broadcast_id: string;
          contact_id: string | null;
          phone_normalized: string;
          contact_name: string | null;
          status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";
          provider_message_id: string | null;
          error_message: string | null;
          sent_at: string | null;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          broadcast_id: string;
          contact_id?: string | null;
          phone_normalized: string;
          contact_name?: string | null;
          status?: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";
          provider_message_id?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          broadcast_id?: string;
          contact_id?: string | null;
          phone_normalized?: string;
          contact_name?: string | null;
          status?: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";
          provider_message_id?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sms_broadcast_recipients_broadcast_id_fkey";
            columns: ["broadcast_id"];
            isOneToOne: false;
            referencedRelation: "sms_broadcasts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_broadcast_recipients_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_imports: {
        Row: {
          id: string;
          campaign_id: string;
          imported_by: string | null;
          file_name: string;
          status: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
          total_rows: number;
          valid_rows: number;
          invalid_rows: number;
          duplicate_rows: number;
          imported_rows: number;
          column_mapping: Json | null;
          preview_data: Json | null;
          error_summary: Json | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          imported_by?: string | null;
          file_name: string;
          status?: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          imported_rows?: number;
          column_mapping?: Json | null;
          preview_data?: Json | null;
          error_summary?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          imported_by?: string | null;
          file_name?: string;
          status?: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          imported_rows?: number;
          column_mapping?: Json | null;
          preview_data?: Json | null;
          error_summary?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_imports_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_imports_imported_by_fkey";
            columns: ["imported_by"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
      telepastor_imports: {
        Row: {
          id: string;
          imported_by: string | null;
          file_name: string;
          status: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
          total_rows: number;
          valid_rows: number;
          invalid_rows: number;
          duplicate_rows: number;
          imported_rows: number;
          column_mapping: Json | null;
          preview_data: Json | null;
          error_summary: Json | null;
          credentials_export: Json | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          imported_by?: string | null;
          file_name: string;
          status?: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          imported_rows?: number;
          column_mapping?: Json | null;
          preview_data?: Json | null;
          error_summary?: Json | null;
          credentials_export?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          imported_by?: string | null;
          file_name?: string;
          status?: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          imported_rows?: number;
          column_mapping?: Json | null;
          preview_data?: Json | null;
          error_summary?: Json | null;
          credentials_export?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "telepastor_imports_imported_by_fkey";
            columns: ["imported_by"];
            isOneToOne: false;
            referencedRelation: "telepastors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_change_role: { Args: Record<string, never>; Returns: boolean };
      can_manage_telepastor: { Args: { target_id: string }; Returns: boolean };
      can_view_telepastor: { Args: { target_id: string }; Returns: boolean };
      current_ministry_role: {
        Args: Record<string, never>;
        Returns: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
      };
      current_telepastor_id: { Args: Record<string, never>; Returns: string };
      get_governor_for_telepastor: {
        Args: { target_id: string };
        Returns: string;
      };
      can_manage_campaigns: { Args: Record<string, never>; Returns: boolean };
      can_import_campaign_contacts: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_import_telepastors: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_view_campaign: { Args: { target_campaign_id: string }; Returns: boolean };
      can_assign_contact_to: {
        Args: { target_assignee_id: string };
        Returns: boolean;
      };
      can_view_contact: { Args: { target_contact_id: string }; Returns: boolean };
      bulk_assign_contacts: {
        Args: {
          p_campaign_id: string;
          p_assignments: Json;
          p_assigned_by: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      can_record_call_attempt: {
        Args: { target_contact_id: string };
        Returns: boolean;
      };
      can_manage_whatsapp_templates: { Args: Record<string, never>; Returns: boolean };
      can_send_sms_broadcasts: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      ministry_role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
      campaign_status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
      contact_import_status: "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
      contact_assignment_status:
        | "UNASSIGNED"
        | "ASSIGNED"
        | "IN_PROGRESS"
        | "COMPLETED";
      call_response:
        | "COMING"
        | "NOT_COMING"
        | "UNREACHABLE"
        | "WRONG_NUMBER"
        | "OTHER";
      sms_broadcast_status:
        | "PENDING"
        | "SENDING"
        | "COMPLETED"
        | "FAILED"
        | "UNAVAILABLE";
      sms_recipient_status:
        | "PENDING"
        | "SENT"
        | "DELIVERED"
        | "FAILED"
        | "SKIPPED";
      broadcast_recipient_scope:
        | "ALL_CONTACTS"
        | "CAMPAIGN"
        | "SELECTED_CONTACTS"
        | "GOVERNOR_ORG"
        | "LEADER_ORG"
        | "TELEPASTOR_ASSIGNMENTS"
        | "RESPONSE_TYPE";
    };
    CompositeTypes: Record<string, never>;
  };
};
