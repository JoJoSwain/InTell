export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ambience_layer_assets": {
                  Row: {
                    "asset_id": string,"layer_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"layer_id": string,"weight"?: number
                  }
                  Update: {
                    "asset_id"?: string,"layer_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ambience_layer_assets_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ambience_layer_assets_layer_id_fkey"
      columns: ["layer_id"]
isOneToOne: false
      referencedRelation: "ambience_layers"
      referencedColumns: ["id"]
    }
                  ]
                },"ambience_layers": {
                  Row: {
                    "created_at": string,"crossfade_ms": number,"gain_db_max": number,"gain_db_min": number,"id": string,"kind": string,"max_concurrent": number,"mean_interval_s": number | null,"min_interval_s": number | null,"months": (number)[],"name": string,"nesting_mute_months": (number)[],"no_repeat_last": number,"pan_max": number,"pan_min": number,"pitch_cents_max": number,"pitch_cents_min": number,"profile_id": string,"speaker_safe": boolean,"time_windows": (Database["public"]['Enums']["time_window"])[],"updated_at": string,"wildlife_call": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crossfade_ms"?: number,"gain_db_max"?: number,"gain_db_min"?: number,"id"?: string,"kind": string,"max_concurrent"?: number,"mean_interval_s"?: number | null,"min_interval_s"?: number | null,"months"?: (number)[],"name": string,"nesting_mute_months"?: (number)[],"no_repeat_last"?: number,"pan_max"?: number,"pan_min"?: number,"pitch_cents_max"?: number,"pitch_cents_min"?: number,"profile_id": string,"speaker_safe"?: boolean,"time_windows"?: (Database["public"]['Enums']["time_window"])[],"updated_at"?: string,"wildlife_call"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"crossfade_ms"?: number,"gain_db_max"?: number,"gain_db_min"?: number,"id"?: string,"kind"?: string,"max_concurrent"?: number,"mean_interval_s"?: number | null,"min_interval_s"?: number | null,"months"?: (number)[],"name"?: string,"nesting_mute_months"?: (number)[],"no_repeat_last"?: number,"pan_max"?: number,"pan_min"?: number,"pitch_cents_max"?: number,"pitch_cents_min"?: number,"profile_id"?: string,"speaker_safe"?: boolean,"time_windows"?: (Database["public"]['Enums']["time_window"])[],"updated_at"?: string,"wildlife_call"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "ambience_layers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "ambience_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ambience_profiles": {
                  Row: {
                    "created_at": string,"density": number,"description": string | null,"id": string,"name": string,"region_id": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"density"?: number,"description"?: string | null,"id"?: string,"name": string,"region_id"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"density"?: number,"description"?: string | null,"id"?: string,"name"?: string,"region_id"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ambience_profiles_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"ambience_zones": {
                  Row: {
                    "boundary": unknown,"created_at": string,"edge_fade_m": number,"id": string,"name": string,"priority": number,"profile_id": string,"region_id": string,"status": Database["public"]['Enums']["publish_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "boundary": unknown,"created_at"?: string,"edge_fade_m"?: number,"id"?: string,"name": string,"priority"?: number,"profile_id": string,"region_id": string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "boundary"?: unknown,"created_at"?: string,"edge_fade_m"?: number,"id"?: string,"name"?: string,"priority"?: number,"profile_id"?: string,"region_id"?: string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ambience_zones_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "ambience_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ambience_zones_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"asset_rights": {
                  Row: {
                    "asset_id": string,"attribution": string | null,"consent_id": string | null,"contributor_id": string | null,"created_at": string,"expires_on": string | null,"id": string,"license": Database["public"]['Enums']["license_kind"],"license_doc_path": string | null,"seed_id": string | null,"status": Database["public"]['Enums']["rights_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"attribution"?: string | null,"consent_id"?: string | null,"contributor_id"?: string | null,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"license": Database["public"]['Enums']["license_kind"],"license_doc_path"?: string | null,"seed_id"?: string | null,"status"?: Database["public"]['Enums']["rights_status"],"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string,"attribution"?: string | null,"consent_id"?: string | null,"contributor_id"?: string | null,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"license"?: Database["public"]['Enums']["license_kind"],"license_doc_path"?: string | null,"seed_id"?: string | null,"status"?: Database["public"]['Enums']["rights_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "asset_rights_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_rights_consent_id_fkey"
      columns: ["consent_id"]
isOneToOne: false
      referencedRelation: "consents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_rights_consent_id_fkey"
      columns: ["consent_id"]
isOneToOne: false
      referencedRelation: "consents_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_rights_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_rights_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_rights_seed_fk"
      columns: ["seed_id"]
isOneToOne: false
      referencedRelation: "seeds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_rights_seed_fk"
      columns: ["seed_id"]
isOneToOne: false
      referencedRelation: "seeds_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"audio_assets": {
                  Row: {
                    "bytes": number,"channels": number,"created_at": string,"created_by": string | null,"duration_ms": number,"ext": string,"id": string,"is_public": boolean,"kind": Database["public"]['Enums']["asset_kind"],"loop_end_ms": number | null,"loop_start_ms": number | null,"loudness_lufs": number | null,"sample_rate": number,"sha256": string,"source": Database["public"]['Enums']["asset_source"],"staging_path": string,"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"channels": number,"created_at"?: string,"created_by"?: string | null,"duration_ms": number,"ext": string,"id"?: string,"is_public"?: boolean,"kind": Database["public"]['Enums']["asset_kind"],"loop_end_ms"?: number | null,"loop_start_ms"?: number | null,"loudness_lufs"?: number | null,"sample_rate": number,"sha256": string,"source": Database["public"]['Enums']["asset_source"],"staging_path": string,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "bytes"?: number,"channels"?: number,"created_at"?: string,"created_by"?: string | null,"duration_ms"?: number,"ext"?: string,"id"?: string,"is_public"?: boolean,"kind"?: Database["public"]['Enums']["asset_kind"],"loop_end_ms"?: number | null,"loop_start_ms"?: number | null,"loudness_lufs"?: number | null,"sample_rate"?: number,"sha256"?: string,"source"?: Database["public"]['Enums']["asset_source"],"staging_path"?: string,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"detail": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"characters": {
                  Row: {
                    "bible": string | null,"created_at": string,"grove_id": string,"id": string,"name": string,"public_bio": NonNullable<Json>,"public_name": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bible"?: string | null,"created_at"?: string,"grove_id": string,"id"?: string,"name": string,"public_bio"?: NonNullable<Json>,"public_name"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "bible"?: string | null,"created_at"?: string,"grove_id"?: string,"id"?: string,"name"?: string,"public_bio"?: NonNullable<Json>,"public_name"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "characters_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
                  Row: {
                    "client_checkin_id": string,"device_id": string,"first_visit": boolean | null,"grove_id": string,"id": string,"people_before": number | null,"people_now": number | null,"place_before": number | null,"place_now": number | null,"session_id": string,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_checkin_id": string,"device_id": string,"first_visit"?: boolean | null,"grove_id": string,"id"?: string,"people_before"?: number | null,"people_now"?: number | null,"place_before"?: number | null,"place_now"?: number | null,"session_id": string,"submitted_at": string
                  }
                  Update: {
                    "client_checkin_id"?: string,"device_id"?: string,"first_visit"?: boolean | null,"grove_id"?: string,"id"?: string,"people_before"?: number | null,"people_now"?: number | null,"place_before"?: number | null,"place_now"?: number | null,"session_id"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "channels": (string)[],"community_permission_notes": string | null,"contributor_id": string,"created_at": string,"document_path": string | null,"expires_on": string | null,"id": string,"license_line": string | null,"revoked_on": string | null,"revoked_reason": string | null,"signed_on": string,"status": Database["public"]['Enums']["rights_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channels": (string)[],"community_permission_notes"?: string | null,"contributor_id": string,"created_at"?: string,"document_path"?: string | null,"expires_on"?: string | null,"id"?: string,"license_line"?: string | null,"revoked_on"?: string | null,"revoked_reason"?: string | null,"signed_on": string,"status"?: Database["public"]['Enums']["rights_status"],"updated_at"?: string
                  }
                  Update: {
                    "channels"?: (string)[],"community_permission_notes"?: string | null,"contributor_id"?: string,"created_at"?: string,"document_path"?: string | null,"expires_on"?: string | null,"id"?: string,"license_line"?: string | null,"revoked_on"?: string | null,"revoked_reason"?: string | null,"signed_on"?: string,"status"?: Database["public"]['Enums']["rights_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consents_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"contributors": {
                  Row: {
                    "community_affiliation": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"display_credit": string,"id": string,"legal_name": string | null,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "community_affiliation"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"display_credit": string,"id"?: string,"legal_name"?: string | null,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "community_affiliation"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"display_credit"?: string,"id"?: string,"legal_name"?: string | null,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"crossroads": {
                  Row: {
                    "anchor_fragment_id": string,"closes_at": string,"created_at": string,"grove_id": string,"id": string,"opens_at": string,"outcome_note": NonNullable<Json>,"outcome_option_id": string | null,"prompt": NonNullable<Json>,"ring_id": string,"status": Database["public"]['Enums']["crossroads_status"],"teaser_asset_id": string | null,"updated_at": string,"vote_radius_m": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_fragment_id": string,"closes_at": string,"created_at"?: string,"grove_id": string,"id"?: string,"opens_at": string,"outcome_note"?: NonNullable<Json>,"outcome_option_id"?: string | null,"prompt": NonNullable<Json>,"ring_id": string,"status"?: Database["public"]['Enums']["crossroads_status"],"teaser_asset_id"?: string | null,"updated_at"?: string,"vote_radius_m"?: number
                  }
                  Update: {
                    "anchor_fragment_id"?: string,"closes_at"?: string,"created_at"?: string,"grove_id"?: string,"id"?: string,"opens_at"?: string,"outcome_note"?: NonNullable<Json>,"outcome_option_id"?: string | null,"prompt"?: NonNullable<Json>,"ring_id"?: string,"status"?: Database["public"]['Enums']["crossroads_status"],"teaser_asset_id"?: string | null,"updated_at"?: string,"vote_radius_m"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "crossroads_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_outcome_fk"
      columns: ["outcome_option_id"]
isOneToOne: false
      referencedRelation: "crossroads_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_ring_id_fkey"
      columns: ["ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_teaser_asset_id_fkey"
      columns: ["teaser_asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"crossroads_options": {
                  Row: {
                    "created_at": string,"crossroads_id": string,"description": NonNullable<Json>,"id": string,"label": NonNullable<Json>,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crossroads_id": string,"description"?: NonNullable<Json>,"id"?: string,"label": NonNullable<Json>,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"crossroads_id"?: string,"description"?: NonNullable<Json>,"id"?: string,"label"?: NonNullable<Json>,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crossroads_options_crossroads_id_fkey"
      columns: ["crossroads_id"]
isOneToOne: false
      referencedRelation: "crossroads"
      referencedColumns: ["id"]
    }
                  ]
                },"crossroads_votes": {
                  Row: {
                    "crossroads_id": string,"device_id": string,"option_id": string,"voted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "crossroads_id": string,"device_id": string,"option_id": string,"voted_at"?: string
                  }
                  Update: {
                    "crossroads_id"?: string,"device_id"?: string,"option_id"?: string,"voted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crossroads_votes_crossroads_id_fkey"
      columns: ["crossroads_id"]
isOneToOne: false
      referencedRelation: "crossroads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_votes_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crossroads_votes_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "crossroads_options"
      referencedColumns: ["id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "age_gate": string | null,"app_version": string | null,"attestation": string | null,"attested_at": string | null,"first_seen_at": string,"id": string,"platform": string | null,"ui_language": Database["public"]['Enums']["lang"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "age_gate"?: string | null,"app_version"?: string | null,"attestation"?: string | null,"attested_at"?: string | null,"first_seen_at"?: string,"id": string,"platform"?: string | null,"ui_language"?: Database["public"]['Enums']["lang"] | null
                  }
                  Update: {
                    "age_gate"?: string | null,"app_version"?: string | null,"attestation"?: string | null,"attested_at"?: string | null,"first_seen_at"?: string,"id"?: string,"platform"?: string | null,"ui_language"?: Database["public"]['Enums']["lang"] | null
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "client_event_id": string,"device_id": string,"fragment_id": string | null,"grove_id": string | null,"id": number,"name": string,"occurred_at": string,"props": NonNullable<Json>,"received_at": string,"revision_id": string | null,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_event_id": string,"device_id": string,"fragment_id"?: string | null,"grove_id"?: string | null,"id"?: never,"name": string,"occurred_at": string,"props"?: NonNullable<Json>,"received_at"?: string,"revision_id"?: string | null,"session_id"?: string | null
                  }
                  Update: {
                    "client_event_id"?: string,"device_id"?: string,"fragment_id"?: string | null,"grove_id"?: string | null,"id"?: never,"name"?: string,"occurred_at"?: string,"props"?: NonNullable<Json>,"received_at"?: string,"revision_id"?: string | null,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"fragment_characters": {
                  Row: {
                    "character_id": string,"fragment_id": string,"introduces": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "character_id": string,"fragment_id": string,"introduces"?: boolean
                  }
                  Update: {
                    "character_id"?: string,"fragment_id"?: string,"introduces"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragment_characters_character_id_fkey"
      columns: ["character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_characters_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_characters_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"fragment_revisions": {
                  Row: {
                    "change_note": NonNullable<Json>,"content_note": NonNullable<Json>,"created_at": string,"created_by": string | null,"fragment_id": string,"id": string,"publish_at": string | null,"requires_outcome_option_id": string | null,"revision_no": number,"ring_id": string | null,"status": Database["public"]['Enums']["publish_status"],"updated_at": string,"writer_notes": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "change_note"?: NonNullable<Json>,"content_note"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"fragment_id": string,"id"?: string,"publish_at"?: string | null,"requires_outcome_option_id"?: string | null,"revision_no": number,"ring_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string,"writer_notes"?: string | null
                  }
                  Update: {
                    "change_note"?: NonNullable<Json>,"content_note"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"fragment_id"?: string,"id"?: string,"publish_at"?: string | null,"requires_outcome_option_id"?: string | null,"revision_no"?: number,"ring_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string,"writer_notes"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragment_revisions_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_revisions_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_revisions_ring_id_fkey"
      columns: ["ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rev_outcome_fk"
      columns: ["requires_outcome_option_id"]
isOneToOne: false
      referencedRelation: "crossroads_options"
      referencedColumns: ["id"]
    }
                  ]
                },"fragment_threads": {
                  Row: {
                    "fragment_id": string,"thread_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fragment_id": string,"thread_id": string
                  }
                  Update: {
                    "fragment_id"?: string,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragment_threads_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_threads_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_threads_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "threads"
      referencedColumns: ["id"]
    }
                  ]
                },"fragments": {
                  Row: {
                    "created_at": string,"gap_hint": NonNullable<Json>,"grove_id": string,"id": string,"introduced_in_ring_id": string | null,"location": unknown,"marker_code": string | null,"parent_id": string | null,"status": Database["public"]['Enums']["publish_status"],"story_order": number,"tier": Database["public"]['Enums']["tier"],"title": NonNullable<Json>,"trigger_radius_m": number,"updated_at": string,"visibility": Database["public"]['Enums']["fragment_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gap_hint"?: NonNullable<Json>,"grove_id": string,"id"?: string,"introduced_in_ring_id"?: string | null,"location": unknown,"marker_code"?: string | null,"parent_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"story_order": number,"tier": Database["public"]['Enums']["tier"],"title": NonNullable<Json>,"trigger_radius_m": number,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["fragment_visibility"]
                  }
                  Update: {
                    "created_at"?: string,"gap_hint"?: NonNullable<Json>,"grove_id"?: string,"id"?: string,"introduced_in_ring_id"?: string | null,"location"?: unknown,"marker_code"?: string | null,"parent_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"story_order"?: number,"tier"?: Database["public"]['Enums']["tier"],"title"?: NonNullable<Json>,"trigger_radius_m"?: number,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["fragment_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragments_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragments_introduced_in_ring_id_fkey"
      columns: ["introduced_in_ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"gatherings": {
                  Row: {
                    "created_at": string,"grove_id": string | null,"id": string,"ring_id": string | null,"starts_at": string,"title": NonNullable<Json>,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"grove_id"?: string | null,"id"?: string,"ring_id"?: string | null,"starts_at": string,"title": NonNullable<Json>,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"grove_id"?: string | null,"id"?: string,"ring_id"?: string | null,"starts_at"?: string,"title"?: NonNullable<Json>,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gatherings_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gatherings_ring_id_fkey"
      columns: ["ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    }
                  ]
                },"groves": {
                  Row: {
                    "access_notes": NonNullable<Json>,"boundary": unknown,"created_at": string,"id": string,"name": NonNullable<Json>,"narrator_growth_cue_id": string | null,"pack_version": number,"premise": NonNullable<Json>,"published_at": string | null,"site_id": string,"slug": string,"status": Database["public"]['Enums']["publish_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_notes"?: NonNullable<Json>,"boundary": unknown,"created_at"?: string,"id"?: string,"name": NonNullable<Json>,"narrator_growth_cue_id"?: string | null,"pack_version"?: number,"premise"?: NonNullable<Json>,"published_at"?: string | null,"site_id": string,"slug": string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "access_notes"?: NonNullable<Json>,"boundary"?: unknown,"created_at"?: string,"id"?: string,"name"?: NonNullable<Json>,"narrator_growth_cue_id"?: string | null,"pack_version"?: number,"premise"?: NonNullable<Json>,"published_at"?: string | null,"site_id"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groves_narrator_growth_cue_id_fkey"
      columns: ["narrator_growth_cue_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "groves_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"kind": string,"last_error": string | null,"payload": NonNullable<Json>,"run_after": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"kind": string,"last_error"?: string | null,"payload": NonNullable<Json>,"run_after"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"kind"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"landcover_classes": {
                  Row: {
                    "code": number,"name": string,"profile_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"name": string,"profile_id"?: string | null
                  }
                  Update: {
                    "code"?: number,"name"?: string,"profile_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "landcover_classes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "ambience_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"landcover_grids": {
                  Row: {
                    "file_path": string,"generated_at": string,"h3_resolution": number,"region_id": string,"source": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "file_path": string,"generated_at": string,"h3_resolution"?: number,"region_id": string,"source": string,"version": number
                  }
                  Update: {
                    "file_path"?: string,"generated_at"?: string,"h3_resolution"?: number,"region_id"?: string,"source"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "landcover_grids_region_id_fkey"
      columns: ["region_id"]
isOneToOne: true
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"music_cue_stems": {
                  Row: {
                    "asset_id": string,"created_at": string,"cue_id": string,"gain_db": number,"id": string,"role": string,"state_gains": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"created_at"?: string,"cue_id": string,"gain_db"?: number,"id"?: string,"role"?: string,"state_gains"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string,"created_at"?: string,"cue_id"?: string,"gain_db"?: number,"id"?: string,"role"?: string,"state_gains"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "music_cue_stems_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "music_cue_stems_cue_id_fkey"
      columns: ["cue_id"]
isOneToOne: false
      referencedRelation: "music_cues"
      referencedColumns: ["id"]
    }
                  ]
                },"music_cues": {
                  Row: {
                    "conditions": NonNullable<Json>,"created_at": string,"crossfade_ms": number,"grove_id": string | null,"id": string,"min_dwell_s": number,"music_zone_id": string | null,"name": string,"priority": number,"status": Database["public"]['Enums']["publish_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conditions"?: NonNullable<Json>,"created_at"?: string,"crossfade_ms"?: number,"grove_id"?: string | null,"id"?: string,"min_dwell_s"?: number,"music_zone_id"?: string | null,"name": string,"priority"?: number,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "conditions"?: NonNullable<Json>,"created_at"?: string,"crossfade_ms"?: number,"grove_id"?: string | null,"id"?: string,"min_dwell_s"?: number,"music_zone_id"?: string | null,"name"?: string,"priority"?: number,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "music_cues_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "music_cues_music_zone_id_fkey"
      columns: ["music_zone_id"]
isOneToOne: false
      referencedRelation: "music_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"music_zones": {
                  Row: {
                    "boundary": unknown,"created_at": string,"edge_fade_m": number,"id": string,"name": string,"priority": number,"region_id": string,"status": Database["public"]['Enums']["publish_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "boundary": unknown,"created_at"?: string,"edge_fade_m"?: number,"id"?: string,"name": string,"priority"?: number,"region_id": string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "boundary"?: unknown,"created_at"?: string,"edge_fade_m"?: number,"id"?: string,"name"?: string,"priority"?: number,"region_id"?: string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "music_zones_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"pack_builds": {
                  Row: {
                    "asset_hashes": (string)[],"built_at": string,"bytes_total": number,"id": number,"manifest_path": string,"manifest_sha256": string,"reason": string | null,"scope": string,"scope_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_hashes": (string)[],"built_at"?: string,"bytes_total": number,"id"?: never,"manifest_path": string,"manifest_sha256": string,"reason"?: string | null,"scope": string,"scope_id": string,"version": number
                  }
                  Update: {
                    "asset_hashes"?: (string)[],"built_at"?: string,"bytes_total"?: number,"id"?: never,"manifest_path"?: string,"manifest_sha256"?: string,"reason"?: string | null,"scope"?: string,"scope_id"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"questions": {
                  Row: {
                    "anchor_character_id": string | null,"anchor_fragment_id": string | null,"closes_at": string | null,"created_at": string,"grove_id": string,"id": string,"opens_at": string,"requires_heard": boolean,"ring_id": string | null,"status": Database["public"]['Enums']["publish_status"],"text": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_character_id"?: string | null,"anchor_fragment_id"?: string | null,"closes_at"?: string | null,"created_at"?: string,"grove_id": string,"id"?: string,"opens_at": string,"requires_heard"?: boolean,"ring_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"text": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "anchor_character_id"?: string | null,"anchor_fragment_id"?: string | null,"closes_at"?: string | null,"created_at"?: string,"grove_id"?: string,"id"?: string,"opens_at"?: string,"requires_heard"?: boolean,"ring_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"text"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_anchor_character_id_fkey"
      columns: ["anchor_character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_ring_id_fkey"
      columns: ["ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    }
                  ]
                },"regions": {
                  Row: {
                    "bounds": unknown,"created_at": string,"id": string,"name": string,"pack_version": number,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bounds"?: unknown,"created_at"?: string,"id"?: string,"name": string,"pack_version"?: number,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bounds"?: unknown,"created_at"?: string,"id"?: string,"name"?: string,"pack_version"?: number,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"revision_contributors": {
                  Row: {
                    "consent_id": string,"contributor_id": string,"revision_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_id": string,"contributor_id": string,"revision_id": string,"role": string
                  }
                  Update: {
                    "consent_id"?: string,"contributor_id"?: string,"revision_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "revision_contributors_consent_id_fkey"
      columns: ["consent_id"]
isOneToOne: false
      referencedRelation: "consents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revision_contributors_consent_id_fkey"
      columns: ["consent_id"]
isOneToOne: false
      referencedRelation: "consents_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revision_contributors_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revision_contributors_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revision_contributors_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "fragment_revisions"
      referencedColumns: ["id"]
    }
                  ]
                },"revision_versions": {
                  Row: {
                    "created_at": string,"id": string,"language": Database["public"]['Enums']["lang"],"narration_asset_id": string,"revision_id": string,"transcript": string,"updated_at": string,"vtt": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"language": Database["public"]['Enums']["lang"],"narration_asset_id": string,"revision_id": string,"transcript": string,"updated_at"?: string,"vtt"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"language"?: Database["public"]['Enums']["lang"],"narration_asset_id"?: string,"revision_id"?: string,"transcript"?: string,"updated_at"?: string,"vtt"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "revision_versions_narration_asset_id_fkey"
      columns: ["narration_asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revision_versions_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "fragment_revisions"
      referencedColumns: ["id"]
    }
                  ]
                },"rings": {
                  Row: {
                    "created_at": string,"grove_id": string,"id": string,"name": NonNullable<Json>,"planting_closes_at": string | null,"planting_opens_at": string | null,"released_at": string | null,"ring_no": number,"status": Database["public"]['Enums']["ring_status"],"theme_note": NonNullable<Json>,"updated_at": string,"writer_note_asset_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"grove_id": string,"id"?: string,"name": NonNullable<Json>,"planting_closes_at"?: string | null,"planting_opens_at"?: string | null,"released_at"?: string | null,"ring_no": number,"status"?: Database["public"]['Enums']["ring_status"],"theme_note"?: NonNullable<Json>,"updated_at"?: string,"writer_note_asset_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"grove_id"?: string,"id"?: string,"name"?: NonNullable<Json>,"planting_closes_at"?: string | null,"planting_opens_at"?: string | null,"released_at"?: string | null,"ring_no"?: number,"status"?: Database["public"]['Enums']["ring_status"],"theme_note"?: NonNullable<Json>,"updated_at"?: string,"writer_note_asset_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rings_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rings_writer_note_asset_id_fkey"
      columns: ["writer_note_asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"seed_links": {
                  Row: {
                    "asset_id": string | null,"created_at": string,"crossroads_option_id": string | null,"id": string,"note": string | null,"question_id": string | null,"revision_id": string | null,"seed_id": string,"stage": Database["public"]['Enums']["seed_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id"?: string | null,"created_at"?: string,"crossroads_option_id"?: string | null,"id"?: string,"note"?: string | null,"question_id"?: string | null,"revision_id"?: string | null,"seed_id": string,"stage"?: Database["public"]['Enums']["seed_status"],"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string | null,"created_at"?: string,"crossroads_option_id"?: string | null,"id"?: string,"note"?: string | null,"question_id"?: string | null,"revision_id"?: string | null,"seed_id"?: string,"stage"?: Database["public"]['Enums']["seed_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seed_links_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_links_option_fk"
      columns: ["crossroads_option_id"]
isOneToOne: false
      referencedRelation: "crossroads_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_links_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_links_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "fragment_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_links_seed_id_fkey"
      columns: ["seed_id"]
isOneToOne: false
      referencedRelation: "seeds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_links_seed_id_fkey"
      columns: ["seed_id"]
isOneToOne: false
      referencedRelation: "seeds_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"seed_terms": {
                  Row: {
                    "body": NonNullable<Json>,"effective_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": NonNullable<Json>,"effective_at": string,"version": number
                  }
                  Update: {
                    "body"?: NonNullable<Json>,"effective_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"seeds": {
                  Row: {
                    "anchor_fragment_id": string | null,"body": string | null,"body_added_at": string | null,"character_id": string | null,"client_seed_id": string,"created_at": string,"credit_name": string | null,"credit_status": string,"device_id": string,"flags": (string)[],"grove_id": string,"id": string,"kind": Database["public"]['Enums']["seed_kind"],"may_quote": boolean,"may_use_voice": boolean,"memory_contact": string | null,"planted_at": string,"planted_on_site": boolean,"question_id": string | null,"ring_id": string | null,"sound_grant": boolean,"staff_transcript": string | null,"status": Database["public"]['Enums']["seed_status"],"status_changed_at": string | null,"terms_version": number,"themes": (string)[],"updated_at": string,"voice_duration_ms": number | null,"voice_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_fragment_id"?: string | null,"body"?: string | null,"body_added_at"?: string | null,"character_id"?: string | null,"client_seed_id": string,"created_at"?: string,"credit_name"?: string | null,"credit_status"?: string,"device_id": string,"flags"?: (string)[],"grove_id": string,"id"?: string,"kind": Database["public"]['Enums']["seed_kind"],"may_quote"?: boolean,"may_use_voice"?: boolean,"memory_contact"?: string | null,"planted_at": string,"planted_on_site": boolean,"question_id"?: string | null,"ring_id"?: string | null,"sound_grant"?: boolean,"staff_transcript"?: string | null,"status"?: Database["public"]['Enums']["seed_status"],"status_changed_at"?: string | null,"terms_version": number,"themes"?: (string)[],"updated_at"?: string,"voice_duration_ms"?: number | null,"voice_path"?: string | null
                  }
                  Update: {
                    "anchor_fragment_id"?: string | null,"body"?: string | null,"body_added_at"?: string | null,"character_id"?: string | null,"client_seed_id"?: string,"created_at"?: string,"credit_name"?: string | null,"credit_status"?: string,"device_id"?: string,"flags"?: (string)[],"grove_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["seed_kind"],"may_quote"?: boolean,"may_use_voice"?: boolean,"memory_contact"?: string | null,"planted_at"?: string,"planted_on_site"?: boolean,"question_id"?: string | null,"ring_id"?: string | null,"sound_grant"?: boolean,"staff_transcript"?: string | null,"status"?: Database["public"]['Enums']["seed_status"],"status_changed_at"?: string | null,"terms_version"?: number,"themes"?: (string)[],"updated_at"?: string,"voice_duration_ms"?: number | null,"voice_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seeds_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_character_id_fkey"
      columns: ["character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_ring_id_fkey"
      columns: ["ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_terms_version_fkey"
      columns: ["terms_version"]
isOneToOne: false
      referencedRelation: "seed_terms"
      referencedColumns: ["version"]
    }
                  ]
                },"site_approvals": {
                  Row: {
                    "allows_speaker_wildlife_sounds": boolean,"approved_by": string | null,"created_at": string,"document_path": string | null,"expires_on": string | null,"id": string,"scope": string | null,"site_id": string,"starts_on": string | null,"status": Database["public"]['Enums']["approval_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allows_speaker_wildlife_sounds"?: boolean,"approved_by"?: string | null,"created_at"?: string,"document_path"?: string | null,"expires_on"?: string | null,"id"?: string,"scope"?: string | null,"site_id": string,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["approval_status"],"updated_at"?: string
                  }
                  Update: {
                    "allows_speaker_wildlife_sounds"?: boolean,"approved_by"?: string | null,"created_at"?: string,"document_path"?: string | null,"expires_on"?: string | null,"id"?: string,"scope"?: string | null,"site_id"?: string,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["approval_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_approvals_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"sites": {
                  Row: {
                    "access_info": NonNullable<Json>,"created_at": string,"gatherings_url": string | null,"id": string,"name": string,"region_id": string,"slug": string,"updated_at": string,"website_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_info"?: NonNullable<Json>,"created_at"?: string,"gatherings_url"?: string | null,"id"?: string,"name": string,"region_id": string,"slug": string,"updated_at"?: string,"website_url"?: string | null
                  }
                  Update: {
                    "access_info"?: NonNullable<Json>,"created_at"?: string,"gatherings_url"?: string | null,"id"?: string,"name"?: string,"region_id"?: string,"slug"?: string,"updated_at"?: string,"website_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sites_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "active": boolean,"created_at": string,"display_name": string,"role": Database["public"]['Enums']["staff_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"display_name": string,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"display_name"?: string,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"threads": {
                  Row: {
                    "bible": string | null,"created_at": string,"grove_id": string,"id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bible"?: string | null,"created_at"?: string,"grove_id": string,"id"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "bible"?: string | null,"created_at"?: string,"grove_id"?: string,"id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "threads_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"ui_cues": {
                  Row: {
                    "asset_id": string,"created_at": string,"id": string,"key": string,"language": Database["public"]['Enums']["lang"],"region_id": string | null,"status": Database["public"]['Enums']["publish_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"created_at"?: string,"id"?: string,"key": string,"language": Database["public"]['Enums']["lang"],"region_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string,"created_at"?: string,"id"?: string,"key"?: string,"language"?: Database["public"]['Enums']["lang"],"region_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ui_cues_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ui_cues_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "consents_staff": {
                  Row: {
                    "channels": (string)[],"community_permission_notes": string | null,"contributor_id": string,"created_at": string,"document_path": string | null,"expires_on": string | null,"id": string,"license_line": string | null,"revoked_on": string | null,"revoked_reason": string | null,"signed_on": string,"status": Database["public"]['Enums']["rights_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "channels"?: (string)[] | null,"community_permission_notes"?: string | null,"contributor_id"?: string | null,"created_at"?: string | null,"document_path"?: never,"expires_on"?: string | null,"id"?: string | null,"license_line"?: string | null,"revoked_on"?: string | null,"revoked_reason"?: string | null,"signed_on"?: string | null,"status"?: Database["public"]['Enums']["rights_status"] | null,"updated_at"?: string | null
                         }
                        Update: {
                           "channels"?: (string)[] | null,"community_permission_notes"?: string | null,"contributor_id"?: string | null,"created_at"?: string | null,"document_path"?: never,"expires_on"?: string | null,"id"?: string | null,"license_line"?: string | null,"revoked_on"?: string | null,"revoked_reason"?: string | null,"signed_on"?: string | null,"status"?: Database["public"]['Enums']["rights_status"] | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "consents_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consents_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"contributors_staff": {
                  Row: {
                    "community_affiliation": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"display_credit": string,"id": string,"legal_name": string | null,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "community_affiliation"?: string | null,"contact_email"?: never,"contact_phone"?: never,"created_at"?: string | null,"display_credit"?: string | null,"id"?: string | null,"legal_name"?: never,"notes"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "community_affiliation"?: string | null,"contact_email"?: never,"contact_phone"?: never,"created_at"?: string | null,"display_credit"?: string | null,"id"?: string | null,"legal_name"?: never,"notes"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"fragments_staff": {
                  Row: {
                    "created_at": string,"gap_hint": NonNullable<Json>,"grove_id": string,"id": string,"introduced_in_ring_id": string | null,"location": unknown,"marker_code": string | null,"parent_id": string | null,"status": Database["public"]['Enums']["publish_status"],"story_order": number,"tier": Database["public"]['Enums']["tier"],"title": NonNullable<Json>,"trigger_radius_m": number,"updated_at": string,"visibility": Database["public"]['Enums']["fragment_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"gap_hint"?: Json | null,"grove_id"?: string | null,"id"?: string | null,"introduced_in_ring_id"?: string | null,"location"?: never,"marker_code"?: never,"parent_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"] | null,"story_order"?: number | null,"tier"?: Database["public"]['Enums']["tier"] | null,"title"?: Json | null,"trigger_radius_m"?: number | null,"updated_at"?: string | null,"visibility"?: Database["public"]['Enums']["fragment_visibility"] | null
                         }
                        Update: {
                           "created_at"?: string | null,"gap_hint"?: Json | null,"grove_id"?: string | null,"id"?: string | null,"introduced_in_ring_id"?: string | null,"location"?: never,"marker_code"?: never,"parent_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"] | null,"story_order"?: number | null,"tier"?: Database["public"]['Enums']["tier"] | null,"title"?: Json | null,"trigger_radius_m"?: number | null,"updated_at"?: string | null,"visibility"?: Database["public"]['Enums']["fragment_visibility"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "fragments_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragments_introduced_in_ring_id_fkey"
      columns: ["introduced_in_ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"seeds_staff": {
                  Row: {
                    "anchor_fragment_id": string | null,"body": string | null,"body_added_at": string | null,"character_id": string | null,"client_seed_id": string,"created_at": string,"credit_name": string | null,"credit_status": string,"device_id": string,"flags": (string)[],"grove_id": string,"id": string,"kind": Database["public"]['Enums']["seed_kind"],"may_quote": boolean,"may_use_voice": boolean,"memory_contact": string | null,"planted_at": string,"planted_on_site": boolean,"question_id": string | null,"ring_id": string | null,"sound_grant": boolean,"staff_transcript": string | null,"status": Database["public"]['Enums']["seed_status"],"status_changed_at": string | null,"terms_version": number,"themes": (string)[],"updated_at": string,"voice_duration_ms": number | null,"voice_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "anchor_fragment_id"?: string | null,"body"?: string | null,"body_added_at"?: string | null,"character_id"?: string | null,"client_seed_id"?: string | null,"created_at"?: string | null,"credit_name"?: string | null,"credit_status"?: string | null,"device_id"?: string | null,"flags"?: (string)[] | null,"grove_id"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["seed_kind"] | null,"may_quote"?: boolean | null,"may_use_voice"?: boolean | null,"memory_contact"?: never,"planted_at"?: string | null,"planted_on_site"?: boolean | null,"question_id"?: string | null,"ring_id"?: string | null,"sound_grant"?: boolean | null,"staff_transcript"?: string | null,"status"?: Database["public"]['Enums']["seed_status"] | null,"status_changed_at"?: string | null,"terms_version"?: number | null,"themes"?: (string)[] | null,"updated_at"?: string | null,"voice_duration_ms"?: number | null,"voice_path"?: string | null
                         }
                        Update: {
                           "anchor_fragment_id"?: string | null,"body"?: string | null,"body_added_at"?: string | null,"character_id"?: string | null,"client_seed_id"?: string | null,"created_at"?: string | null,"credit_name"?: string | null,"credit_status"?: string | null,"device_id"?: string | null,"flags"?: (string)[] | null,"grove_id"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["seed_kind"] | null,"may_quote"?: boolean | null,"may_use_voice"?: boolean | null,"memory_contact"?: never,"planted_at"?: string | null,"planted_on_site"?: boolean | null,"question_id"?: string | null,"ring_id"?: string | null,"sound_grant"?: boolean | null,"staff_transcript"?: string | null,"status"?: Database["public"]['Enums']["seed_status"] | null,"status_changed_at"?: string | null,"terms_version"?: number | null,"themes"?: (string)[] | null,"updated_at"?: string | null,"voice_duration_ms"?: number | null,"voice_path"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "seeds_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_character_id_fkey"
      columns: ["character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_ring_id_fkey"
      columns: ["ring_id"]
isOneToOne: false
      referencedRelation: "rings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seeds_terms_version_fkey"
      columns: ["terms_version"]
isOneToOne: false
      referencedRelation: "seed_terms"
      referencedColumns: ["version"]
    }
                  ]
                }
          }
          Functions: {
            "fn_asset_is_playable":
{ Args: { "p_asset_id": string,"p_timezone"?: string }; Returns: boolean
                           },
"fn_call_run_jobs":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_close_due_crossroads":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_cue_is_playable":
{ Args: { "p_cue_id": string }; Returns: boolean
                           },
"fn_current_revision":
{ Args: { "p_fragment_id": string }; Returns: string
                           },
"fn_daily_expiry_and_retention":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_date_unexpired":
{ Args: { "p_expires_on": string,"p_timezone": string }; Returns: boolean
                           },
"fn_enqueue_due_publish_at":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_enqueue_purge_asset":
{ Args: { "p_asset_sha": string }; Returns: undefined
                           },
"fn_enqueue_rebuild_pack":
{ Args: { "p_grove_id"?: string,"p_region_id"?: string }; Returns: undefined
                           },
"fn_layer_assets_playable":
{ Args: { "p_layer_id": string }; Returns: string[]
                           },
"fn_publish_check":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
                           },
"fn_publish_commit":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
                           },
"fn_region_today":
{ Args: { "p_timezone": string }; Returns: string
                           },
"fn_revision_is_playable":
{ Args: { "p_revision_id": string }; Returns: boolean
                           },
"fn_site_ok":
{ Args: { "p_site_id": string }; Returns: boolean
                           },
"has_role":
{ Args: { "roles": (Database["public"]['Enums']["staff_role"])[] }; Returns: boolean
                           }
          }
          Enums: {
            "approval_status": "pending"|"active"|"revoked"|"expired","asset_kind": "narration"|"sfx_oneshot"|"sfx_bed"|"music_stem"|"voice_cue"|"writer_note","asset_source": "original"|"commissioned"|"licensed"|"public_domain"|"community_sound","crossroads_status": "draft"|"open"|"closed"|"decided"|"cancelled","fragment_visibility": "marked"|"unmarked"|"protected","lang": "en"|"es","license_kind": "owned"|"work_for_hire"|"consent_form"|"cc0"|"cc_by"|"commercial"|"community_sound_grant","publish_status": "draft"|"in_review"|"approved"|"published"|"retired"|"unpublished","rights_status": "active"|"revoked"|"expired","ring_status": "planned"|"planting"|"writing"|"released"|"archived","seed_kind": "next"|"character"|"noticed"|"answer"|"memory"|"sound","seed_status": "planted"|"read"|"sprouting"|"grown"|"resting"|"hidden","staff_role": "admin"|"editor"|"writer"|"sound"|"moderator"|"viewer","tier": "root"|"branch"|"leaf","time_window": "dawn"|"day"|"dusk"|"night"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "approval_status": ["pending", "active", "revoked", "expired"],"asset_kind": ["narration", "sfx_oneshot", "sfx_bed", "music_stem", "voice_cue", "writer_note"],"asset_source": ["original", "commissioned", "licensed", "public_domain", "community_sound"],"crossroads_status": ["draft", "open", "closed", "decided", "cancelled"],"fragment_visibility": ["marked", "unmarked", "protected"],"lang": ["en", "es"],"license_kind": ["owned", "work_for_hire", "consent_form", "cc0", "cc_by", "commercial", "community_sound_grant"],"publish_status": ["draft", "in_review", "approved", "published", "retired", "unpublished"],"rights_status": ["active", "revoked", "expired"],"ring_status": ["planned", "planting", "writing", "released", "archived"],"seed_kind": ["next", "character", "noticed", "answer", "memory", "sound"],"seed_status": ["planted", "read", "sprouting", "grown", "resting", "hidden"],"staff_role": ["admin", "editor", "writer", "sound", "moderator", "viewer"],"tier": ["root", "branch", "leaf"],"time_window": ["dawn", "day", "dusk", "night"]
          }
        }
} as const
