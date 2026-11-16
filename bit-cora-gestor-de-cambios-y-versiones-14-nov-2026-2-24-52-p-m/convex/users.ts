import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internalMutation, mutation, query } from './_generated/server';
import { components } from './_generated/api';

/**
 * Convex Auth llama esta mutación al crear la cuenta. Aquí guardamos los datos
 * propios del perfil (el nombre de usuario lo gestiona el componente de auth).
 */
export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal('usernamePassword'),
      profile: v.object({}),
    }),
  },
  returns: v.id('users'),
  handler: async (ctx) => {
    return await ctx.db.insert('users', {
      createdAt: new Date().toISOString(),
    });
  },
});

/** Perfil del usuario autenticado, incluido su nombre de usuario único. */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (user === null) return null;

    const username = await ctx.runQuery(
      components.authUsername.public.getUsername,
      { userId },
    );

    return {
      id: userId,
      username: username ?? '',
      name: user.name ?? '',
      email: user.email ?? '',
      color: user.color ?? '#2563EB',
    };
  },
});

/** Guarda el perfil visible del usuario autenticado. */
export const saveProfile = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    await ctx.db.patch(userId, {
      name: args.name.trim(),
      email: args.email.trim(),
      color: args.color,
    });
    return null;
  },
});
