# Atelier — AI-assisted interior design platform

Phase 1 of the product described in `Interior_Design_AI_PRD_EN.md`: studios, client entry
(studio link, personal invite, guest trial), a guided room wizard, a 2D floor-plan editor,
immutable plan versions, and tenant isolation.

```
frontend/   Static HTML/CSS/ES modules, no build step. UI follows the Stitch "Architectural Atelier" design system.
            vendor/ holds the official supabase-js browser build (from npm), so no third-party script loads at runtime.
backend/    FastAPI API (Python 3.13, managed with uv).
supabase/   Database migrations and the auth settings this project manages.
```

## How it fits together

- The browser uses `supabase-js` only to sign in. All data goes through the backend API (`/v1/...`).
- The backend **reads** with the caller's JWT, so Postgres row-level security decides what is visible.
- The backend **writes** with the service key, after validating the payload and confirming access with
  an RLS-scoped read. Signed-in users have no write access to the tables at all, so validation and the
  audit trail cannot be bypassed through the Supabase Data API.
- A plan is one JSON document per version (centimetres; see `backend/app/schemas.py` and
  `frontend/js/plan.js`). Saving never overwrites: it adds a version tagged `client` or `designer`.
- A guest's plan lives in the browser (`localStorage`) until they register and save.

## Run locally

Prerequisites: Python 3.13 + [uv](https://docs.astral.sh/uv/), Node 22 (frontend tests only), the Supabase CLI.

1. `backend/.env` — copy `backend/.env.example` and fill in the Supabase URL and keys
   (`supabase projects api-keys --project-ref <ref> --reveal`).
2. `frontend/js/config.js` — copy `frontend/js/config.example.js` and fill in the URL and the **publishable** key.
3. Start both servers:

```sh
cd backend  && uv run uvicorn app.main:app --port 8000
cd frontend && python -m http.server 5500
```

Open <http://localhost:5500>. Create a studio, then open the studio link it shows to try the client journey.

## Tests

```sh
cd backend  && uv run pytest        # unit + integration (real Supabase) + browser E2E
cd frontend && npm test             # plan logic (node --test)
```

Integration and E2E tests run against the project in `backend/.env`, create throw-away users
(`*@owndesign-test.example.com`) and delete them afterwards. They are skipped when `.env` is missing.
First E2E run needs `uv run playwright install chromium`.

## Deploy

Railway (Production and Dev, backend and frontend services): see [`docs/deploy-railway.md`](docs/deploy-railway.md).

## Database and auth settings

```sh
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations
supabase config push      # applies the auth settings declared in supabase/config.toml
```

`supabase/config.toml` currently holds **development** values: email confirmation is off and the
site URL is `localhost:5500`. Production needs confirmation on, custom SMTP, and its own URLs.

## Not in Phase 1

Design brief, moodboards, AI consultant, renderings, budget, dossier, messaging and tasks, studio
branding, invitation emails (the designer copies an invite link), per-project team permissions,
Railway deployment files, rate limiting, subscriptions and credits.
