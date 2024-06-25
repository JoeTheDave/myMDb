# myMDb

This project is a test bed for practicing application architecture and experimenting with various tech. It will be my own movie/actor database, a vast simplification of IMDb.

### Stack

- vite-express
- tailwindcss + DaisyUI
- standard REST api
- prisma + postgres hosted on tembo.io
- images hosted on amazon S3
- custom rolled JWT auth
- deployment to fly.io

### Helpful Dev Links

- https://nerdcave.com/tailwind-cheat-sheet
- https://fonts.google.com/

### TODO

- [ ] Login and Register pages - debounce submit button.
- [ ] Server side establish an API for returning `success`, `message`, and `data`.
- [ ] Build out strong types for client side api function return types.
- [ ] Implement refresh tokens for auth.
- [ ] Implement progressive event and error logging solution.
