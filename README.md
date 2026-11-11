# TRACE — AI-Powered Business Intelligence & Automation Platform

TRACE has evolved from a local event investigation MVP into an operational intelligence workspace that combines AI reasoning, business APIs, database memory, and deterministic analysis. The project preserves the existing event-first foundation while adding workflow orchestration, external integrations, investigation execution, and trustable rule validation.

## Product direction

TRACE helps teams understand operations across payments, orders, inventory, logistics, and customer activity. It is designed to:

- interpret business questions in natural language,
- retrieve the relevant events and investigation records from the database,
- call approved business APIs when configured,
- run deterministic validation checks independently of model reasoning,
- identify contradictions, missing states, and dependency issues,
- recommend safe actions with evidence,
- record the final outcome for audit and review.

The application remains grounded in the existing TRACE architecture: React + TypeScript frontend, Express API, and SQLite persistence. The current MVP focuses on correctness, account-level isolation, and evidence-based workflows rather than a generic chatbot experience.

## Run it locally

Requirements: Node.js 20 or later and npm.

```bash
npm install
cp .env.example .env
```

Set `AUTH_SECRET` in `.env` to a random value of at least 32 characters. One way to generate it is:

```bash
openssl rand -base64 48
```

Email/password authentication works without a Supabase project. To enable **Continue with Google**, configure Supabase Auth first:

1. In Supabase, enable the Google provider under **Authentication → Sign In / Providers** and add your Google OAuth client ID and secret. Google’s authorized redirect URI must be the callback URL shown by Supabase for your project.
2. In **Authentication → URL Configuration**, add `http://localhost:5173/auth/callback` to the redirect URL allow list. Add your deployed app’s `/auth/callback` URL there before using Google sign-in in production.
3. Copy the Supabase project URL and its **publishable** (or legacy anon) key into `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, then restart the dev server. Never use the Supabase service-role key in the app.

For production, also set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the API server's environment so it can verify Google sessions. These are public project values; never use the Supabase service-role key.

The browser uses Supabase to complete Google OAuth. TRACE verifies the Supabase access token on its server, then issues its existing HTTP-only session cookie. Investigation data and account ownership remain in SQLite. Google accounts with an already-registered, verified email are linked to that TRACE account.

To enable live responses in the AI Workspace, add your OpenAI API key to the server's `.env` file:

```env
OPENAI_API_KEY=your-key
# Optional; defaults to gpt-4.1-mini
OPENAI_MODEL=gpt-4.1-mini
```

Keep the key server-side: do not prefix it with `VITE_`, commit it, or enter it in the browser. Restart TRACE after updating `.env`. When a user submits a question, TRACE sends that question and a limited set of their own event, investigation, relationship, and deterministic finding records to OpenAI. The response is grounded in those records; it does not execute actions or claim to have checked external systems.

Then start the client and API together:

```bash
npm run dev
```

Open the Vite URL printed by the command (normally `http://localhost:5173`). Register an account to enter the workspace. The SQLite database is created at `data/trace.sqlite` automatically. Keep the `.env` and database file private.

To create a production build and run the bundled app locally:

```bash
npm run build
NODE_ENV=production npm start
```

The production server requires `AUTH_SECRET` (at least 32 characters) and serves the compiled client from `dist/` on port 8787 by default. Set `PORT` or `DATABASE_PATH` in `.env` to override the defaults.

## What works

- Email/password registration and sign-in; optional Supabase Google OAuth; bcrypt password hashes and HTTP-only session cookies.
- Per-user data ownership enforced by the REST API.
- Event create, edit, delete, filter, and search.
- Investigation create, delete, event membership, and chronological evidence view.
- Event relationships: caused by, followed by, related to, contradicts, and depends on.
- Rule-based findings for failed payments alongside successful orders, missing payment attempts or outcomes, duplicate event records in a case, reversed dependency timestamps, and explicit contradictions.
- The AI Workspace retrieves account-owned records and deterministic findings, then requests an evidence-grounded response from OpenAI when `OPENAI_API_KEY` is configured.
- Responsive landing page, overview metrics from SQLite, event and investigation lists, timeline, and account settings.

Detection is deterministic and reports why each rule matched. OpenAI responses are separate from deterministic calculations and do not replace their results. Events are entered through the user interface in this MVP (there is no external event-ingestion integration yet).

## Project layout

- `src/` — React and TypeScript client.
- `server/` — Express REST API and SQLite schema.
- `preview/` — standalone, static marketing preview deployed as its own asset folder; it intentionally does not host the private local API.
- `data/` — runtime SQLite database (created when the server starts).

## REST routes

All `/api` routes except health and authentication require a signed session cookie.

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/supabase`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/overview`
- `GET|POST /api/events`, `PUT|DELETE /api/events/:id`
- `GET|POST /api/investigations`, `GET|PUT|DELETE /api/investigations/:id`
- `POST|DELETE /api/investigations/:id/events/:eventId` (add uses `POST /api/investigations/:id/events` with `{ "eventId": 1 }`)
- `GET|POST /api/relationships`, `DELETE /api/relationships/:id`
- `GET /api/analysis/detect`

## Tests

```bash
npm test
```

The integration test uses a temporary database and verifies authentication, input validation, event and investigation flows, rule checks, and account isolation.
