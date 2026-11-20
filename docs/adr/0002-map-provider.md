# ADR 0002: Map provider for the home map

## Status
**Proposed**, 2026-11-19. Awaiting a decision from the product owner (JoJo). Until this is Accepted, agents must not add new map features, marker systems or offline tile code (AGENTS.md §7).

## Context
The specs (TECH_SPEC §1, DESIGN §1.2, DATA_MODEL §12, PRODUCT_SPEC principle 7) assume **MapLibre** with vector tiles, a custom muted style, **offline tile packs per Grove**, and markers drawn as style-driven layers.

On 2026-11-19, a home-map pass on branch `cursor/intell-v2-m0-scaffold-8134` (uncommitted at the time of review) used **Google Maps** through `react-native-maps` with `PROVIDER_GOOGLE`, a `customMapStyle`, and default `Marker` components. That was a stated preference. See `docs/intell-home-map-notes.md`.

Forces:
1. **Offline is a product principle.** Groves are at nature centers with weak or no signal (Farmington Bay, Ogden Nature Center, Pia Okwai). The map background has to work there.
2. **Google's terms restrict caching.** The Google Maps Platform terms say customers will not pre-fetch, cache, index or store Google Maps content outside the service, apart from narrow exceptions such as temporarily caching coordinates. Offline Grove downloads of the Google basemap aren't allowed.
3. **Marker scale and style.** The spec calls for tier glyphs, halos, reveal animations, updated and in-range states, and about 300 markers that pan smoothly on a mid-range Android. That's natural with MapLibre's data-driven style layers. With `react-native-maps`, each marker is a native view, so it costs more and is harder to style.
4. **iOS.** `PROVIDER_GOOGLE` on iOS needs its own Google Maps SDK setup and key. Only the Android key is wired today.
5. **Cost and accounts.** Google Maps needs a billing account and per-load pricing beyond free tiers. Self-hosted tiles need setup work but have no per-request fees.
6. **Sunk cost is small now and grows with every map feature.** Today's map code is one screen (`MapHome.tsx`, `demoContent.ts`).

## Options

### A. MapLibre + self-hosted Protomaps tiles (recommended)
`@maplibre/maplibre-react-native` with a custom style JSON in the repo. Tiles come from a Protomaps PMTiles extract of Utah (or the Wasatch Front), hosted in Supabase Storage or R2. Offline packs per Grove follow DATA_MODEL §12 and TECH_SPEC §3.4.
- ✅ Offline maps work; full style control (paper, trails, no POIs, night variant); style-layer markers scale; the same tiles serve the admin.
- ✅ No per-request fees; no third-party tracking.
- ⚠️ Setup: building and hosting the extract, writing the style, OpenStreetMap attribution. A short spike must confirm that offline pack creation works with the chosen tile source, either PMTiles directly through MapLibre Native's support or a tile endpoint served from the PMTiles file.
- Migration: rewrite `MapHome.tsx`'s map element and markers. The chrome (recenter, chip, bottom bar), tokens and demo content carry over.

### B. Keep Google Maps (online basemap)
Keep `react-native-maps` with `PROVIDER_GOOGLE`.
- ✅ Already working on Android; familiar look; nothing to host.
- ❌ No offline basemap. When there's no signal the background goes blank or stale. Stories, sound, Grove polygons and markers still work from packs, drawn over an empty background.
- ❌ Needs iOS setup and an iOS key, a billing account, and Google attribution.
- ❌ Marker performance and the spec's marker states will need custom marker views; revisit at 300 markers.
- **The spec must change:** PRODUCT_SPEC §2.7 and FR-9, TECH_SPEC §1 and §3.4 (drop tile packs), DESIGN §1.2, and AUDIO_SPEC §7 (drop the tiles budget).

### C. MapLibre + MapTiler (hosted)
Same client as A, with hosted tiles and style from MapTiler.
- ✅ Fastest path to a polished, offline-capable MapLibre map.
- ⚠️ Subscription cost; offline packs likely need a paid plan; vendor dependency.

## Recommendation
**Option A.** The offline requirement and the marker system are central to the experience, and switching is cheapest now, while the map is a single demo screen. If setting up Protomaps would hold up Milestone 5, use **C** to start and move to A later; the client code is identical.

## Decision
_To be filled in by the product owner: A / B / C, the date, and any conditions._

## Consequences (fill in on acceptance)
- If A or C: a brief for the map rewrite; keep the Google version on branch `preview/m5-google-map-home` for reference; remove `react-native-maps` and the Google key wiring when M5 lands.
- If B: a docs PR amending the spec sections listed under B; iOS Google Maps setup; a billing account; a custom marker plan.
