import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { createRoot } from 'react-dom/client';
import { api } from '../convex/_generated/api';
import { AppShell } from './AppShell.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error(
    'Falta VITE_CONVEX_URL en .env.local. Ejecuta `npx convex dev` para generarlo.',
  );
}

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById('root')!).render(
  <ConvexAuthProvider
    client={convex}
    api={{
      refreshSession: api.auth.refreshSession,
      signOut: api.auth.signOut,
      isAuthenticated: api.auth.isAuthenticated,
    }}
  >
    <AppShell />
  </ConvexAuthProvider>,
);

// PWA: registra el service worker para poder instalar la app en el teléfono.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => {
        console.warn('No se pudo registrar el service worker', error);
      });
  });
}
