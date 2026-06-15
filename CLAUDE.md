# myMDb — Claude Code Context

## Read these first
- `VISION.md` — what this app is and why
- `PROJECT.md` — how it's built, deployed, and what conventions apply

## Critical conventions for this project
- **Auth is JWT (httpOnly cookie), NOT session-based.** Do not introduce `express-session` or `connect-pg-simple`.
- **Tailwind v3, not v4.** Config lives in `client/tailwind.config.ts` and `client/postcss.config.js` — do not migrate to v4.
- **Prisma binaryTargets** `["native", "linux-musl-openssl-3.0.x"]` in `schema.prisma` — required for Fly.io Alpine deployment. Do not remove.

## Local Dev
```bash
npm install && npm run install:all
cd server && npm run db:ensure && npm run db:migrate:deploy && npm run db:seed
npm run dev
```
Frontend: http://localhost:5173
Backend: http://localhost:3001
