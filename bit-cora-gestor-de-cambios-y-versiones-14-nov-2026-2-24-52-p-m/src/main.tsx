import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error(
    'Falta VITE_CONVEX_URL en .env.local. Ejecuta `npx convex dev` para generarlo.',
  );
}

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById('root')!).render(
  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>,
);
