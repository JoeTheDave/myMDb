# myMDb

This project is a test bed for practicing application architecture and experimenting with various tech. It will be my own movie/actor database, a vast simplification of IMDb.

### Stack

- vite-express
- tailwindcss + https://ui.shadcn.com/
- standard REST api
- prisma + postgres hosted on amazon
- custom rolled JWT auth with roles for admin/editor/viewer - viewer does not need login
- investigate deployment to amazon or settle for fly.io - prod and staging environments
