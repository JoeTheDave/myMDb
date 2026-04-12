# myMDb — Claude Code Context

## What This Is
A personal movie and media database for tracking, rating, and managing a film collection — with full cast/crew data and admin-controlled access.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, React Router
- **Backend**: Express, Prisma ORM, TypeScript, pino logging
- **Auth**: Google OAuth via Passport.js (no email/password login)
- **Database**: PostgreSQL — `sage-shared-dev-postgres` Docker container locally, `sage-shared-postgres` Fly.io cluster in prod
- **Deployment**: Fly.io — `mymdb` (prod), `mymdb-staging` (staging)
- **Node**: 24 (v24.14.1)

## Repo Structure
```
mymdb/
├── client/                  # React frontend (Vite, port 5173)
│   └── src/
│       ├── components/      # Shared UI components (shadcn/ui + custom)
│       ├── hooks/           # useAuth, useTheme, etc.
│       ├── lib/             # utils, api client
│       └── pages/           # Route-level components
├── server/                  # Express backend (port 3001)
│   └── src/
│       ├── prisma/          # schema.prisma + migrations
│       ├── routes/          # auth, media, actors, users
│       ├── middleware/       # auth middleware, role guards
│       └── lib/             # seed.ts, logger, etc.
├── scripts/                 # ensure-postgres.sh, ensure-database.sh
├── fly.toml                 # production Fly.io config
├── fly.staging.toml         # staging Fly.io config
├── Dockerfile               # multi-stage: builder (node:24-alpine) + runner (node:24-alpine)
└── .dockerignore            # excludes **/node_modules, **/dist, **/.env
```

## Auth & Roles
- **Google OAuth only** — login is `/api/auth/google`, callback is `/api/auth/google/callback`
- No email/password. No self-registration.
- Three roles: `ADMIN > EDITOR > VIEWER`
- All app routes are protected — unauthenticated users are redirected to `/login`
- **Seeded admin**: `joethedave@gmail.com` (ADMIN role, created on app startup via `seed.ts`)
- New users who log in via Google are created with `VIEWER` role by default
- Role upgrades are managed by an ADMIN through the `/admin` page

## Data Model (key entities)
- `User` — Google OAuth profile + role assignment
- `Media` — movies/TV with title, year, type (MOVIE/TV_SHOW), content rating, poster image
- `Actor` — name, bio, profile image
- `CastRole` — join table linking Media ↔ Actor with character name and billing order
- `Rating` — user ratings (1–10) on Media

All primary keys are UUIDs: `String @id @default(uuid())`.

## Frontend Routes
| Route | Auth | Description |
|-------|------|-------------|
| `/login` | Public | Full-screen Google sign-in |
| `/movies` | VIEWER+ | Movie grid with filter/sort bar |
| `/movies/:id` | VIEWER+ | Media detail with cast and ratings |
| `/movies/new` | EDITOR+ | Add movie form |
| `/movies/:id/edit` | EDITOR+ | Edit movie form |
| `/actors` | VIEWER+ | Actor grid |
| `/actors/:id` | VIEWER+ | Actor detail with filmography |
| `/actors/new` | EDITOR+ | Add actor form |
| `/actors/:id/edit` | EDITOR+ | Edit actor form |
| `/admin` | ADMIN | User management (role assignment) |

## Databases
| Environment | Database | Connection |
|-------------|----------|------------|
| Local dev | `mymdb_dev` | `sage-shared-dev-postgres` Docker (port 5432, password `localdev123`) |
| Staging | `mymdb_staging` | `sage-shared-postgres.flycast:5432` (Fly secret) |
| Production | `mymdb_prod` | `sage-shared-postgres.flycast:5432` (Fly secret) |

## Environment Variables

`.env` (local dev):
```
DATABASE_URL=postgresql://postgres:localdev123@localhost:5432/mymdb_dev
PORT=3001
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
JWT_SECRET=...
FRONTEND_URL=http://localhost:5173
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=...
AWS_REGION=...
```

Production Fly secrets (set via `fly secrets set -a mymdb`):
`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `AWS_REGION`

`FRONTEND_URL` and `PORT` are set in `fly.toml [env]` (not secrets — they're not sensitive).

## Key npm Scripts

Run from `server/`:
```bash
npm run dev              # tsx watch — starts server with hot reload
npm run build            # tsc compile to dist/
npm run db:migrate       # prisma migrate dev (creates new migration)
npm run db:migrate:deploy # prisma migrate deploy (runs pending migrations)
npm run db:generate      # regenerate Prisma client after schema changes
npm run db:seed          # run seed.ts (creates admin user)
npm run db:studio        # open Prisma Studio
npm run test             # vitest run
```

Run from `client/`:
```bash
npm run dev    # vite dev server (port 5173)
npm run build  # tsc + vite build → dist/
npm run lint   # eslint
```

## Deployment

```bash
# Production (auto-deploys on push to master via GitHub Actions)
fly deploy --remote-only -a mymdb

# Staging (auto-deploys on push to develop via GitHub Actions)
fly deploy --config fly.staging.toml --remote-only -a mymdb-staging

# Check logs
fly logs -a mymdb
fly logs -a mymdb-staging
```

CI/CD requires `FLY_API_TOKEN` in GitHub repo secrets.

## Branching Convention
All feature work branches from `develop`. Always:
1. `git checkout develop && git pull origin develop`
2. `git checkout -b feature/[feature-name]`
3. Work on `feature/[feature-name]`
4. Before merging to `develop`: bump the version in root `package.json` (major/minor/patch)
5. PR `feature/[feature-name]` → `develop` → staging auto-deploys
6. PR `develop` → `master` → production auto-deploys

**Version guard**: Never merge a feature branch to `develop` if both have the same version. The feature branch version must be bumped first.

## Version
Tracked in root `package.json` (`"version"` field). Current version is the source of truth.
- **major**: breaking changes (1.0.0 → 2.0.0)
- **minor**: new feature, backwards compatible (1.0.0 → 1.1.0)
- **patch**: bug fix or small improvement (1.0.0 → 1.0.1)

Bump with: `npm version [major|minor|patch] --no-git-tag-version` from the project root.

## Local Dev (from project root)
```bash
npm install       # installs concurrently at root
npm run dev       # starts server (port 3001) + client (port 5173) concurrently
```

## Non-Obvious Conventions

- **Prisma binaryTargets**: `schema.prisma` includes `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` — required for the Alpine Linux runner on Fly.io. Do not remove this.
- **Dockerfile Prisma copy**: The runner stage explicitly copies `/app/node_modules/.prisma/client` → `/app/server/node_modules/.prisma/client` because the schema `output` path resolves to the project root, not `server/node_modules`.
- **Alpine OpenSSL**: The Dockerfile runner stage includes `RUN apk add --no-cache openssl` — Prisma's query engine requires it.
- **No root package.json**: This is a monorepo with separate `client/` and `server/` packages. There is no root `npm run` — scripts must be run from the appropriate subdirectory.
- **Shared Postgres cluster**: Both staging and prod databases live on `sage-shared-postgres`. If that cluster's machine enters an error state, migrations will fail with `P1017`. Fix with `fly machine restart [id] -a sage-shared-postgres`.
- **Session vs JWT**: The server uses JWT (not express-session). Tokens are stored client-side.
- **Image uploads**: Media and Actor poster/profile images upload via the backend to AWS S3. Never direct browser-to-S3 uploads.
