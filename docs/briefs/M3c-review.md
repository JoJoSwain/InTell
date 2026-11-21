# M3c authoring: architect review of the implementation

**Reviewed:** `docs/briefs/M3c-report.md` and `m3c-authoring` at `90416bf` (PR #9), against `M3c-plan.md` and `M3c-plan-review.md`, including the two committed screenshots
**Verdict:** **Changes requested: four required fixes (C1–C4).** Fix on PR #9, then stop for verification. Do not start M3d.
**Reviewer:** architect (Claude), 2026-11-20

A big milestone, done carefully: B1 (and catching `gatherings`), B3, B4, B5, B6, answers 1–3, the invoker geometry setters, the print page and the no-key fallback are all right. But the screenshot exposed a data-safety bug the tests didn't catch (C1), and the true-peak meter doesn't actually oversample (C2).

---

## Required

### C1. Existing geometry doesn't load, so saving an existing fragment or grove breaks it

PostgREST returns `geography` columns as **hex EWKB strings**, not GeoJSON. The grove editor screenshot shows both symptoms:

- **Fragments.** `coordsFromGeo(selected.location)` can't parse the hex string, so it returns its **hard-coded fallback, 41.1 / −111.9**. The screenshot shows exactly those values for "Beginning", whose seed location is 41.01 / −111.90. Saving that fragment after changing only its title or teaser sends the fallback coordinates to `fn_set_fragment_location`. The fragment either moves silently or the save fails as outside the grove.
- **Groves.** The Boundary field shows the hex string (`0103000020E6…`). Saving a grove after changing only its name fails with "boundary must be valid GeoJSON" unless someone re-pastes the boundary. The map component gets the same hex string as `initialGeoJson`, so Terra Draw can't show an existing boundary either.

The Playwright acceptance spec only creates new groves and fragments and never re-saves an existing one, which is how this got through.

**Fix:**
1. Read geometry as GeoJSON through PostgREST **computed columns**: `security invoker`, `stable` SQL functions that take the row type, e.g.
   - `public.boundary_geojson(public.groves) returns jsonb` (`ST_AsGeoJSON(boundary)::jsonb`)
   - `public.location_geojson(public.fragments) returns jsonb`

   Select them in the admin instead of the raw columns. They're invoker functions, so RLS still applies and `110` doesn't change.
2. **Delete the coordinate fallback.** If a location can't be read, show empty latitude and longitude fields and require input. Never default to a constant coordinate anywhere.
3. Call `fn_set_fragment_location` / `fn_set_grove_boundary` **only when the geometry actually changed**, by comparing against the loaded values.
4. **Tests:**
   - **Playwright:** open an existing seed fragment, change only its teaser, save, and assert its location is unchanged. Open the seed grove, change only its name, save, and assert the save succeeds and the boundary is unchanged.
   - **pgTAP:** the computed functions return GeoJSON for staff and nothing for `anon`.

### C2. The true-peak interpolator runs at a quarter gain

`designTruePeakPhases` normalizes the **whole** 48-tap filter to a sum of 1. A 4× polyphase interpolator needs each **phase** at unity DC gain, which means the whole filter sums to 4. Each branch therefore outputs about 0.25× the signal, intersample peaks are never found, and `truePeak` is always just the sample peak. The tests pass because a 1 kHz sine at 48 kHz has no intersample overs.

**Fix:**
- Normalize per phase, or scale the whole filter to sum to `OVERSAMPLE`.
- Add cases that **fail today**:
  - a 12 kHz (fs/4) sine at amplitude 0.5 with a 45° phase offset. The sample peak is −9.03 dBFS, and the expected true peak is **−6.02 dBTP** (tolerance +0.2 / −0.4 dB, per EBU Tech 3341).
  - one more intersample case at another frequency below fs/4.

### C3. Short one-shots can't be measured

BS.1770 gating needs at least one 400 ms block. For clips shorter than that, `integrated` is −∞. Because `maxShortTerm` copies `integrated` for clips under 3 s, it's −∞ too, so short one-shots like a twig snap or a drip are stored as "not measured". The −∞ also reaches the database only by accident: JSON serialization turns it into `null`.

**Fix:**
- For clips **under 3 s**, `maxShortTerm` is the **ungated loudness of the whole clip**: the K-weighted, channel-weighted mean square over every sample. This corrects my plan-review answer 3, which said "integrated".
- `integrated` stays as BS.1770 defines it.
- Convert every non-finite value to `null` explicitly before insert.
- Unit tests: a 200 ms tone burst and a 1.5 s tone at known levels give the expected `maxShortTerm` (±0.1 LU).

### C4. Two dev-overlay issues on the grove editor
The grove editor screenshot shows Next.js's **"2 Issues"** badge. Report what the two issues are (hydration mismatch, runtime error or warning) and fix them. The grove editor and fragment form should render with no dev-overlay issues.

---

## Nits (fix if cheap; otherwise list them as follow-ups)

- **N1.** The writer marker test accepts any status code and checks a *standard* fragment. Target the physical seed fragment (`DEM00001`), assert **403** (the F1 guard raises 42501), and assert the code is unchanged.
- **N2.** `fn_draft_check` is editor-only, so writers see no badges. It's read-only and exposes nothing writers can't already read, so allow all active staff (like `fn_unreleased`) and show the badges to everyone.
- **N3.** Loudness performance: short-term windows recompute about 30× overlapping sums, and true peak runs 48 taps per sample on the main thread. Use per-100 ms segment sums (O(n)) and run `analyzeAudioFile` in a Web Worker so a long narration file doesn't freeze the page.

## Accepted
- **The EWKT placeholder on grove insert followed by the invoker setter:** fine, once C1 lands.
- **Closing the `gatherings` delete hole:** good catch.
- **`fn_draft_check` without audio checks:** fine for M3c, since audio reaches fragments through revisions. **M3d** must add the revision and audio rules to `fn_draft_check` through the same shared helpers.
- **Seed demo tones as `.wav`** (report §12.1): keep them. They show the `AUDIO_FORMAT` warning working.

## For JoJo (staging, not Cursor)
In Vercel, set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAP_ID` for **Production only**, not Preview. The key is restricted to the production domain, so previews would show Google's error overlay instead of the clean fallback.

## Report back with
- New commits since `90416bf`
- pgTAP, unit and Playwright counts, naming the new C1, C2 and C3 tests
- What the two dev-overlay issues were (C4)
- A new screenshot of the grove editor showing the seed fragment's real coordinates and a GeoJSON boundary
- Which nits were fixed and which were deferred
- PR #9 CI and Vercel status on the new head

**Then stop for verification. Do not start M3d.**
