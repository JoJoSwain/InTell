# A3 review (Lane A): the Embark relay

**Tip reviewed:** `073b0d7` · **Brief:** `docs/briefs/A3-embark-relay.md` · **Plan review:** `A3-plan-review.md`

## Verdict

**Accepted.** It's ready to merge once `check` and `db` are green on the PR. The `db` job now starts the Routes stub. It reaches the stub through `host.docker.internal` the same way it already reaches `run-jobs`, so that should hold on GitHub's runners.

## What Claude checked
- **The handler** runs the brief's order exactly: body → registered device → rate limit → opening → 150 km → Google. Each step fails closed with a fixed phrase.
- **R1:** missing transit details keep the step. A 502 happens only when the route itself is unusable.
- **R2 (privacy):**
  - Invalid bodies return `invalid body` with no zod details.
  - Every caught error is swallowed without its message.
  - Google's error bodies are drained, never echoed.
  - `index.ts` peeks at `deviceId` only to build the 8-character log prefix.
  - Logs carry the outcome, that prefix and the mode, never the origin, the grove or the route.
- **N1:** `lang` reaches Google as `languageCode`.
- **No other mode exists:** `DRIVE` can't be reached, because the zod enum stops anything but walk, bike and transit before any call.
- **Secrets:** only the secret's **name** is in the repo (`supabase/README.md`). CI uses a dummy key in a generated env file.

## Notes (later; no change needed now)
- **N1. A missing key on staging** shows up as `upstream-error` and a 502, because Google refuses the call. That's acceptable. The staging walkthrough sets the key before the function is deployed.
- **N2. The staging smoke test waits for content.** A real call needs a registered device and a published grove with an opening, and staging has neither yet. The first real route is checked during M5c on the Pixel.

## After the merge (Claude walks Jordan through it)
1. **Google Cloud:** create a **Routes API** key, restricted to the Routes API (with no app restriction, because it's server-side). Save it in the password manager.
2. **Google Cloud quotas:** cap Routes API requests per day (for example, 1,000), and keep the $25 budget alert.
3. **Supabase dashboard:** go to Edge Functions → Secrets, and add `GOOGLE_ROUTES_API_KEY` there, not on a command line.
4. **Deploy:** `pnpm exec supabase functions deploy embark`.
