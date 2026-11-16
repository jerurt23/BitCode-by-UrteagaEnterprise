export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationPreferences {
  moduleIds: string[];
  deadlineReminders: boolean;
}

const PREFS_KEY = 'bitcode_notification_prefs_v1';

function prefsKey(scope?: string): string {
  return scope ? `${PREFS_KEY}:${scope}` : PREFS_KEY;
}

export function loadNotificationPreferences(
  scope?: string,
): NotificationPreferences | null {
  try {
    const raw = localStorage.getItem(prefsKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    if (!Array.isArray(parsed.moduleIds)) return null;
    return {
      moduleIds: parsed.moduleIds.filter((id) => typeof id === 'string'),
      deadlineReminders: parsed.deadlineReminders !== false,
    };
  } catch {
    return null;
  }
}

export function saveNotificationPreferences(
  prefs: NotificationPreferences,
  scope?: string,
): void {
  try {
    localStorage.setItem(prefsKey(scope), JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento disponible; las preferencias quedan en memoria.
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function enablePushNotifications(
  applicationServerKey: string,
): Promise<PushSubscription> {
  if (!pushSupported()) {
    throw new Error('Este navegador no soporta notificaciones push.');
  }

  if (Notification.permission === 'denied') {
    throw new Error(
      'Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador para este sitio.',
    );
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('No se concedió permiso para mostrar notificaciones.');
    }
  }

  if (!(await navigator.serviceWorker.getRegistration())) {
    throw new Error(
      'El service worker todavía no está activo. Recarga la página o abre la app instalada e inténtalo de nuevo.',
    );
  }

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000)),
  ]);
  if (!registration) {
    throw new Error(
      'El service worker no terminó de activarse. Recarga la página e inténtalo de nuevo.',
    );
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
  });
}

export function serializePushSubscription(
  subscription: PushSubscription,
): PushSubscriptionPayload {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('La suscripción de notificaciones está incompleta.');
  }

  return { endpoint: json.endpoint, p256dh, auth };
}
