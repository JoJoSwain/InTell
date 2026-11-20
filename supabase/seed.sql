-- M2a demo seed (DATA_MODEL §15 + architect B7/B8).
-- Synthetic test tones only — never real stories or wildlife recordings.
-- Audio metadata must match supabase/seed-media.json exactly (C23).

do $seed$
declare
  ---------------------------------------------------------------------------
  -- Fixed UUIDs (RFC 4122 v4-shaped) for pgTAP / pack tests
  ---------------------------------------------------------------------------
  c_region_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
  c_site_demo_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';
  c_site_ogden_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003';
  c_site_todo2_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000004';
  c_site_todo3_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000005';
  c_site_approval_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000006';

  c_grove_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
  c_ring1_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000011';

  c_char_a_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';
  c_char_b_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000021';

  c_frag_root_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';
  c_frag_branch_a_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031';
  c_frag_branch_b_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000032'; -- unmarked
  c_frag_leaf_a_id         constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033';
  c_frag_leaf_b_id         constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000034'; -- protected DEMO-001
  c_frag_leaf_c_id         constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000035'; -- outcome-gated

  c_rev_root_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';
  c_rev_branch_a_id        constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000041';
  c_rev_branch_b_id        constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000042';
  c_rev_leaf_a_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000043';
  c_rev_leaf_b_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000044';
  c_rev_leaf_c_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000045';

  c_contributor_id         constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000050';
  c_consent_id             constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

  c_question_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000060';
  c_crossroads_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000070';
  c_option_a_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000071';
  c_option_b_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000072';

  c_amb_marsh_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000080';
  c_amb_urban_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000081';
  c_amb_zone_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000082';
  c_layer_marsh_bed_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000083';
  c_layer_marsh_os1_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000084';
  c_layer_marsh_os2_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000085';
  c_layer_urban_bed_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000086';
  c_layer_urban_os1_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000087';
  c_layer_urban_os2_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000088';

  c_music_zone_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000090';
  c_music_cue_default_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000091';
  c_music_cue_branch_id    constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000092';
  c_stem_def_base_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000093';
  c_stem_def_layer_id      constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000094';
  c_stem_br_base_id        constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000095';
  c_stem_br_layer_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000096';

  c_ui_cue_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0';

  c_asset_narr_root_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';
  c_asset_narr_ba_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000101';
  c_asset_narr_bb_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000102';
  c_asset_narr_la_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000103';
  c_asset_narr_lb_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000104';
  c_asset_narr_lc_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000105';
  c_asset_bed_marsh_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000110';
  c_asset_bed_urban_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000111';
  c_asset_os_marsh1_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000112';
  c_asset_os_marsh2_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000113';
  c_asset_os_urban1_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000114';
  c_asset_os_urban2_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000115';
  c_asset_stem_def_base_id constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000120';
  c_asset_stem_def_lyr_id  constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000121';
  c_asset_stem_br_base_id  constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000122';
  c_asset_stem_br_lyr_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000123';
  c_asset_hush_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000130';

  ---------------------------------------------------------------------------
  -- Demo Park geometry (fictional ~300 m × 300 m square)
  -- TODO(JoJo): placeholder coordinates — replace with a walkable public site
  ---------------------------------------------------------------------------
  c_park_lon      constant double precision := -111.9000;
  c_park_lat      constant double precision := 40.9000;
  c_park_half_deg constant double precision := 0.0015; -- ~150 m → ~300 m square

  v_park_poly       extensions.geography(Polygon, 4326);
  v_region_bounds   extensions.geography(Polygon, 4326);
  v_ambience_poly   extensions.geography(Polygon, 4326);
  v_music_poly      extensions.geography(Polygon, 4326);

  v_pt_root         extensions.geography(Point, 4326);
  v_pt_branch_a     extensions.geography(Point, 4326);
  v_pt_branch_b     extensions.geography(Point, 4326);
  v_pt_leaf_a       extensions.geography(Point, 4326);
  v_pt_leaf_b       extensions.geography(Point, 4326);
  v_pt_leaf_c       extensions.geography(Point, 4326);
begin
  -- Grove / Demo Park polygon (CCW ring)
  v_park_poly := extensions.ST_GeogFromText(format(
    'SRID=4326;POLYGON((%s %s,%s %s,%s %s,%s %s,%s %s))',
    c_park_lon - c_park_half_deg, c_park_lat - c_park_half_deg,
    c_park_lon + c_park_half_deg, c_park_lat - c_park_half_deg,
    c_park_lon + c_park_half_deg, c_park_lat + c_park_half_deg,
    c_park_lon - c_park_half_deg, c_park_lat + c_park_half_deg,
    c_park_lon - c_park_half_deg, c_park_lat - c_park_half_deg
  ));

  -- Region bounds: padded box around the demo park
  v_region_bounds := extensions.ST_GeogFromText(format(
    'SRID=4326;POLYGON((%s %s,%s %s,%s %s,%s %s,%s %s))',
    c_park_lon - 0.0200, c_park_lat - 0.0200,
    c_park_lon + 0.0200, c_park_lat - 0.0200,
    c_park_lon + 0.0200, c_park_lat + 0.0200,
    c_park_lon - 0.0200, c_park_lat + 0.0200,
    c_park_lon - 0.0200, c_park_lat - 0.0200
  ));

  -- Marsh ambience zone: slightly larger than the grove
  v_ambience_poly := extensions.ST_GeogFromText(format(
    'SRID=4326;POLYGON((%s %s,%s %s,%s %s,%s %s,%s %s))',
    c_park_lon - 0.0017, c_park_lat - 0.0017,
    c_park_lon + 0.0017, c_park_lat - 0.0017,
    c_park_lon + 0.0017, c_park_lat + 0.0017,
    c_park_lon - 0.0017, c_park_lat + 0.0017,
    c_park_lon - 0.0017, c_park_lat - 0.0017
  ));

  -- Music zone: shifted west so a walk can cross both zone edges
  v_music_poly := extensions.ST_GeogFromText(format(
    'SRID=4326;POLYGON((%s %s,%s %s,%s %s,%s %s,%s %s))',
    c_park_lon - 0.0020, c_park_lat - 0.0015,
    c_park_lon + 0.0010, c_park_lat - 0.0015,
    c_park_lon + 0.0010, c_park_lat + 0.0015,
    c_park_lon - 0.0020, c_park_lat + 0.0015,
    c_park_lon - 0.0020, c_park_lat - 0.0015
  ));

  -- Fragment points (all inside v_park_poly for fn_fragment_guard)
  v_pt_root     := extensions.ST_GeogFromText(format('SRID=4326;POINT(%s %s)', c_park_lon,          c_park_lat));
  v_pt_branch_a := extensions.ST_GeogFromText(format('SRID=4326;POINT(%s %s)', c_park_lon,          c_park_lat + 0.00050));
  v_pt_branch_b := extensions.ST_GeogFromText(format('SRID=4326;POINT(%s %s)', c_park_lon,          c_park_lat - 0.00050));
  v_pt_leaf_a   := extensions.ST_GeogFromText(format('SRID=4326;POINT(%s %s)', c_park_lon + 0.00050, c_park_lat + 0.00070));
  v_pt_leaf_b   := extensions.ST_GeogFromText(format('SRID=4326;POINT(%s %s)', c_park_lon - 0.00050, c_park_lat + 0.00070));
  v_pt_leaf_c   := extensions.ST_GeogFromText(format('SRID=4326;POINT(%s %s)', c_park_lon + 0.00050, c_park_lat - 0.00070));

  ---------------------------------------------------------------------------
  -- Region + sites
  ---------------------------------------------------------------------------
  insert into public.regions (id, slug, name, timezone, bounds, pack_version)
  values (
    c_region_id,
    'wasatch-front',
    'Wasatch Front',
    'America/Denver',
    v_region_bounds,
    0
  );

  insert into public.sites (id, region_id, slug, name) values
    (c_site_demo_id,  c_region_id, 'demo-park',            'Demo Park'),
    -- B7 placeholders for three real sites (draft content; no grove yet)
    -- TODO(JoJo): placeholder coordinates
    (c_site_ogden_id, c_region_id, 'ogden-nature-center',  'TODO: placeholder'),
    -- TODO(JoJo): placeholder coordinates
    (c_site_todo2_id, c_region_id, 'todo-site-2',          'TODO: placeholder'),
    -- TODO(JoJo): placeholder coordinates
    (c_site_todo3_id, c_region_id, 'todo-site-3',          'TODO: placeholder');

  insert into public.site_approvals (
    id, site_id, status, approved_by, scope,
    allows_speaker_wildlife_sounds, starts_on, expires_on
  ) values (
    c_site_approval_id,
    c_site_demo_id,
    'active',
    'seed',
    'Demo Park test grove — synthetic audio only',
    false,
    current_date - 30,
    null
  );

  insert into public.seed_terms (version, body, effective_at)
  values (
    1,
    '{"en":"Demo seed terms v1. Synthetic test content only."}'::jsonb,
    timestamptz '2020-01-01 00:00:00+00'
  );

  ---------------------------------------------------------------------------
  -- Contributor + consent (channels include app; consent_form rights)
  ---------------------------------------------------------------------------
  insert into public.contributors (
    id, display_credit, legal_name, contact_email, notes
  ) values (
    c_contributor_id,
    'Demo Narrator',
    'Demo Contributor (test)',
    'demo-contributor@example.invalid',
    'Synthetic seed contributor — not a real person'
  );

  insert into public.consents (
    id, contributor_id, status, channels, license_line, signed_on, expires_on
  ) values (
    c_consent_id,
    c_contributor_id,
    'active',
    array['app','archive']::text[],
    'Demo consent for synthetic test tones',
    current_date - 60,
    null
  );

  ---------------------------------------------------------------------------
  -- Audio assets (exact values from supabase/seed-media.json)
  ---------------------------------------------------------------------------
  insert into public.audio_assets (
    id, kind, sha256, ext, bytes, duration_ms, channels, sample_rate,
    loudness_lufs, loop_start_ms, loop_end_ms, title, tags, source, staging_path, is_public
  ) values
    -- narration (source original)
    (c_asset_narr_root_id, 'narration',
     '3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration root', '{}', 'original',
     'staging-audio/3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b.wav', false),
    (c_asset_narr_ba_id, 'narration',
     'a1a13dc4a469641c6304dc6bcadd323ad1a79c6a8ecb31c008b85b7973000ed9',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration branch A', '{}', 'original',
     'staging-audio/a1a13dc4a469641c6304dc6bcadd323ad1a79c6a8ecb31c008b85b7973000ed9.wav', false),
    (c_asset_narr_bb_id, 'narration',
     '8038bba56706193394e57d0253266b17a06a0abfec0c7687e6dacba39481cad2',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration branch B', '{}', 'original',
     'staging-audio/8038bba56706193394e57d0253266b17a06a0abfec0c7687e6dacba39481cad2.wav', false),
    (c_asset_narr_la_id, 'narration',
     '54deb5d22d1c7c78b66c977afea348a7c55f3e3a834b11878b8dc309cf102d80',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration leaf A', '{}', 'original',
     'staging-audio/54deb5d22d1c7c78b66c977afea348a7c55f3e3a834b11878b8dc309cf102d80.wav', false),
    (c_asset_narr_lb_id, 'narration',
     '0c2af2ec982be27376eba4bd5c00f849925e98bb639a94659a2725b5c1e61233',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration leaf B (protected)', '{}', 'original',
     'staging-audio/0c2af2ec982be27376eba4bd5c00f849925e98bb639a94659a2725b5c1e61233.wav', false),
    (c_asset_narr_lc_id, 'narration',
     '6e5140a3a332d60438ed93cca1db04729d9c54947091fe04e91ad827288ac334',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration leaf C (outcome-gated)', '{}', 'original',
     'staging-audio/6e5140a3a332d60438ed93cca1db04729d9c54947091fe04e91ad827288ac334.wav', false),
    -- sfx (source public_domain)
    (c_asset_bed_marsh_id, 'sfx_bed',
     'f384397cef9c76b20b004403e804768a5164cad7be43ca57c06b795c5933cac7',
     'wav', 352844, 4000, 2, 22050, -30, 0, 4000,
     'TEST tone — marsh bed', '{marsh,bed,test}', 'public_domain',
     'staging-audio/f384397cef9c76b20b004403e804768a5164cad7be43ca57c06b795c5933cac7.wav', false),
    (c_asset_bed_urban_id, 'sfx_bed',
     '11b23859a2dad1c63ae96a92f4879c85e29335cd509166aca4f0e0ed2ab32fd4',
     'wav', 352844, 4000, 2, 22050, -30, 0, 4000,
     'TEST tone — urban bed', '{urban,bed,test}', 'public_domain',
     'staging-audio/11b23859a2dad1c63ae96a92f4879c85e29335cd509166aca4f0e0ed2ab32fd4.wav', false),
    (c_asset_os_marsh1_id, 'sfx_oneshot',
     '41db393d34a899b59601eba2c417ee44aaba014a8a8b881995cb9dbca9354d4c',
     'wav', 26504, 300, 1, 44100, -24, null, null,
     'TEST tone — marsh oneshot 1', '{marsh,oneshot,test}', 'public_domain',
     'staging-audio/41db393d34a899b59601eba2c417ee44aaba014a8a8b881995cb9dbca9354d4c.wav', false),
    (c_asset_os_marsh2_id, 'sfx_oneshot',
     'c795fb1f891379fe7b95391b3e011046a64688080dd4ae30908ad490f37f1f22',
     'wav', 26504, 300, 1, 44100, -24, null, null,
     'TEST tone — marsh oneshot 2', '{marsh,oneshot,test}', 'public_domain',
     'staging-audio/c795fb1f891379fe7b95391b3e011046a64688080dd4ae30908ad490f37f1f22.wav', false),
    (c_asset_os_urban1_id, 'sfx_oneshot',
     '06c48420a1b8496c251b6ba888b4abe47ff96535f77fd244bc29634e6aa46e17',
     'wav', 22094, 250, 1, 44100, -24, null, null,
     'TEST tone — urban oneshot 1', '{urban,oneshot,test}', 'public_domain',
     'staging-audio/06c48420a1b8496c251b6ba888b4abe47ff96535f77fd244bc29634e6aa46e17.wav', false),
    (c_asset_os_urban2_id, 'sfx_oneshot',
     'fc64ad1de902bf9ac21c334de4917be4adf76337b5a0e16f503df2aa01e4030c',
     'wav', 22094, 250, 1, 44100, -24, null, null,
     'TEST tone — urban oneshot 2', '{urban,oneshot,test}', 'public_domain',
     'staging-audio/fc64ad1de902bf9ac21c334de4917be4adf76337b5a0e16f503df2aa01e4030c.wav', false),
    -- music stems (source original; equal duration/loop within each cue)
    (c_asset_stem_def_base_id, 'music_stem',
     '4e8d73245900da065ff33926c9d8d788bdb9bd35b565fbb1a394e0da4dad885d',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — default cue base stem', '{music,stem,test}', 'original',
     'staging-audio/4e8d73245900da065ff33926c9d8d788bdb9bd35b565fbb1a394e0da4dad885d.wav', false),
    (c_asset_stem_def_lyr_id, 'music_stem',
     'a3f19e59dfba06a1b42bc813cad4e24e4e07cfd166c11bf71cf519402a4ca9c9',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — default cue layer stem', '{music,stem,test}', 'original',
     'staging-audio/a3f19e59dfba06a1b42bc813cad4e24e4e07cfd166c11bf71cf519402a4ca9c9.wav', false),
    (c_asset_stem_br_base_id, 'music_stem',
     '21b7ceac2f101cc8ccccbbb8780b85360e3dfce4062c878fe07ac750ebb627be',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — branch-tier cue base stem', '{music,stem,test}', 'original',
     'staging-audio/21b7ceac2f101cc8ccccbbb8780b85360e3dfce4062c878fe07ac750ebb627be.wav', false),
    (c_asset_stem_br_lyr_id, 'music_stem',
     '64390d5a6288cfce700af7ab42cf206316fd13eba2289c348b8aa4e87683ab65',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — branch-tier cue layer stem', '{music,stem,test}', 'original',
     'staging-audio/64390d5a6288cfce700af7ab42cf206316fd13eba2289c348b8aa4e87683ab65.wav', false),
    -- voice cue (source original)
    (c_asset_hush_id, 'voice_cue',
     'ede986b4df84259e33113f8400e755cc2820eb8b91bb7ef9070769c65fbce9b1',
     'wav', 88244, 1000, 1, 44100, -18, null, null,
     'TEST tone — hush_listen en', '{hush,ui,test}', 'original',
     'staging-audio/ede986b4df84259e33113f8400e755cc2820eb8b91bb7ef9070769c65fbce9b1.wav', false);

  -- Rights: narration via consent_form; sfx cc0; music/voice owned
  insert into public.asset_rights (
    asset_id, license, contributor_id, consent_id, attribution, status
  ) values
    (c_asset_narr_root_id,    'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_ba_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_bb_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_la_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_lb_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_lc_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_bed_marsh_id,    'cc0',          null,             null,         null, 'active'),
    (c_asset_bed_urban_id,    'cc0',          null,             null,         null, 'active'),
    (c_asset_os_marsh1_id,    'cc0',          null,             null,         null, 'active'),
    (c_asset_os_marsh2_id,    'cc0',          null,             null,         null, 'active'),
    (c_asset_os_urban1_id,    'cc0',          null,             null,         null, 'active'),
    (c_asset_os_urban2_id,    'cc0',          null,             null,         null, 'active'),
    (c_asset_stem_def_base_id,'owned',        null,             null,         null, 'active'),
    (c_asset_stem_def_lyr_id, 'owned',        null,             null,         null, 'active'),
    (c_asset_stem_br_base_id, 'owned',        null,             null,         null, 'active'),
    (c_asset_stem_br_lyr_id,  'owned',        null,             null,         null, 'active'),
    (c_asset_hush_id,         'owned',        null,             null,         null, 'active');

  ---------------------------------------------------------------------------
  -- Grove + Ring 1 planting
  ---------------------------------------------------------------------------
  insert into public.groves (
    id, site_id, slug, name, premise, access_notes, boundary,
    status, pack_version, published_at
  ) values (
    c_grove_id,
    c_site_demo_id,
    'demo-park',
    '{"en":"Demo Park Grove"}'::jsonb,
    '{"en":"Synthetic test grove for M2 seed and pgTAP."}'::jsonb,
    '{"en":"Fictional park — not a real place."}'::jsonb,
    v_park_poly,
    'published',
    0,
    now()
  );

  insert into public.rings (
    id, grove_id, ring_no, name, theme_note, status,
    planting_opens_at, planting_closes_at
  ) values (
    c_ring1_id,
    c_grove_id,
    1,
    '{"en":"Ring 1 · Demo Planting"}'::jsonb,
    '{"en":"First demo ring — planting open for tests."}'::jsonb,
    'planting',
    now() - interval '7 days',
    now() + interval '90 days'
  );

  insert into public.characters (id, grove_id, name, bible, public_name, public_bio) values
    (c_char_a_id, c_grove_id, 'River',  'Internal bible: demo character A',
     '{"en":"River"}'::jsonb,  '{"en":"A demo character for tests."}'::jsonb),
    (c_char_b_id, c_grove_id, 'Keeper', 'Internal bible: demo character B',
     '{"en":"Keeper"}'::jsonb, '{"en":"Another demo character for tests."}'::jsonb);

  ---------------------------------------------------------------------------
  -- Fragments: 1 root, 2 branches (one unmarked), 3 leaves
  ---------------------------------------------------------------------------
  insert into public.fragments (
    id, grove_id, tier, parent_id, title, location, visibility,
    trigger_radius_m, marker_code, story_order, gap_hint,
    introduced_in_ring_id, status
  ) values
    (c_frag_root_id, c_grove_id, 'root', null,
     '{"en":"Demo Root"}'::jsonb, v_pt_root, 'marked',
     40, null, 1, '{"en":"Begin near the open center."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag_branch_a_id, c_grove_id, 'branch', c_frag_root_id,
     '{"en":"Demo Branch A"}'::jsonb, v_pt_branch_a, 'marked',
     30, null, 2, '{"en":"A marked path north of center."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag_branch_b_id, c_grove_id, 'branch', c_frag_root_id,
     '{"en":"Demo Branch B (unmarked)"}'::jsonb, v_pt_branch_b, 'unmarked',
     30, null, 3, '{"en":"An unmarked stretch south of center."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag_leaf_a_id, c_grove_id, 'leaf', c_frag_branch_a_id,
     '{"en":"Demo Leaf A"}'::jsonb, v_pt_leaf_a, 'marked',
     25, null, 4, '{"en":"A short leaf to the northeast."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag_leaf_b_id, c_grove_id, 'leaf', c_frag_branch_a_id,
     '{"en":"Demo Leaf B (protected)"}'::jsonb, v_pt_leaf_b, 'protected',
     25, 'DEMO-001', 5, '{"en":"A protected leaf — marker required."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag_leaf_c_id, c_grove_id, 'leaf', c_frag_branch_b_id,
     '{"en":"Demo Leaf C (outcome-gated)"}'::jsonb, v_pt_leaf_c, 'marked',
     25, null, 6, '{"en":"Waits on a crossroads outcome."}'::jsonb,
     c_ring1_id, 'published');

  insert into public.fragment_characters (fragment_id, character_id, introduces) values
    (c_frag_root_id,     c_char_a_id, true),
    (c_frag_branch_a_id, c_char_b_id, true);

  ---------------------------------------------------------------------------
  -- Question + open crossroads (anchored on branch A) with 2 options
  ---------------------------------------------------------------------------
  insert into public.questions (
    id, grove_id, ring_id, text, anchor_fragment_id, anchor_character_id,
    requires_heard, opens_at, closes_at, status
  ) values (
    c_question_id,
    c_grove_id,
    c_ring1_id,
    '{"en":"What did you notice near the marked path?"}'::jsonb,
    c_frag_branch_a_id,
    c_char_a_id,
    true,
    now() - interval '1 day',
    now() + interval '60 days',
    'published'
  );

  insert into public.crossroads (
    id, grove_id, ring_id, anchor_fragment_id, prompt,
    vote_radius_m, opens_at, closes_at, status
  ) values (
    c_crossroads_id,
    c_grove_id,
    c_ring1_id,
    c_frag_branch_a_id,
    '{"en":"Which way should the story lean next?"}'::jsonb,
    75,
    now() - interval '1 day',
    now() + interval '30 days',
    'open'
  );

  insert into public.crossroads_options (id, crossroads_id, label, description, sort_order) values
    (c_option_a_id, c_crossroads_id,
     '{"en":"Toward the reeds"}'::jsonb,
     '{"en":"Demo option A — outcome for leaf C."}'::jsonb, 0),
    (c_option_b_id, c_crossroads_id,
     '{"en":"Toward the path"}'::jsonb,
     '{"en":"Demo option B."}'::jsonb, 1);

  ---------------------------------------------------------------------------
  -- Published revisions (+ outcome-gated leaf C still not playable while open)
  ---------------------------------------------------------------------------
  insert into public.fragment_revisions (
    id, fragment_id, revision_no, ring_id, status, publish_at,
    requires_outcome_option_id, content_note
  ) values
    (c_rev_root_id,     c_frag_root_id,     1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Root r1"}'::jsonb),
    (c_rev_branch_a_id, c_frag_branch_a_id, 1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Branch A r1"}'::jsonb),
    (c_rev_branch_b_id, c_frag_branch_b_id, 1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Branch B r1"}'::jsonb),
    (c_rev_leaf_a_id,   c_frag_leaf_a_id,   1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Leaf A r1"}'::jsonb),
    (c_rev_leaf_b_id,   c_frag_leaf_b_id,   1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Leaf B r1 protected"}'::jsonb),
    (c_rev_leaf_c_id,   c_frag_leaf_c_id,   1, c_ring1_id, 'published', now() - interval '1 day', c_option_a_id, '{"en":"Leaf C r1 waits on option A"}'::jsonb);

  insert into public.revision_versions (
    revision_id, language, narration_asset_id, transcript
  ) values
    (c_rev_root_id,     'en', c_asset_narr_root_id, 'TEST transcript — demo root narration tone.'),
    (c_rev_branch_a_id, 'en', c_asset_narr_ba_id,   'TEST transcript — demo branch A narration tone.'),
    (c_rev_branch_b_id, 'en', c_asset_narr_bb_id,   'TEST transcript — demo branch B narration tone.'),
    (c_rev_leaf_a_id,   'en', c_asset_narr_la_id,   'TEST transcript — demo leaf A narration tone.'),
    (c_rev_leaf_b_id,   'en', c_asset_narr_lb_id,   'TEST transcript — demo leaf B protected narration tone.'),
    (c_rev_leaf_c_id,   'en', c_asset_narr_lc_id,   'TEST transcript — demo leaf C outcome-gated narration tone.');

  insert into public.revision_contributors (
    revision_id, contributor_id, role, consent_id
  ) values
    (c_rev_root_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_branch_a_id, c_contributor_id, 'narrator', c_consent_id),
    (c_rev_branch_b_id, c_contributor_id, 'narrator', c_consent_id),
    (c_rev_leaf_a_id,   c_contributor_id, 'narrator', c_consent_id),
    (c_rev_leaf_b_id,   c_contributor_id, 'narrator', c_consent_id),
    (c_rev_leaf_c_id,   c_contributor_id, 'narrator', c_consent_id);

  ---------------------------------------------------------------------------
  -- Ambience: Marsh + Urban profiles (bed + 2 oneshots each); marsh zone
  ---------------------------------------------------------------------------
  insert into public.ambience_profiles (id, region_id, slug, name, description, density) values
    (c_amb_marsh_id, c_region_id, 'marsh', 'Marsh',
     'Demo marsh palette — synthetic tones only', 1.0),
    (c_amb_urban_id, c_region_id, 'urban', 'Urban',
     'Demo urban palette — synthetic tones only', 1.0);

  insert into public.ambience_layers (
    id, profile_id, name, kind,
    gain_db_min, gain_db_max, mean_interval_s, min_interval_s,
    max_concurrent, crossfade_ms, speaker_safe, wildlife_call
  ) values
    (c_layer_marsh_bed_id, c_amb_marsh_id, 'Marsh bed', 'bed',
     -24, -16, null, null, 1, 4000, true, false),
    (c_layer_marsh_os1_id, c_amb_marsh_id, 'Marsh oneshot A', 'oneshot',
     -20, -12, 14, 5, 2, 4000, true, false),
    (c_layer_marsh_os2_id, c_amb_marsh_id, 'Marsh oneshot B', 'oneshot',
     -20, -12, 18, 6, 2, 4000, true, false),
    (c_layer_urban_bed_id, c_amb_urban_id, 'Urban bed', 'bed',
     -24, -16, null, null, 1, 4000, true, false),
    (c_layer_urban_os1_id, c_amb_urban_id, 'Urban oneshot A', 'oneshot',
     -20, -12, 12, 4, 2, 4000, true, false),
    (c_layer_urban_os2_id, c_amb_urban_id, 'Urban oneshot B', 'oneshot',
     -20, -12, 16, 5, 2, 4000, true, false);

  insert into public.ambience_layer_assets (layer_id, asset_id, weight) values
    (c_layer_marsh_bed_id, c_asset_bed_marsh_id, 1.0),
    (c_layer_marsh_os1_id, c_asset_os_marsh1_id, 1.0),
    (c_layer_marsh_os2_id, c_asset_os_marsh2_id, 1.0),
    (c_layer_urban_bed_id, c_asset_bed_urban_id, 1.0),
    (c_layer_urban_os1_id, c_asset_os_urban1_id, 1.0),
    (c_layer_urban_os2_id, c_asset_os_urban2_id, 1.0);

  insert into public.ambience_zones (
    id, region_id, name, boundary, profile_id, priority, edge_fade_m, status
  ) values (
    c_amb_zone_id,
    c_region_id,
    'Demo Park marsh zone',
    v_ambience_poly,
    c_amb_marsh_id,
    100,
    40,
    'published'
  );

  ---------------------------------------------------------------------------
  -- Music zone + 2 cues (default; tiers branch) each with base+layer stems
  ---------------------------------------------------------------------------
  insert into public.music_zones (
    id, region_id, name, boundary, priority, edge_fade_m, status
  ) values (
    c_music_zone_id,
    c_region_id,
    'Demo Park music zone',
    v_music_poly,
    100,
    60,
    'published'
  );

  insert into public.music_cues (
    id, name, music_zone_id, grove_id, priority, conditions,
    min_dwell_s, crossfade_ms, status
  ) values
    (c_music_cue_default_id, 'Demo default cue',
     c_music_zone_id, null, 50, '{}'::jsonb, 45, 6000, 'published'),
    (c_music_cue_branch_id, 'Demo branch-tier cue',
     c_music_zone_id, null, 80, '{"tiers":["branch"]}'::jsonb, 45, 6000, 'published');

  insert into public.music_cue_stems (
    id, cue_id, asset_id, role, gain_db, state_gains
  ) values
    (c_stem_def_base_id,  c_music_cue_default_id, c_asset_stem_def_base_id, 'base',  0, '[]'::jsonb),
    (c_stem_def_layer_id, c_music_cue_default_id, c_asset_stem_def_lyr_id,  'layer', -3, '[]'::jsonb),
    (c_stem_br_base_id,   c_music_cue_branch_id,  c_asset_stem_br_base_id,  'base',  0, '[]'::jsonb),
    (c_stem_br_layer_id,  c_music_cue_branch_id,  c_asset_stem_br_lyr_id,   'layer', -3, '[]'::jsonb);

  ---------------------------------------------------------------------------
  -- UI cue: published hush_listen en
  ---------------------------------------------------------------------------
  insert into public.ui_cues (
    id, region_id, key, language, asset_id, status
  ) values (
    c_ui_cue_id,
    c_region_id,
    'hush_listen',
    'en',
    c_asset_hush_id,
    'published'
  );

  ---------------------------------------------------------------------------
  -- Landcover fixture (NLCD codes → profiles; placeholder grid path)
  ---------------------------------------------------------------------------
  insert into public.landcover_classes (code, name, profile_id) values
    (11, 'Open Water',              c_amb_marsh_id),
    (21, 'Developed, Open Space',   c_amb_urban_id),
    (22, 'Developed, Low Intensity',c_amb_urban_id),
    (90, 'Woody Wetlands',          c_amb_marsh_id),
    (95, 'Emergent Herbaceous Wetlands', c_amb_marsh_id);

  insert into public.landcover_grids (
    region_id, h3_resolution, source, file_path, version, generated_at
  ) values (
    c_region_id,
    9,
    'NLCD fixture (placeholder)',
    'public-media/landcover/wasatch-front/0.bin',
    0,
    timestamptz '1970-01-01 00:00:00+00'
  );
end;
$seed$;
