# Car Repair Tracker

![Car Repair Tracker](./public/banner.svg)

Track repairs, know your cost/km, never miss a service deadline. A web app for individual car owners who want structured repair history, automatic cost aggregation, and maintenance reminders — without spreadsheets.

## Features

- **Vehicle management** — add cars with make, model, year, and baseline mileage
- **Repair tracking** — log repairs with date, description, cost, and odometer reading; edit or delete with confirmation
- **Cost/km dashboard** — automatic cost-per-kilometer calculation updated after every repair
- **AI classification** — repairs auto-categorized into six categories (silnik, hamulce, elektryka, ogumienie, przegląd, inne) via Google Gemini; manual override available
- **Service reminders** — define maintenance thresholds (km or time interval) per vehicle and see alerts on the dashboard
- **Cost trend charts** — visual cost/km, total cost, and mileage trends over time (Recharts)
- **Demo mode** — one-click demo account with realistic seed data; demo accounts cleaned up nightly
- **Error tracking** — Sentry integration for server-side error monitoring

## Tech Stack

- [Astro](https://astro.build/) v6 — server-first rendering (SSR via Node.js standalone adapter)
- [React](https://react.dev/) v19 — interactive islands
- [TypeScript](https://www.typescriptlang.org/) v5 — type safety
- [Tailwind CSS](https://tailwindcss.com/) v4 — utility-first styling
- [shadcn/ui](https://ui.shadcn.com/) — component library (new-york style)
- [Supabase](https://supabase.com/) — auth + Postgres database with RLS
- [Google Gemini](https://ai.google.dev/) — AI repair classification (Gemini 2.5 Flash-Lite)
- [Recharts](https://recharts.org/) — cost trend charts
- [Sentry](https://sentry.io/) — error tracking
- [Playwright](https://playwright.dev/) — E2E testing

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)
- [Docker](https://www.docker.com/) (for local Supabase — ~7 GB RAM)

## Getting Started

1. Clone the repository:

```bash
git clone git@github.com:maciejszklarczyk/car-repair-tracker.git
cd car-repair-tracker
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Start local Supabase and apply migrations:

```bash
npx supabase start
npx supabase db reset
```

Copy the credentials printed by `supabase start` into `.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` — start development server
- `npm run build` — build for production
- `npm run preview` — preview production build
- `npm run lint` — run ESLint with type-checked rules
- `npm run lint:fix` — auto-fix ESLint issues
- `npm run format` — run Prettier
- `npm run test` — run unit tests (Vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run e2e` — run E2E tests (Playwright, requires local Supabase running)
- `npm run review:eval` — run promptfoo evaluation comparing AI review models

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── vehicles/        # vehicle-specific components (forms, cards, charts)
│   │   └── hooks/           # React hooks
│   ├── layouts/             # Astro layouts
│   ├── lib/                 # Services & helpers (Supabase client, cost calculations, AI classification, schemas)
│   ├── pages/
│   │   ├── api/
│   │   │   ├── auth/        # signin, signup, signout
│   │   │   ├── repairs/     # CRUD endpoints
│   │   │   ├── service-thresholds/  # CRUD endpoints
│   │   │   └── demo.ts      # demo account creation + seed
│   │   ├── auth/            # signin, signup, confirm-email pages
│   │   └── dashboard/
│   │       ├── vehicles/    # vehicle list, detail, add
│   │       └── repairs/     # add repair, edit repair
│   └── types.ts             # Shared entity types and DTOs
├── e2e/                     # Playwright E2E tests
├── supabase/
│   └── migrations/          # Postgres migrations (cars, repairs, service_thresholds, categories)
├── public/                  # Static assets
└── Dockerfile               # Production container build
```

## Supabase Configuration

Supabase provides auth and Postgres database. Environment variables are declared via Astro's `astro:env` schema as **server-only secrets**.

### Local development

1. Start local Supabase stack:

```bash
npx supabase start
```

2. Apply database migrations (creates `cars`, `repairs`, `service_thresholds` tables with RLS):

```bash
npx supabase db reset
```

3. Copy credentials from CLI output into `.env`.

The local Studio UI is available at `http://localhost:54323`.

To stop the stack:

```bash
npx supabase stop
```

### Cloud Supabase project

Add these variables to `.env`:

| Variable         | Description                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`   | Project URL from Supabase dashboard → Settings → API                                                     |
| `SUPABASE_KEY`   | `anon` public key from Supabase dashboard → Settings → API                                               |
| `GEMINI_API_KEY` | Optional — API key from [Google AI Studio](https://aistudio.google.com/apikey) for repair classification |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional — service role key for demo account creation (from Supabase dashboard → Settings → API) |
| `SENTRY_DSN` | Optional — Sentry DSN for error tracking |
| `SENTRY_AUTH_TOKEN` | Optional — Sentry auth token for source map uploads |
| `OPENROUTER_API_KEY` | Optional — [OpenRouter](https://openrouter.ai) API key for AI code review agent and promptfoo evaluation |

### Email confirmation in local development

To skip email confirmation during local development:

1. Open Supabase dashboard → **Authentication → Email → Confirm email**
2. Toggle it **off**

### Routes

| Route                          | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| `/auth/signin`                 | Email/password sign-in                               |
| `/auth/signup`                 | Email/password sign-up                               |
| `/auth/confirm-email`          | Post-signup confirmation page                        |
| `/dashboard/vehicles`          | Vehicle list                                         |
| `/dashboard/vehicles/new`      | Add vehicle form                                     |
| `/dashboard/vehicles/[id]`     | Vehicle detail (cost/km, repairs, charts, reminders) |
| `/dashboard/repairs/new`       | Add repair form                                      |
| `/dashboard/repairs/[id]/edit` | Edit repair form                                     |

All `/dashboard/*` routes redirect to `/auth/signin` if unauthenticated. Protection handled in `src/middleware.ts`.

## Gemini AI Classification

New repairs are automatically classified into one of six categories (silnik, hamulce, elektryka, ogumienie, przegląd, inne) using Google Gemini 2.5 Flash-Lite. Classification is optional — without `GEMINI_API_KEY`, repairs save with `pending` status and users pick the category via dropdown.

### Setup

Add to `.env`:

```
GEMINI_API_KEY=<your-api-key>
```

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey). The key is declared as an optional server-only secret in `astro.config.mjs`.

### Free tier limits

- 30 requests per minute, 1,500 requests per day
- Classification adds ~1–2s to repair creation (3s timeout)

## Deployment

A `Dockerfile` and `docker-compose.prod.yml` are included for deployment.

```bash
docker compose -f docker-compose.prod.yml up -d
```

## CI

GitHub Actions workflows:

- **`ci.yml`** — runs lint (ESLint + `astro check`), unit tests (Vitest), and build as parallel jobs on every push and PR to `main`. E2E tests (Playwright) run on PRs only, against a local Supabase instance.
- **`ai-review.yml`** — AI code review on every PR to `main`/`master`. Reviews the diff using OpenRouter, posts verdict as a PR comment and Job Summary.
- **`deploy.yml`** — builds and pushes a Docker image on release publish or manual trigger.
- **`demo-cleanup.yml`** — nightly cron (03:00 UTC) deletes expired demo accounts and their data.

Required repository secrets: `SUPABASE_URL`, `SUPABASE_KEY`. Additional secrets: `OPENROUTER_API_KEY` (AI review), `SUPABASE_SERVICE_ROLE_KEY` (demo cleanup).

## License

MIT

## Coded with the help of CLAUDE CODE
<p align="center">
  <img src="./public/mann.gif" width="200" alt="Mann" />
</p>