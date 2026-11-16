import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useSignInWithUsernamePassword } from '@convex-dev/auth/methods/username-password/react';
import { useSignUpWithUsernamePassword } from '@convex-dev/auth/methods/username-password/react';
import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password';
import type {
  SignInWithUsernamePasswordResult,
  SignUpWithUsernamePasswordResult,
} from '@convex-dev/auth/methods/username-password/react';
import { api } from '../../convex/_generated/api';

type Mode = 'signIn' | 'signUp';

function signInError(result: SignInWithUsernamePasswordResult): string {
  if (result.status === 'complete') return '';
  switch (result.userError.error) {
    case 'USER_NOT_FOUND':
      return 'No existe una cuenta con ese usuario.';
    case 'INVALID_CREDENTIALS':
      return 'Usuario o contraseña incorrectos.';
    case 'PASSWORD_TOO_SHORT':
      return `La contraseña debe tener al menos ${result.userError.minimumLength} caracteres.`;
    case 'PASSWORD_TOO_LONG':
      return `La contraseña no puede superar ${result.userError.maximumLength} caracteres.`;
    case 'PASSWORD_HAS_SURROUNDING_WHITESPACE':
      return 'La contraseña no puede empezar ni terminar con espacios.';
    case 'RATE_LIMITED':
      return `Demasiados intentos. Espera ${Math.ceil(result.userError.retryAfterMs / 1000)} s.`;
    case 'OTHER_ERROR':
      console.error('Error al iniciar sesión:', result.userError.cause);
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    default:
      return 'No se pudo iniciar sesión.';
  }
}

function signUpError(result: SignUpWithUsernamePasswordResult): string {
  if (result.status === 'complete') return '';
  switch (result.userError.error) {
    case 'USERNAME_TAKEN':
      return 'Ese nombre de usuario ya está en uso.';
    case 'USERNAME_TOO_SHORT':
      return `El usuario debe tener al menos ${result.userError.minimumLength} caracteres.`;
    case 'USERNAME_TOO_LONG':
      return `El usuario no puede superar ${result.userError.maximumLength} caracteres.`;
    case 'USERNAME_HAS_SURROUNDING_WHITESPACE':
      return 'El usuario no puede empezar ni terminar con espacios.';
    case 'USERNAME_HAS_INVALID_CHARACTERS':
      return 'El usuario contiene caracteres no permitidos.';
    case 'PASSWORD_TOO_SHORT':
      return `La contraseña debe tener al menos ${result.userError.minimumLength} caracteres.`;
    case 'PASSWORD_TOO_LONG':
      return `La contraseña no puede superar ${result.userError.maximumLength} caracteres.`;
    case 'PASSWORD_HAS_SURROUNDING_WHITESPACE':
      return 'La contraseña no puede empezar ni terminar con espacios.';
    case 'PASSWORD_TOO_COMMON':
      return 'Esa contraseña es demasiado común. Elige otra.';
    case 'OTHER_ERROR':
      console.error('Error al crear la cuenta:', result.userError.cause);
      return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
    default:
      return 'No se pudo crear la cuenta.';
  }
}

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(
    api.auth,
  );
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(
    api.auth,
  );
  const pending = signingIn || signingUp;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (mode === 'signUp' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (mode === 'signIn') {
      const result = await signIn({ username, password });
      if (result.status !== 'complete') setError(signInError(result));
      return;
    }

    const result = await signUp({ username, password });
    if (result.status !== 'complete') setError(signUpError(result));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-4 py-8 text-zinc-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt="BitCode"
            className="h-16 w-16 rounded-2xl shadow-sm"
          />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
            BitCode
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Tu espacio personal de proyectos y versiones
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div
            role="tablist"
            aria-label="Acceso"
            className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signIn'}
              onClick={() => {
                setMode('signIn');
                setError('');
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'signIn'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signUp'}
              onClick={() => {
                setMode('signUp');
                setError('');
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'signUp'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">
                Usuario
              </span>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={pending}
                placeholder="tu_usuario"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">
                Contraseña
              </span>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === 'signIn' ? 'current-password' : 'new-password'
                }
                minLength={
                  mode === 'signUp' ? DEFAULT_MIN_PASSWORD_LENGTH : undefined
                }
                required
                disabled={pending}
                placeholder="••••••••"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none disabled:opacity-60"
              />
              {mode === 'signUp' && (
                <span className="mt-1 block text-[10px] text-zinc-400">
                  Mínimo {DEFAULT_MIN_PASSWORD_LENGTH} caracteres.
                </span>
              )}
            </label>

            {mode === 'signUp' && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Repetir contraseña
                </span>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={pending}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none disabled:opacity-60"
                />
              </label>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === 'signIn' ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {pending
                ? 'Procesando…'
                : mode === 'signIn'
                  ? 'Entrar'
                  : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-400">
            Tu sesión se guarda en este dispositivo para no pedir la contraseña
            cada vez. La contraseña nunca se guarda en caché.
          </p>
        </div>
      </div>
    </div>
  );
};
