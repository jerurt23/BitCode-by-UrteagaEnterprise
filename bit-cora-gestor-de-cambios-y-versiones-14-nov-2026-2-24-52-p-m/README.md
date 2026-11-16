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

Convex ya es la forma gratuita de sincronizar en vivo: su plan Free incluye
1 millón de llamadas a funciones al mes y 0.5 GB de base de datos, sin límite de
tiempo. Cada cambio se escribe en la nube y los demás dispositivos reciben la
actualización por WebSocket sin recargar (el mismo mecanismo que usan las
consultas reactivas de `useQuery`). No hace falta Firebase, Supabase ni otro
servicio.

## Dashboard y Modo Reunión

- El dashboard incluye **Avance de módulos por proyecto**: todos los proyectos
  con el porcentaje de cada módulo, barras de progreso y acceso directo al bloc.
- Al terminar una reunión o sesión de ideas, el comparador permite **enviar las
  notas seleccionadas a otro módulo del proyecto** o **crear un módulo nuevo**
  con esas notas (nombre, rama del módulo origen y fecha límite a 30 días).
  Al elegir otro módulo o uno nuevo, la selección se ajusta automáticamente a
  las **notas nuevas** (sin desmarcar a mano reemplazos ni borrados).
  Al crear un módulo nuevo se abre un selector con las notas nuevas de **Modo
  Reunión y Modo Idea** para elegir exactamente cuáles se llevan al módulo.
  Así una sola reunión puede repartirse entre varios módulos sin duplicar notas.

## Cuentas y acceso

- Login con **usuario y contraseña** mediante Convex Auth. Las contraseñas se
  guardan hasheadas (Argon2id/Scrypt), nunca en texto plano ni en la caché.
- La **sesión** se guarda en `localStorage` (token, no contraseña), así que al
  volver a abrir la app no se pide la contraseña. Cerrar sesión la elimina.
- Cada usuario tiene su **espacio de trabajo propio** y solo ve sus proyectos.
- El espacio anterior (documento `main`) se importa a la cuenta con un **código
  privado** desde **Configuración → Espacio de trabajo anterior**; así un
  visitante no puede reclamarlo.
- El archivo local se guarda por usuario:
  `Datos BitCode - <usuario>.json`.
- El perfil (nombre, correo de contacto, color), el cambio de contraseña y el
  cierre de sesión están en **Configuración → Mi cuenta**.

> La colaboración entre usuarios (invitaciones por enlace/código, roles
> propietario/editor/lector y espacios compartidos) es la siguiente fase.
> Por ahora no hay recuperación de contraseña por correo; guarda tus
> credenciales.

## Configuración

La pestaña **Configuración** incluye:

- **Mi perfil** (nombre, correo y color del avatar), guardado en Convex y
  compartido entre dispositivos.
- **Notificaciones por módulo**: activa las notificaciones push en cada
  dispositivo y elige qué módulos avisan cuando cambian. Incluye recordatorios
  diarios de fecha límite y un botón de notificación de prueba.
- **Empezar desde cero**: borra proyectos, módulos, notas, ramas, historial y
  perfil en todos los dispositivos (pide escribir `BORRAR`).

Las notificaciones push usan VAPID + `web-push` en una acción Node de Convex.
Variables necesarias en el deployment de Convex:
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. En iPhone requieren
iOS 16.4+ y la PWA instalada en la pantalla de inicio.

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
- Frontend (Vercel): `vercel --prod` desde esta carpeta. El proyecto ya tiene
  `VITE_CONVEX_URL` configurada para production/preview/development.
  URL: https://bitcode-rho.vercel.app
- Frontend (GitHub Pages): `npm run build:pages` y publica `dist` en `gh-pages`.
  URL: https://jerurt23.github.io/BitCode-by-UrteagaEnterprise/
