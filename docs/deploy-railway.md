# Deploying to Railway

Two Railway environments, **Production** and **Dev**. Each has two services built from this repository:

| Service | Root directory | Config file | Start command |
|---|---|---|---|
| `backend` | `backend/` | `backend/railway.json` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| `frontend` | `frontend/` | `frontend/railway.json` | `node server.mjs` |

Both use the Railpack builder. The backend installs from `backend/uv.lock` and runs Python 3.13
(`backend/.python-version`). The frontend has no build step and no npm dependencies (Node 22).
Health checks: backend `GET /health`, frontend `GET /healthz`.

Set the root directory per service in Railway (Settings, Source). Railway reads `railway.json`
from that directory.

## Variables (names only; values are set in Railway, never committed)

### `backend`

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Supabase project URL for this environment |
| `SUPABASE_PUBLISHABLE_KEY` | public key |
| `SUPABASE_SECRET_KEY` | service key; backend only, never on the frontend |
| `ALLOWED_ORIGINS` | the frontend service's Railway URL of the **same environment**, e.g. `https://<frontend>.up.railway.app` (comma separated for several, no trailing slash) |
| `OPENAI_API_KEY` | optional; without it the consultant answers 503 |
| `OPENAI_MODEL` | optional; defaults to `gpt-5-mini` |

`PORT` is provided by Railway.

### `frontend`

| Variable | Notes |
|---|---|
| `API_URL` | the backend service's Railway URL of the same environment |
| `SUPABASE_URL` | same project as the backend |
| `SUPABASE_PUBLISHABLE_KEY` | public key only; never the secret key |

At start, `server.mjs` writes `js/config.js` from these three variables and refuses to start if one is
missing. Changing a variable needs a redeploy.

## Per environment

- **Production**: `backend` and `frontend` services, variables as above, pointing at the production
  Supabase project.
- **Dev**: the same two services, pointing at a **separate** Supabase project. Dev and Production must
  never share a Supabase project, so dev data and test users cannot touch production.

Each environment's `ALLOWED_ORIGINS` and `API_URL` point at that environment's own services.

## Supabase auth settings (per project)

In each Supabase project, under Authentication, URL configuration:

- **Site URL**: the frontend's Railway URL for that environment.
- **Redirect URLs**: include the same frontend URL (and `<frontend URL>/**` if links return to inner pages).

`supabase/config.toml` holds local development values only; apply the environment's URLs to each hosted
project separately. Production also needs email confirmation on and custom SMTP (see the README).

## Order of first deploy

1. Create the backend service, set its variables except `ALLOWED_ORIGINS`, deploy, and note its URL.
2. Create the frontend service with `API_URL` set to that URL, deploy, and note its URL.
3. Set `ALLOWED_ORIGINS` on the backend to the frontend URL and redeploy it.
4. Set the Supabase Site URL and redirect URLs to the frontend URL.
5. Open the frontend URL, sign up, create a studio.

## Local check of the frontend server

```sh
cd frontend
API_URL=http://localhost:8000 SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=<key> PORT=5500 node server.mjs
```

This overwrites the git-ignored `frontend/js/config.js`. For ordinary local work keep using
`npm run serve:local` with your own `config.js`.
