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
      broker_appointments: {
        Row: {
          appointment_date: string
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          broker_id: string
          client_name: string | null
          client_phone: string | null
          completed: boolean
          created_at: string
          end_time: string | null
          id: string
          location: string | null
          notes: string | null
          pipeline_id: string | null
          property_id: string | null
          reminder_minutes: number | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          broker_id: string
          client_name?: string | null
          client_phone?: string | null
          completed?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pipeline_id?: string | null
          property_id?: string | null
          reminder_minutes?: number | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          broker_id?: string
          client_name?: string | null
          client_phone?: string | null
          completed?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pipeline_id?: string | null
          property_id?: string | null
          reminder_minutes?: number | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_appointments_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_partnerships: {
        Row: {
          broker_a_id: string
          broker_b_id: string
          commission_split: number | null
          created_at: string
          group_id: string
          id: string
          status: Database["public"]["Enums"]["partnership_status"]
          terms: string | null
          updated_at: string
        }
        Insert: {
          broker_a_id: string
          broker_b_id: string
          commission_split?: number | null
          created_at?: string
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["partnership_status"]
          terms?: string | null
          updated_at?: string
        }
        Update: {
          broker_a_id?: string
          broker_b_id?: string
          commission_split?: number | null
          created_at?: string
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["partnership_status"]
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_partnerships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_photos: {
        Row: {
          created_at: string
          id: string
          is_banner: boolean | null
          is_cover: boolean | null
          position: number | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_banner?: boolean | null
          is_cover?: boolean | null
          position?: number | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_banner?: boolean | null
          is_cover?: boolean | null
          position?: number | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          property_id: string
          request_type: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          property_id: string
          request_type?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          property_id?: string
          request_type?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          commercial_name: string | null
          created_at: string
          creci: string | null
          email_verified: boolean
          facebook: string | null
          full_name: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          phone: string | null
          suspended_at: string | null
          tiktok: string | null
          updated_at: string
          user_id: string
          username: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          commercial_name?: string | null
          created_at?: string
          creci?: string | null
          email_verified?: boolean
          facebook?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          phone?: string | null
          suspended_at?: string | null
          tiktok?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          commercial_name?: string | null
          created_at?: string
          creci?: string | null
          email_verified?: boolean
          facebook?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          phone?: string | null
          suspended_at?: string | null
          tiktok?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          area: number | null
          bathrooms: number | null
          bedrooms: number | null
          boundary: Json | null
          city: string
          condo_fee: number | null
          created_at: string
          description: string | null
          features: string[] | null
          id: string
          iptu: number | null
          latitude: number | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          longitude: number | null
          neighborhood: string | null
          parking_spots: number | null
          price: number
          property_type: Database["public"]["Enums"]["property_type"]
          sold_by_other_price: number | null
          sold_commission: number | null
          sold_price: number | null
          state: string
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          view_count: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          boundary?: Json | null
          city: string
          condo_fee?: number | null
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          iptu?: number | null
          latitude?: number | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          longitude?: number | null
          neighborhood?: string | null
          parking_spots?: number | null
          price: number
          property_type?: Database["public"]["Enums"]["property_type"]
          sold_by_other_price?: number | null
          sold_commission?: number | null
          sold_price?: number | null
          state: string
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          view_count?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          boundary?: Json | null
          city?: string
          condo_fee?: number | null
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          iptu?: number | null
          latitude?: number | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          longitude?: number | null
          neighborhood?: string | null
          parking_spots?: number | null
          price?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          sold_by_other_price?: number | null
          sold_commission?: number | null
          sold_price?: number | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          view_count?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      property_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_url: string
          id: string
          name: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_url: string
          id?: string
          name: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_url?: string
          id?: string
          name?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_group_members: {
        Row: {
          approved_at: string | null
          broker_id: string
          commission_split: number | null
          group_id: string
          id: string
          joined_at: string
          partnership_type:
            | Database["public"]["Enums"]["partnership_kind"]
            | null
          property_id: string
          requested_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          terms: string | null
        }
        Insert: {
          approved_at?: string | null
          broker_id: string
          commission_split?: number | null
          group_id: string
          id?: string
          joined_at?: string
          partnership_type?:
            | Database["public"]["Enums"]["partnership_kind"]
            | null
          property_id: string
          requested_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          terms?: string | null
        }
        Update: {
          approved_at?: string | null
          broker_id?: string
          commission_split?: number | null
          group_id?: string
          id?: string
          joined_at?: string
          partnership_type?:
            | Database["public"]["Enums"]["partnership_kind"]
            | null
          property_id?: string
          requested_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_group_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_groups: {
        Row: {
          area_approx: number | null
          canonical_address: string
          city: string
          created_at: string
          exclusive: boolean
          id: string
          is_partnership_only: boolean
          neighborhood: string | null
          primary_broker_id: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          state: string
        }
        Insert: {
          area_approx?: number | null
          canonical_address: string
          city: string
          created_at?: string
          exclusive?: boolean
          id?: string
          is_partnership_only?: boolean
          neighborhood?: string | null
          primary_broker_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          state: string
        }
        Update: {
          area_approx?: number | null
          canonical_address?: string
          city?: string
          created_at?: string
          exclusive?: boolean
          id?: string
          is_partnership_only?: boolean
          neighborhood?: string | null
          primary_broker_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          state?: string
        }
        Relationships: []
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          position: number | null
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number | null
          property_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number | null
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_private_data: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_address: string | null
          owner_cpf: string | null
          owner_name: string | null
          owner_phone: string | null
          owners: Json | null
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_address?: string | null
          owner_cpf?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owners?: Json | null
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_address?: string | null
          owner_cpf?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owners?: Json | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_private_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_charges: {
        Row: {
          admin_fee_amount: number
          boleto_url: string | null
          broker_id: string
          charges_amount: number
          competence: string
          contract_id: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_link: string | null
          payout_amount: number
          pix_payload: string | null
          provider_charge_id: string | null
          rent_amount: number
          status: Database["public"]["Enums"]["rental_charge_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          admin_fee_amount?: number
          boleto_url?: string | null
          broker_id: string
          charges_amount?: number
          competence: string
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_link?: string | null
          payout_amount?: number
          pix_payload?: string | null
          provider_charge_id?: string | null
          rent_amount?: number
          status?: Database["public"]["Enums"]["rental_charge_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          admin_fee_amount?: number
          boleto_url?: string | null
          broker_id?: string
          charges_amount?: number
          competence?: string
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_link?: string | null
          payout_amount?: number
          pix_payload?: string | null
          provider_charge_id?: string | null
          rent_amount?: number
          status?: Database["public"]["Enums"]["rental_charge_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_charges_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_contracts: {
        Row: {
          adjustment_index: Database["public"]["Enums"]["rental_index"]
          admin_fee_percent: number
          broker_id: string
          condo_fee: number
          created_at: string
          due_day: number
          end_date: string
          guarantee_details: string | null
          guarantee_type: Database["public"]["Enums"]["rental_guarantee"]
          id: string
          iptu: number
          next_adjustment_date: string | null
          notes: string | null
          other_charges: number
          owner_name: string | null
          owner_phone: string | null
          property_id: string | null
          property_label: string | null
          rent_amount: number
          start_date: string
          status: Database["public"]["Enums"]["rental_contract_status"]
          tenant_cpf: string | null
          tenant_email: string | null
          tenant_name: string
          tenant_phone: string | null
          updated_at: string
        }
        Insert: {
          adjustment_index?: Database["public"]["Enums"]["rental_index"]
          admin_fee_percent?: number
          broker_id: string
          condo_fee?: number
          created_at?: string
          due_day?: number
          end_date: string
          guarantee_details?: string | null
          guarantee_type?: Database["public"]["Enums"]["rental_guarantee"]
          id?: string
          iptu?: number
          next_adjustment_date?: string | null
          notes?: string | null
          other_charges?: number
          owner_name?: string | null
          owner_phone?: string | null
          property_id?: string | null
          property_label?: string | null
          rent_amount: number
          start_date: string
          status?: Database["public"]["Enums"]["rental_contract_status"]
          tenant_cpf?: string | null
          tenant_email?: string | null
          tenant_name: string
          tenant_phone?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_index?: Database["public"]["Enums"]["rental_index"]
          admin_fee_percent?: number
          broker_id?: string
          condo_fee?: number
          created_at?: string
          due_day?: number
          end_date?: string
          guarantee_details?: string | null
          guarantee_type?: Database["public"]["Enums"]["rental_guarantee"]
          id?: string
          iptu?: number
          next_adjustment_date?: string | null
          notes?: string | null
          other_charges?: number
          owner_name?: string | null
          owner_phone?: string | null
          property_id?: string | null
          property_label?: string | null
          rent_amount?: number
          start_date?: string
          status?: Database["public"]["Enums"]["rental_contract_status"]
          tenant_cpf?: string | null
          tenant_email?: string | null
          tenant_name?: string
          tenant_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_documents: {
        Row: {
          broker_id: string
          contract_id: string
          created_at: string
          document_type: string | null
          file_path: string
          id: string
          name: string
        }
        Insert: {
          broker_id: string
          contract_id: string
          created_at?: string
          document_type?: string | null
          file_path: string
          id?: string
          name: string
        }
        Update: {
          broker_id?: string
          contract_id?: string
          created_at?: string
          document_type?: string | null
          file_path?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_inspections: {
        Row: {
          broker_id: string
          contract_id: string
          created_at: string
          id: string
          inspection_date: string
          inspection_type: Database["public"]["Enums"]["rental_inspection_type"]
          notes: string | null
          photos: Json
          updated_at: string
        }
        Insert: {
          broker_id: string
          contract_id: string
          created_at?: string
          id?: string
          inspection_date?: string
          inspection_type: Database["public"]["Enums"]["rental_inspection_type"]
          notes?: string | null
          photos?: Json
          updated_at?: string
        }
        Update: {
          broker_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          inspection_date?: string
          inspection_type?: Database["public"]["Enums"]["rental_inspection_type"]
          notes?: string | null
          photos?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_payment_settings: {
        Row: {
          api_key: string | null
          auto_charge_enabled: boolean
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          beneficiary_city: string | null
          beneficiary_name: string | null
          broker_id: string
          created_at: string
          environment: string
          id: string
          instructions: string | null
          pix_key: string | null
          pix_key_type: string | null
          provider: string
          provider_account_id: string | null
          provider_connected_at: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          api_key?: string | null
          auto_charge_enabled?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          beneficiary_city?: string | null
          beneficiary_name?: string | null
          broker_id: string
          created_at?: string
          environment?: string
          id?: string
          instructions?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_connected_at?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          api_key?: string | null
          auto_charge_enabled?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          beneficiary_city?: string | null
          beneficiary_name?: string | null
          broker_id?: string
          created_at?: string
          environment?: string
          id?: string
          instructions?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          provider?: string
          provider_account_id?: string | null
          provider_connected_at?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      sale_documents: {
        Row: {
          document_type: string | null
          file_url: string
          id: string
          name: string
          pipeline_id: string
          uploaded_at: string
        }
        Insert: {
          document_type?: string | null
          file_url: string
          id?: string
          name: string
          pipeline_id: string
          uploaded_at?: string
        }
        Update: {
          document_type?: string | null
          file_url?: string
          id?: string
          name?: string
          pipeline_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_documents_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pipeline: {
        Row: {
          actual_close_date: string | null
          broker_id: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          commission_value: number | null
          created_at: string
          expected_close_date: string | null
          id: string
          notes: string | null
          property_id: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          broker_id: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          commission_value?: number | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          broker_id?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          commission_value?: number | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_pipeline_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string | null
          broker_id: string
          created_at: string
          external_id: string
          id: string
          page_id: string | null
          provider: string
          token_expires_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          access_token?: string | null
          broker_id: string
          created_at?: string
          external_id: string
          id?: string
          page_id?: string | null
          provider: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_token?: string | null
          broker_id?: string
          created_at?: string
          external_id?: string
          id?: string
          page_id?: string | null
          provider?: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      social_post_exports: {
        Row: {
          broker_id: string
          caption: string | null
          created_at: string
          format: string
          id: string
          property_id: string
        }
        Insert: {
          broker_id: string
          caption?: string | null
          created_at?: string
          format: string
          id?: string
          property_id: string
        }
        Update: {
          broker_id?: string
          caption?: string | null
          created_at?: string
          format?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_exports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      subscription_overrides: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          plan_slug: string
          source: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_slug: string
          source?: string
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_slug?: string
          source?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          features: Json
          highlighted: boolean
          id: string
          max_properties: number | null
          name: string
          price_cents: number
          slug: string
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          highlighted?: boolean
          id?: string
          max_properties?: number | null
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          highlighted?: boolean
          id?: string
          max_properties?: number | null
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          replied_at: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          replied_at?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          replied_at?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          type: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          type?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      brokers_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          commercial_name: string | null
          created_at: string | null
          creci: string | null
          facebook: string | null
          full_name: string | null
          instagram: string | null
          linkedin: string | null
          tiktok: string | null
          user_id: string | null
          username: string | null
          youtube: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          commercial_name?: string | null
          created_at?: string | null
          creci?: string | null
          facebook?: string | null
          full_name?: string | null
          instagram?: string | null
          linkedin?: string | null
          tiktok?: string | null
          user_id?: string | null
          username?: string | null
          youtube?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          commercial_name?: string | null
          created_at?: string | null
          creci?: string | null
          facebook?: string | null
          full_name?: string | null
          instagram?: string | null
          linkedin?: string | null
          tiktok?: string | null
          user_id?: string | null
          username?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_partnership_group: {
        Args: { _broker_a: string; _broker_b: string }
        Returns: string
      }
      detach_property_group: { Args: { _property_id: string }; Returns: string }
      find_property_group: {
        Args: {
          _address: string
          _area?: number
          _city: string
          _property_type: Database["public"]["Enums"]["property_type"]
          _state: string
        }
        Returns: {
          exclusive: boolean
          group_id: string
          member_count: number
          primary_broker_id: string
          primary_broker_name: string
          sample_property_id: string
          sample_title: string
        }[]
      }
      generate_rental_charges: {
        Args: { _contract_id: string; _from?: string }
        Returns: number
      }
      get_broker_contact: {
        Args: { _user_id: string }
        Returns: {
          phone: string
          user_id: string
          whatsapp: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_view_count: {
        Args: { _property_id: string }
        Returns: undefined
      }
      rental_daily_maintenance: { Args: never; Returns: number }
      request_group_membership: {
        Args: {
          _commission_split?: number
          _group_id: string
          _partnership_type: Database["public"]["Enums"]["partnership_kind"]
          _property_id: string
          _terms?: string
        }
        Returns: string
      }
      respond_group_membership: {
        Args: {
          _approve: boolean
          _commission_split?: number
          _member_id: string
          _partnership_type?: Database["public"]["Enums"]["partnership_kind"]
          _terms?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "broker" | "user"
      appointment_type:
        | "visit"
        | "meeting"
        | "signing"
        | "inspection"
        | "follow_up"
        | "other"
      listing_type: "sale" | "rent"
      member_role: "captador" | "parceiro"
      member_status: "pending" | "approved" | "declined"
      partnership_kind: "co_listing" | "sale_partnership" | "non_exclusive"
      partnership_status: "pending" | "active" | "declined" | "completed"
      pipeline_stage:
        | "lead"
        | "visit_scheduled"
        | "visited"
        | "proposal"
        | "negotiation"
        | "documentation"
        | "closed_won"
        | "closed_lost"
      property_status: "active" | "inactive" | "sold" | "rented"
      property_type: "apartment" | "house" | "land" | "commercial"
      rental_charge_status: "pending" | "paid" | "overdue" | "cancelled"
      rental_contract_status: "draft" | "active" | "notice" | "ended"
      rental_guarantee:
        | "none"
        | "fiador"
        | "caucao"
        | "seguro_fianca"
        | "titulo_capitalizacao"
      rental_index: "none" | "igpm" | "ipca" | "inpc"
      rental_inspection_type: "entrada" | "saida"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "broker", "user"],
      appointment_type: [
        "visit",
        "meeting",
        "signing",
        "inspection",
        "follow_up",
        "other",
      ],
      listing_type: ["sale", "rent"],
      member_role: ["captador", "parceiro"],
      member_status: ["pending", "approved", "declined"],
      partnership_kind: ["co_listing", "sale_partnership", "non_exclusive"],
      partnership_status: ["pending", "active", "declined", "completed"],
      pipeline_stage: [
        "lead",
        "visit_scheduled",
        "visited",
        "proposal",
        "negotiation",
        "documentation",
        "closed_won",
        "closed_lost",
      ],
      property_status: ["active", "inactive", "sold", "rented"],
      property_type: ["apartment", "house", "land", "commercial"],
      rental_charge_status: ["pending", "paid", "overdue", "cancelled"],
      rental_contract_status: ["draft", "active", "notice", "ended"],
      rental_guarantee: [
        "none",
        "fiador",
        "caucao",
        "seguro_fianca",
        "titulo_capitalizacao",
      ],
      rental_index: ["none", "igpm", "ipca", "inpc"],
      rental_inspection_type: ["entrada", "saida"],
    },
  },
} as const
