# myMDb — Technical Reference

## What This Is
A personal movie and TV database with full cast/crew data, auto-fetched ratings, and curated image management. Deployed on Fly.io with a React frontend served by the Express backend.

## Workflow
```yaml
deployments:
  prod:
    branch: master
```

Single branch, no staging (Joe, 2026-11-03: staging is only for client sites). Agent work commits straight to `master`; the push auto-deploys to prod (`deploy-production.yml`) and runs the report-only test suite (`ci.yml`).

## Intentional Deviations from STANDARDS.md

| Default | This Project | Why |
|---------|-------------|-----|
| Session-based auth (Passport + connect-pg-simple) | JWT in httpOnly cookie | Chosen at project start for stateless deployment simplicity |
| Tailwind CSS v4 | Tailwind CSS v3 | Project was scaffolded before STANDARDS moved to v4 |
| Tests at `tests/server/` | Tests at `server/src/test/` | Matches original scaffold layout |
| No synopsis field | No synopsis | Removed in early migration — wasn't used |
| User ratings | Rotten Tomatoes critic + audience ratings | User ratings removed; RT data is more meaningful and auto-fetched |

## Stack
| Layer | In Use |
|-------|--------|
| Frontend | React 18, TypeScript, Tailwind v3, Vite, React Router v6, shadcn/ui, @tanstack/react-query |
| Backend | Express, TypeScript, Prisma ORM, pino logging |
| Auth | Google OAuth2 via Passport.js + JWT (httpOnly cookie, SameSite=Lax) |
| Database | PostgreSQL — `sage-shared-dev-postgres` Docker locally, `sage-shared-postgres` Fly cluster in prod |
| Image Storage | AWS S3 (`mymdb-dev-assets` / `mymdb-prod-assets`) — always proxied through backend, never direct browser upload |
| Deployment | Fly.io — `mymdb` (prod only) |
| CI/CD | GitHub Actions |
| Testing | Vitest + Supertest (integration, real DB) |
| Node | 24 (.nvmrc) |

## Repo Structure
```
myMDb/
├── client/                    # React frontend (Vite, port 5173)
│   └── src/
│       ├── components/        # Shared UI + shadcn/ui
│       ├── hooks/             # useAuth, useTheme
│       ├── lib/               # api.ts, utils.ts, types.ts, rtIcons.ts
│       └── pages/             # Route-level components
├── server/                    # Express backend (port 3001)
│   └── src/
│       ├── prisma/            # schema.prisma + migrations
│       ├── routes/            # actors.ts, auth.ts, images.ts, media.ts, roles.ts, upload.ts, users.ts
│       ├── middleware/        # authenticate.ts, authorize.ts
│       ├── lib/               # prisma.ts, s3.ts, logger.ts, jwt.ts, seed.ts, rtScraper.ts, validation.ts
│       ├── test/              # Vitest + Supertest integration tests
│       └── types/             # express.d.ts
├── scripts/                   # ensure-postgres.sh, ensure-database.sh
├── .github/workflows/         # ci.yml (report-only tests), deploy-production.yml
├── fly.toml                   # production Fly.io config
└── Dockerfile
```

## Data Models

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  imageUrl  String?
  role      Role     @default(VIEWER)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role { ADMIN | EDITOR | VIEWER }

model Media {
  id                      String         @id @default(uuid())
  title                   String
  imageUrl                String?
  releaseYear             Int?
  mediaType               MediaType      @default(MOVIE)
  contentRating           ContentRating?
  criticRating            Int?           // Rotten Tomatoes critic score (0–100)
  audienceRating          Int?           // Rotten Tomatoes audience score (0–100)
  amazonPrimeUrl          String?
  trailerUrl              String?
  imdbId                  String?
  castSortOrder           CastSortOrder  @default(BY_ACTOR)
  rtAutoFetchDisabled     Boolean        @default(false)
  amazonAutoFetchDisabled Boolean        @default(false)
  actorAutoImportDisabled Boolean        @default(false)
  castRoles               CastRole[]
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @updatedAt
}

enum MediaType     { MOVIE | SHOW }
enum CastSortOrder { BY_ACTOR | BY_ROLE | CUSTOM }
enum ContentRating { G | PG | PG_13 | R | NC_17 | NR | TV_Y | TV_Y7 | TV_G | TV_PG | TV_14 | TV_MA }

model Actor {
  id           String     @id @default(uuid())
  name         String
  imageUrl     String?
  imageFocalX  Float?
  imageFocalY  Float?
  birthday     DateTime?
  deathDay     DateTime?
  castRoles    CastRole[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model CastRole {
  id               String   @id @default(uuid())
  characterName    String?
  roleImageUrl     String?
  roleImageFocalX  Float?
  roleImageFocalY  Float?
  billingOrder     Int      @default(0)
  actorId          String
  mediaId          String
  actor            Actor    @relation(fields: [actorId], references: [id], onDelete: Cascade)
  media            Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@unique([actorId, mediaId])
}
```

## API Endpoints

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/google` | No | Initiates Google OAuth |
| GET | `/google/callback` | No | OAuth callback, sets JWT cookie, redirects |
| POST | `/logout` | Yes | Clears token cookie |
| GET | `/me` | Yes | Returns current user `{ id, email, name, imageUrl, role }` |

### Users (`/api/users`) — ADMIN only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all users |
| POST | `/` | Register new user `{ email, role }` |
| PATCH | `/:id` | Update `{ role?, active? }` |
| DELETE | `/:id` | Remove user |

### Media (`/api/media`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | VIEWER | List/filter (`q`, `type`, `contentRating`, `yearFrom`, `yearTo`, `actorId`, `page`, `limit`) |
| GET | `/tmdb-lookup` | EDITOR | Search TMDB by title, returns candidates |
| GET | `/:id` | VIEWER | Media detail with full cast |
| POST | `/` | EDITOR | Create media |
| PUT | `/:id` | EDITOR | Update media |
| DELETE | `/:id` | ADMIN | Delete + clean up S3 |
| PATCH | `/:id/fetch-ratings` | EDITOR | Trigger RT ratings scrape |
| PATCH | `/:id/ratings` | EDITOR | Manually set `{ criticRating, audienceRating }` |
| POST | `/:id/cast/import` | EDITOR | Import cast from TMDB |
| POST | `/:id/cast/purge-no-image` | EDITOR | Remove cast roles with no image |
| POST | `/:id/amazon-lookup` | EDITOR | Auto-fetch Amazon Prime URL |
| PATCH | `/:id/amazon-prime-url` | EDITOR | Manually set Amazon Prime URL |
| POST | `/:id/trailer-lookup` | EDITOR | Auto-fetch YouTube trailer URL |
| PUT | `/:id/cast-sort` | EDITOR | Set cast sort order |
| PUT | `/:id/cast-reorder` | EDITOR | Save custom cast order |

### Actors (`/api/actors`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | VIEWER | List/filter (`q`, `birthYearFrom`, `birthYearTo`, `deceased`, `mediaId`, `page`, `limit`) |
| GET | `/:id` | VIEWER | Actor detail with filmography |
| POST | `/` | EDITOR | Create actor |
| PUT | `/:id` | EDITOR | Update actor |
| DELETE | `/:id` | ADMIN | Delete + clean up S3 |

### Roles (`/api/roles`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | EDITOR | Add cast role `{ characterName?, actorId, mediaId }` |
| PUT | `/:id` | EDITOR | Update cast role |
| DELETE | `/:id` | EDITOR | Remove cast role + S3 cleanup |
| DELETE | `/purge` | EDITOR | Purge roles with no image |

### Images (`/api/images`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/search` | EDITOR | Search for images by query |
| POST | `/download` | EDITOR | Download remote image URL to S3, returns stored URL |

### Upload (`/api/upload`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | EDITOR | Upload file via multipart → S3, returns `{ url }` |

## Frontend Routes
| Route | Component | Min Role |
|-------|-----------|----------|
| `/login` | LoginPage | None |
| `/` | → `/movies` | Any |
| `/movies` | MoviesPage | VIEWER |
| `/movies/:id` | MediaDetailPage | VIEWER |
| `/movies/new` | MediaFormPage | EDITOR |
| `/movies/:id/edit` | MediaFormPage | EDITOR |
| `/actors` | ActorsPage | VIEWER |
| `/actors/:id` | ActorDetailPage | VIEWER |
| `/actors/new` | ActorFormPage | EDITOR |
| `/actors/:id/edit` | ActorFormPage | EDITOR |
| `/admin` | AdminPage | ADMIN |

## Environment Variables
| Variable | Where Set | Notes |
|----------|-----------|-------|
| `DATABASE_URL` | `.env` / Fly secret | Postgres connection string |
| `PORT` | `fly.toml [env]` | 3001 |
| `NODE_ENV` | `fly.toml [env]` | `production` in prod |
| `FRONTEND_URL` | `fly.toml [env]` | `https://mymdb.fly.dev` in prod |
| `GOOGLE_CLIENT_ID` | `.env` / Fly secret | OAuth app credentials |
| `GOOGLE_CLIENT_SECRET` | `.env` / Fly secret | OAuth app credentials |
| `GOOGLE_CALLBACK_URL` | `.env` / Fly secret | Points to `/api/auth/google/callback` |
| `JWT_SECRET` | `.env` / Fly secret | Min 32 chars |
| `JWT_EXPIRES_IN` | `.env` | `30d` |
| `AWS_ACCESS_KEY_ID` | `.env` / Fly secret | Shared IAM user (sage home-page) |
| `AWS_SECRET_ACCESS_KEY` | `.env` / Fly secret | Shared IAM user |
| `AWS_REGION` | `.env` / Fly secret | `us-east-2` |
| `AWS_BUCKET_NAME` | `.env` / Fly secret | `mymdb-dev-assets` locally, `mymdb-prod-assets` in prod |

## Non-Obvious Conventions

- **Prisma binaryTargets**: `schema.prisma` includes `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` — required for Alpine Linux on Fly.io. Do not remove.
- **Prisma output path**: generator `output = "../../node_modules/.prisma/client"` resolves to project root, not `server/node_modules`. Dockerfile copies accordingly.
- **Alpine OpenSSL**: `RUN apk add --no-cache openssl` in Dockerfile runner stage — Prisma query engine requires it.
- **Auth**: JWT stored in httpOnly cookie (not session). `authenticate.ts` reads the `token` cookie. No `express-session`.
- **Admin bootstrap**: On server startup, `seed.ts` upserts `joethedave@gmail.com` as ADMIN so first login always works.
- **RT ratings**: Sourced via `rtScraper.ts` — not from an official API. Flagged per-media with `rtAutoFetchDisabled` if scraping fails or is unwanted.
- **Image uploads**: Always proxied through `/api/upload` or `/api/images/download`. Never direct browser-to-S3.
- **S3 cleanup**: Deleting or replacing any imageUrl/roleImageUrl must also delete the old S3 object. Failures are logged (pino + logId) but must not fail the API request.
- **LogId format**: Every pino log statement includes `logId: 'adjective-verb-noun'`. Grep before adding to ensure uniqueness.
- **Shared Postgres cluster**: Prod lives on `sage-shared-postgres`. If it enters error state, run `fly machine restart [id] -a sage-shared-postgres`.

## Tagged Versions
- `v1.13.0` — 2026-06 — Current. Focal point editor, cast sort order, TMDB cast import, Amazon/trailer auto-lookup
- `v1.10.1` — patch fix
- `v1.10.0` — media enrichment fields (imdbId, auto-fetch flags)
- `v1.9.0` — Rotten Tomatoes ratings integration
- `v1.8.0` — cast sort order
- `v1.7.1` — patch fix
- `v1.7.0` — Amazon Prime + trailer URL
- `v1.6.0` — image focal points
