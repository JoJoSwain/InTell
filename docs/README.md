# InTell docs

| Doc | Role |
| --- | --- |
| [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) | Behavior (wins on conflict) |
| [AUDIO_SPEC.md](./AUDIO_SPEC.md) | Three layers + Hush + engine |
| [JOURNAL_SPEC.md](./JOURNAL_SPEC.md) | *(superseded by ADR 0004; becomes the Chronicle spec before M8)* |
| [PARTICIPATION_SPEC.md](./PARTICIPATION_SPEC.md) | *(superseded by ADR 0004; becomes the Journal spec before M9)* |
| [DATA_MODEL.md](./DATA_MODEL.md) | Schema / packs (wins on schema) |
| [TECH_SPEC.md](./TECH_SPEC.md) | Implementation (wins on impl) |
| [DESIGN.md](./DESIGN.md) | Tokens, map, components, copy (mobile parts superseded until M5) |
| [BUILD_PLAN.md](./BUILD_PLAN.md) | Milestones M0–M12 |
| [intell-v2-architecture.md](./intell-v2-architecture.md) | Historical v2 synthesis |
| [intell-v2-gap-and-decisions.md](./intell-v2-gap-and-decisions.md) | Historical v2 gap analysis |
| [adr/](./adr/) | Architecture decision records |
| [adr/0002-map-provider.md](./adr/0002-map-provider.md) | Map provider: Google Maps, online (Accepted) |
| [adr/0004-product-realignment.md](./adr/0004-product-realignment.md) | **Product realignment (Accepted); read first** |
| [briefs/](./briefs/) | Milestone task briefs |

Prompt for Cursor (from BUILD_PLAN):

> Read docs/PRODUCT_SPEC.md and the docs it lists, then Milestone N in docs/BUILD_PLAN.md. Implement Milestone N only. List any spec ambiguity before writing code.
