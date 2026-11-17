# ProducerOS

**Prospect Smarter. Produce More.** A prospecting CRM for commercial P&C insurance producers: renewal intelligence, a Kanban sales pipeline, follow-up tasks, AI outreach, commission forecasting, and Stripe subscriptions.

- **Live demo (no setup needed):** run the app and open `/demo`. Every record in it is fictional, and nothing is written to the database.
- **Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn-style components on Radix · Lucide · Supabase (Postgres, Auth, RLS) · OpenAI Responses API · Stripe · Vercel-ready.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

Without any env values, the marketing pages and the full `/demo` workspace still work. App routes redirect to a setup notice.

## Environment variables

| Variable | Where to get it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Your site URL (`http://localhost:3000` locally) | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` public key | yes (safe: RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | **no**. Used only by the Stripe checkout and webhook routes |
| `OPENAI_API_KEY` | platform.openai.com → API keys | **no** |
| `OPENAI_MODEL` | Model id, default `gpt-5-mini` | no |
| `AI_ENABLED` | `false` disables all AI calls instantly (cost kill-switch) | no |
| `STRIPE_SECRET_KEY` | Stripe Dashboard (**Test mode**) → Developers → API keys → `sk_test_…` | **no** |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output, or the webhook endpoint's signing secret (`whsec_…`) | **no** |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` | Price IDs (`price_…`) of two monthly recurring prices you create in Stripe test mode | no |
| `ALLOW_LIVE_BILLING` | Leave `false`. The app **refuses `sk_live_` keys** unless this is exactly `true` | no |
| `NEXT_PUBLIC_PRICE_STARTER_CENTS` / `…_PRO_CENTS` | Display prices (default 2900 / 4900). Keep them in sync with Stripe | yes |

## Supabase setup

1. Create a project at supabase.com.
2. Run the migration, either with the CLI (`supabase link && supabase db push`) or by pasting `supabase/migrations/20261117000001_init.sql` into the SQL editor.
3. **Auth → URL configuration:** set Site URL to `NEXT_PUBLIC_APP_URL` and add `<APP_URL>/auth/confirm` to the redirect URLs.
4. **Auth → Email templates:** point the *Confirm signup* and *Reset password* links at the token-hash flow:
   - Confirm: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
   - Reset: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
5. Keep "Confirm email" enabled (Auth → Providers → Email).

Signing up triggers `handle_new_user`, which creates the profile, the default settings, and a 14-day trial.

## Stripe setup (test mode)

1. In **test mode**, create a product "ProducerOS" with two monthly prices ($29 and $49). Copy the price IDs into the env file.
2. Enable the Customer Portal (Settings → Billing → Customer portal) and allow plan switching between the two prices.
3. Forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the `whsec_…` secret into `STRIPE_WEBHOOK_SECRET`.
4. Webhook events used: `checkout.session.completed`, `customer.subscription.created|updated|deleted`.
5. Test card: `4242 4242 4242 4242`, any future date, any CVC.

> Live billing stays off until you deliberately switch to `sk_live_` keys **and** set `ALLOW_LIVE_BILLING=true`.

## Deploying to Vercel

Import the repo, add the env variables above (Production + Preview), and deploy. Then add a Stripe webhook endpoint at `https://<domain>/api/stripe/webhook` and update the Supabase Site URL and redirect URLs to the production domain.

---

## Architecture

```
src/
  app/
    (marketing)/          landing, pricing
    (auth)/               login, signup, forgot/reset password, verify email
    (app)/                authenticated app (generated thin pages → views)
    demo/                 same views backed by fictional in-memory data
    api/ai/generate       AI drafts (quota + rate limit + history)
    api/prospects/export  CSV export (formula-injection safe)
    api/stripe/*          checkout, portal, signed + idempotent webhook
    auth/confirm          email verification / recovery / PKCE
  proxy.ts                session refresh + route protection (Next 16 "proxy")
  views/                  one server component per screen, mode-agnostic
  components/ui           design-system primitives
  components/app          feature components (pipeline board, calendar, forms…)
  lib/
    data/                 Repo interface → live-repo (Supabase/RLS) | demo-repo (memory)
    domain/               pure, unit-tested logic: commission, renewals, pipeline, CSV, KPIs, AI prompts
    actions/              server actions (auth check → zod → RLS query → audit → revalidate)
    validations/          zod schemas shared by client & server
    providers/            pluggable licensed business-data provider interface
    plans.ts              plan config + entitlements (feature gating)
supabase/migrations/      schema, indexes, constraints, RLS, triggers, transactional RPCs
tests/                    vitest unit tests + SQL RLS tests
scripts/gen-routes.mjs    generates live + demo page files from one route table
```

**Data flow.** Every page asks for a `Repo`. In the live app, that repo runs Supabase queries as the signed-in user, so RLS applies to every read. Demo mode swaps in an in-memory repo built from fictional data. The two never mix: the demo has no database client at all.

### Security
- Row Level Security on every table. Child rows (tasks, activities, opportunities, contacts) must also reference a prospect the user owns, which is enforced in the `WITH CHECK` clauses.
- Subscriptions are read-only for users; only the service role writes them, from the verified webhook.
- RPCs are `SECURITY INVOKER`, so RLS still applies inside the transactions.
- Every server action re-authenticates, validates with zod, and filters by `user_id` on top of RLS.
- Append-only `audit_logs` record creates, updates, archives, imports, exports, stage changes, AI use, and billing.
- Rate limits: AI uses DB-backed per-minute and monthly quotas. Login, signup, reset, import, export, and checkout use an in-memory limiter (swap in Redis for multi-region).
- Secrets live server-side only (`server-only` imports). Error messages are generic. Security headers are set in `next.config.ts`.
- CSV export neutralizes formula injection. External links use `noopener noreferrer`.

### Key product rules
- **Unknown renewal dates stay unknown.** A database constraint enforces this: a renewal date is either present and `known`/`estimated`, or absent and `unknown`. Estimates are labeled everywhere they appear, and AI prompts receive them as `ESTIMATE`.
- **No duplicate renewal tasks.** A unique index on `(prospect_id, renewal_cycle_date, renewal_offset_days)` plus the atomic `sync_renewal_tasks` RPC means you can recalculate any number of times. Completed tasks are preserved, and stale open tasks are replaced when the date changes.
- **The AI never sends anything.** It receives only stored facts, with unknowns marked explicitly, and is instructed never to invent coverage, carriers, renewal dates, or policies.
- All commission figures are labeled as estimates, and the formulas are shown.

## Testing

```bash
npm test             # 19 unit tests: commission, renewal engine, CSV, validation, pipeline, AI prompt safety, plans, demo data
npm run typecheck
npm run build
PGHOST=… PGPORT=… PGUSER=postgres ./scripts/test-db.sh   # applies migrations to a scratch DB and asserts RLS isolation, no-duplicate renewals, atomic stage moves
```

## Known limitations / next steps
- Changing renewal offsets in Settings doesn't rewrite existing tasks automatically. Click **Recalculate tasks** (on Settings or Renewal Calendar) to apply them.
- Concurrent AI requests could exceed the monthly quota by a few generations. For strict enforcement, move the quota check into an RPC.
- No licensed business-data provider is connected yet. Implement `BusinessDataProvider` in `src/lib/providers` once one is licensed.
- Recommended before launch: an E2E suite against a staging Supabase project, Sentry, a Redis-backed rate limiter, and legal pages (terms and privacy).
