# myMDb

A personal movie and media database for tracking your film collection — add movies, manage cast and crew, and rate what you've watched.

Access is invite-only. An admin approves users and assigns roles after they sign in with Google.

## Prerequisites

- Node 24 ([nvm](https://github.com/nvm-sh/nvm) recommended — `nvm use` picks up the version automatically)
- Docker (for the local PostgreSQL container)

## Running Locally

```bash
npm install && npm run install:all
cd server && npm run db:ensure && npm run db:migrate:deploy && npm run db:seed
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

## Key Scripts

| Script | Where | What it does |
|--------|-------|--------------|
| `npm run dev` | root | Starts server + client concurrently |
| `npm run db:migrate` | `server/` | Create a new migration |
| `npm run db:seed` | `server/` | Seed the admin user |
| `npm run db:studio` | `server/` | Open Prisma Studio |
| `npm run test` | `server/` | Run tests |

## Deploying

Production deploys automatically via GitHub Actions on every push to `master`. There is no staging environment.

To deploy manually:
```bash
fly deploy --remote-only
```
