# BitCode — Gestor de Cambios y Versiones

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Start the Convex backend (creates `.env.local` with `VITE_CONVEX_URL`):
   `npx convex dev`
3. Run the app:
   `npm run dev`

## Data & real-time sync

Projects live in Convex, so changes sync live across tabs and devices. `localStorage`
is kept only as an offline cache; on first run the app uploads existing local data.

## Deployment

- Backend: `npx convex deploy` creates/updates the production deployment of your
  Convex account. Copy the resulting `https://<name>.convex.cloud` URL.
- Frontend: deploy the `dist` folder to Vercel (`npm run build`, output `dist`) and
  set `VITE_CONVEX_URL` to the production Convex URL in the Vercel project settings.
