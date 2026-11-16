import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  KeyRound,
  LogOut,
  Mail,
  RotateCcw,
  Save,
  Smartphone,
  User,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { CurrentUser, Project, UserProfile } from '../types/workspace';
import { SuperAdminPanel } from './SuperAdminPanel';
import { formatShortDate } from '../utils/projectHelpers';
import {
  getDeviceId,
  getDeviceName,
  isIosDevice,
  isRunningAsInstalledApp,
} from '../utils/device';
import {
  enablePushNotifications,
  getExistingPushSubscription,
  loadNotificationPreferences,
  pushSupported,
  saveNotificationPreferences,
  serializePushSubscription,
} from '../utils/push';

const PROFILE_COLORS = [
  { hex: '#2563EB', label: 'Azul' },
  { hex: '#0D9488', label: 'Verde' },
  { hex: '#D97706', label: 'Ámbar' },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#DC2626', label: 'Carmesí' },
  { hex: '#3F3F46', label: 'Grafito' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'B';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface SettingsViewProps {
  projects: Project[];
  user: CurrentUser;
  localFileName: string;
  onResetAll: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  projects,
  user,
  localFileName,
  onResetAll,
}) => {
  const { signOut } = useAuthActions();
  const saveProfile = useMutation(api.users.saveProfile);
  const changePassword = useMutation(api.auth.changePassword);
  const legacyStatus = useQuery(api.workspace.legacyStatus);
  const claimLegacy = useMutation(api.workspace.claimLegacy);
  const vapidKey = useQuery(api.notifications.vapidPublicKey);
  const subscribePush = useMutation(api.notifications.subscribe);
  const unsubscribePush = useMutation(api.notifications.unsubscribe);
  const sendTestPush = useMutation(api.notifications.sendTest);

  const [profile, setProfile] = useState<UserProfile>({
    name: user.name,
    email: user.email,
    color: user.color || '#2563EB',
  });
  const profileDirty = useRef(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [signOutOtherSessions, setSignOutOtherSessions] = useState(true);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const initialPrefs = useRef(loadNotificationPreferences(user.id));
  const [moduleIds, setModuleIds] = useState<string[]>(
    () =>
      initialPrefs.current?.moduleIds ??
      projects.flatMap((project) => project.modules.map((mod) => mod.id)),
  );
  const [deadlineReminders, setDeadlineReminders] = useState<boolean>(
    () => initialPrefs.current?.deadlineReminders ?? true,
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [pushState, setPushState] = useState<
    'checking' | 'off' | 'on' | 'unsupported'
  >('checking');
  const [pushMessage, setPushMessage] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const autoSelected = useRef(Boolean(initialPrefs.current));

  const [legacyCode, setLegacyCode] = useState('');
  const [legacyMessage, setLegacyMessage] = useState('');
  const [claimingLegacy, setClaimingLegacy] = useState(false);

  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);

  // Perfil de la cuenta: llega actualizado desde Convex.
  useEffect(() => {
    if (profileDirty.current) return;
    setProfile({
      name: user.name,
      email: user.email,
      color: user.color || '#2563EB',
    });
  }, [user.name, user.email, user.color]);

  // Estado actual de las notificaciones en este dispositivo.
  useEffect(() => {
    let active = true;
    if (!pushSupported()) {
      setPushState('unsupported');
      return;
    }
    getExistingPushSubscription()
      .then((sub) => {
        if (!active) return;
        setSubscription(sub);
        setPushState(sub && Notification.permission === 'granted' ? 'on' : 'off');
      })
      .catch(() => {
        if (active) setPushState('off');
      });
    return () => {
      active = false;
    };
  }, []);

  // Mantiene las preferencias locales y las del servidor sincronizadas.
  useEffect(() => {
    saveNotificationPreferences({ moduleIds, deadlineReminders }, user.id);
    if (!subscription) return;

    const timer = window.setTimeout(() => {
      try {
        subscribePush({
          ...serializePushSubscription(subscription),
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
          moduleIds,
          deadlineReminders,
        }).catch(() => {
          // Si falla, se reintenta en el siguiente cambio.
        });
      } catch {
        // Suscripción incompleta; el usuario puede volver a activarla.
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    moduleIds,
    deadlineReminders,
    subscription,
    subscribePush,
    user.id,
  ]);

  // Añade módulos nuevos a la selección inicial y quita los eliminados.
  useEffect(() => {
    const allIds = projects.flatMap((project) =>
      project.modules.map((mod) => mod.id),
    );
    if (!autoSelected.current && allIds.length > 0) {
      autoSelected.current = true;
      setModuleIds(allIds);
      return;
    }
    setModuleIds((prev) => {
      const next = prev.filter((id) => allIds.includes(id));
      return next.length === prev.length ? prev : next;
    });
  }, [projects]);

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile.name.trim()) {
      setProfileMessage('Escribe tu nombre para guardar el perfil.');
      return;
    }

    setSavingProfile(true);
    setProfileMessage('');
    try {
      const next = {
        ...profile,
        name: profile.name.trim(),
        email: profile.email.trim(),
      };
      await saveProfile({
        name: next.name,
        email: next.email,
        color: next.color,
      });
      profileDirty.current = false;
      setProfile(next);
      setProfileMessage('Perfil guardado en tu cuenta.');
    } catch {
      setProfileMessage('No se pudo guardar el perfil. Revisa tu conexión.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      if (!vapidKey) {
        throw new Error(
          'La clave de notificaciones aún no está lista. Recarga la página e inténtalo de nuevo.',
        );
      }
      const sub = await enablePushNotifications(vapidKey);
      const payload = serializePushSubscription(sub);
      await subscribePush({
        ...payload,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        moduleIds,
        deadlineReminders,
      });
      setSubscription(sub);
      setPushState('on');
      setPushMessage('Notificaciones activadas en este dispositivo.');
    } catch (error) {
      setPushMessage(
        error instanceof Error
          ? error.message
          : 'No se pudieron activar las notificaciones.',
      );
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      const sub = subscription ?? (await getExistingPushSubscription());
      if (sub) {
        try {
          await unsubscribePush({ endpoint: sub.endpoint });
        } catch {
          // La suscripción local se desactiva igualmente.
        }
        await sub.unsubscribe();
      }
      setSubscription(null);
      setPushState('off');
      setPushMessage('Notificaciones desactivadas en este dispositivo.');
    } catch {
      setPushMessage('No se pudieron desactivar las notificaciones.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    if (!subscription) return;
    setPushMessage('');
    try {
      await sendTestPush({ endpoint: subscription.endpoint });
      setPushMessage('Notificación de prueba enviada. Revisa este dispositivo.');
    } catch {
      setPushMessage('No se pudo enviar la notificación de prueba.');
    }
  };

  const toggleModule = (moduleId: string) => {
    setModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId],
    );
  };

  const allModuleIds = projects.flatMap((project) =>
    project.modules.map((mod) => mod.id),
  );

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        signOutOtherSessions,
      });

      if (result.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordMessage('Contraseña actualizada correctamente.');
        return;
      }

      switch (result.userError.error) {
        case 'INVALID_CREDENTIALS':
          setPasswordError('La contraseña actual es incorrecta.');
          break;
        case 'PASSWORD_TOO_SHORT':
          setPasswordError(
            `La nueva contraseña debe tener al menos ${result.userError.minimumLength} caracteres.`,
          );
          break;
        case 'PASSWORD_TOO_LONG':
          setPasswordError(
            `La nueva contraseña no puede superar ${result.userError.maximumLength} caracteres.`,
          );
          break;
        case 'PASSWORD_HAS_SURROUNDING_WHITESPACE':
          setPasswordError(
            'La contraseña no puede empezar ni terminar con espacios.',
          );
          break;
        case 'PASSWORD_TOO_COMMON':
          setPasswordError('Esa contraseña es demasiado común. Elige otra.');
          break;
        case 'RATE_LIMITED':
          setPasswordError(
            `Demasiados intentos. Espera ${Math.ceil(result.userError.retryAfterMs / 1000)} s.`,
          );
          break;
        case 'NOT_LOGGED_IN':
          setPasswordError('Tu sesión terminó. Vuelve a iniciar sesión.');
          break;
        default:
          setPasswordError('No se pudo cambiar la contraseña.');
      }
    } catch (cause) {
      console.error('No se pudo cambiar la contraseña', cause);
      setPasswordError('No se pudo cambiar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleClaimLegacy = async (event: React.FormEvent) => {
    event.preventDefault();
    setLegacyMessage('');
    setClaimingLegacy(true);
    try {
      await claimLegacy({ code: legacyCode });
      setLegacyCode('');
      setLegacyMessage(
        'Espacio importado. Tus proyectos aparecerán en el dashboard.',
      );
    } catch (cause) {
      setLegacyMessage(
        cause instanceof Error
          ? cause.message
          : 'No se pudo importar el espacio anterior.',
      );
    } finally {
      setClaimingLegacy(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirm.trim().toUpperCase() !== 'BORRAR') return;

    setResetting(true);
    setResetMessage('');
    try {
      await onResetAll();
      setModuleIds([]);
      setResetConfirm('');
      setResetMessage(
        'Datos borrados. Tu cuenta y tu perfil se conservan.',
      );
    } catch {
      setResetMessage('No se pudo reiniciar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setResetting(false);
    }
  };

  const selectedCount = moduleIds.filter((id) =>
    allModuleIds.includes(id),
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-semibold text-zinc-900">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cuenta, notificaciones por módulo y control de tus datos.
        </p>
      </header>

      {/* Perfil y cuenta */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3.5 sm:px-5">
          <User className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Mi cuenta</h2>
          <span className="font-mono text-[11px] text-zinc-400">
            @{user.username}
          </span>
          {user.role === 'superadmin' && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
              Superadmin
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: profile.color }}
              aria-hidden="true"
            >
              {initials(profile.name || user.username)}
            </div>
            <div className="min-w-[220px] flex-1 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Nombre
                </span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(event) => {
                    profileDirty.current = true;
                    setProfile((prev) => ({ ...prev, name: event.target.value }));
                  }}
                  placeholder="Tu nombre"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Correo
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(event) => {
                      profileDirty.current = true;
                      setProfile((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }));
                    }}
                    placeholder="tu@correo.com"
                    className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </label>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-600">
              Color del avatar
            </span>
            <div className="flex flex-wrap gap-2">
              {PROFILE_COLORS.map((option) => (
                <button
                  key={option.hex}
                  type="button"
                  onClick={() => {
                    profileDirty.current = true;
                    setProfile((prev) => ({ ...prev, color: option.hex }));
                  }}
                  aria-label={`Color ${option.label}`}
                  aria-pressed={profile.color === option.hex}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    profile.color === option.hex
                      ? 'scale-110 border-zinc-900'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: option.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {savingProfile ? 'Guardando…' : 'Guardar perfil'}
            </button>
            {profileMessage && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                {profileMessage}
              </span>
            )}
          </div>
          <div className="space-y-1 text-[11px] text-zinc-500">
            <p>
              El perfil se sincroniza con tu cuenta en todos los dispositivos.
            </p>
            <p className="truncate font-mono text-zinc-400" title={localFileName}>
              Copia local: {localFileName}
            </p>
          </div>
        </form>
      </section>

      {/* Contraseña */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3.5 sm:px-5">
          <KeyRound className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Contraseña</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-600">
                Contraseña actual
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={changingPassword}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">
                Nueva contraseña
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={changingPassword}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">
                Repetir nueva contraseña
              </span>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(event) =>
                  setConfirmNewPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
                disabled={changingPassword}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none disabled:opacity-60"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={signOutOtherSessions}
              onChange={(event) =>
                setSignOutOtherSessions(event.target.checked)
              }
              disabled={changingPassword}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            Cerrar sesión en otros dispositivos al cambiar la contraseña
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {changingPassword ? 'Cambiando…' : 'Cambiar contraseña'}
            </button>
            {passwordMessage && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                {passwordMessage}
              </span>
            )}
            {passwordError && (
              <span className="text-xs text-red-600">{passwordError}</span>
            )}
          </div>
        </form>
      </section>

      {user.role === 'superadmin' && (
        <SuperAdminPanel currentUserId={user.id} />
      )}

      {/* Importar espacio anterior */}
      {legacyStatus?.canClaim && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60">
          <div className="border-b border-amber-200 px-4 py-3.5 sm:px-5">
            <h2 className="text-sm font-semibold text-amber-900">
              Espacio de trabajo anterior
            </h2>
          </div>
          <form
            onSubmit={handleClaimLegacy}
            className="space-y-3 p-4 sm:p-5"
          >
            <p className="text-xs text-amber-800">
              Encontramos tus proyectos anteriores. Introduce el código privado
              para agregarlos a tu espacio actual.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={legacyCode}
                onChange={(event) => setLegacyCode(event.target.value)}
                placeholder="Código de importación"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-56 rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={claimingLegacy || !legacyCode.trim()}
                className="rounded-md bg-amber-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {claimingLegacy ? 'Importando…' : 'Importar espacio'}
              </button>
            </div>
            {legacyMessage && (
              <p className="text-xs text-amber-900">{legacyMessage}</p>
            )}
          </form>
        </section>
      )}

      {/* Notificaciones */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">
              Notificaciones
            </h2>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              pushState === 'on'
                ? 'bg-emerald-50 text-emerald-700'
                : pushState === 'unsupported'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {pushState === 'on'
              ? `Activadas · ${getDeviceName()}`
              : pushState === 'unsupported'
                ? 'No disponibles'
                : pushState === 'checking'
                  ? 'Comprobando…'
                  : 'Desactivadas'}
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {pushState === 'unsupported' ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {isIosDevice() && !isRunningAsInstalledApp()
                  ? 'En iPhone primero instala BitCode en la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde el ícono. Solo así iOS permite notificaciones.'
                  : 'Este navegador no soporta notificaciones push. Prueba con Chrome, Edge o Safari actualizado.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                {pushState === 'on' ? (
                  <BellRing className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <BellOff className="mt-0.5 h-4 w-4 text-zinc-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {pushState === 'on'
                      ? 'Notificaciones activas en este dispositivo'
                      : 'Activa las notificaciones en este dispositivo'}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Recibirás avisos de los módulos que elijas aunque la app esté
                    cerrada.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pushState === 'on' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleTestPush}
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Enviar prueba
                    </button>
                    <button
                      type="button"
                      onClick={handleDisablePush}
                      disabled={pushBusy}
                      className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Desactivar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={pushBusy || pushState === 'checking'}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    {pushBusy ? 'Activando…' : 'Activar notificaciones'}
                  </button>
                )}
              </div>
            </div>
          )}

          {pushMessage && (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              {pushMessage}
            </p>
          )}

          <div className="border-t border-zinc-200 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-zinc-900">
                  Avisos por módulo
                </h3>
                <p className="text-xs text-zinc-500">
                  Elige qué módulos te envían notificaciones cuando cambian en
                  otro dispositivo.
                </p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500">
                {selectedCount}/{allModuleIds.length} seleccionados
              </span>
            </div>

            {projects.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500">
                Crea un proyecto y sus módulos para configurar sus avisos.
              </p>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-md border border-zinc-200"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/60 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate text-xs font-semibold text-zinc-800">
                          {project.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setModuleIds((prev) => {
                            const ids = project.modules.map((mod) => mod.id);
                            const allSelected = ids.every((id) =>
                              prev.includes(id),
                            );
                            return allSelected
                              ? prev.filter((id) => !ids.includes(id))
                              : Array.from(new Set([...prev, ...ids]));
                          })
                        }
                        className="text-[10px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        {project.modules.every((mod) =>
                          moduleIds.includes(mod.id),
                        )
                          ? 'Quitar todos'
                          : 'Todos'}
                      </button>
                    </div>
                    {project.modules.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-zinc-400">
                        Sin módulos
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {project.modules.map((mod) => {
                          const enabled = moduleIds.includes(mod.id);
                          return (
                            <li
                              key={mod.id}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-zinc-800">
                                  {mod.name}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                  Límite: {formatShortDate(mod.deadline)}
                                </p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`Notificaciones del módulo ${mod.name}`}
                                onClick={() => toggleModule(mod.id)}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                                  enabled ? 'bg-blue-600' : 'bg-zinc-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                    enabled ? 'left-4' : 'left-0.5'
                                  }`}
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="mt-3 flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2">
              <span className="text-xs text-zinc-700">
                Recordatorios de fecha límite
                <span className="mt-0.5 block text-[10px] text-zinc-500">
                  Aviso diario cuando un módulo vence en los próximos 3 días.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={deadlineReminders}
                aria-label="Recordatorios de fecha límite"
                onClick={() => setDeadlineReminders((prev) => !prev)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  deadlineReminders ? 'bg-blue-600' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    deadlineReminders ? 'left-4' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      </section>

      {/* Zona de riesgo */}
      <section className="rounded-lg border border-red-200 bg-white">
        <div className="flex items-center gap-2 border-b border-red-100 px-4 py-3.5 sm:px-5">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold text-zinc-900">
            Empezar desde cero
          </h2>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs text-zinc-600">
            Borra todos los proyectos, módulos, notas, ramas e historial de tu
            espacio. Tu cuenta y tu perfil se conservan. Esta acción no se
            puede deshacer y se aplica a todos tus dispositivos.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-zinc-600">
                Escribe <strong>BORRAR</strong> para confirmar
              </span>
              <input
                type="text"
                value={resetConfirm}
                onChange={(event) => setResetConfirm(event.target.value)}
                placeholder="BORRAR"
                className="w-40 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleReset}
              disabled={
                resetting || resetConfirm.trim().toUpperCase() !== 'BORRAR'
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resetting ? 'Reiniciando…' : 'Reiniciar todo'}
            </button>
          </div>
          {resetMessage && (
            <p className="text-xs text-zinc-600">{resetMessage}</p>
          )}
        </div>
      </section>
    </div>
  );
};
