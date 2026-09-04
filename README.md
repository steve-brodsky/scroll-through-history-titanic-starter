# Scroll Through History — Titanic Starter

This is the first vertical slice for **Scroll Through History**.

Initial playable window:
**RMS Titanic, April 14, 1912 10:30 PM → April 15, 1912 12:30 AM**

The architecture deliberately separates historical generation from the public feed:

sources → claims → events → candidate posts → validation → human review → published feed

The public website does **not** generate canonical historical posts live.

## 1. Run the UI immediately

Requirements: a current Node.js installation.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Then open **Titanic — Episode 001**.

No Supabase account is required for this first screen. If database environment variables are
missing, the page uses a tiny local development feed.

## 2. Create Supabase

Create a Supabase project.

Run the migrations in order:

```text
supabase/migrations/20260903000000_history_core.sql
supabase/migrations/20260903000001_claim_ingestion.sql
```

in the Supabase SQL editor.

Then run:

```text
supabase/seed.sql
```

Copy `.env.example` to `.env.local` and add:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The feed code will then attempt to read published posts from Supabase and fall back to the
local demo if none exist yet.

For the server/admin claim importer, also add:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Older projects may use `SUPABASE_SERVICE_ROLE_KEY` as a fallback for the secret key.

The server-backed Claim Review v1 workbench is available at:

```text
http://localhost:3000/admin/claims
```

This is currently a development-only administrative route. It keeps the Supabase secret
in server-only modules, but it must be placed behind authenticated authorization before a
public production deployment.

After applying both migrations, import a validated extraction with:

```bash
npm run import:claims -- data/generated/claims/titanic-1912/british-inquiry-bride-day14/q16503-16518.json
```

## 3. Add the OpenAI key for offline generation

In `.env.local`:

```text
OPENAI_API_KEY=...
OPENAI_EXTRACTION_MODEL=gpt-5.6-terra
```

Do not expose the OpenAI key to client-side code.

## 4. Run our first real AI pipeline stage

A short, source-backed development note is already included at:

```text
data/source-notes/british-inquiry-assistance.md
```

Run:

```bash
npm run extract:events
```

The result is written to:

```text
data/generated/extracted-events.json
```

Open that file and review it manually.

That is the first genuine content-pipeline milestone:
**historical source → structured events**.

## 5. Why the timestamps are split in the database

Three fields matter:

- `occurred_at` — when the event happened
- `known_by_actor_at` — when the relevant historical actor could know it
- `publicly_known_at` — when the wider public could know it

This prevents the AI from giving characters future knowledge.

## Next implementation milestones

1. Source registry + ingestion CLI
2. Claim extraction and claim review
3. Event builder that groups approved claims
4. Character/entity profiles and voice constraints
5. Candidate post generator
6. Automated factuality / anachronism / knowledge-boundary checks
7. Admin approve / edit / reject UI
8. Publish the 10:30 PM–12:30 AM Titanic slice
9. Expand to 2:20 AM
10. Expand outward to the full April 10–18 episode
