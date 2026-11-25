/**
 * Bounded focus re-request after Media3 has promoted the FGS (remote play).
 * Default: 3 tries over ~1.5 s while AudioHardening settles.
 */
export type FocusRequestFn = () => Promise<boolean>;

export async function requestFocusWithRetry(
  requestOnce: FocusRequestFn,
  opts: { tries?: number; gapMs?: number } = {},
): Promise<{ ok: boolean; attempts: number }> {
  const tries = opts.tries ?? 3;
  const gapMs = opts.gapMs ?? 500;
  let attempts = 0;
  for (let i = 0; i < tries; i += 1) {
    if (i > 0) {
      await new Promise<void>((r) => setTimeout(r, gapMs));
    }
    attempts += 1;
    const ok = await requestOnce();
    if (ok) return { ok: true, attempts };
  }
  return { ok: false, attempts };
}
