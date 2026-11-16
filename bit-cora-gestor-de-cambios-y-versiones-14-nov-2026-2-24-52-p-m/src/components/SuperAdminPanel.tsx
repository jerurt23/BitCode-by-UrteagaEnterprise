import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '../../convex/_generated/dataModel';
import { KeyRound, ShieldCheck, UserCog } from 'lucide-react';
import { api } from '../../convex/_generated/api';

interface AdminUser {
  id: Id<'users'>;
  username: string;
  name: string;
  email: string;
  role: 'superadmin' | 'user';
  createdAt: string | null;
  lastSignInAt: string | null;
}

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const UserAdminRow: React.FC<{
  user: AdminUser;
  isSelf: boolean;
}> = ({ user, isSelf }) => {
  const saveUsername = useMutation(api.users.adminSetUsername);
  const resetPassword = useMutation(api.users.adminResetPassword);
  const [username, setUsernameInput] = useState(user.username);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setUsernameInput(user.username);
  }, [user.username]);

  const handleUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const next = username.trim();
    if (!next || next === user.username) return;

    setSavingUsername(true);
    try {
      await saveUsername({ userId: user.id, username: next });
      setMessage(`Usuario actualizado a @${next}.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo cambiar el usuario.',
      );
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setSavingPassword(true);
    try {
      await resetPassword({ userId: user.id, newPassword });
      setNewPassword('');
      setMessage(
        'Contraseña restablecida. El usuario deberá usar la nueva y sus sesiones se cerraron.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo restablecer la contraseña.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <details className="group border-t border-zinc-200 first:border-t-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-zinc-50/70">
        <UserCog className="h-3.5 w-3.5 text-zinc-400" />
        <span className="font-mono text-xs font-medium text-zinc-900">
          @{user.username}
        </span>
        {isSelf && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
            tú
          </span>
        )}
        <span className="truncate text-xs text-zinc-500">
          {user.name || 'Sin nombre'}
        </span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium ${
            user.role === 'superadmin'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {user.role === 'superadmin' ? 'Superadmin' : 'Usuario'}
        </span>
      </summary>

      <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/40 px-3 py-3">
        <p className="text-[10px] text-zinc-500">
          Registrado: {formatDate(user.createdAt)} · Último acceso:{' '}
          {formatDate(user.lastSignInAt)}
        </p>

        <form onSubmit={handleUsername} className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[180px] flex-1">
            <span className="mb-1 block text-[10px] font-medium text-zinc-600">
              Nombre de usuario
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsernameInput(event.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={
              savingUsername || !username.trim() || username.trim() === user.username
            }
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingUsername ? 'Guardando…' : 'Cambiar usuario'}
          </button>
        </form>

        <form onSubmit={handlePassword} className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[180px] flex-1">
            <span className="mb-1 block text-[10px] font-medium text-zinc-600">
              Nueva contraseña
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={isSelf || savingPassword}
              placeholder={
                isSelf ? 'Usa la sección Contraseña' : 'Mínimo 8 caracteres'
              }
              className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
            />
          </label>
          <button
            type="submit"
            disabled={isSelf || savingPassword || newPassword.length < 8}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="h-3 w-3" />
            {savingPassword ? 'Restableciendo…' : 'Restablecer'}
          </button>
        </form>

        {isSelf && (
          <p className="text-[10px] text-zinc-400">
            Para tu propia cuenta usa la sección Contraseña, arriba.
          </p>
        )}
        {message && <p className="text-[11px] text-emerald-600">{message}</p>}
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </details>
  );
};

export const SuperAdminPanel: React.FC<{ currentUserId: string }> = ({
  currentUserId,
}) => {
  const users = useQuery(api.users.listAll);

  if (users === undefined) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white px-4 py-5 text-xs text-zinc-500">
        Cargando usuarios…
      </section>
    );
  }

  if (!users) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3.5 sm:px-5">
        <ShieldCheck className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-zinc-900">
          Administración de usuarios
        </h2>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">
          {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
        </span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Las contraseñas están cifradas y no se pueden visualizar. Puedes
          cambiar el nombre de usuario o asignar una contraseña nueva; al
          restablecerla se cierran las sesiones de esa cuenta.
        </p>

        <div className="overflow-hidden rounded-md border border-zinc-200">
          {users.map((user) => (
            <UserAdminRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
