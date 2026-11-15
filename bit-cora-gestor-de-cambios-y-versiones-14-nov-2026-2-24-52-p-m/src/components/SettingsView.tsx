import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  Mail,
  RotateCcw,
  Save,
  Smartphone,
  User,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { Project, UserProfile } from '../types/workspace';
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

const PROFILE_KEY = 'bitcode_profile_v1';

const PROFILE_COLORS = [
  { hex: '#2563EB', label: 'Azul' },
  { hex: '#0D9488', label: 'Verde' },
  { hex: '#D97706', label: 'Ámbar' },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#DC2626', label: 'Carmesí' },
  { hex: '#3F3F46', label: 'Grafito' },
];

const EMPTY_PROFILE: UserProfile = { name: '', email: '', color: '#2563EB' };

function loadLocalProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      color:
        typeof parsed.color === 'string' ? parsed.color : EMPTY_PROFILE.color,
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

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
  onResetAll: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  projects,
  onResetAll,
}) => {
  const remoteProfile = useQuery(api.workspace.getProfile);
  const saveProfile = useMutation(api.workspace.saveProfile);
  const vapidKey = useQuery(api.notifications.vapidPublicKey);
  const subscribePush = useMutation(api.notifications.subscribe);
  const updatePushPreferences = useMutation(
    api.notifications.updatePreferences,
  );
  const unsubscribePush = useMutation(api.notifications.unsubscribe);
  const sendTestPush = useMutation(api.notifications.sendTest);

  const [profile, setProfile] = useState<UserProfile>(loadLocalProfile);
  const profileDirty = useRef(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const initialPrefs = useRef(loadNotificationPreferences());
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

  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);

  // Perfil compartido: llega desde Convex.
  useEffect(() => {
    if (remoteProfile === undefined) return;
    if (!remoteProfile || profileDirty.current) return;
    setProfile(remoteProfile);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(remoteProfile));
    } catch {
      // Sin almacenamiento disponible.
    }
  }, [remoteProfile]);

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
    saveNotificationPreferences({ moduleIds, deadlineReminders });
    if (!subscription) return;

    const timer = window.setTimeout(() => {
      updatePushPreferences({
        endpoint: subscription.endpoint,
        moduleIds,
        deadlineReminders,
      }).catch(() => {
        // Si falla, se reintenta en el siguiente cambio.
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [moduleIds, deadlineReminders, subscription, updatePushPreferences]);

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
      const next = { ...profile, name: profile.name.trim() };
      await saveProfile({ profile: next });
      profileDirty.current = false;
      setProfile(next);
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento disponible.
      }
      setProfileMessage('Perfil guardado y sincronizado.');
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

  const handleReset = async () => {
    if (resetConfirm.trim().toUpperCase() !== 'BORRAR') return;

    setResetting(true);
    setResetMessage('');
    try {
      await onResetAll();
      try {
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem('bitcode_notification_prefs_v1');
      } catch {
        // Sin almacenamiento disponible.
      }
      profileDirty.current = false;
      setProfile(EMPTY_PROFILE);
      setModuleIds([]);
      setResetConfirm('');
      setResetMessage(
        'Todo reiniciado. Ya puedes empezar desde cero en todos tus dispositivos.',
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
          Perfil, notificaciones por módulo y control total de tus datos.
        </p>
      </header>

      {/* Perfil */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3.5 sm:px-5">
          <User className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Mi perfil</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: profile.color }}
              aria-hidden="true"
            >
              {initials(profile.name)}
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
          <p className="text-[11px] text-zinc-500">
            El perfil se sincroniza con tu cuenta en todos los dispositivos.
          </p>
        </form>
      </section>

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
            cuenta. También se elimina el perfil. Esta acción no se puede
            deshacer y se aplica a todos los dispositivos.
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
