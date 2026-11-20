-- M3a demo seed (DATA_MODEL §15 + M3a-plan §9 + review A25 / C4 / R5).
-- Geometry from supabase/seed-geometry.sql (sql_paths runs it first).
-- Synthetic test tones only — never real stories or wildlife recordings.
-- Audio metadata must match supabase/seed-media.json exactly.
--
-- C4 stable UUIDs (pack-integration DEMO / pgTAP):
--   region ............... aaaaaaaa-bbbb-4ccc-8ddd-000000000001
--   farmington grove ..... aaaaaaaa-bbbb-4ccc-8ddd-000000000010
--   frag4 ................ aaaaaaaa-bbbb-4ccc-8ddd-000000000033
--   frag8 ................ aaaaaaaa-bbbb-4ccc-8ddd-000000000037  (standard, Day-only versions)
--   frag9 ................ aaaaaaaa-bbbb-4ccc-8ddd-000000000038  (physical DEMO-001)
--   frag10 ............... aaaaaaaa-bbbb-4ccc-8ddd-000000000039
--   frag4 rev1 ........... aaaaaaaa-bbbb-4ccc-8ddd-000000000043
--   frag4 rev2 correction  aaaaaaaa-bbbb-4ccc-8ddd-00000000004b
--   frag8 rev1 ........... aaaaaaaa-bbbb-4ccc-8ddd-000000000047
--   frag9 rev1 ........... aaaaaaaa-bbbb-4ccc-8ddd-000000000048
--   frag10 rev1 .......... aaaaaaaa-bbbb-4ccc-8ddd-000000000049
--   frag10 rev2 contingency aaaaaaaa-bbbb-4ccc-8ddd-00000000004a
--   second grove ......... aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0
--   bridge fragment ...... aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1
--   second-grove frag2 ... aaaaaaaa-bbbb-4ccc-8ddd-0000000000c2
--   published release .... aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0
--   draft release ........ aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1
--
-- Portrait image_assets use deterministic placeholder shas; tools/seed-media-upload.mjs
-- uploads the matching 1×1 PNGs to staging-images after db reset.

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
  ---------------------------------------------------------------------------
  c_region_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';

  c_grove_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
  c_grove_ogden_id         constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';
  c_grove_pia_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003';
  c_grove2_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0';

  c_thread_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000016';

  c_char_a_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';
  c_char_b_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000021';
  c_portrait_a_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';
  c_portrait_b_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000141';

  c_frag1_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';
  c_frag2_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031';
  c_frag3_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000032';
  c_frag4_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033';
  c_frag5_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000034';
  c_frag6_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000035';
  c_frag7_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036';
  c_frag8_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000037';
  c_frag9_id               constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';
  c_frag10_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000039';

  c_g2_frag1_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1';
  c_g2_frag2_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c2';

  c_rev_f1_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';
  c_rev_f2_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000041';
  c_rev_f3_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000042';
  c_rev_f4_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000043';
  c_rev_f4b_id             constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000004b';
  c_rev_f5_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000044';
  c_rev_f6_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000045';
  c_rev_f7_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000046';
  c_rev_f8_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000047';
  c_rev_f9_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000048';
  c_rev_f10_r1_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000049';
  c_rev_f10_r2_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000004a';
  c_rev_g2_f1_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000d0';
  c_rev_g2_f2_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000d1';

  c_question_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000060';

  c_release_published_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0';
  c_release_draft_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1';

  c_amb_marsh_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000080';
  c_amb_urban_id           constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000081';
  c_amb_zone_id            constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000082';
  c_layer_marsh_bed_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000083';
  c_layer_marsh_os1_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000084';
  c_layer_marsh_os2_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000085';
  c_layer_urban_bed_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000086';
  c_layer_urban_os1_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000087';
  c_layer_urban_os2_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000088';
  c_layer_marsh_bed_n_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000008d';
  c_layer_marsh_os1_n_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000008e';
  c_layer_marsh_os2_n_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000008f';
  c_layer_urban_bed_n_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000008c';
  c_layer_urban_os1_n_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000093';
  c_layer_urban_os2_n_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000094';

  c_music_zone_id          constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000090';
  c_music_cue_def_day_id   constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000091';
  c_music_cue_br_day_id    constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000092';
  c_music_cue_def_night_id constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000097';
  c_music_cue_br_night_id  constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-000000000098';

  c_stem_def_base_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000009a';
  c_stem_def_layer_id      constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000009b';
  c_stem_br_base_id        constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000009c';
  c_stem_br_layer_id       constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000009d';
  c_stem_def_base_n_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000009e';
  c_stem_def_layer_n_id    constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-00000000009f';
  c_stem_br_base_n_id      constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a1';
  c_stem_br_layer_n_id     constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a2';

  c_ui_cue_id              constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0';

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
  c_pg_g2_f1_0             constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000be';
  c_pg_g2_f2_0             constant uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000bf';

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

  v_grove_boundary         extensions.geography(Polygon, 4326);
  v_grove2_boundary        extensions.geography(Polygon, 4326);
  v_region_bounds          extensions.geography(Polygon, 4326);
  v_ambience_poly          extensions.geography(Polygon, 4326);
  v_music_poly             extensions.geography(Polygon, 4326);
  v_sun_reference          extensions.geography(Point, 4326);

  v_pt_frag1               extensions.geography(Point, 4326);
  v_pt_frag2               extensions.geography(Point, 4326);
  v_pt_frag3               extensions.geography(Point, 4326);
  v_pt_frag4               extensions.geography(Point, 4326);
  v_pt_frag5               extensions.geography(Point, 4326);
  v_pt_frag6               extensions.geography(Point, 4326);
  v_pt_frag7               extensions.geography(Point, 4326);
  v_pt_frag8               extensions.geography(Point, 4326);
  v_pt_frag9               extensions.geography(Point, 4326);
  v_pt_frag10              extensions.geography(Point, 4326);
  v_pt_g2_frag1            extensions.geography(Point, 4326);
  v_pt_g2_frag2            extensions.geography(Point, 4326);

  v_commit                 jsonb;
  v_lng_offset             double precision := 0.00357; -- ~300 m east at ~41°N
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

  v_grove2_boundary := extensions.ST_Translate(
    v_grove_boundary::geometry, v_lng_offset, 0
  )::extensions.geography;

  v_pt_g2_frag1 := extensions.ST_Translate(v_pt_frag1::geometry, v_lng_offset, 0)::extensions.geography;
  v_pt_g2_frag2 := extensions.ST_Translate(v_pt_frag7::geometry, v_lng_offset, 0.0003)::extensions.geography;

  v_sun_reference := extensions.ST_SetSRID(
    extensions.ST_MakePoint(-111.92, 40.96), 4326
  )::extensions.geography;

  ---------------------------------------------------------------------------
  -- Region
  ---------------------------------------------------------------------------
  insert into public.regions (id, slug, name, timezone, sun_reference, bounds, pack_version)
  values (
    c_region_id,
    'wasatch-front',
    'Wasatch Front',
    'America/Denver',
    v_sun_reference,
    v_region_bounds,
    0
  );

  insert into public.journal_terms (version, body, effective_at)
  values (
    1,
    '{"en":"Demo journal terms v1. Synthetic test content only."}'::jsonb,
    timestamptz '2020-01-01 00:00:00+00'
  );

  ---------------------------------------------------------------------------
  -- Image assets (1×1 PNG placeholders)
  ---------------------------------------------------------------------------
  insert into public.image_assets (
    id, sha256, ext, bytes, width, height, title, alt_text, staging_path, is_public
  ) values
    (c_portrait_a_id,
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
     'png', 68, 1, 1,
     'TEST portrait — River (1×1 placeholder)',
     '{"en":"Placeholder portrait for demo character River."}'::jsonb,
     'staging-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
     false),
    (c_portrait_b_id,
     'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
     'png', 68, 1, 1,
     'TEST portrait — Keeper (1×1 placeholder)',
     '{"en":"Placeholder portrait for demo character Keeper."}'::jsonb,
     'staging-images/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png',
     false);

  ---------------------------------------------------------------------------
  -- Audio assets (exact values from supabase/seed-media.json; no source column)
  ---------------------------------------------------------------------------
  insert into public.audio_assets (
    id, kind, sha256, ext, bytes, duration_ms, channels, sample_rate,
    loudness_lufs, loop_start_ms, loop_end_ms, title, tags, staging_path, is_public
  ) values
    (c_asset_narr_f1_id, 'narration',
     '3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag1', '{}',
     'staging-audio/3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b.wav', false),
    (c_asset_narr_f2_id, 'narration',
     '70f1e568e7c75e66b93ef5963d048761e111333e1f67becb5663c766f74c2ae7',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag2', '{}',
     'staging-audio/70f1e568e7c75e66b93ef5963d048761e111333e1f67becb5663c766f74c2ae7.wav', false),
    (c_asset_narr_f3_id, 'narration',
     'd3a8ae92d84c428d70cda57916fc6597fbae5b5953953fb2679b7f54833155a3',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag3', '{}',
     'staging-audio/d3a8ae92d84c428d70cda57916fc6597fbae5b5953953fb2679b7f54833155a3.wav', false),
    (c_asset_narr_f4_id, 'narration',
     '56bf2aee6f44f93dacfad0bbb51b522b0becad55d0a3aa01108f9f6fc8440b59',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag4', '{}',
     'staging-audio/56bf2aee6f44f93dacfad0bbb51b522b0becad55d0a3aa01108f9f6fc8440b59.wav', false),
    (c_asset_narr_f5_id, 'narration',
     'c7474307853655023e674929b79ee85253523e5f5996e36c6e02c0550a1ce586',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag5', '{}',
     'staging-audio/c7474307853655023e674929b79ee85253523e5f5996e36c6e02c0550a1ce586.wav', false),
    (c_asset_narr_f6_id, 'narration',
     '8979653040ba033d7fb66c8a178b6c2572fbb7a814f9ed0ec68485e2cad72b02',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag6', '{}',
     'staging-audio/8979653040ba033d7fb66c8a178b6c2572fbb7a814f9ed0ec68485e2cad72b02.wav', false),
    (c_asset_narr_f7_id, 'narration',
     '6ff8280f32a08dcb5b7b39dd4f9f3a96ffd74b85f14aae2af985a04fa2186efe',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag7', '{}',
     'staging-audio/6ff8280f32a08dcb5b7b39dd4f9f3a96ffd74b85f14aae2af985a04fa2186efe.wav', false),
    (c_asset_narr_f8_id, 'narration',
     '430feddba090436faf8c6f7e3a986c0b76c309b523533ba8011aa4a4db8af217',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag8', '{}',
     'staging-audio/430feddba090436faf8c6f7e3a986c0b76c309b523533ba8011aa4a4db8af217.wav', false),
    (c_asset_narr_f9_id, 'narration',
     'c7ab860a7db67c8d298af3b2758291499acbcf5cb520f3dbb66bb17b3aa50f1e',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag9 (physical)', '{}',
     'staging-audio/c7ab860a7db67c8d298af3b2758291499acbcf5cb520f3dbb66bb17b3aa50f1e.wav', false),
    (c_asset_narr_f10_id, 'narration',
     '591dcfcbff07cdcfceba48237625356e529f431fbbdf29c4c9277ac7950e0add',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag10 rev1', '{}',
     'staging-audio/591dcfcbff07cdcfceba48237625356e529f431fbbdf29c4c9277ac7950e0add.wav', false),
    (c_asset_narr_f10_r2_id, 'narration',
     '95dcd251db2dcf2d076697a32b5be1ae3d3a47bc68dfcff67583daf34426fba1',
     'wav', 176444, 2000, 1, 44100, -16, null, null,
     'TEST tone — narration frag10 rev2 (contingency)', '{}',
     'staging-audio/95dcd251db2dcf2d076697a32b5be1ae3d3a47bc68dfcff67583daf34426fba1.wav', false),
    (c_asset_bed_marsh_id, 'sfx_bed',
     'f384397cef9c76b20b004403e804768a5164cad7be43ca57c06b795c5933cac7',
     'wav', 352844, 4000, 2, 22050, -30, 0, 4000,
     'TEST tone — marsh bed', '{marsh,bed,test}',
     'staging-audio/f384397cef9c76b20b004403e804768a5164cad7be43ca57c06b795c5933cac7.wav', false),
    (c_asset_bed_urban_id, 'sfx_bed',
     '11b23859a2dad1c63ae96a92f4879c85e29335cd509166aca4f0e0ed2ab32fd4',
     'wav', 352844, 4000, 2, 22050, -30, 0, 4000,
     'TEST tone — urban bed', '{urban,bed,test}',
     'staging-audio/11b23859a2dad1c63ae96a92f4879c85e29335cd509166aca4f0e0ed2ab32fd4.wav', false),
    (c_asset_os_marsh1_id, 'sfx_oneshot',
     '41db393d34a899b59601eba2c417ee44aaba014a8a8b881995cb9dbca9354d4c',
     'wav', 26504, 300, 1, 44100, -24, null, null,
     'TEST tone — marsh oneshot 1', '{marsh,oneshot,test}',
     'staging-audio/41db393d34a899b59601eba2c417ee44aaba014a8a8b881995cb9dbca9354d4c.wav', false),
    (c_asset_os_marsh2_id, 'sfx_oneshot',
     'c795fb1f891379fe7b95391b3e011046a64688080dd4ae30908ad490f37f1f22',
     'wav', 26504, 300, 1, 44100, -24, null, null,
     'TEST tone — marsh oneshot 2', '{marsh,oneshot,test}',
     'staging-audio/c795fb1f891379fe7b95391b3e011046a64688080dd4ae30908ad490f37f1f22.wav', false),
    (c_asset_os_urban1_id, 'sfx_oneshot',
     '06c48420a1b8496c251b6ba888b4abe47ff96535f77fd244bc29634e6aa46e17',
     'wav', 22094, 250, 1, 44100, -24, null, null,
     'TEST tone — urban oneshot 1', '{urban,oneshot,test}',
     'staging-audio/06c48420a1b8496c251b6ba888b4abe47ff96535f77fd244bc29634e6aa46e17.wav', false),
    (c_asset_os_urban2_id, 'sfx_oneshot',
     'fc64ad1de902bf9ac21c334de4917be4adf76337b5a0e16f503df2aa01e4030c',
     'wav', 22094, 250, 1, 44100, -24, null, null,
     'TEST tone — urban oneshot 2', '{urban,oneshot,test}',
     'staging-audio/fc64ad1de902bf9ac21c334de4917be4adf76337b5a0e16f503df2aa01e4030c.wav', false),
    (c_asset_stem_def_base_id, 'music_stem',
     '4e8d73245900da065ff33926c9d8d788bdb9bd35b565fbb1a394e0da4dad885d',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — default cue base stem', '{music,stem,test}',
     'staging-audio/4e8d73245900da065ff33926c9d8d788bdb9bd35b565fbb1a394e0da4dad885d.wav', false),
    (c_asset_stem_def_lyr_id, 'music_stem',
     'a3f19e59dfba06a1b42bc813cad4e24e4e07cfd166c11bf71cf519402a4ca9c9',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — default cue layer stem', '{music,stem,test}',
     'staging-audio/a3f19e59dfba06a1b42bc813cad4e24e4e07cfd166c11bf71cf519402a4ca9c9.wav', false),
    (c_asset_stem_br_base_id, 'music_stem',
     '21b7ceac2f101cc8ccccbbb8780b85360e3dfce4062c878fe07ac750ebb627be',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — branch-tier cue base stem', '{music,stem,test}',
     'staging-audio/21b7ceac2f101cc8ccccbbb8780b85360e3dfce4062c878fe07ac750ebb627be.wav', false),
    (c_asset_stem_br_lyr_id, 'music_stem',
     '64390d5a6288cfce700af7ab42cf206316fd13eba2289c348b8aa4e87683ab65',
     'wav', 1411244, 8000, 2, 44100, -23, 0, 8000,
     'TEST tone — branch-tier cue layer stem', '{music,stem,test}',
     'staging-audio/64390d5a6288cfce700af7ab42cf206316fd13eba2289c348b8aa4e87683ab65.wav', false),
    (c_asset_hush_id, 'voice_cue',
     'ede986b4df84259e33113f8400e755cc2820eb8b91bb7ef9070769c65fbce9b1',
     'wav', 88244, 1000, 1, 44100, -18, null, null,
     'TEST tone — hush_listen en', '{hush,ui,test}',
     'staging-audio/ede986b4df84259e33113f8400e755cc2820eb8b91bb7ef9070769c65fbce9b1.wav', false);

  ---------------------------------------------------------------------------
  -- Story-wide thread + characters
  ---------------------------------------------------------------------------
  insert into public.threads (id, title, notes) values
    (c_thread_id, 'Demo wetland thread',
     'Internal notes: placeholder story thread for M3a seed tests.');

  insert into public.characters (
    id, name, notes, public_name, public_intro, portrait_image_id, status
  ) values
    (c_char_a_id, 'River', 'Internal notes: demo character A',
     '{"en":"River"}'::jsonb,
     '{"en":"A demo character for tests."}'::jsonb,
     c_portrait_a_id, 'draft'),
    (c_char_b_id, 'Keeper', 'Internal notes: demo character B',
     '{"en":"Keeper"}'::jsonb,
     '{"en":"Another demo character for tests."}'::jsonb,
     c_portrait_b_id, 'draft');

  ---------------------------------------------------------------------------
  -- Groves (working status draft until publish commit)
  ---------------------------------------------------------------------------
  insert into public.groves (
    id, region_id, slug, name, premise, access_notes, boundary,
    website_url, gatherings_url, allows_speaker_wildlife_sounds,
    growth_cue_id, status, pack_version
  ) values (
    c_grove_id,
    c_region_id,
    'demo',
    '{"en":"Farmington Bird Refuge Grove"}'::jsonb,
    '{"en":"Synthetic test grove for M3a seed and integration tests (Farmington fixture)."}'::jsonb,
    jsonb_build_object(
      'parking', jsonb_build_object('en', 'Test parking near the education center.'),
      'terrain', jsonb_build_object('en', 'Flat wetland trail — synthetic audio only.')
    ),
    v_grove_boundary,
    null,
    null,
    false,
    null,
    'draft',
    0
  );

  insert into public.groves (
    id, region_id, slug, name, premise, access_notes, boundary,
    allows_speaker_wildlife_sounds, status, pack_version
  ) values
    (c_grove_ogden_id, c_region_id, 'ogden-nature-center',
     '{"en":"Ogden Nature Center (draft placeholder)"}'::jsonb,
     '{"en":"Draft grove — placeholder geometry only."}'::jsonb,
     '{}'::jsonb,
     extensions.ST_Buffer(
       extensions.ST_SetSRID(extensions.ST_MakePoint(-111.90, 41.01), 4326)::extensions.geography,
       200
     ),
     false, 'draft', 0),
    (c_grove_pia_id, c_region_id, 'pia-okwai',
     '{"en":"Nature Center at Pia Okwai (draft placeholder)"}'::jsonb,
     '{"en":"Draft grove — placeholder geometry only."}'::jsonb,
     '{}'::jsonb,
     extensions.ST_Buffer(
       extensions.ST_SetSRID(extensions.ST_MakePoint(-111.88, 41.00), 4326)::extensions.geography,
       200
     ),
     false, 'draft', 0);

  insert into public.groves (
    id, region_id, slug, name, premise, access_notes, boundary,
    allows_speaker_wildlife_sounds, status, pack_version
  ) values (
    c_grove2_id,
    c_region_id,
    'demo-nearby',
    '{"en":"Nearby test grove (bridge prereq)"}'::jsonb,
    '{"en":"Second small grove ~300 m east for cross-grove unlock tests."}'::jsonb,
    '{"terrain":{"en":"Offset duplicate of the Farmington fixture boundary."}}'::jsonb,
    v_grove2_boundary,
    false,
    'draft',
    0
  );

  ---------------------------------------------------------------------------
  -- Fragments — Farmington (fixture); radii 10.67 m; standard / physical
  ---------------------------------------------------------------------------
  insert into public.fragments (
    id, grove_id, tier, is_ending, title, location, visibility,
    trigger_radius_m, marker_code, story_order, teaser, status
  ) values
    (c_frag1_id, c_grove_id, 'root', false,
     '{"en":"Beginning"}'::jsonb, v_pt_frag1, 'standard',
     10.67, null, 1, '{"en":"Begin near the refuge entrance."}'::jsonb, 'draft'),
    (c_frag2_id, c_grove_id, 'branch', false,
     '{"en":"Buildings 1"}'::jsonb, v_pt_frag2, 'standard',
     10.67, null, 2, '{"en":"Near the education-center buildings."}'::jsonb, 'draft'),
    (c_frag3_id, c_grove_id, 'branch', false,
     '{"en":"Buildings 2"}'::jsonb, v_pt_frag3, 'standard',
     10.67, null, 3, '{"en":"Another stretch by the buildings."}'::jsonb, 'draft'),
    (c_frag4_id, c_grove_id, 'leaf', false,
     '{"en":"Parking Lot 1"}'::jsonb, v_pt_frag4, 'standard',
     10.67, null, 4, '{"en":"A short leaf by the parking lot."}'::jsonb, 'draft'),
    (c_frag5_id, c_grove_id, 'leaf', false,
     '{"en":"Parking Lot 2"}'::jsonb, v_pt_frag5, 'standard',
     10.67, null, 5, '{"en":"AND-test leaf — needs Buildings 1 and 2."}'::jsonb, 'draft'),
    (c_frag6_id, c_grove_id, 'root', true,
     '{"en":"Ending"}'::jsonb, v_pt_frag6, 'standard',
     10.67, null, 6, '{"en":"Root End — same point as Beginning."}'::jsonb, 'draft'),
    (c_frag7_id, c_grove_id, 'root', false,
     '{"en":"Pond"}'::jsonb, v_pt_frag7, 'standard',
     10.67, null, 7, '{"en":"Gated Root Start after the ending."}'::jsonb, 'draft'),
    (c_frag8_id, c_grove_id, 'branch', false,
     '{"en":"Heron Overlook"}'::jsonb, v_pt_frag8, 'standard',
     10.67, null, 8, '{"en":"Standard overlook on the marsh loop (Day-only narration)."}'::jsonb, 'draft'),
    (c_frag9_id, c_grove_id, 'leaf', false,
     '{"en":"Hidden Post"}'::jsonb, v_pt_frag9, 'physical',
     10.67, 'DEMO-001', 9, '{"en":"Physical — marker required."}'::jsonb, 'draft'),
    (c_frag10_id, c_grove_id, 'leaf', false,
     '{"en":"Two Ways"}'::jsonb, v_pt_frag10, 'standard',
     10.67, null, 10, '{"en":"OR-test leaf; rev2 is a contingency."}'::jsonb, 'draft');

  insert into public.fragments (
    id, grove_id, tier, is_ending, title, location, visibility,
    trigger_radius_m, story_order, teaser, status
  ) values
    (c_g2_frag1_id, c_grove2_id, 'root', false,
     '{"en":"Bridge Start"}'::jsonb, v_pt_g2_frag1, 'standard',
     10.67, 1, '{"en":"Requires Beginning from the Farmington grove."}'::jsonb, 'draft'),
    (c_g2_frag2_id, c_grove2_id, 'leaf', false,
     '{"en":"Nearby Leaf"}'::jsonb, v_pt_g2_frag2, 'standard',
     10.67, 2, '{"en":"Second fragment in the nearby test grove."}'::jsonb, 'draft');

  insert into public.fragment_characters (
    fragment_id, character_id, introduces, prominence, card_line
  ) values
    (c_frag1_id, c_char_a_id, true, 'major',
     '{"en":"River welcomes you to the refuge."}'::jsonb),
    (c_frag2_id, c_char_b_id, true, 'minor',
     '{"en":"Keeper watches from the buildings."}'::jsonb);

  ---------------------------------------------------------------------------
  -- Prerequisites
  ---------------------------------------------------------------------------
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
  -- cross-grove: bridge requires Farmington frag1
  perform pg_temp.add_prereq_group(c_pg_g2_f1_0, c_g2_frag1_id, 0, array[c_frag1_id]);
  perform pg_temp.add_prereq_group(c_pg_g2_f2_0, c_g2_frag2_id, 0, array[c_g2_frag1_id]);

  ---------------------------------------------------------------------------
  -- Question (story-wide scope)
  ---------------------------------------------------------------------------
  insert into public.questions (
    id, text, anchor_fragment_id, anchor_character_id,
    requires_completed, opens_at, closes_at, status
  ) values (
    c_question_id,
    '{"en":"What did you notice near the buildings?"}'::jsonb,
    c_frag2_id,
    c_char_a_id,
    true,
    now() - interval '1 day',
    now() + interval '60 days',
    'published'
  );

  ---------------------------------------------------------------------------
  -- Revisions (draft) + versions (time_window required)
  ---------------------------------------------------------------------------
  insert into public.fragment_revisions (
    id, fragment_id, revision_no, status, change_kind, change_note
  ) values
    (c_rev_f1_id,     c_frag1_id,     1, 'draft', 'contingency', 'Frag1 r1'),
    (c_rev_f2_id,     c_frag2_id,     1, 'draft', 'contingency', 'Frag2 r1'),
    (c_rev_f3_id,     c_frag3_id,     1, 'draft', 'contingency', 'Frag3 r1'),
    (c_rev_f4_id,     c_frag4_id,     1, 'draft', 'contingency', 'Frag4 r1'),
    (c_rev_f4b_id,    c_frag4_id,     2, 'draft', 'correction',  'Frag4 r2 correction'),
    (c_rev_f5_id,     c_frag5_id,     1, 'draft', 'contingency', 'Frag5 r1'),
    (c_rev_f6_id,     c_frag6_id,     1, 'draft', 'contingency', 'Frag6 r1 Ending'),
    (c_rev_f7_id,     c_frag7_id,     1, 'draft', 'contingency', 'Frag7 r1 Pond'),
    (c_rev_f8_id,     c_frag8_id,     1, 'draft', 'contingency', 'Frag8 r1 standard Day-only'),
    (c_rev_f9_id,     c_frag9_id,     1, 'draft', 'contingency', 'Frag9 r1 physical'),
    (c_rev_f10_r1_id, c_frag10_id,    1, 'draft', 'contingency', 'Frag10 r1'),
    (c_rev_f10_r2_id, c_frag10_id,    2, 'draft', 'contingency', 'Frag10 r2 contingency'),
    (c_rev_g2_f1_id,  c_g2_frag1_id,  1, 'draft', 'contingency', 'Bridge r1'),
    (c_rev_g2_f2_id,  c_g2_frag2_id,  1, 'draft', 'contingency', 'Nearby leaf r1');

  insert into public.revision_versions (
    revision_id, language, time_window, narration_asset_id, transcript
  ) values
    (c_rev_f1_id,     'en', 'day',   c_asset_narr_f1_id,     'TEST transcript — frag1 Beginning day narration tone.'),
    (c_rev_f1_id,     'en', 'night', c_asset_narr_f1_id,     'TEST transcript — frag1 Beginning night narration tone.'),
    (c_rev_f2_id,     'en', 'day',   c_asset_narr_f2_id,     'TEST transcript — frag2 Buildings 1 narration tone.'),
    (c_rev_f3_id,     'en', 'day',   c_asset_narr_f3_id,     'TEST transcript — frag3 Buildings 2 narration tone.'),
    (c_rev_f4_id,     'en', 'day',   c_asset_narr_f4_id,     'TEST transcript — frag4 Parking Lot 1 narration tone.'),
    (c_rev_f4b_id,    'en', 'day',   c_asset_narr_f4_id,     'TEST transcript — frag4 r2 correction narration tone.'),
    (c_rev_f5_id,     'en', 'day',   c_asset_narr_f5_id,     'TEST transcript — frag5 Parking Lot 2 narration tone.'),
    (c_rev_f6_id,     'en', 'day',   c_asset_narr_f6_id,     'TEST transcript — frag6 Ending narration tone.'),
    (c_rev_f7_id,     'en', 'day',   c_asset_narr_f7_id,     'TEST transcript — frag7 Pond narration tone.'),
    (c_rev_f8_id,     'en', 'day',   c_asset_narr_f8_id,     'TEST transcript — frag8 Heron Overlook Day-only narration tone.'),
    (c_rev_f9_id,     'en', 'day',   c_asset_narr_f9_id,     'TEST transcript — frag9 Hidden Post physical narration tone.'),
    (c_rev_f10_r1_id, 'en', 'day',   c_asset_narr_f10_id,    'TEST transcript — frag10 Two Ways rev1 narration tone.'),
    (c_rev_f10_r2_id, 'en', 'day',   c_asset_narr_f10_r2_id, 'TEST transcript — frag10 Two Ways rev2 contingency narration tone.'),
    (c_rev_g2_f1_id,  'en', 'day',   c_asset_narr_f1_id,     'TEST transcript — bridge start narration tone.'),
    (c_rev_g2_f2_id,  'en', 'day',   c_asset_narr_f2_id,     'TEST transcript — nearby leaf narration tone.');

  ---------------------------------------------------------------------------
  -- Ambience: Day + Night layers
  ---------------------------------------------------------------------------
  insert into public.ambience_profiles (id, region_id, slug, name, description, density) values
    (c_amb_marsh_id, c_region_id, 'marsh', 'Marsh',
     'Demo marsh palette — synthetic tones only', 1.0),
    (c_amb_urban_id, c_region_id, 'urban', 'Urban',
     'Demo urban palette — synthetic tones only', 1.0);

  insert into public.ambience_layers (
    id, profile_id, name, kind, time_window,
    gain_db_min, gain_db_max, mean_interval_s, min_interval_s,
    max_concurrent, crossfade_ms, speaker_safe, wildlife_call
  ) values
    (c_layer_marsh_bed_id, c_amb_marsh_id, 'Marsh bed', 'bed', 'day',
     -24, -16, null, null, 1, 4000, true, false),
    (c_layer_marsh_os1_id, c_amb_marsh_id, 'Marsh oneshot A', 'oneshot', 'day',
     -20, -12, 14, 5, 2, 4000, true, false),
    (c_layer_marsh_os2_id, c_amb_marsh_id, 'Marsh oneshot B', 'oneshot', 'day',
     -20, -12, 18, 6, 2, 4000, true, false),
    (c_layer_urban_bed_id, c_amb_urban_id, 'Urban bed', 'bed', 'day',
     -24, -16, null, null, 1, 4000, true, false),
    (c_layer_urban_os1_id, c_amb_urban_id, 'Urban oneshot A', 'oneshot', 'day',
     -20, -12, 12, 4, 2, 4000, true, false),
    (c_layer_urban_os2_id, c_amb_urban_id, 'Urban oneshot B', 'oneshot', 'day',
     -20, -12, 16, 5, 2, 4000, true, false),
  (c_layer_marsh_bed_n_id, c_amb_marsh_id, 'Marsh bed (night)', 'bed', 'night',
     -24, -16, null, null, 1, 4000, true, false),
    (c_layer_marsh_os1_n_id, c_amb_marsh_id, 'Marsh oneshot A (night)', 'oneshot', 'night',
     -20, -12, 14, 5, 2, 4000, true, false),
    (c_layer_marsh_os2_n_id, c_amb_marsh_id, 'Marsh oneshot B (night)', 'oneshot', 'night',
     -20, -12, 18, 6, 2, 4000, true, false),
    (c_layer_urban_bed_n_id, c_amb_urban_id, 'Urban bed (night)', 'bed', 'night',
     -24, -16, null, null, 1, 4000, true, false),
    (c_layer_urban_os1_n_id, c_amb_urban_id, 'Urban oneshot A (night)', 'oneshot', 'night',
     -20, -12, 12, 4, 2, 4000, true, false),
    (c_layer_urban_os2_n_id, c_amb_urban_id, 'Urban oneshot B (night)', 'oneshot', 'night',
     -20, -12, 16, 5, 2, 4000, true, false);

  insert into public.ambience_layer_assets (layer_id, asset_id, weight) values
    (c_layer_marsh_bed_id, c_asset_bed_marsh_id, 1.0),
    (c_layer_marsh_os1_id, c_asset_os_marsh1_id, 1.0),
    (c_layer_marsh_os2_id, c_asset_os_marsh2_id, 1.0),
    (c_layer_urban_bed_id, c_asset_bed_urban_id, 1.0),
    (c_layer_urban_os1_id, c_asset_os_urban1_id, 1.0),
    (c_layer_urban_os2_id, c_asset_os_urban2_id, 1.0),
    (c_layer_marsh_bed_n_id, c_asset_bed_marsh_id, 1.0),
    (c_layer_marsh_os1_n_id, c_asset_os_marsh1_id, 1.0),
    (c_layer_marsh_os2_n_id, c_asset_os_marsh2_id, 1.0),
    (c_layer_urban_bed_n_id, c_asset_bed_urban_id, 1.0),
    (c_layer_urban_os1_n_id, c_asset_os_urban1_id, 1.0),
    (c_layer_urban_os2_n_id, c_asset_os_urban2_id, 1.0);

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
    'draft'
  );

  ---------------------------------------------------------------------------
  -- Music zone + Day/Night cues
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
    'draft'
  );

  insert into public.music_cues (
    id, name, music_zone_id, grove_id, time_window, priority, conditions,
    min_dwell_s, crossfade_ms, status
  ) values
    (c_music_cue_def_day_id, 'Demo default cue (day)',
     c_music_zone_id, null, 'day', 50, '{}'::jsonb, 45, 6000, 'draft'),
    (c_music_cue_br_day_id, 'Demo branch-tier cue (day)',
     c_music_zone_id, null, 'day', 80, '{"tiers":["branch"]}'::jsonb, 45, 6000, 'draft'),
    (c_music_cue_def_night_id, 'Demo default cue (night)',
     c_music_zone_id, null, 'night', 50, '{}'::jsonb, 45, 6000, 'draft'),
    (c_music_cue_br_night_id, 'Demo branch-tier cue (night)',
     c_music_zone_id, null, 'night', 80, '{"tiers":["branch"]}'::jsonb, 45, 6000, 'draft');

  insert into public.music_cue_stems (
    id, cue_id, asset_id, role, gain_db, state_gains
  ) values
    (c_stem_def_base_id,  c_music_cue_def_day_id,   c_asset_stem_def_base_id, 'base',  0, '[]'::jsonb),
    (c_stem_def_layer_id, c_music_cue_def_day_id,   c_asset_stem_def_lyr_id,  'layer', -3, '[]'::jsonb),
    (c_stem_br_base_id,   c_music_cue_br_day_id,    c_asset_stem_br_base_id,  'base',  0, '[]'::jsonb),
    (c_stem_br_layer_id,  c_music_cue_br_day_id,    c_asset_stem_br_lyr_id,   'layer', -3, '[]'::jsonb),
    (c_stem_def_base_n_id, c_music_cue_def_night_id, c_asset_stem_def_base_id, 'base',  0, '[]'::jsonb),
    (c_stem_def_layer_n_id, c_music_cue_def_night_id, c_asset_stem_def_lyr_id, 'layer', -3, '[]'::jsonb),
    (c_stem_br_base_n_id,  c_music_cue_br_night_id,  c_asset_stem_br_base_id,  'base',  0, '[]'::jsonb),
    (c_stem_br_layer_n_id, c_music_cue_br_night_id,  c_asset_stem_br_lyr_id,   'layer', -3, '[]'::jsonb);

  insert into public.ui_cues (
    id, region_id, key, language, asset_id, status
  ) values (
    c_ui_cue_id,
    c_region_id,
    'hush_listen',
    'en',
    c_asset_hush_id,
    'draft'
  );

  ---------------------------------------------------------------------------
  -- Landcover fixture
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

  ---------------------------------------------------------------------------
  -- Releases
  ---------------------------------------------------------------------------
  insert into public.releases (id, name, notes, status) values
    (c_release_published_id,
     'M3a demo publish',
     'Published release covering Farmington + nearby test grove and region palettes.',
     'draft'),
    (c_release_draft_id,
     'M3a preview draft',
     'Empty draft release for admin preview / schedule tests.',
     'draft');

  insert into public.release_items (release_id, entity, entity_id) values
    -- groves
    (c_release_published_id, 'grove', c_grove_id),
    (c_release_published_id, 'grove', c_grove2_id),
    -- fragments (Farmington)
    (c_release_published_id, 'fragment', c_frag1_id),
    (c_release_published_id, 'fragment', c_frag2_id),
    (c_release_published_id, 'fragment', c_frag3_id),
    (c_release_published_id, 'fragment', c_frag4_id),
    (c_release_published_id, 'fragment', c_frag5_id),
    (c_release_published_id, 'fragment', c_frag6_id),
    (c_release_published_id, 'fragment', c_frag7_id),
    (c_release_published_id, 'fragment', c_frag8_id),
    (c_release_published_id, 'fragment', c_frag9_id),
    (c_release_published_id, 'fragment', c_frag10_id),
  (c_release_published_id, 'fragment', c_g2_frag1_id),
    (c_release_published_id, 'fragment', c_g2_frag2_id),
    -- revisions
    (c_release_published_id, 'revision', c_rev_f1_id),
    (c_release_published_id, 'revision', c_rev_f2_id),
    (c_release_published_id, 'revision', c_rev_f3_id),
    (c_release_published_id, 'revision', c_rev_f4_id),
    (c_release_published_id, 'revision', c_rev_f4b_id),
    (c_release_published_id, 'revision', c_rev_f5_id),
    (c_release_published_id, 'revision', c_rev_f6_id),
    (c_release_published_id, 'revision', c_rev_f7_id),
    (c_release_published_id, 'revision', c_rev_f8_id),
    (c_release_published_id, 'revision', c_rev_f9_id),
    (c_release_published_id, 'revision', c_rev_f10_r1_id),
    (c_release_published_id, 'revision', c_rev_f10_r2_id),
    (c_release_published_id, 'revision', c_rev_g2_f1_id),
    (c_release_published_id, 'revision', c_rev_g2_f2_id),
    -- characters + portraits
    (c_release_published_id, 'character', c_char_a_id),
    (c_release_published_id, 'character', c_char_b_id),
    (c_release_published_id, 'image', c_portrait_a_id),
    (c_release_published_id, 'image', c_portrait_b_id),
    -- region sound
    (c_release_published_id, 'ambience_profile', c_amb_marsh_id),
    (c_release_published_id, 'ambience_profile', c_amb_urban_id),
    (c_release_published_id, 'ambience_zone', c_amb_zone_id),
    (c_release_published_id, 'music_zone', c_music_zone_id),
    (c_release_published_id, 'music_cue', c_music_cue_def_day_id),
    (c_release_published_id, 'music_cue', c_music_cue_br_day_id),
    (c_release_published_id, 'music_cue', c_music_cue_def_night_id),
    (c_release_published_id, 'music_cue', c_music_cue_br_night_id),
    (c_release_published_id, 'ui_cue', c_ui_cue_id);

  ---------------------------------------------------------------------------
  -- Publish commit (snapshots + queued rebuild_pack jobs)
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_commit := public.fn_publish_commit(c_release_published_id);
  if coalesce((v_commit->>'ok')::boolean, false) is not true then
    raise exception 'seed fn_publish_commit failed: %', v_commit::text;
  end if;

  drop table if exists public._seed_geometry;
end;
$seed$;