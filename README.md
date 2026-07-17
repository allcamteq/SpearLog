# SpearLog

A personal spearfishing activity log: record sessions (location, tide, conditions, catches, rating, GPS), filter/analyze them, and export everything to CSV.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Turso](https://turso.tech) (hosted libSQL — SQLite-compatible) via [Drizzle ORM](https://orm.drizzle.team)
- Tailwind CSS, react-hook-form + zod, recharts

Locally, the app talks to a plain libSQL file (`./local.db`) with zero setup. In production it talks to a hosted Turso database — same client code, just different env vars — since Vercel's serverless functions have a read-only, ephemeral filesystem that a local SQLite file can't survive.

## Local development

```bash
npm install
npm run db:push   # creates the sessions/catches tables in ./local.db
npm run dev
```

Open 
. No env vars are required for local dev.

## Data model

- **Session** — one row per spearfishing outing: date, location, country, comments, high/low tide time, tide type (High to Low / Low to High), slack tide time, high/low tide ratio, current, visibility, depth, weighting, time of day, GPS lat/long, overall rating (1-5).
- **Catches** — a session can have any number of catch rows: species, quantity, weight (kg), size (cm).

## Filtering & analysis

The dashboard (`/`) filters sessions by location, country, rating range, date range, species, and tide type — e.g. "all sessions at a location with rating ≥ 4". The **Export CSV** button exports exactly the currently filtered set (or everything, with no filters applied).

`/analysis` shows aggregate stats — total sessions, total fish caught, average rating, average rating by location, and catch counts by species.

## CSV export

`GET /api/sessions/export` (same filter query params as the dashboard) returns one CSV row **per catch**, with session fields repeated across a session's catches (sessions with no catches still get one row). This is deliberately denormalized so the export is directly pivotable in a spreadsheet.

## Deploying to Vercel with Turso

1. Install the Turso CLI and log in:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
2. Create a database and grab its URL + a token:
   ```bash
   turso db create fishlog
   turso db show fishlog --url        # -> TURSO_DATABASE_URL
   turso db tokens create fishlog     # -> TURSO_AUTH_TOKEN
   ```
3. Create the tables on the hosted database:
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push
   ```
4. In the Vercel project settings, add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, and `LOCATIONIQ_API_KEY` as environment variables (Production, and Preview if you want preview deploys to share the data). `LOCATIONIQ_API_KEY` is required in production — geocoding falls back to the free Nominatim endpoint locally (fine from a home IP), but Nominatim blocks cloud/datacenter IPs, so it fails silently on Vercel without this set. Sign up for a free key at [locationiq.com](https://locationiq.com).
5. Deploy (via `vercel --prod` or by connecting the git repo).

For local dev against the same hosted data instead of the local file, copy `.env.example` to `.env.local` and fill in the same two values.

## Schema changes

- Pre-launch / iterating on the schema: `npm run db:push` (fast, no migration files).
- Once there's real data worth preserving: `npm run db:generate` (writes a migration under `drizzle/`) then `npm run db:migrate` to apply it — do this against both local and Turso.
