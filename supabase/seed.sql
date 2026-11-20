-- M2a demo seed (DATA_MODEL §15 + ADR 0003 + Farmington fixture).
-- Geometry comes from supabase/seed-geometry.sql (sql_paths runs it first).
-- Synthetic test tones only — never real stories or wildlife recordings.
-- Audio metadata must match supabase/seed-media.json exactly (C23).

-- Helper: one prerequisite group + its OR members (ANY member satisfies the group).
create or replace function pg_temp.add_prereq_group(
  p_id uuid,
  p_fragment_id uuid,
  p_sort_order int,
  p_members uuid[]
) returns void
language plpgsql
as $$
declare
  i int;
begin
  insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
  values (p_id, p_fragment_id, p_sort_order);

  for i in 1 .. coalesce(array_length(p_members, 1), 0) loop
    insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values (p_id, p_members[i], i - 1);
  end loop;
end;
$$;

do $seed$
declare
  ---------------------------------------------------------------------------
  -- Fixed UUIDs (RFC 4122 v4-shaped) for pgTAP / pack tests
  -- Pattern: aaaaaaaa-bbbb-4ccc-8ddd-0000000000NN
  ---------------------------------------------------------------------------
  c_region_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
  c_site_demo_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';
  c_site_todo2_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003';
  c_site_todo3_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000004';
  c_site_approval_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000006';

  c_grove_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
  c_ring1_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000011';

  c_char_a_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';
  c_char_b_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000021';

  c_frag1_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';
  c_frag2_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031';
  c_frag3_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000032';
  c_frag4_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033';
  c_frag5_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000034';
  c_frag6_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000035'; -- Root End
  c_frag7_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036';
  c_frag8_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000037'; -- unmarked
  c_frag9_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'; -- protected DEMO-001
  c_frag10_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000039';

  c_rev_f1_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';
  c_rev_f2_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000041';
  c_rev_f3_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000042';
  c_rev_f4_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000043';
  c_rev_f5_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000044';
  c_rev_f6_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000045';
  c_rev_f7_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000046';
  c_rev_f8_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000047';
  c_rev_f9_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000048';
  c_rev_f10_r1_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000049';
  c_rev_f10_r2_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000004a'; -- outcome-gated

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

  -- Prerequisite group ids (14 groups)
  c_pg_f2_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b0';
  c_pg_f3_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b1';
  c_pg_f4_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b2';
  c_pg_f5_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b3';
  c_pg_f5_1                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b4';
  c_pg_f6_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b5';
  c_pg_f6_1                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b6';
  c_pg_f6_2                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b7';
  c_pg_f6_3                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b8';
  c_pg_f6_4                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000b9';
  c_pg_f7_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000ba';
  c_pg_f8_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000bb';
  c_pg_f9_0                constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000bc';
  c_pg_f10_0               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000bd';

  c_asset_narr_f1_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';
  c_asset_narr_f2_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000101';
  c_asset_narr_f3_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000102';
  c_asset_narr_f4_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000103';
  c_asset_narr_f5_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000104';
  c_asset_narr_f6_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000105';
  c_asset_narr_f7_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000106';
  c_asset_narr_f8_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000107';
  c_asset_narr_f9_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000108';
  c_asset_narr_f10_id      constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000109';
  c_asset_narr_f10_r2_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000010a';
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
  -- Geometry from public._seed_geometry (Farmington Bird Refuge fixture)
  ---------------------------------------------------------------------------
  v_grove_boundary  extensions.geography(Polygon, 4326);
  v_region_bounds   extensions.geography(Polygon, 4326);
  v_ambience_poly   extensions.geography(Polygon, 4326);
  v_music_poly      extensions.geography(Polygon, 4326);

  v_pt_frag1        extensions.geography(Point, 4326);
  v_pt_frag2        extensions.geography(Point, 4326);
  v_pt_frag3        extensions.geography(Point, 4326);
  v_pt_frag4        extensions.geography(Point, 4326);
  v_pt_frag5        extensions.geography(Point, 4326);
  v_pt_frag6        extensions.geography(Point, 4326);
  v_pt_frag7        extensions.geography(Point, 4326);
  v_pt_frag8        extensions.geography(Point, 4326);
  v_pt_frag9        extensions.geography(Point, 4326);
  v_pt_frag10       extensions.geography(Point, 4326);
begin
  select geog into strict v_grove_boundary from public._seed_geometry where key = 'grove_boundary';
  select geog into strict v_region_bounds  from public._seed_geometry where key = 'region_bounds';
  select geog into strict v_ambience_poly  from public._seed_geometry where key = 'ambience_marsh';
  select geog into strict v_music_poly     from public._seed_geometry where key = 'music_zone';

  select geog into strict v_pt_frag1  from public._seed_geometry where key = 'frag1';
  select geog into strict v_pt_frag2  from public._seed_geometry where key = 'frag2';
  select geog into strict v_pt_frag3  from public._seed_geometry where key = 'frag3';
  select geog into strict v_pt_frag4  from public._seed_geometry where key = 'frag4';
  select geog into strict v_pt_frag5  from public._seed_geometry where key = 'frag5';
  select geog into strict v_pt_frag6  from public._seed_geometry where key = 'frag6';
  select geog into strict v_pt_frag7  from public._seed_geometry where key = 'frag7';
  select geog into strict v_pt_frag8  from public._seed_geometry where key = 'frag8';
  select geog into strict v_pt_frag9  from public._seed_geometry where key = 'frag9';
  select geog into strict v_pt_frag10 from public._seed_geometry where key = 'frag10';

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
    (c_site_demo_id,  c_region_id, 'farmington-bird-refuge', 'Farmington Bird Refuge'),
    -- B7 placeholders (draft content; no grove yet)
    -- TODO(JoJo): placeholder coordinates
    (c_site_todo2_id, c_region_id, 'todo-site-2',            'TODO: placeholder'),
    -- TODO(JoJo): placeholder coordinates
    (c_site_todo3_id, c_region_id, 'todo-site-3',            'TODO: placeholder');

  insert into public.site_approvals (
    id, site_id, status, approved_by, scope,
    allows_speaker_wildlife_sounds, starts_on, expires_on
  ) values (
    c_site_approval_id,
    c_site_demo_id,
    'active',
    'seed',
    'FIXTURE: Farmington Bird Refuge test grove from supabase/fixtures/farmington-bird-refuge.json — synthetic audio only',
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
    (c_asset_narr_f1_id, 'narration',
     '3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag1', '{}', 'original',
     'staging-audio/3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b.wav', false),
    (c_asset_narr_f2_id, 'narration',
     '70f1e568e7c75e66b93ef5963d048761e111333e1f67becb5663c766f74c2ae7',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag2', '{}', 'original',
     'staging-audio/70f1e568e7c75e66b93ef5963d048761e111333e1f67becb5663c766f74c2ae7.wav', false),
    (c_asset_narr_f3_id, 'narration',
     'd3a8ae92d84c428d70cda57916fc6597fbae5b5953953fb2679b7f54833155a3',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag3', '{}', 'original',
     'staging-audio/d3a8ae92d84c428d70cda57916fc6597fbae5b5953953fb2679b7f54833155a3.wav', false),
    (c_asset_narr_f4_id, 'narration',
     '56bf2aee6f44f93dacfad0bbb51b522b0becad55d0a3aa01108f9f6fc8440b59',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag4', '{}', 'original',
     'staging-audio/56bf2aee6f44f93dacfad0bbb51b522b0becad55d0a3aa01108f9f6fc8440b59.wav', false),
    (c_asset_narr_f5_id, 'narration',
     'c7474307853655023e674929b79ee85253523e5f5996e36c6e02c0550a1ce586',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag5', '{}', 'original',
     'staging-audio/c7474307853655023e674929b79ee85253523e5f5996e36c6e02c0550a1ce586.wav', false),
    (c_asset_narr_f6_id, 'narration',
     '8979653040ba033d7fb66c8a178b6c2572fbb7a814f9ed0ec68485e2cad72b02',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag6', '{}', 'original',
     'staging-audio/8979653040ba033d7fb66c8a178b6c2572fbb7a814f9ed0ec68485e2cad72b02.wav', false),
    (c_asset_narr_f7_id, 'narration',
     '6ff8280f32a08dcb5b7b39dd4f9f3a96ffd74b85f14aae2af985a04fa2186efe',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag7', '{}', 'original',
     'staging-audio/6ff8280f32a08dcb5b7b39dd4f9f3a96ffd74b85f14aae2af985a04fa2186efe.wav', false),
    (c_asset_narr_f8_id, 'narration',
     '430feddba090436faf8c6f7e3a986c0b76c309b523533ba8011aa4a4db8af217',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag8', '{}', 'original',
     'staging-audio/430feddba090436faf8c6f7e3a986c0b76c309b523533ba8011aa4a4db8af217.wav', false),
    (c_asset_narr_f9_id, 'narration',
     'c7ab860a7db67c8d298af3b2758291499acbcf5cb520f3dbb66bb17b3aa50f1e',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag9 (protected)', '{}', 'original',
     'staging-audio/c7ab860a7db67c8d298af3b2758291499acbcf5cb520f3dbb66bb17b3aa50f1e.wav', false),
    (c_asset_narr_f10_id, 'narration',
     '591dcfcbff07cdcfceba48237625356e529f431fbbdf29c4c9277ac7950e0add',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag10 rev1', '{}', 'original',
     'staging-audio/591dcfcbff07cdcfceba48237625356e529f431fbbdf29c4c9277ac7950e0add.wav', false),
    (c_asset_narr_f10_r2_id, 'narration',
     '95dcd251db2dcf2d076697a32b5be1ae3d3a47bc68dfcff67583daf34426fba1',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag10 rev2 (outcome-gated)', '{}', 'original',
     'staging-audio/95dcd251db2dcf2d076697a32b5be1ae3d3a47bc68dfcff67583daf34426fba1.wav', false),
    -- sfx (source public_domain; license cc0)
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
    (c_asset_narr_f1_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f2_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f3_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f4_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f5_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f6_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f7_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f8_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f9_id,      'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f10_id,     'consent_form', c_contributor_id, c_consent_id, null, 'active'),
    (c_asset_narr_f10_r2_id,  'consent_form', c_contributor_id, c_consent_id, null, 'active'),
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
    'demo',
    '{"en":"Farmington Bird Refuge Grove"}'::jsonb,
    '{"en":"Synthetic test grove for M2a seed and pgTAP (Farmington fixture)."}'::jsonb,
    '{"en":"Test content at Farmington Bird Refuge — synthetic audio only."}'::jsonb,
    v_grove_boundary,
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
  -- Fragments 1–10 (ADR 0003: no parent_id; exact fixture names/tiers/radii)
  ---------------------------------------------------------------------------
  insert into public.fragments (
    id, grove_id, tier, is_ending, title, location, visibility,
    trigger_radius_m, marker_code, story_order, gap_hint,
    introduced_in_ring_id, status
  ) values
    (c_frag1_id, c_grove_id, 'root', false,
     '{"en":"Beginning"}'::jsonb, v_pt_frag1, 'marked',
     30, null, 1, '{"en":"Begin near the refuge entrance."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag2_id, c_grove_id, 'branch', false,
     '{"en":"Buildings 1"}'::jsonb, v_pt_frag2, 'marked',
     25, null, 2, '{"en":"Near the education-center buildings."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag3_id, c_grove_id, 'branch', false,
     '{"en":"Buildings 2"}'::jsonb, v_pt_frag3, 'marked',
     25, null, 3, '{"en":"Another stretch by the buildings."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag4_id, c_grove_id, 'leaf', false,
     '{"en":"Parking Lot 1"}'::jsonb, v_pt_frag4, 'marked',
     20, null, 4, '{"en":"A short leaf by the parking lot."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag5_id, c_grove_id, 'leaf', false,
     '{"en":"Parking Lot 2"}'::jsonb, v_pt_frag5, 'marked',
     20, null, 5, '{"en":"AND-test leaf — needs Buildings 1 and 2."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag6_id, c_grove_id, 'root', true,
     '{"en":"Ending"}'::jsonb, v_pt_frag6, 'marked',
     30, null, 6, '{"en":"Root End — same point as Beginning."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag7_id, c_grove_id, 'root', false,
     '{"en":"Pond"}'::jsonb, v_pt_frag7, 'marked',
     30, null, 7, '{"en":"Gated Root Start after the ending."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag8_id, c_grove_id, 'branch', false,
     '{"en":"Heron Overlook"}'::jsonb, v_pt_frag8, 'unmarked',
     25, null, 8, '{"en":"An unmarked overlook on the marsh loop."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag9_id, c_grove_id, 'leaf', false,
     '{"en":"Hidden Post"}'::jsonb, v_pt_frag9, 'protected',
     20, 'DEMO-001', 9, '{"en":"Protected — marker required."}'::jsonb,
     c_ring1_id, 'published'),
    (c_frag10_id, c_grove_id, 'leaf', false,
     '{"en":"Two Ways"}'::jsonb, v_pt_frag10, 'marked',
     20, null, 10, '{"en":"OR-test leaf; rev2 waits on a crossroads."}'::jsonb,
     c_ring1_id, 'published');

  insert into public.fragment_characters (fragment_id, character_id, introduces) values
    (c_frag1_id, c_char_a_id, true),
    (c_frag2_id, c_char_b_id, true);

  ---------------------------------------------------------------------------
  -- Prerequisites (AND of OR groups) — fixture requires[] exactly
  ---------------------------------------------------------------------------
  -- frag1: none
  perform pg_temp.add_prereq_group(c_pg_f2_0,  c_frag2_id,  0, array[c_frag1_id]);
  perform pg_temp.add_prereq_group(c_pg_f3_0,  c_frag3_id,  0, array[c_frag1_id]);
  perform pg_temp.add_prereq_group(c_pg_f4_0,  c_frag4_id,  0, array[c_frag2_id]);
  perform pg_temp.add_prereq_group(c_pg_f5_0,  c_frag5_id,  0, array[c_frag2_id]);
  perform pg_temp.add_prereq_group(c_pg_f5_1,  c_frag5_id,  1, array[c_frag3_id]);
  perform pg_temp.add_prereq_group(c_pg_f6_0,  c_frag6_id,  0, array[c_frag1_id]);
  perform pg_temp.add_prereq_group(c_pg_f6_1,  c_frag6_id,  1, array[c_frag2_id]);
  perform pg_temp.add_prereq_group(c_pg_f6_2,  c_frag6_id,  2, array[c_frag3_id]);
  perform pg_temp.add_prereq_group(c_pg_f6_3,  c_frag6_id,  3, array[c_frag4_id]);
  perform pg_temp.add_prereq_group(c_pg_f6_4,  c_frag6_id,  4, array[c_frag5_id]);
  perform pg_temp.add_prereq_group(c_pg_f7_0,  c_frag7_id,  0, array[c_frag6_id]);
  perform pg_temp.add_prereq_group(c_pg_f8_0,  c_frag8_id,  0, array[c_frag7_id]);
  perform pg_temp.add_prereq_group(c_pg_f9_0,  c_frag9_id,  0, array[c_frag8_id]);
  perform pg_temp.add_prereq_group(c_pg_f10_0, c_frag10_id, 0, array[c_frag8_id, c_frag9_id]);

  ---------------------------------------------------------------------------
  -- Question + open crossroads (anchored on frag2) with 2 options
  ---------------------------------------------------------------------------
  insert into public.questions (
    id, grove_id, ring_id, text, anchor_fragment_id, anchor_character_id,
    requires_heard, opens_at, closes_at, status
  ) values (
    c_question_id,
    c_grove_id,
    c_ring1_id,
    '{"en":"What did you notice near the buildings?"}'::jsonb,
    c_frag2_id,
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
    c_frag2_id,
    '{"en":"Which way should the story lean next?"}'::jsonb,
    75,
    now() - interval '1 day',
    now() + interval '30 days',
    'open'
  );

  insert into public.crossroads_options (id, crossroads_id, label, description, sort_order) values
    (c_option_a_id, c_crossroads_id,
     '{"en":"Toward the reeds"}'::jsonb,
     '{"en":"Demo option A — outcome for frag10 revision 2."}'::jsonb, 0),
    (c_option_b_id, c_crossroads_id,
     '{"en":"Toward the path"}'::jsonb,
     '{"en":"Demo option B."}'::jsonb, 1);

  ---------------------------------------------------------------------------
  -- Published revisions (rev1 for all; frag10 also rev2, outcome-gated)
  ---------------------------------------------------------------------------
  insert into public.fragment_revisions (
    id, fragment_id, revision_no, ring_id, status, publish_at,
    requires_outcome_option_id, content_note
  ) values
    (c_rev_f1_id,     c_frag1_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag1 r1"}'::jsonb),
    (c_rev_f2_id,     c_frag2_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag2 r1"}'::jsonb),
    (c_rev_f3_id,     c_frag3_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag3 r1"}'::jsonb),
    (c_rev_f4_id,     c_frag4_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag4 r1"}'::jsonb),
    (c_rev_f5_id,     c_frag5_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag5 r1"}'::jsonb),
    (c_rev_f6_id,     c_frag6_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag6 r1 Ending"}'::jsonb),
    (c_rev_f7_id,     c_frag7_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag7 r1 Pond"}'::jsonb),
    (c_rev_f8_id,     c_frag8_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag8 r1 unmarked"}'::jsonb),
    (c_rev_f9_id,     c_frag9_id,  1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag9 r1 protected"}'::jsonb),
    (c_rev_f10_r1_id, c_frag10_id, 1, c_ring1_id, 'published', now() - interval '1 day', null,          '{"en":"Frag10 r1"}'::jsonb),
    (c_rev_f10_r2_id, c_frag10_id, 2, c_ring1_id, 'published', now() - interval '1 day', c_option_a_id, '{"en":"Frag10 r2 waits on option A"}'::jsonb);

  insert into public.revision_versions (
    revision_id, language, narration_asset_id, transcript
  ) values
    (c_rev_f1_id,     'en', c_asset_narr_f1_id,     'TEST transcript — frag1 Beginning narration tone.'),
    (c_rev_f2_id,     'en', c_asset_narr_f2_id,     'TEST transcript — frag2 Buildings 1 narration tone.'),
    (c_rev_f3_id,     'en', c_asset_narr_f3_id,     'TEST transcript — frag3 Buildings 2 narration tone.'),
    (c_rev_f4_id,     'en', c_asset_narr_f4_id,     'TEST transcript — frag4 Parking Lot 1 narration tone.'),
    (c_rev_f5_id,     'en', c_asset_narr_f5_id,     'TEST transcript — frag5 Parking Lot 2 narration tone.'),
    (c_rev_f6_id,     'en', c_asset_narr_f6_id,     'TEST transcript — frag6 Ending narration tone.'),
    (c_rev_f7_id,     'en', c_asset_narr_f7_id,     'TEST transcript — frag7 Pond narration tone.'),
    (c_rev_f8_id,     'en', c_asset_narr_f8_id,     'TEST transcript — frag8 Heron Overlook narration tone.'),
    (c_rev_f9_id,     'en', c_asset_narr_f9_id,     'TEST transcript — frag9 Hidden Post protected narration tone.'),
    (c_rev_f10_r1_id, 'en', c_asset_narr_f10_id,    'TEST transcript — frag10 Two Ways rev1 narration tone.'),
    (c_rev_f10_r2_id, 'en', c_asset_narr_f10_r2_id, 'TEST transcript — frag10 Two Ways rev2 outcome-gated narration tone.');

  insert into public.revision_contributors (
    revision_id, contributor_id, role, consent_id
  ) values
    (c_rev_f1_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f2_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f3_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f4_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f5_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f6_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f7_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f8_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f9_id,     c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f10_r1_id, c_contributor_id, 'narrator', c_consent_id),
    (c_rev_f10_r2_id, c_contributor_id, 'narrator', c_consent_id);

  ---------------------------------------------------------------------------
  -- Ambience: Marsh + Urban profiles (bed + 2 oneshots each); marsh zone = grove
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
    'Farmington marsh zone',
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
    'Farmington music zone',
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

  -- Geometry helper table is only for this seed pass.
  drop table if exists public._seed_geometry;
end;
$seed$;
