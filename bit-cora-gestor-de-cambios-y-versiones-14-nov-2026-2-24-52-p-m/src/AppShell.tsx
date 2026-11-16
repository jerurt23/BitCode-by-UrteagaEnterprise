import React, { useEffect, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../convex/_generated/api';
import App from './App';
import { AuthScreen } from './components/AuthScreen';

const Splash: React.FC<{ label?: string }> = ({ label = 'Cargando…' }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAF9F6] text-zinc-500">
    <img
      src={`${import.meta.env.BASE_URL}icon-192.png`}
      alt="BitCode"
      className="h-12 w-12 rounded-xl shadow-sm"
    />
    <p className="text-xs">{label}</p>
  </div>
);

const WorkspaceGate: React.FC = () => {
  const user = useQuery(api.users.current);
  const ensureWorkspace = useMutation(api.workspace.ensureForUser);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError('');

    ensureWorkspace()
      .then(() => {
        if (!cancelled) setReadyUserId(user.id);
      })
      .catch((cause) => {
        console.error('No se pudo preparar el espacio de trabajo', cause);
        if (!cancelled) {
          setError('No se pudo preparar tu espacio de trabajo.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, ensureWorkspace, attempt]);

  if (user === undefined) return <Splash label="Comprobando tu cuenta…" />;

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-4">
        <div className="max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-center">
          <p className="text-sm font-medium text-zinc-900">
            No encontramos tu perfil
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Vuelve a iniciar sesión para crear tu espacio.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-4">
        <div className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-amber-600" />
          <p className="mt-2 text-sm font-medium text-amber-900">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-4 rounded-md bg-amber-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (readyUserId !== user.id) {
    return <Splash label="Preparando tu espacio…" />;
  }

  return <App key={user.id} user={user} />;
};

export const AppShell: React.FC = () => {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) return <Splash label="Comprobando tu sesión…" />;
  if (!isAuthenticated) return <AuthScreen />;
  return <WorkspaceGate />;
};
