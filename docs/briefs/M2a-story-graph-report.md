# M2a story-graph report (ADR 0003 + Farmington)

**Branch:** `m2a-schema`  
**Status:** green; **no PR opened**  
**Date:** 2026-11-20

---

## 1. Commits on `m2a-schema` (this work)

```
a67397b feat(db): ADR 0003 story graph + Farmington seed
9bc0b67 docs: ADR 0003 story graph
```

Full branch tip log vs master also includes prior M2a commits (`c1ff1db`, `fc4856e`, …).

---

## 2. Commands and results

| Command | Result |
|---|---|
| `pnpm exec supabase db reset` | **PASS** — migrations + `seed-geometry.sql` + `seed.sql` |
| `pnpm exec supabase test db` | **PASS** — Files=18, Tests=78 |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |

---

## 3. `fn_publish_check` for seeded grove (all rev1)

```json
{"ok": true, "failures": [{"code": "RADIUS_OVERLAP", "message": "trigger radii overlap", "other_id": "aaaaaaaa-bbbb-4ccc-8ddd-000000000033", "severity": "warning", "entity_id": "aaaaaaaa-bbbb-4ccc-8ddd-000000000032"}], "asset_shas_to_publish": ["56bf2aee6f44f93dacfad0bbb51b522b0becad55d0a3aa01108f9f6fc8440b59", "591dcfcbff07cdcfceba48237625356e529f431fbbdf29c4c9277ac7950e0add", "8979653040ba033d7fb66c8a178b6c2572fbb7a814f9ed0ec68485e2cad72b02", "70f1e568e7c75e66b93ef5963d048761e111333e1f67becb5663c766f74c2ae7", "d3a8ae92d84c428d70cda57916fc6597fbae5b5953953fb2679b7f54833155a3", "c7ab860a7db67c8d298af3b2758291499acbcf5cb520f3dbb66bb17b3aa50f1e", "430feddba090436faf8c6f7e3a986c0b76c309b523533ba8011aa4a4db8af217", "6ff8280f32a08dcb5b7b39dd4f9f3a96ffd74b85f14aae2af985a04fa2186efe", "3576ba8f5052331dca2a180f299e084d0b3ef891e0a7ebe711cd54f38981e88b", "c7474307853655023e674929b79ee85253523e5f5996e36c6e02c0550a1ce586"]}
```

Exactly one `RADIUS_OVERLAP` warning: frag3 (`…032`) / frag4 (`…033`).

---

## 4. GPX (`apps/mobile/e2e/demo-route.gpx`)

- **Point count:** 558  
- **Duration:** 558 s (1 Hz timestamps)

**First 10 `<trkpt>` lines:**
```
      <trkpt lat="40.96122185" lon="-111.93014661"><ele>1285</ele><time>2026-06-15T17:00:00.000Z</time></trkpt>
      <trkpt lat="40.96122161" lon="-111.93008712"><ele>1285</ele><time>2026-06-15T17:00:01.000Z</time></trkpt>
      <trkpt lat="40.96122136" lon="-111.93002762"><ele>1285</ele><time>2026-06-15T17:00:02.000Z</time></trkpt>
      <trkpt lat="40.96122111" lon="-111.92996813"><ele>1285</ele><time>2026-06-15T17:00:03.000Z</time></trkpt>
      <trkpt lat="40.96122086" lon="-111.92990863"><ele>1285</ele><time>2026-06-15T17:00:04.000Z</time></trkpt>
      <trkpt lat="40.96122061" lon="-111.92984914"><ele>1285</ele><time>2026-06-15T17:00:05.000Z</time></trkpt>
      <trkpt lat="40.96122037" lon="-111.92978965"><ele>1285</ele><time>2026-06-15T17:00:06.000Z</time></trkpt>
      <trkpt lat="40.96122012" lon="-111.92973015"><ele>1285</ele><time>2026-06-15T17:00:07.000Z</time></trkpt>
      <trkpt lat="40.96121987" lon="-111.92967066"><ele>1285</ele><time>2026-06-15T17:00:08.000Z</time></trkpt>
      <trkpt lat="40.96121962" lon="-111.92961116"><ele>1285</ele><time>2026-06-15T17:00:09.000Z</time></trkpt>
```

**Last 10 `<trkpt>` lines:**
```
      <trkpt lat="40.96122185" lon="-111.92957951"><ele>1285</ele><time>2026-06-15T17:09:08.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92963622"><ele>1285</ele><time>2026-06-15T17:09:09.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92969293"><ele>1285</ele><time>2026-06-15T17:09:10.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92974964"><ele>1285</ele><time>2026-06-15T17:09:11.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92980635"><ele>1285</ele><time>2026-06-15T17:09:12.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92986306"><ele>1285</ele><time>2026-06-15T17:09:13.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92991977"><ele>1285</ele><time>2026-06-15T17:09:14.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.92997648"><ele>1285</ele><time>2026-06-15T17:09:15.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.93003319"><ele>1285</ele><time>2026-06-15T17:09:16.000Z</time></trkpt>
      <trkpt lat="40.96122185" lon="-111.93008990"><ele>1285</ele><time>2026-06-15T17:09:17.000Z</time></trkpt>
```

---

## 5. Deviations and open questions

1. **Migrations edited in place** (brief decision 1) rather than squashing history — follow-up commits on `m2a-schema`.
2. **B7** still placeholders (`todo-site-2`, `todo-site-3`). Farmington is the demo site (B8 closed).
3. **Fixture `_shape_note`:** trail lollipop topology still marked UNCONFIRMED by JoJo; GPX follows the fixture’s described route and never enters frag9’s radius.
4. **Old `tools/demo-route-gpx.mjs` removed** in favor of `tools/demo-geometry/generate.mjs` + `pnpm db:demo-geometry`.
5. No spec edits (architect already updated them). No contradictions found beyond the fixture’s own unconfirmed trail-shape note.
