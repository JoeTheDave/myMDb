# Project Spec: myMDb

## Overview
myMDb is a personal movie and TV show database app — a self-managed IMDb-style catalog. It is a private web app for a single admin and invited users to browse, rate, and manage a curated library of movies, shows, and actors. Access is restricted to Google accounts explicitly registered by the admin.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, shadcn/ui, React Router v6
- **Backend**: Express, Prisma ORM, TypeScript, Passport.js (Google OAuth2)
- **Database**: PostgreSQL 15 (shared local Docker container `sage-shared-dev-postgres`)
- **Deployment**: Fly.io (prod: `mymdb`, staging: `mymdb-staging`)
- **Image Storage**: AWS S3 — uploads proxy through backend via multer (never direct browser → S3)
- **Additional packages**:
  - `passport`, `passport-google-oauth20` — Google SSO
  - `jsonwebtoken`, `cookie-parser` — JWT in httpOnly cookies
  - `@aws-sdk/client-s3` — S3 uploads from server
  - `multer` — multipart file handling on upload endpoint
  - `zod` — request validation
  - `pino`, `pino-pretty` — structured logging
  - `helmet` — security headers
  - `express-rate-limit` — rate limiting on auth endpoints
  - `lucide-react` — icons
  - `@tanstack/react-query` — server state on frontend
  - `vitest`, `supertest` — integration testing

## Project Structure
```
mymdb/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui generated components
│   │   │   ├── Logo.tsx         # HTML/CSS logo component
│   │   │   ├── StarRating.tsx   # Interactive star rating component
│   │   │   ├── MediaCard.tsx    # Thumbnail card for browse grid
│   │   │   ├── ActorCard.tsx    # Thumbnail card for actor grid
│   │   │   ├── FilterBar.tsx    # Reusable filter controls
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── MoviesPage.tsx
│   │   │   ├── MediaDetailPage.tsx
│   │   │   ├── MediaFormPage.tsx
│   │   │   ├── ActorsPage.tsx
│   │   │   ├── ActorDetailPage.tsx
│   │   │   ├── ActorFormPage.tsx
│   │   │   └── AdminPage.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useTheme.ts
│   │   ├── lib/
│   │   │   ├── api.ts           # typed fetch wrapper
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── eslint.config.js
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── media.ts
│   │   │   ├── actors.ts
│   │   │   ├── roles.ts
│   │   │   ├── ratings.ts
│   │   │   └── upload.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts  # JWT verification
│   │   │   └── authorize.ts     # Role enforcement
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── s3.ts
│   │   │   ├── logger.ts        # pino instance
│   │   │   └── jwt.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   ├── ensure-postgres.sh       # starts shared sage-shared-dev-postgres container
│   └── ensure-database.sh       # creates mymdb db in shared container
├── .github/
│   └── workflows/
│       ├── ci.yml               # runs on PRs
│       ├── deploy-staging.yml   # runs on push to develop
│       └── deploy-production.yml # runs on push to main
├── fly.toml                     # prod config
├── fly.staging.toml             # staging config
├── .prettierrc
├── .nvmrc
├── .env
├── .env.example
└── .env.production.example
```

## Data Model

```prisma
// server/src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  imageUrl  String?
  role      Role     @default(VIEWER)
  active    Boolean  @default(true)
  ratings   Rating[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

model Media {
  id            String         @id @default(uuid())
  title         String
  imageUrl      String?
  releaseDate   DateTime?
  mediaType     MediaType      @default(MOVIE)
  contentRating ContentRating?
  synopsis      String?
  castRoles     CastRole[]
  ratings       Rating[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

enum MediaType {
  MOVIE
  SHOW
}

enum ContentRating {
  // Movie ratings
  G
  PG
  PG_13
  R
  NC_17
  NR
  // TV ratings
  TV_Y
  TV_Y7
  TV_G
  TV_PG
  TV_14
  TV_MA
}

model Actor {
  id        String     @id @default(uuid())
  name      String
  imageUrl  String?
  birthday  DateTime?
  deathDay  DateTime?
  castRoles CastRole[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model CastRole {
  id            String   @id @default(uuid())
  characterName String
  roleImageUrl  String?
  actorId       String
  mediaId       String
  actor         Actor    @relation(fields: [actorId], references: [id], onDelete: Cascade)
  media         Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([actorId, mediaId])
}

model Rating {
  id        String   @id @default(uuid())
  stars     Int      // 1–5, enforced in application layer
  userId    String
  mediaId   String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  media     Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, mediaId])
}
```

> **ID Convention**: All models use `String @id @default(uuid())`. Never auto-incrementing integers.

> **Content Rating Logic**: When `mediaType = MOVIE`, valid ratings are `G, PG, PG_13, R, NC_17, NR`. When `mediaType = SHOW`, valid ratings are `TV_Y, TV_Y7, TV_G, TV_PG, TV_14, TV_MA`. The form shows only the relevant options based on selected type. The backend validates accordingly.

## Authentication

**Strategy**: Google OAuth2 via Passport.js. JWT issued on successful login, stored in an httpOnly `token` cookie (SameSite=Lax, Secure in prod). No session store needed.

**Flow**:
1. Frontend renders login page with "Sign in with Google" button linking to `GET /api/auth/google`
2. Passport redirects to Google consent screen
3. Google redirects to `GET /api/auth/google/callback`
4. Passport validates token. Backend checks `user.active === true` and `user` exists in the `User` table. If email is not registered, redirect with error.
5. On success: sign JWT `{ sub: user.id, email: user.email, role: user.role }`, set as httpOnly cookie, redirect to `FRONTEND_URL/movies`
6. On failure: redirect to `FRONTEND_URL/login?error=unauthorized`

**Bootstrap admin**: On server startup, upsert `{ email: "joethedave@gmail.com", role: "ADMIN", active: true }` into the User table so the first login always works without any manual DB steps.

**Middleware**:
- `authenticate.ts` — reads `token` cookie, verifies JWT, attaches `req.user`. Returns 401 if missing or invalid.
- `authorize.ts` — takes minimum role, returns 403 if `req.user.role` is insufficient. Role hierarchy: `VIEWER < EDITOR < ADMIN`.

## Logging

All server-side logging uses **pino**. Never use `console.log`.

- Dev: `pino-pretty` human-readable output
- Prod/staging: JSON output
- Test: silent

Every log statement must include a unique `logId` in `adjective-verb-noun` format (e.g., `"happy-send-rocket"`). Before using a logId, grep the codebase to confirm it is unique. The word list for constructing logIds is at `/Users/joedavis/.claude/skills/backend-dev/log-id-words.md`.

```ts
// server/src/lib/logger.ts
import pino from 'pino'
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
})
```

## Security

Apply to the Express app in `server/src/index.ts`:
- `helmet()` — secure HTTP headers
- CORS locked to `FRONTEND_URL` env var (never `*`)
- `express-rate-limit` on all `/api/auth/*` routes: 20 requests per 15 minutes per IP
- All request bodies validated with zod before use; never trust `req.body` directly

## API Endpoints

Routes are thin — validation and business logic live in service functions, not inline in route handlers.
Always use explicit Prisma `select` when returning data; never return raw Prisma model objects.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/auth/google | No | Initiates Google OAuth redirect |
| GET | /api/auth/google/callback | No | Google OAuth callback, sets cookie, redirects |
| POST | /api/auth/logout | Yes | Clears token cookie |
| GET | /api/auth/me | Yes | Returns `{ id, email, name, imageUrl, role }` |

### Users (Admin only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/users | ADMIN | List all registered users |
| POST | /api/users | ADMIN | Register new user `{ email, role }` |
| PATCH | /api/users/:id | ADMIN | Update user `{ role?, active? }` |
| DELETE | /api/users/:id | ADMIN | Permanently remove user |

### Media
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/media | VIEWER | List/filter media. Query params: `q`, `type`, `contentRating` (comma-separated), `yearFrom`, `yearTo`, `minRating`, `actorId`, `page`, `limit` |
| GET | /api/media/:id | VIEWER | Single media record with full cast (roles + actors) and ratings summary |
| POST | /api/media | EDITOR | Create media |
| PUT | /api/media/:id | EDITOR | Update media |
| DELETE | /api/media/:id | ADMIN | Delete media and its S3 images |

### Actors
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/actors | VIEWER | List/filter actors. Query params: `q`, `birthYearFrom`, `birthYearTo`, `deceased` (boolean), `mediaId`, `page`, `limit` |
| GET | /api/actors/:id | VIEWER | Single actor with full role/media list |
| POST | /api/actors | EDITOR | Create actor |
| PUT | /api/actors/:id | EDITOR | Update actor |
| DELETE | /api/actors/:id | ADMIN | Delete actor and their S3 image |

### Cast Roles
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/media/:id/roles | EDITOR | Add cast role `{ characterName, actorId }` |
| PUT | /api/roles/:id | EDITOR | Update cast role |
| DELETE | /api/roles/:id | EDITOR | Remove cast role and its S3 image |

### Ratings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | /api/media/:id/ratings | VIEWER | Upsert current user's rating `{ stars: 1–5 }` |
| DELETE | /api/media/:id/ratings | VIEWER | Remove current user's rating |

### Upload
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/upload | EDITOR | Accepts `multipart/form-data` with `file` field via multer. Uploads to S3 at path `{userId}/{uuid}-{originalname}`. Returns `{ url: string }` — the public S3 URL. |

## S3 Image Lifecycle

Two buckets: `mymdb-dev-assets` (local/dev) and `mymdb-prod-assets` (Fly.io prod+staging). Active bucket controlled by `AWS_BUCKET_NAME` env var.

**Upload flow**: client sends `multipart/form-data` to `POST /api/upload` → multer buffers the file in memory → server uploads to S3 using `PutObjectCommand` → returns public URL → client stores URL in subsequent create/update request body.

**Stale image cleanup** — the backend must delete S3 objects whenever a stored image URL is replaced or its owning record is deleted:

| Event | S3 action |
|-------|-----------|
| Media updated with a new `imageUrl` | Delete old `imageUrl` key from S3 |
| Media deleted | Delete `imageUrl` key + all `roleImageUrl` keys of its cast from S3 |
| Actor updated with a new `imageUrl` | Delete old `imageUrl` key from S3 |
| Actor deleted | Delete `imageUrl` key from S3 |
| CastRole updated with a new `roleImageUrl` | Delete old `roleImageUrl` key from S3 |
| CastRole deleted | Delete `roleImageUrl` key from S3 |

`server/src/lib/s3.ts` exports:
- `uploadToS3(file: Express.Multer.File, userId: string): Promise<string>` — uploads and returns public URL
- `deleteS3Object(url: string): Promise<void>` — extracts key from URL, calls `DeleteObjectCommand`

S3 deletion failures must be logged (with logId) but must not cause the API request to fail (best-effort cleanup).

## Frontend Routes & Views

| Route | Component | Min Role | Description |
|-------|-----------|----------|-------------|
| / | redirect | Any | Redirects to `/movies` if authenticated, else `/login` |
| /login | LoginPage | None | Full-screen centered `<Logo size="lg" />` + "Sign in with Google" button. Error message if `?error=unauthorized`. |
| /movies | MoviesPage | VIEWER | Grid of `<MediaCard />` thumbnails. `<FilterBar />`: text search, type toggle (Movie/Show), content rating checkboxes, year range slider, min star rating, actor search. Pagination. |
| /movies/:id | MediaDetailPage | VIEWER | Hero image, title, type badge, content rating badge, release date, synopsis, `<StarRating />`, community rating display, cast grid (role image, character name, actor name). EDITOR+ sees Edit button; ADMIN sees Delete button. |
| /movies/new | MediaFormPage | EDITOR | Form: title, mediaType toggle, image upload, releaseDate, contentRating select (options change per type), synopsis, cast section (search actor, enter character name, upload role image). |
| /movies/:id/edit | MediaFormPage | EDITOR | Same form pre-populated. |
| /actors | ActorsPage | VIEWER | Grid of `<ActorCard />` thumbnails. `<FilterBar />`: name search, birth year range, alive-only toggle, appears-in filter. Pagination. |
| /actors/:id | ActorDetailPage | VIEWER | Actor photo, name, born/died, filmography grid. EDITOR+ sees Edit; ADMIN sees Delete. |
| /actors/new | ActorFormPage | EDITOR | Form: name, image upload, birthday, deathDay (optional). |
| /actors/:id/edit | ActorFormPage | EDITOR | Same form pre-populated. |
| /admin | AdminPage | ADMIN | User management table: email, name, role (inline editable), active (toggle), delete. "Add User" form: email + role. |

**Frontend conventions**:
- Auth state managed via React Context; check `/api/auth/me` on app load
- All route-level components wrapped in `<ErrorBoundary>`
- Skeleton loaders for initial data load; disabled + spinner for in-progress mutations
- Optimistic UI for star ratings (capture current → apply change → rollback on failure)
- Form errors displayed inline; background/mutation failures shown as toast notifications
- `client/src/lib/api.ts` typed fetch wrapper used for all requests; no raw `fetch` in components

## Logo Component

`client/src/components/Logo.tsx` — pure HTML/CSS React component, no image assets. Resembles the IMDb logo aesthetic: bold sans-serif, golden yellow (`#F5C518`) background, black text, "my" italic and smaller to differentiate ownership. Accepts `size?: "sm" | "md" | "lg"` (sm in navbar, lg on login page).

```
// Visual intent: [ my MDb ]  ← gold rounded-rectangle badge, black text
// "my" — italic, font-weight 600, ~60% the font size of "MDb"
// "MDb" — font-weight 900
// Both baseline-aligned inside the badge
```

## Star Rating Component

`client/src/components/StarRating.tsx` — props: `userRating: number | null`, `communityAvg: number | null`, `communityCount: number`, `onRate: (stars: number) => void`, `readonly?: boolean`.

Rendering rules:
- **User has rated**: fill stars up to `userRating` in golden yellow (`#F5C518`). If `communityAvg` differs from `userRating`, show community avg as a small number beside the stars.
- **User has not rated, community ratings exist**: show 5 stars with gray fill representing the community average. Show community avg number and count beside the stars.
- **No ratings at all**: show 5 empty gray stars, interactive.
- Hover previews rating. Click submits (optimistic update).
- `readonly` mode: non-interactive, used on browse grid cards.

## Theme

- Dark mode and light mode both supported, toggle in navbar, persisted in `localStorage`
- Tailwind `darkMode: 'class'` strategy
- Dark defaults: near-black backgrounds (`#141414`, `#1c1c1c`), gold (`#F5C518`) accents
- shadcn/ui components respect the active theme automatically

## Code Quality

**`.prettierrc`** (committed):
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "arrowParens": "avoid",
  "semi": false,
  "printWidth": 120
}
```

**`.nvmrc`**: the output of `node --version` at time of scaffolding.

**TypeScript** — maximally strict on both client and server:
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "exactOptionalPropertyTypes": true,
  "noPropertyAccessFromIndexSignature": true,
  "erasableSyntaxOnly": true,
  "noUncheckedSideEffectImports": true
}
```
Server additionally: `"resolveJsonModule": true`, `"outDir": "dist"`, `"rootDir": "src"`.

**ESLint**: flat config in `client/eslint.config.js`.

## Environment Variables

```
# server/.env
DATABASE_URL=postgresql://postgres:localdev123@localhost:5432/mymdb
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=30d

AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_BUCKET_NAME=mymdb-dev-assets

# client/.env
VITE_API_URL=http://localhost:3001
```

```
# .env.production.example (values set as fly secrets, not in fly.toml)
DATABASE_URL=           # Fly internal Postgres URL with sslmode=disable
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=    # https://mymdb.fly.dev/api/auth/google/callback
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=mymdb-prod-assets
```

## Scripts & Tooling

```json
// server/package.json scripts
"dev": "tsx watch src/index.ts",
"build": "tsc",
"start": "node dist/index.js",
"db:ensure": "../../scripts/ensure-postgres.sh && ../../scripts/ensure-database.sh",
"db:migrate": "prisma migrate dev --schema src/prisma/schema.prisma",
"db:migrate:deploy": "prisma migrate deploy --schema src/prisma/schema.prisma",
"db:push": "prisma db push --schema src/prisma/schema.prisma",
"db:generate": "prisma generate --schema src/prisma/schema.prisma",
"db:seed": "tsx src/lib/seed.ts",
"db:studio": "prisma studio --schema src/prisma/schema.prisma",
"db:reset": "prisma migrate reset --schema src/prisma/schema.prisma",
"test": "vitest run",
"test:watch": "vitest",
"postgres:shared-status": "docker inspect sage-shared-dev-postgres --format '{{.State.Status}}'",
"postgres:shared-stop": "docker stop sage-shared-dev-postgres",
"postgres:shared-logs": "docker logs sage-shared-dev-postgres"

// client/package.json scripts
"dev": "vite",
"build": "tsc && vite build",
"preview": "vite preview",
"lint": "eslint src"
```

## Local Database Setup

Uses the shared Docker container `sage-shared-dev-postgres` (Postgres 15, port 5432, password `localdev123`) — not a per-project `docker-compose.yml`.

`scripts/ensure-postgres.sh` — checks if the container is running; starts it if not.
`scripts/ensure-database.sh` — creates the `mymdb_dev` database in the shared container if it doesn't exist.

Run `npm run db:ensure` before `npm run dev` on first setup.

## Migration Naming Convention

Initial migration name: `20000101000000_init` (year-2000 timestamp). This ensures all seed migrations sort before any real future migrations, which will have current-date timestamps.

## Deployment

### Fly.io — Production (`mymdb`)
- Express server serves both the API and the Vite build output (`client/dist`) as static files
- All non-API routes fall through to `index.html` for client-side routing
- `fly.toml`: port 3001, auto-scale to 0, 512MB RAM, shared CPU
- `release_command`: `npm run db:migrate:deploy`
- Database: Fly Postgres using `.flycast` internal URL with `sslmode=disable`
- Secrets (never in `fly.toml`): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`
- Non-sensitive env in `fly.toml [env]`: `PORT=3001`, `NODE_ENV=production`, `FRONTEND_URL=https://mymdb.fly.dev`

### Fly.io — Staging (`mymdb-staging`)
- Identical config to prod via `fly.staging.toml`
- Separate Fly Postgres database on the same cluster
- `AWS_BUCKET_NAME=mymdb-dev-assets` (shares dev bucket with local)
- `GOOGLE_CALLBACK_URL` points to `mymdb-staging.fly.dev`

### GitHub Actions CI/CD
- **`ci.yml`** — triggered on PRs: install, typecheck, lint, run integration tests against a fresh Postgres
- **`deploy-staging.yml`** — triggered on push to `develop`: deploy to `mymdb-staging`
- **`deploy-production.yml`** — triggered on push to `main`: deploy to `mymdb`

## Integration Testing

- Test runner: Vitest
- HTTP layer: Supertest (real requests to Express app)
- Database: `mymdb_test` on shared Postgres container
- Setup: `vitest.config.ts` with global-setup (apply migrations once to test DB) and per-test teardown (truncate tables between suites)
- Auth helper creates a signed JWT for use in protected endpoint tests

Every endpoint must have tests for:
- Happy path
- Auth enforcement (401 when unauthenticated)
- Authorization (403 when insufficient role)
- Validation errors (400 on bad input)
- 404 on unknown resource

## Non-Standard Setup Steps

1. **Google OAuth app**: Create a project in Google Cloud Console, enable the Google People API, create OAuth2 credentials. Add authorized redirect URIs for localhost, staging, and prod. Add Client ID + Secret to `.env` and as Fly secrets.
2. **AWS S3**: Create two buckets — `mymdb-dev-assets` and `mymdb-prod-assets`. On each: configure CORS to allow PUT from the relevant origin; set bucket policy for public `GetObject`. Create one IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` scoped to both buckets. Add credentials to `.env` and as Fly secrets. **Claude will walk you through this step-by-step after the code is written.**
3. **Shared Postgres**: `npm run db:ensure` starts `sage-shared-dev-postgres` if not already running and creates the `mymdb_dev` database.
4. **shadcn/ui init**: `npx shadcn@latest init` in `client/`. Add components: `button`, `input`, `select`, `dialog`, `dropdown-menu`, `badge`, `avatar`, `table`, `slider`, `toggle`, `tooltip`, `card`, `separator`, `label`, `form`, `sonner` (toast).
5. **Fly.io**: `fly launch` for prod, `fly launch --config fly.staging.toml` for staging. Set all secrets via `fly secrets set`. Attach Fly Postgres to both apps.

## Acceptance Criteria

- [ ] Navigating to the app unauthenticated redirects to `/login`
- [ ] The login page displays `<Logo size="lg" />` and a "Sign in with Google" button; no other registration method exists
- [ ] Signing in with `joethedave@gmail.com` grants ADMIN access on first login without any manual DB setup
- [ ] Signing in with an unregistered Google account shows an "unauthorized" error on the login page
- [ ] An ADMIN can register a new email with VIEWER or EDITOR role from `/admin`
- [ ] An ADMIN can toggle a user's `active` status to revoke access; a revoked user is rejected at the OAuth callback step
- [ ] The `/movies` page displays a responsive grid of thumbnails with a working filter bar (search, type, rating, year, content rating, actor)
- [ ] A VIEWER can submit a 1–5 star rating on any media detail page; stars display gold for their rating
- [ ] If a community average exists and differs from the user's rating, the community average displays as a number beside the stars
- [ ] If a user has not rated and community ratings exist, gray-filled stars display with community average and count
- [ ] An EDITOR can create and edit movies and shows via `/movies/new` and `/movies/:id/edit`
- [ ] A movie/show form shows only movie content ratings for MOVIE type and only TV ratings for SHOW type
- [ ] Images upload via `POST /api/upload` (server proxies to S3); resulting public URL is stored on the record
- [ ] Replacing an image on a media, actor, or cast role record deletes the old S3 object
- [ ] Deleting a media record deletes its poster image and all cast role images from S3
- [ ] Deleting an actor record deletes their image from S3
- [ ] Deleting a cast role deletes its role image from S3
- [ ] S3 deletion failures are logged with a logId but do not cause API errors
- [ ] An EDITOR can add cast roles to a media item (search actor, character name, optional role image)
- [ ] The `/actors` page displays a responsive grid with a working filter bar (search, birth year, alive toggle, appears-in)
- [ ] An actor detail page shows their filmography linking back to media detail pages
- [ ] Dark/light mode toggle persists via `localStorage` and applies across all pages
- [ ] All routes requiring EDITOR or ADMIN role return 403 / redirect unauthorized users
- [ ] All integration tests pass against a real test database
- [ ] TypeScript compiles with zero errors on both client and server

---

## Multi-Agent Build Instructions

When a fresh Claude session receives this spec, it should:

1. Read the entire spec before taking any action
2. Create a task list covering all work items
3. Execute the following agent workflow in order:

### Agent: project-scaffolder
**Role**: Creates the full base project structure
**Tasks**:
- Create `client/` and `server/` subdirectories
- Initialize `package.json` files with all deps from this spec
- Configure `vite.config.ts`, `tailwind.config.ts` (with `darkMode: 'class'`), `tsconfig.json` for both (with strict options from spec)
- Initialize shadcn/ui in `client/`
- Write `.prettierrc`, `.nvmrc`
- Write `scripts/ensure-postgres.sh` and `scripts/ensure-database.sh`
- Write `.env.example`, `.env.production.example`, `.gitignore`
- Write `fly.toml` and `fly.staging.toml`
- Write GitHub Actions workflow files
- Run `npm install`
- Initialize git, make initial commit

### Agent: database-agent
**Role**: Implements Prisma schema and migrations
**Tasks**:
- Write `server/src/prisma/schema.prisma` exactly as specified — every `@id` must be `String @id @default(uuid())`, never auto-increment
- Run `npm run db:ensure` then `npm run db:migrate` with migration name `20000101000000_init`
- Run `npm run db:generate`
- Write `server/src/lib/seed.ts` to upsert `joethedave@gmail.com` as ADMIN on startup
**Depends on**: project-scaffolder complete

### Agent: backend-agent
**Role**: Implements all Express API endpoints
**Tasks**:
- Set up Express server with helmet, cors (locked to FRONTEND_URL), cookie-parser, JSON middleware
- Add rate limiting on `/api/auth/*` routes
- Implement `authenticate.ts` and `authorize.ts` middleware
- Implement `server/src/lib/logger.ts` (pino), `jwt.ts`, `prisma.ts`, `s3.ts` (uploadToS3, deleteS3Object)
- Implement every route file with thin handlers, service functions, zod validation, pino logIds
- Wire up admin seed on server start
- Serve `client/dist` as static files in production
**Depends on**: database-agent complete

### Agent: frontend-agent
**Role**: Implements all React views
**Tasks**:
- Set up React Router with all routes and `<ProtectedRoute />`
- Implement `useAuth` (React Context + `/api/auth/me` on load) and `useTheme` hooks
- Implement `Logo.tsx`, `StarRating.tsx`, `MediaCard.tsx`, `ActorCard.tsx`, `FilterBar.tsx`
- Implement every page component with skeleton loaders, error boundaries, optimistic mutations
- Implement `client/src/lib/api.ts` typed fetch wrapper
- Wire up dark/light mode toggle
- Wire up `@tanstack/react-query` for all data fetching
**Depends on**: backend-agent complete (for API contract)

### Agent: testing-agent
**Role**: Writes and runs integration tests
**Tasks**:
- Configure `vitest.config.ts` with global-setup (migrate test DB) and per-suite teardown
- Write auth helper (JWT factory for test users)
- Write tests for every endpoint covering: happy path, 401, 403, 400, 404
- Run full test suite and confirm all pass
**Depends on**: backend-agent complete

### Agent: reviewer-agent
**Role**: Reviews all generated code for quality and spec compliance
**Tasks**:
- Verify every acceptance criterion is met
- Run `tsc --noEmit` on both client and server; confirm zero errors
- Verify all pino logIds are unique across the codebase
- Check API endpoints match spec, route guards work, S3 cleanup fires correctly
- Report any gaps
**Depends on**: testing-agent complete
