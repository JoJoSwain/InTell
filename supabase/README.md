# Supabase (InTell)

Local stack: `pnpm exec supabase start`, then `pnpm db:setup-local` from the repo root (Lane A only).

## Edge function secrets (names only)

| Secret | Used by | Notes |
|---|---|---|
| `GOOGLE_ROUTES_API_KEY` | `embark` | Google Cloud key restricted to the **Routes API**. Set a **daily quota** on that key in Google Cloud as the cost backstop (ADR 0005). Never commit the value. |

Hosted projects also inject `SUPABASE_URL`, publishable keys, and secret keys automatically.

### Local / CI embark stub

Integration tests do not call Google. Start the stub, then serve functions with a generated env file (never commit it):

```bash
node tools/routes-stub.mjs &
# write a temp env file, e.g.:
#   GOOGLE_ROUTES_BASE_URL=http://host.docker.internal:8791
#   GOOGLE_ROUTES_API_KEY=test-not-a-real-key
# (host.docker.internal: the edge runtime is in Docker; the stub is on the host)
pnpm exec supabase functions serve --env-file /tmp/embark-functions.env
```

The CI `db` job does the same with a generated `--env-file` (plan review N3).
