import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';

/** Clave pública VAPID que necesita el navegador para suscribirse al push. */
export const vapidPublicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    deviceId: v.string(),
    deviceName: v.string(),
    moduleIds: v.array(v.string()),
    deadlineReminders: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, userId, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert('pushSubscriptions', {
      ...args,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePreferences = mutation({
  args: {
    endpoint: v.string(),
    moduleIds: v.array(v.string()),
    deadlineReminders: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();
    if (!existing || existing.userId !== userId) return null;

    await ctx.db.patch(existing._id, {
      moduleIds: args.moduleIds,
      deadlineReminders: args.deadlineReminders,
      updatedAt: new Date().toISOString(),
    });
    return existing._id;
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();
    if (existing && existing.userId === userId) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const sendTest = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();
    if (!existing || existing.userId !== userId) {
      throw new Error('Este dispositivo no está suscrito.');
    }

    await ctx.scheduler.runAfter(0, internal.push.sendTestPush, {
      endpoint: args.endpoint,
    });
    return null;
  },
});

export const listSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query('pushSubscriptions').take(500),
});

export const getByEndpoint = internalQuery({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();
  },
});

export const removeByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Espacios de trabajo de todos los usuarios, para los recordatorios diarios. */
export const listWorkspaces = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query('workspace').collect(),
});
