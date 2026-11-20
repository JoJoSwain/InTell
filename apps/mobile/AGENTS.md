# apps/mobile — agent notes

Read the root `AGENTS.md` first. Its hard constraints apply here. This file adds mobile-specific rules.

## Layout (this project's convention; ignore Expo templates that say otherwise)
```
apps/mobile/app/          Expo Router routes ONLY (every file is a screen; _layout.tsx defines navigators)
  index.tsx               the map home
  journal/ grow/ settings/  the three sub-screens (modal stacks)
  welcome.tsx             first-launch flow
  f/[code].tsx            QR universal link → protected fragment
apps/mobile/src/          everything else: map/, audio/, location/, session/, packs/, journal/, grow/,
                          recording/, analytics/, api/, ui/, i18n/
apps/mobile/assets/       fonts, images, animation, map-style, bundled UI sounds
```
Pure decision logic doesn't go here. It belongs in `packages/shared` so the admin Listening Simulator can use the same code.

## Expo has changed; don't trust your training data
Every Expo SDK ships breaking changes. Before writing code that touches an Expo, EAS or React Native API:
1. Read the `expo` major version in `apps/mobile/package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For anything else, use https://docs.expo.dev/llms.txt and follow its links. Never answer from memory.

## Commands (run from apps/mobile; this is a pnpm workspace, so don't use npm, yarn or bun)
```bash
pnpm exec expo install <package>   # ALWAYS use this to add packages (SDK-compatible versions)
pnpm exec expo install --check     # verify versions match the SDK
pnpm exec expo-doctor              # diagnose dependency and config issues
pnpm start                         # dev server
pnpm lint                          # expo lint
pnpm typecheck                     # tsc --noEmit
```
Run lint and typecheck before declaring any task done.

## Native rules
- `ios/` and `android/` are generated (Continuous Native Generation) and gitignored. Never create or edit them by hand. Configure native behavior in `app.json`, `app.config.js` and config plugins.
- This app needs a **development build** (`expo-dev-client`), not Expo Go, because of its native modules. Don't run prebuild, native builds or device installs unless the product owner asks.
- Secrets (e.g. map keys) come from `apps/mobile/.env` (gitignored) via `app.config.js`. Add new keys to `.env.example` with empty values.

## Location and permissions
- Request **foreground ("While Using")** permission only, and only after the location explainer screen (PRODUCT_SPEC §3.1). Never request it on map mount for a first-time user.
- Never request "Always" or Android `ACCESS_BACKGROUND_LOCATION`. Background location runs only during an exploring session, via the iOS background mode or an Android foreground service.
- Coordinates never leave the device.

## Map
The map provider is pending **ADR 0002**. Don't add marker systems, map layers or offline tile code until it's Accepted.
