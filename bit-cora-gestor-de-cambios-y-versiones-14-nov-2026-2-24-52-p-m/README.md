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

## Datos locales en el teléfono

- La app es una PWA: ábrela en el navegador del teléfono y usa
  **Compartir → Añadir a pantalla de inicio** (iPhone) o **Instalar app**
  (Android/Chrome). También aparece el botón **Instalar en el teléfono** en la
  barra lateral cuando el navegador lo permite.
- Cada cambio se guarda automáticamente en el archivo interno
  `Datos BitCode.json` (almacenamiento privado del navegador, OPFS), además de
  la caché en `localStorage`. En la barra lateral verás la hora del último
  guardado.
- **Guardar copia** exporta `Datos BitCode.json` como archivo real: en el
  teléfono abre la hoja de compartir para guardarlo en Archivos/Drive; en
  escritorio lo descarga.
- **Cargar copia** importa un `Datos BitCode.json` y reemplaza los datos
  actuales (pide confirmación y sincroniza con Convex).
- Los datos siguen sincronizándose en la nube de Convex; el archivo local es
  la copia de seguridad del dispositivo y permite abrir la app sin conexión.

## Deployment

- Backend: `npx convex deploy` creates/updates the production deployment of your
  Convex account. Copy the resulting `https://<name>.convex.cloud` URL.
- Frontend: deploy the `dist` folder to Vercel (`npm run build`, output `dist`) and
  set `VITE_CONVEX_URL` to the production Convex URL in the Vercel project settings.
