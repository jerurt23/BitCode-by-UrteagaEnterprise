'use node';

import { v } from 'convex/values';
import * as webPush from 'web-push';
import type { ActionCtx } from './_generated/server';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';

type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function configureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:bitcode@example.com';

  if (!publicKey || !privateKey) {
    console.warn('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en Convex.');
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendToMany(
  ctx: ActionCtx,
  targets: PushTarget[],
  payload: PushPayload,
): Promise<number> {
  if (targets.length === 0 || !configureVapid()) return 0;

  let sent = 0;
  await Promise.allSettled(
    targets.map(async (target) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(internal.notifications.removeByEndpoint, {
            endpoint: target.endpoint,
          });
        } else {
          console.warn(
            'No se pudo enviar la notificación push:',
            statusCode,
            (error as Error).message,
          );
        }
      }
    }),
  );

  return sent;
}

/** Avisa a los demás dispositivos del mismo usuario cuando cambia un módulo. */
export const sendModuleUpdates = internalAction({
  args: {
    changes: v.array(
      v.object({
        moduleId: v.string(),
        moduleName: v.string(),
        projectName: v.string(),
      }),
    ),
    originDeviceId: v.optional(v.string()),
    ownerUserId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.changes.length === 0) return;

    const subscriptions = await ctx.runQuery(
      internal.notifications.listSubscriptions,
      {},
    );
    const moduleIds = new Set(args.changes.map((change) => change.moduleId));
    const targets = subscriptions.filter(
      (sub) =>
        sub.userId === args.ownerUserId &&
        sub.deviceId !== args.originDeviceId &&
        sub.moduleIds.some((id) => moduleIds.has(id)),
    );

    if (targets.length === 0) return;

    const first = args.changes[0];
    const title =
      args.changes.length === 1
        ? `${first.projectName} · ${first.moduleName}`
        : `${args.changes.length} módulos actualizados`;
    const body =
      args.changes.length === 1
        ? 'Cambios guardados desde otro dispositivo.'
        : args.changes
            .slice(0, 3)
            .map((change) => change.moduleName)
            .join(', ');

    await sendToMany(ctx, targets, {
      title,
      body,
      url: './',
      tag: `bitcode-module-${first.moduleId}`,
    });
  },
});

/** Notificación de prueba para comprobar el dispositivo. */
export const sendTestPush = internalAction({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.runQuery(
      internal.notifications.getByEndpoint,
      { endpoint: args.endpoint },
    );
    if (!subscription) return;

    await sendToMany(ctx, [subscription], {
      title: 'BitCode',
      body: 'Notificaciones configuradas correctamente ✅',
      url: './',
      tag: 'bitcode-test',
    });
  },
});

const relativeDeadline = (days: number) =>
  days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`;

/** Recordatorio diario de fechas límite de los próximos 3 días, por usuario. */
export const sendDeadlineReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.runQuery(
      internal.notifications.listWorkspaces,
      {},
    );
    if (workspaces.length === 0) return;

    const subscriptions = await ctx.runQuery(
      internal.notifications.listSubscriptions,
      {},
    );

    const now = new Date();
    const todayUTC = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );

    for (const workspace of workspaces) {
      // Los documentos antiguos con clave 'main' se migran al primer login.
      if (workspace.key === 'main') continue;
      const projects = workspace.projects;
      if (!Array.isArray(projects)) continue;

      const due: Array<{
        moduleId: string;
        moduleName: string;
        projectName: string;
        days: number;
      }> = [];

      for (const project of projects) {
        const modules = Array.isArray(project?.modules) ? project.modules : [];
        for (const module of modules) {
          if (!module?.deadline || module.status === 'completado') continue;
          const [year, month, day] = String(module.deadline)
            .split('-')
            .map(Number);
          if (!year || !month || !day) continue;

          const deadlineUTC = Date.UTC(year, month - 1, day);
          const days = Math.round((deadlineUTC - todayUTC) / 86_400_000);
          if (days >= 0 && days <= 2) {
            due.push({
              moduleId: module.id,
              moduleName: String(module.name ?? 'Módulo'),
              projectName: String(project.name ?? 'Proyecto'),
              days,
            });
          }
        }
      }

      if (due.length === 0) continue;

      const moduleIds = new Set(due.map((item) => item.moduleId));
      const targets = subscriptions.filter(
        (sub) =>
          sub.userId === workspace.key &&
          sub.deadlineReminders &&
          sub.moduleIds.some((id) => moduleIds.has(id)),
      );
      if (targets.length === 0) continue;

      const first = due[0];
      await sendToMany(ctx, targets, {
        title:
          due.length === 1
            ? `Vence pronto: ${first.moduleName}`
            : `${due.length} módulos con fecha límite próxima`,
        body:
          due.length === 1
            ? `${first.projectName} · vence ${relativeDeadline(first.days)}.`
            : due
                .slice(0, 3)
                .map(
                  (item) =>
                    `${item.moduleName} (${relativeDeadline(item.days)})`,
                )
                .join(', '),
        url: './',
        tag: 'bitcode-deadlines',
      });
    }
  },
});
