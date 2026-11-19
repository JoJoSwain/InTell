# ADR 0000 — Record architecture decisions

## Status
Accepted

## Context
InTell v2 has high-risk choices (audio engine, map tiles, pack delivery). We need a lightweight ADR trail under `docs/adr/`.

## Decision
- Number ADRs sequentially (`0001-…`).
- M1 must produce `0001-audio-engine.md` from the device spike (BUILD_PLAN).
- Tile provider decision (MapTiler vs PMTiles) lands as an ADR at the start of M5.

## Consequences
Milestone PRs that change stack defaults update or add an ADR.
