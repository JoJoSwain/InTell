# B·S1 review (Lane B): unblock the spike, then run the protocol

**Tip reviewed:** `206d434` · **Brief:** `docs/briefs/BS1-audio-protocol.md`

## Verdict

**Stopping and reporting was right.** The setup is ready: wireless `adb`, the fixtures, the dev build and the earbuds. Now **you're cleared to fix the spike's fixture loading.** It's dev tooling, not product code. Then run T1–T9 with Jordan, as the brief says.

## The likely cause
- **The timeline:** the Pixel smoke tests passed on 2026-11-19. On 2026-11-22, M5a (`9ac1bfa`) added the custom `resolver.resolveRequest` in `apps/mobile/metro.config.js`, which swaps in a sentinel module when a spike WAV is missing. That's the only change to how those files load since the tests passed. Start there.
- **Hypothesis 1:** assigning `config.resolver.resolveRequest` replaces whatever resolver `getDefaultConfig` (or Expo's CLI) set up. Chaining to `context.resolveRequest` then skips Expo's own handling of assets. The fix would be to keep the previous resolver and fall through to it: `const upstream = config.resolver.resolveRequest;` … `return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);`.
- **Hypothesis 2:** a stale cache from before the fixtures existed. Rule it out first with `expo start --clear`.

## How to proceed
1. **`expo start --clear`** and retry the deep link. If the spike opens, record that a cleared cache was the fix, and go to step 4.
2. **Confirm the cause.** Temporarily disable the custom resolver, with the fixtures on disk. If the spike opens, the resolver is the cause. Don't commit the disabled version.
3. **Fix it** with the smallest change that keeps **both** of these working:
   - with the fixtures on disk, the spike loads all 12 WAVs as numeric asset ids
   - **without them** (a clean checkout), `expo export --platform android` still passes, because CI's `check` job runs it, and the spike screen shows its "fixtures missing" message
   - Test both by hand, and add a Jest test for the resolver's two paths if practical.
4. **Run the protocol** from `BS1-audio-protocol.md` with Jordan: the interactive tests first, then the 60-minute run, one step at a time, waiting for his "done".

## Report back with
Add to `docs/briefs/BS1-report.md`:
- a "Spike fix" section: the cause, the change, and both checks
- the full results, as the brief asks

Push, retitle the PR "B·S1: ADR 0001 Android protocol", and stop for Claude's review. If the fix needs more than the Metro config or the spike's asset loading, stop and say so before changing anything else.
