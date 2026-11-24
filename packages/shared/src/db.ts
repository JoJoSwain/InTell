
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
                    "created_at": string,"crossfade_ms": number,"gain_db_max": number,"gain_db_min": number,"id": string,"kind": string,"max_concurrent": number,"mean_interval_s": number | null,"min_interval_s": number | null,"months": (number)[],"name": string,"nesting_mute_months": (number)[],"no_repeat_last": number,"pan_max": number,"pan_min": number,"pitch_cents_max": number,"pitch_cents_min": number,"profile_id": string,"speaker_safe": boolean,"time_window": Database["public"]['Enums']["time_window"],"updated_at": string,"wildlife_call": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crossfade_ms"?: number,"gain_db_max"?: number,"gain_db_min"?: number,"id"?: string,"kind": string,"max_concurrent"?: number,"mean_interval_s"?: number | null,"min_interval_s"?: number | null,"months"?: (number)[],"name": string,"nesting_mute_months"?: (number)[],"no_repeat_last"?: number,"pan_max"?: number,"pan_min"?: number,"pitch_cents_max"?: number,"pitch_cents_min"?: number,"profile_id": string,"speaker_safe"?: boolean,"time_window": Database["public"]['Enums']["time_window"],"updated_at"?: string,"wildlife_call"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"crossfade_ms"?: number,"gain_db_max"?: number,"gain_db_min"?: number,"id"?: string,"kind"?: string,"max_concurrent"?: number,"mean_interval_s"?: number | null,"min_interval_s"?: number | null,"months"?: (number)[],"name"?: string,"nesting_mute_months"?: (number)[],"no_repeat_last"?: number,"pan_max"?: number,"pan_min"?: number,"pitch_cents_max"?: number,"pitch_cents_min"?: number,"profile_id"?: string,"speaker_safe"?: boolean,"time_window"?: Database["public"]['Enums']["time_window"],"updated_at"?: string,"wildlife_call"?: boolean
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
                },"audio_assets": {
                  Row: {
                    "bitrate_kbps": number | null,"bytes": number,"channels": number,"created_at": string,"created_by": string | null,"crest_factor_db": number | null,"duration_ms": number,"ext": string,"id": string,"is_public": boolean,"kind": Database["public"]['Enums']["asset_kind"],"loop_end_ms": number | null,"loop_start_ms": number | null,"loudness_lufs": number | null,"max_short_term_lufs": number | null,"safe_for_walkers_checked": boolean,"sample_rate": number,"sha256": string,"staging_path": string,"tags": (string)[],"title": string,"true_peak_dbtp": number | null,"updated_at": string,"fn_check_audio_asset": Json | null
                  }
                  ComputedFields: "fn_check_audio_asset"
                  Insert: {
                    "bitrate_kbps"?: number | null,"bytes": number,"channels": number,"created_at"?: string,"created_by"?: string | null,"crest_factor_db"?: number | null,"duration_ms": number,"ext": string,"id"?: string,"is_public"?: boolean,"kind": Database["public"]['Enums']["asset_kind"],"loop_end_ms"?: number | null,"loop_start_ms"?: number | null,"loudness_lufs"?: number | null,"max_short_term_lufs"?: number | null,"safe_for_walkers_checked"?: boolean,"sample_rate": number,"sha256": string,"staging_path": string,"tags"?: (string)[],"title": string,"true_peak_dbtp"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "bitrate_kbps"?: number | null,"bytes"?: number,"channels"?: number,"created_at"?: string,"created_by"?: string | null,"crest_factor_db"?: number | null,"duration_ms"?: number,"ext"?: string,"id"?: string,"is_public"?: boolean,"kind"?: Database["public"]['Enums']["asset_kind"],"loop_end_ms"?: number | null,"loop_start_ms"?: number | null,"loudness_lufs"?: number | null,"max_short_term_lufs"?: number | null,"safe_for_walkers_checked"?: boolean,"sample_rate"?: number,"sha256"?: string,"staging_path"?: string,"tags"?: (string)[],"title"?: string,"true_peak_dbtp"?: number | null,"updated_at"?: string
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
                    "created_at": string,"home_grove_id": string | null,"id": string,"name": string,"notes": string | null,"portrait_image_id": string | null,"public_intro": NonNullable<Json>,"public_name": NonNullable<Json>,"status": Database["public"]['Enums']["publish_status"],"updated_at": string,"fn_check_character_local": Json | null
                  }
                  ComputedFields: "fn_check_character_local"
                  Insert: {
                    "created_at"?: string,"home_grove_id"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"portrait_image_id"?: string | null,"public_intro"?: NonNullable<Json>,"public_name"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"home_grove_id"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"portrait_image_id"?: string | null,"public_intro"?: NonNullable<Json>,"public_name"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "characters_home_grove_id_fkey"
      columns: ["home_grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "characters_portrait_image_id_fkey"
      columns: ["portrait_image_id"]
isOneToOne: false
      referencedRelation: "image_assets"
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
                },"device_rate_limits": {
                  Row: {
                    "device_id": string,"endpoint": string,"hits": number,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device_id": string,"endpoint": string,"hits": number,"window_start": string
                  }
                  Update: {
                    "device_id"?: string,"endpoint"?: string,"hits"?: number,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"devices": {
                  Row: {
                    "age_gate": string | null,"app_version": string | null,"first_seen_at": string,"id": string,"platform": string | null,"ui_language": Database["public"]['Enums']["lang"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "age_gate"?: string | null,"app_version"?: string | null,"first_seen_at"?: string,"id": string,"platform"?: string | null,"ui_language"?: Database["public"]['Enums']["lang"] | null
                  }
                  Update: {
                    "age_gate"?: string | null,"app_version"?: string | null,"first_seen_at"?: string,"id"?: string,"platform"?: string | null,"ui_language"?: Database["public"]['Enums']["lang"] | null
                  }
                  Relationships: [
                    
                  ]
                },"entry_links": {
                  Row: {
                    "created_at": string,"entry_id": string,"id": string,"note": string | null,"question_id": string | null,"revision_id": string | null,"stage": Database["public"]['Enums']["entry_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_id": string,"id"?: string,"note"?: string | null,"question_id"?: string | null,"revision_id"?: string | null,"stage"?: Database["public"]['Enums']["entry_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"entry_id"?: string,"id"?: string,"note"?: string | null,"question_id"?: string | null,"revision_id"?: string | null,"stage"?: Database["public"]['Enums']["entry_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entry_links_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entry_links_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entry_links_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "fragment_revisions"
      referencedColumns: ["id"]
    }
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
                    "card_line": NonNullable<Json>,"character_id": string,"fragment_id": string,"introduces": boolean,"prominence": Database["public"]['Enums']["character_prominence"]
                  }
                  ComputedFields: never
                  Insert: {
                    "card_line"?: NonNullable<Json>,"character_id": string,"fragment_id": string,"introduces"?: boolean,"prominence"?: Database["public"]['Enums']["character_prominence"]
                  }
                  Update: {
                    "card_line"?: NonNullable<Json>,"character_id"?: string,"fragment_id"?: string,"introduces"?: boolean,"prominence"?: Database["public"]['Enums']["character_prominence"]
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
                },"fragment_prereq_groups": {
                  Row: {
                    "created_at": string,"fragment_id": string,"id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fragment_id": string,"id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"fragment_id"?: string,"id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragment_prereq_groups_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_prereq_groups_fragment_id_fkey"
      columns: ["fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"fragment_prereq_members": {
                  Row: {
                    "group_id": string,"requires_fragment_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"requires_fragment_id": string,"sort_order"?: number
                  }
                  Update: {
                    "group_id"?: string,"requires_fragment_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragment_prereq_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "fragment_prereq_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_prereq_members_requires_fragment_id_fkey"
      columns: ["requires_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fragment_prereq_members_requires_fragment_id_fkey"
      columns: ["requires_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    }
                  ]
                },"fragment_revisions": {
                  Row: {
                    "change_kind": Database["public"]['Enums']["change_kind"],"change_note": string | null,"change_teaser": NonNullable<Json>,"created_at": string,"created_by": string | null,"fragment_id": string,"id": string,"release_id": string | null,"revision_no": number,"status": Database["public"]['Enums']["publish_status"],"updated_at": string,"fn_check_revision_local": Json | null
                  }
                  ComputedFields: "fn_check_revision_local"
                  Insert: {
                    "change_kind": Database["public"]['Enums']["change_kind"],"change_note"?: string | null,"change_teaser"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"fragment_id": string,"id"?: string,"release_id"?: string | null,"revision_no": number,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
                  }
                  Update: {
                    "change_kind"?: Database["public"]['Enums']["change_kind"],"change_note"?: string | null,"change_teaser"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"fragment_id"?: string,"id"?: string,"release_id"?: string | null,"revision_no"?: number,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string
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
      foreignKeyName: "fragment_revisions_release_id_fkey"
      columns: ["release_id"]
isOneToOne: false
      referencedRelation: "releases"
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
                    "beacon_asset_id": string | null,"created_at": string,"grove_id": string,"id": string,"indigeny_body": string | null,"indigeny_earth": string | null,"indigeny_world": string | null,"is_ending": boolean,"location": unknown,"marker_code": string | null,"resolve_asset_id": string | null,"status": Database["public"]['Enums']["publish_status"],"story_order": number,"teaser": NonNullable<Json>,"teaser_locked_asset_id": string | null,"tier": Database["public"]['Enums']["tier"],"title": NonNullable<Json>,"trigger_radius_m": number,"updated_at": string,"visibility": Database["public"]['Enums']["fragment_visibility"],"fn_check_fragment_local": Json | null,"location_geojson": Json | null
                  }
                  ComputedFields: "fn_check_fragment_local" | "location_geojson"
                  Insert: {
                    "beacon_asset_id"?: string | null,"created_at"?: string,"grove_id": string,"id"?: string,"indigeny_body"?: string | null,"indigeny_earth"?: string | null,"indigeny_world"?: string | null,"is_ending"?: boolean,"location": unknown,"marker_code"?: string | null,"resolve_asset_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"story_order": number,"teaser"?: NonNullable<Json>,"teaser_locked_asset_id"?: string | null,"tier": Database["public"]['Enums']["tier"],"title": NonNullable<Json>,"trigger_radius_m"?: number,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["fragment_visibility"]
                  }
                  Update: {
                    "beacon_asset_id"?: string | null,"created_at"?: string,"grove_id"?: string,"id"?: string,"indigeny_body"?: string | null,"indigeny_earth"?: string | null,"indigeny_world"?: string | null,"is_ending"?: boolean,"location"?: unknown,"marker_code"?: string | null,"resolve_asset_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"story_order"?: number,"teaser"?: NonNullable<Json>,"teaser_locked_asset_id"?: string | null,"tier"?: Database["public"]['Enums']["tier"],"title"?: NonNullable<Json>,"trigger_radius_m"?: number,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["fragment_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "fragments_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"gatherings": {
                  Row: {
                    "created_at": string,"grove_id": string | null,"id": string,"starts_at": string,"title": NonNullable<Json>,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"grove_id"?: string | null,"id"?: string,"starts_at": string,"title": NonNullable<Json>,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"grove_id"?: string | null,"id"?: string,"starts_at"?: string,"title"?: NonNullable<Json>,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gatherings_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"grove_journeys": {
                  Row: {
                    "created_at": string,"grove_id": string,"mode": Database["public"]['Enums']["journey_mode"],"passage": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"grove_id": string,"mode": Database["public"]['Enums']["journey_mode"],"passage"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"grove_id"?: string,"mode"?: Database["public"]['Enums']["journey_mode"],"passage"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grove_journeys_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"grove_sound_cues": {
                  Row: {
                    "asset_id": string,"created_at": string,"grove_id": string,"id": string,"kind": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"created_at"?: string,"grove_id": string,"id"?: string,"kind": string,"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string,"created_at"?: string,"grove_id"?: string,"id"?: string,"kind"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grove_sound_cues_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grove_sound_cues_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                },"groves": {
                  Row: {
                    "allows_speaker_wildlife_sounds": boolean,"created_at": string,"depth_bloom_texture_m": number,"gatherings_url": string | null,"growth_cue_id": string | null,"id": string,"name": NonNullable<Json>,"pack_version": number,"premise": NonNullable<Json>,"published_at": string | null,"region_id": string,"slug": string,"status": Database["public"]['Enums']["publish_status"],"updated_at": string,"website_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allows_speaker_wildlife_sounds"?: boolean,"created_at"?: string,"depth_bloom_texture_m"?: number,"gatherings_url"?: string | null,"growth_cue_id"?: string | null,"id"?: string,"name": NonNullable<Json>,"pack_version"?: number,"premise"?: NonNullable<Json>,"published_at"?: string | null,"region_id": string,"slug": string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string,"website_url"?: string | null
                  }
                  Update: {
                    "allows_speaker_wildlife_sounds"?: boolean,"created_at"?: string,"depth_bloom_texture_m"?: number,"gatherings_url"?: string | null,"growth_cue_id"?: string | null,"id"?: string,"name"?: NonNullable<Json>,"pack_version"?: number,"premise"?: NonNullable<Json>,"published_at"?: string | null,"region_id"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["publish_status"],"updated_at"?: string,"website_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "groves_narrator_growth_cue_id_fkey"
      columns: ["growth_cue_id"]
isOneToOne: false
      referencedRelation: "audio_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "groves_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"image_assets": {
                  Row: {
                    "alt_text": NonNullable<Json>,"bytes": number,"created_at": string,"created_by": string | null,"ext": string,"height": number,"id": string,"is_public": boolean,"sha256": string,"staging_path": string,"title": string,"updated_at": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: NonNullable<Json>,"bytes": number,"created_at"?: string,"created_by"?: string | null,"ext": string,"height": number,"id"?: string,"is_public"?: boolean,"sha256": string,"staging_path": string,"title": string,"updated_at"?: string,"width": number
                  }
                  Update: {
                    "alt_text"?: NonNullable<Json>,"bytes"?: number,"created_at"?: string,"created_by"?: string | null,"ext"?: string,"height"?: number,"id"?: string,"is_public"?: boolean,"sha256"?: string,"staging_path"?: string,"title"?: string,"updated_at"?: string,"width"?: number
                  }
                  Relationships: [
                    
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
                },"journal_entries": {
                  Row: {
                    "anchor_fragment_id": string | null,"body": string | null,"character_id": string | null,"client_entry_id": string,"created_at": string,"device_id": string,"flags": (string)[],"grove_id": string | null,"id": string,"kind": Database["public"]['Enums']["entry_kind"],"question_id": string | null,"staff_transcript": string | null,"status": Database["public"]['Enums']["entry_status"],"status_changed_at": string | null,"submitted_at": string,"terms_version": number,"themes": (string)[],"updated_at": string,"voice_duration_ms": number | null,"voice_path": string | null,"written_on_site": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_fragment_id"?: string | null,"body"?: string | null,"character_id"?: string | null,"client_entry_id": string,"created_at"?: string,"device_id": string,"flags"?: (string)[],"grove_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["entry_kind"],"question_id"?: string | null,"staff_transcript"?: string | null,"status"?: Database["public"]['Enums']["entry_status"],"status_changed_at"?: string | null,"submitted_at": string,"terms_version": number,"themes"?: (string)[],"updated_at"?: string,"voice_duration_ms"?: number | null,"voice_path"?: string | null,"written_on_site": boolean
                  }
                  Update: {
                    "anchor_fragment_id"?: string | null,"body"?: string | null,"character_id"?: string | null,"client_entry_id"?: string,"created_at"?: string,"device_id"?: string,"flags"?: (string)[],"grove_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["entry_kind"],"question_id"?: string | null,"staff_transcript"?: string | null,"status"?: Database["public"]['Enums']["entry_status"],"status_changed_at"?: string | null,"submitted_at"?: string,"terms_version"?: number,"themes"?: (string)[],"updated_at"?: string,"voice_duration_ms"?: number | null,"voice_path"?: string | null,"written_on_site"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_entries_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_anchor_fragment_id_fkey"
      columns: ["anchor_fragment_id"]
isOneToOne: false
      referencedRelation: "fragments_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_character_id_fkey"
      columns: ["character_id"]
isOneToOne: false
      referencedRelation: "characters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_terms_version_fkey"
      columns: ["terms_version"]
isOneToOne: false
      referencedRelation: "journal_terms"
      referencedColumns: ["version"]
    }
                  ]
                },"journal_terms": {
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
                    "file_path": string,"generated_at": string,"h3_resolution": number,"region_id": string,"sha": string | null,"source": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "file_path": string,"generated_at": string,"h3_resolution"?: number,"region_id": string,"sha"?: string | null,"source": string,"version": number
                  }
                  Update: {
                    "file_path"?: string,"generated_at"?: string,"h3_resolution"?: number,"region_id"?: string,"sha"?: string | null,"source"?: string,"version"?: number
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
                    "conditions": NonNullable<Json>,"created_at": string,"crossfade_ms": number,"grove_id": string | null,"id": string,"min_dwell_s": number,"music_zone_id": string | null,"name": string,"priority": number,"resolve_branch_asset_id": string | null,"resolve_leaf_asset_id": string | null,"resolve_root_asset_id": string | null,"status": Database["public"]['Enums']["publish_status"],"time_window": Database["public"]['Enums']["time_window"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conditions"?: NonNullable<Json>,"created_at"?: string,"crossfade_ms"?: number,"grove_id"?: string | null,"id"?: string,"min_dwell_s"?: number,"music_zone_id"?: string | null,"name": string,"priority"?: number,"resolve_branch_asset_id"?: string | null,"resolve_leaf_asset_id"?: string | null,"resolve_root_asset_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"time_window"?: Database["public"]['Enums']["time_window"],"updated_at"?: string
                  }
                  Update: {
                    "conditions"?: NonNullable<Json>,"created_at"?: string,"crossfade_ms"?: number,"grove_id"?: string | null,"id"?: string,"min_dwell_s"?: number,"music_zone_id"?: string | null,"name"?: string,"priority"?: number,"resolve_branch_asset_id"?: string | null,"resolve_leaf_asset_id"?: string | null,"resolve_root_asset_id"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"time_window"?: Database["public"]['Enums']["time_window"],"updated_at"?: string
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
                    "asset_hashes": (string)[],"bbox": (number)[] | null,"built_at": string,"bytes_total": number,"content_sha256": string | null,"id": number,"live": boolean,"manifest_path": string,"manifest_sha256": string,"opening_lat": number | null,"opening_lng": number | null,"reason": string | null,"release_id": string | null,"scope": string,"scope_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_hashes": (string)[],"bbox"?: (number)[] | null,"built_at"?: string,"bytes_total": number,"content_sha256"?: string | null,"id"?: never,"live"?: boolean,"manifest_path": string,"manifest_sha256": string,"opening_lat"?: number | null,"opening_lng"?: number | null,"reason"?: string | null,"release_id"?: string | null,"scope": string,"scope_id": string,"version": number
                  }
                  Update: {
                    "asset_hashes"?: (string)[],"bbox"?: (number)[] | null,"built_at"?: string,"bytes_total"?: number,"content_sha256"?: string | null,"id"?: never,"live"?: boolean,"manifest_path"?: string,"manifest_sha256"?: string,"opening_lat"?: number | null,"opening_lng"?: number | null,"reason"?: string | null,"release_id"?: string | null,"scope"?: string,"scope_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pack_builds_release_id_fkey"
      columns: ["release_id"]
isOneToOne: false
      referencedRelation: "releases"
      referencedColumns: ["id"]
    }
                  ]
                },"published_snapshots": {
                  Row: {
                    "data": NonNullable<Json>,"entity": string,"entity_id": string,"published_at": string,"release_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data": NonNullable<Json>,"entity": string,"entity_id": string,"published_at"?: string,"release_id": string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string,"published_at"?: string,"release_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "published_snapshots_release_id_fkey"
      columns: ["release_id"]
isOneToOne: false
      referencedRelation: "releases"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "anchor_character_id": string | null,"anchor_fragment_id": string | null,"closes_at": string | null,"created_at": string,"id": string,"opens_at": string,"requires_completed": boolean,"status": Database["public"]['Enums']["publish_status"],"text": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_character_id"?: string | null,"anchor_fragment_id"?: string | null,"closes_at"?: string | null,"created_at"?: string,"id"?: string,"opens_at": string,"requires_completed"?: boolean,"status"?: Database["public"]['Enums']["publish_status"],"text": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "anchor_character_id"?: string | null,"anchor_fragment_id"?: string | null,"closes_at"?: string | null,"created_at"?: string,"id"?: string,"opens_at"?: string,"requires_completed"?: boolean,"status"?: Database["public"]['Enums']["publish_status"],"text"?: NonNullable<Json>,"updated_at"?: string
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
    }
                  ]
                },"regions": {
                  Row: {
                    "bounds": unknown,"created_at": string,"id": string,"name": string,"pack_version": number,"slug": string,"sun_reference": unknown,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bounds"?: unknown,"created_at"?: string,"id"?: string,"name": string,"pack_version"?: number,"slug": string,"sun_reference": unknown,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bounds"?: unknown,"created_at"?: string,"id"?: string,"name"?: string,"pack_version"?: number,"slug"?: string,"sun_reference"?: unknown,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"release_items": {
                  Row: {
                    "entity": string,"entity_id": string,"release_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entity": string,"entity_id": string,"release_id": string
                  }
                  Update: {
                    "entity"?: string,"entity_id"?: string,"release_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "release_items_release_id_fkey"
      columns: ["release_id"]
isOneToOne: false
      referencedRelation: "releases"
      referencedColumns: ["id"]
    }
                  ]
                },"releases": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"last_check": Json | null,"name": string,"notes": string | null,"publish_at": string | null,"published_at": string | null,"published_by": string | null,"status": Database["public"]['Enums']["release_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"last_check"?: Json | null,"name": string,"notes"?: string | null,"publish_at"?: string | null,"published_at"?: string | null,"published_by"?: string | null,"status"?: Database["public"]['Enums']["release_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"last_check"?: Json | null,"name"?: string,"notes"?: string | null,"publish_at"?: string | null,"published_at"?: string | null,"published_by"?: string | null,"status"?: Database["public"]['Enums']["release_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"revision_versions": {
                  Row: {
                    "breath_points_ms": (number)[],"created_at": string,"id": string,"language": Database["public"]['Enums']["lang"],"narration_asset_id": string,"other_time_hint": NonNullable<Json>,"revision_id": string,"swell_cues_ms": (number)[],"time_window": Database["public"]['Enums']["time_window"],"transcript": string,"updated_at": string,"vtt": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "breath_points_ms"?: (number)[],"created_at"?: string,"id"?: string,"language": Database["public"]['Enums']["lang"],"narration_asset_id": string,"other_time_hint"?: NonNullable<Json>,"revision_id": string,"swell_cues_ms"?: (number)[],"time_window"?: Database["public"]['Enums']["time_window"],"transcript": string,"updated_at"?: string,"vtt"?: string | null
                  }
                  Update: {
                    "breath_points_ms"?: (number)[],"created_at"?: string,"id"?: string,"language"?: Database["public"]['Enums']["lang"],"narration_asset_id"?: string,"other_time_hint"?: NonNullable<Json>,"revision_id"?: string,"swell_cues_ms"?: (number)[],"time_window"?: Database["public"]['Enums']["time_window"],"transcript"?: string,"updated_at"?: string,"vtt"?: string | null
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
                },"staff": {
                  Row: {
                    "active": boolean,"created_at": string,"display_name": string,"invited_by": string | null,"role": Database["public"]['Enums']["staff_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"display_name": string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"display_name"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"threads": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
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
            "fragments_staff": {
                  Row: {
                    "created_at": string,"grove_id": string,"id": string,"indigeny_body": string | null,"indigeny_earth": string | null,"indigeny_world": string | null,"is_ending": boolean,"location": unknown,"marker_code": string | null,"status": Database["public"]['Enums']["publish_status"],"story_order": number,"teaser": NonNullable<Json>,"tier": Database["public"]['Enums']["tier"],"title": NonNullable<Json>,"trigger_radius_m": number,"updated_at": string,"visibility": Database["public"]['Enums']["fragment_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"grove_id"?: string | null,"id"?: string | null,"indigeny_body"?: string | null,"indigeny_earth"?: string | null,"indigeny_world"?: string | null,"is_ending"?: boolean | null,"location"?: unknown,"marker_code"?: string | null,"status"?: Database["public"]['Enums']["publish_status"] | null,"story_order"?: number | null,"teaser"?: Json | null,"tier"?: Database["public"]['Enums']["tier"] | null,"title"?: Json | null,"trigger_radius_m"?: number | null,"updated_at"?: string | null,"visibility"?: Database["public"]['Enums']["fragment_visibility"] | null
                         }
                        Update: {
                           "created_at"?: string | null,"grove_id"?: string | null,"id"?: string | null,"indigeny_body"?: string | null,"indigeny_earth"?: string | null,"indigeny_world"?: string | null,"is_ending"?: boolean | null,"location"?: unknown,"marker_code"?: string | null,"status"?: Database["public"]['Enums']["publish_status"] | null,"story_order"?: number | null,"teaser"?: Json | null,"tier"?: Database["public"]['Enums']["tier"] | null,"title"?: Json | null,"trigger_radius_m"?: number | null,"updated_at"?: string | null,"visibility"?: Database["public"]['Enums']["fragment_visibility"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "fragments_grove_id_fkey"
      columns: ["grove_id"]
isOneToOne: false
      referencedRelation: "groves"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "fn_admin_upsert_region":
{ Args: { "p_bounds_geojson": string,"p_id": string,"p_name": string,"p_slug": string,"p_sun_wkt": string,"p_timezone": string }; Returns: string
                           },
"fn_audio_bitrate_target":
{ Args: { "p_kind": Database["public"]['Enums']["asset_kind"] }; Returns: number
                           },
"fn_audio_loudness_target":
{ Args: { "p_kind": Database["public"]['Enums']["asset_kind"] }; Returns: number
                           },
"fn_call_run_jobs":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_check_audio_asset":
{ Args: { "p_asset": Omit<Database["public"]['Tables']["audio_assets"]['Row'], Database["public"]['Tables']["audio_assets"]['ComputedFields']> }; Returns: Json
                           },
"fn_check_character_local":
{ Args: { "p_char": Omit<Database["public"]['Tables']["characters"]['Row'], Database["public"]['Tables']["characters"]['ComputedFields']> }; Returns: Json
                           },
"fn_check_fragment_local":
{ Args: { "p_frag": Omit<Database["public"]['Tables']["fragments"]['Row'], Database["public"]['Tables']["fragments"]['ComputedFields']> }; Returns: Json
                           },
"fn_check_issue":
{ Args: { "p_code": string,"p_context"?: Json,"p_entity": string,"p_entity_id": string,"p_message": string,"p_severity": string }; Returns: Json
                           },
"fn_check_revision_local":
{ Args: { "p_rev": Omit<Database["public"]['Tables']["fragment_revisions"]['Row'], Database["public"]['Tables']["fragment_revisions"]['ComputedFields']> }; Returns: Json
                           },
"fn_contingency_revision_no":
{ Args: { "p_fragment_id": string }; Returns: number
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
"fn_device_rate_allow":
{ Args: { "p_device_id": string,"p_endpoint": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"fn_draft_check":
{ Args: { "p_grove_id": string }; Returns: Json
                           },
"fn_enqueue_due_releases":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_enqueue_purge_asset":
{ Args: { "p_asset_sha": string }; Returns: undefined
                           },
"fn_enqueue_purge_reconcile":
{ Args: { "p_detail"?: Json,"p_reason"?: string }; Returns: undefined
                           },
"fn_enqueue_rebuild_pack":
{ Args: { "p_grove_id"?: string,"p_region_id"?: string,"p_release_id"?: string }; Returns: undefined
                           },
"fn_entity_in_release_or_published":
{ Args: { "p_entity": string,"p_entity_id": string,"p_release_id": string,"p_statuses"?: (string)[] }; Returns: boolean
                           },
"fn_grove_has_opening_root_draft":
{ Args: { "p_grove_id": string }; Returns: boolean
                           },
"fn_grove_has_opening_root_publish":
{ Args: { "p_grove_id": string,"p_release_id": string }; Returns: boolean
                           },
"fn_is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"fn_is_editor_or_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"fn_l10n_blank":
{ Args: { "p": Json }; Returns: boolean
                           },
"fn_layer_is_playable":
{ Args: { "p_layer_id": string }; Returns: boolean
                           },
"fn_must_precede":
{ Args: { "p_earlier": string,"p_later": string }; Returns: boolean
                           },
"fn_pack_geog_geojson":
{ Args: { "p_id": string,"p_scope": string }; Returns: Json
                           },
"fn_a5_sound_check_issues":
{ Args: { "p_release_id": string }; Returns: Json
                           },
"fn_publish_check":
{ Args: { "p_release_id": string }; Returns: Json
                           },
"fn_publish_commit":
{ Args: { "p_release_id": string }; Returns: Json
                           },
"fn_region_today":
{ Args: { "p_timezone": string }; Returns: string
                           },
"fn_register_device":
{ Args: { "p_age_gate": string,"p_app_version": string,"p_id": string,"p_platform": string,"p_set_age_gate": boolean,"p_ui_language": Database["public"]['Enums']["lang"] }; Returns: string
                           },
"fn_release_go_live":
{ Args: { "p_release_id": string }; Returns: Json
                           },
"fn_release_linked_groves":
{ Args: { "p_release_id": string }; Returns: (string)[]
                           },
"fn_require_editor_or_service":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_revision_is_playable":
{ Args: { "p_revision_id": string }; Returns: boolean
                           },
"fn_set_fragment_location":
{ Args: { "p_fragment_id": string,"p_lat": number,"p_lng": number }; Returns: undefined
                           },
"fn_snapshot_projection":
{ Args: { "p_entity": string,"p_entity_id": string }; Returns: Json
                           },
"fn_snapshot_projection_guarded":
{ Args: { "p_entity": string,"p_entity_id": string }; Returns: Json
                           },
"fn_stranded_prereqs":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
                           },
"fn_unpublish_commit":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
                           },
"fn_unpublish_preview":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
                           },
"fn_unreleased":
{ Args: { "p_grove_id"?: string }; Returns: {
              "entity": string,"entity_id": string
            }[]
                           },
"get_pack_index":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"has_role":
{ Args: { "roles": (Database["public"]['Enums']["staff_role"])[] }; Returns: boolean
                           },
"location_geojson":
{ Args: { "f": Omit<Database["public"]['Tables']["fragments"]['Row'], Database["public"]['Tables']["fragments"]['ComputedFields']> }; Returns: Json
                           }
          }
          Enums: {
            "asset_kind": "narration"|"sfx_oneshot"|"sfx_bed"|"music_stem"|"music_moment"|"beacon"|"voice_cue"|"growth_cue","change_kind": "contingency"|"correction","character_prominence": "major"|"minor","entry_kind": "next"|"character"|"noticed"|"answer"|"memory","entry_status": "submitted"|"read"|"sprouting"|"grown"|"resting"|"hidden","fragment_visibility": "standard"|"physical","journey_mode": "walk"|"bike"|"transit","lang": "en"|"es","publish_status": "draft"|"in_review"|"approved"|"published"|"retired"|"unpublished","release_status": "draft"|"scheduled"|"publishing"|"published"|"failed"|"cancelled","staff_role": "admin"|"editor"|"writer"|"sound"|"moderator"|"viewer","tier": "root"|"branch"|"leaf","time_window": "day"|"night"
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
            "asset_kind": ["narration", "sfx_oneshot", "sfx_bed", "music_stem", "music_moment", "beacon", "voice_cue", "growth_cue"],"change_kind": ["contingency", "correction"],"character_prominence": ["major", "minor"],"entry_kind": ["next", "character", "noticed", "answer", "memory"],"entry_status": ["submitted", "read", "sprouting", "grown", "resting", "hidden"],"fragment_visibility": ["standard", "physical"],"journey_mode": ["walk", "bike", "transit"],"lang": ["en", "es"],"publish_status": ["draft", "in_review", "approved", "published", "retired", "unpublished"],"release_status": ["draft", "scheduled", "publishing", "published", "failed", "cancelled"],"staff_role": ["admin", "editor", "writer", "sound", "moderator", "viewer"],"tier": ["root", "branch", "leaf"],"time_window": ["day", "night"]
          }
        }
} as const
