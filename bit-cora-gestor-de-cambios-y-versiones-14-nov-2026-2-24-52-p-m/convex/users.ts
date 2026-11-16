import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { components } from './_generated/api';

async function requireSuperadmin(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error('No autenticado');

  const user = await ctx.db.get(userId);
  if (!user || user.role !== 'superadmin') {
    throw new Error('Solo el superadmin puede hacer esto.');
  }
  return userId;
}

async function usernameFor(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<string> {
  const username = await ctx.runQuery(
    components.authUsername.public.getUsername,
    { userId },
  );
  return username ?? '';
}

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
      role: 'user',
      createdAt: new Date().toISOString(),
    });
  },
});

/** Se ejecuta en cada inicio de sesión: última conexión y rol inicial. */
export const onSignIn = internalMutation({
  args: {
    method: v.object({
      name: v.literal('usernamePassword'),
      profile: v.object({}),
    }),
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const username = await usernameFor(ctx, args.userId);
    const superadminUsername = process.env.SUPERADMIN_USERNAME?.toLowerCase();
    const patch: {
      lastSignInAt: string;
      role?: 'superadmin';
    } = {
      lastSignInAt: new Date().toISOString(),
    };

    if (
      username &&
      superadminUsername &&
      username.toLowerCase() === superadminUsername
    ) {
      patch.role = 'superadmin';
    }

    await ctx.db.patch(args.userId, patch);
    return null;
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

    const username = await usernameFor(ctx, userId);

    return {
      id: userId,
      username,
      name: user.name ?? '',
      email: user.email ?? '',
      color: user.color ?? '#2563EB',
      role: user.role ?? 'user',
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

/** Lista todos los usuarios. Solo accesible para el superadmin. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    const users = await ctx.db.query('users').collect();
    const rows = await Promise.all(
      users.map(async (user) => ({
        id: user._id,
        username: await usernameFor(ctx, user._id),
        name: user.name ?? '',
        email: user.email ?? '',
        role: user.role ?? 'user',
        createdAt: user.createdAt ?? null,
        lastSignInAt: user.lastSignInAt ?? null,
      })),
    );

    return rows.sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
    );
  },
});

/** Cambia el nombre de usuario (credencial de acceso) de otra cuenta. */
export const adminSetUsername = mutation({
  args: {
    userId: v.id('users'),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error('El usuario no existe.');

    const result = await ctx.runMutation(
      components.authUsername.public.setUsername,
      {
        userId: args.userId,
        username: args.username.trim(),
      },
    );

    if (!result.success) {
      switch (result.userError.error) {
        case 'USERNAME_TAKEN':
          throw new Error('Ese nombre de usuario ya está en uso.');
        case 'USERNAME_TOO_SHORT':
          throw new Error(
            `El usuario debe tener al menos ${result.userError.minimumLength} caracteres.`,
          );
        case 'USERNAME_TOO_LONG':
          throw new Error(
            `El usuario no puede superar ${result.userError.maximumLength} caracteres.`,
          );
        case 'USERNAME_HAS_SURROUNDING_WHITESPACE':
          throw new Error(
            'El usuario no puede empezar ni terminar con espacios.',
          );
        case 'USERNAME_HAS_INVALID_CHARACTERS':
          throw new Error('El usuario contiene caracteres no permitidos.');
      }
    }

    return null;
  },
});

/**
 * Asigna una contraseña nueva a otra cuenta y cierra sus sesiones.
 * No es posible leer la contraseña anterior: está hasheada.
 */
export const adminResetPassword = mutation({
  args: {
    userId: v.id('users'),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await requireSuperadmin(ctx);
    if (args.userId === callerId) {
      throw new Error(
        'Usa la sección Contraseña para cambiar tu propia contraseña.',
      );
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error('El usuario no existe.');

    const result = await ctx.runMutation(
      components.authPassword.public._internal_dangerous_setPassword,
      {
        userId: args.userId,
        password: args.newPassword,
        minimumLength: 8,
      },
    );

    if (!result.success) {
      switch (result.userError.error) {
        case 'PASSWORD_TOO_SHORT':
          throw new Error(
            `La contraseña debe tener al menos ${result.userError.minimumLength} caracteres.`,
          );
        case 'PASSWORD_TOO_LONG':
          throw new Error(
            `La contraseña no puede superar ${result.userError.maximumLength} caracteres.`,
          );
        case 'PASSWORD_HAS_SURROUNDING_WHITESPACE':
          throw new Error(
            'La contraseña no puede empezar ni terminar con espacios.',
          );
        case 'PASSWORD_TOO_COMMON':
          throw new Error('Esa contraseña es demasiado común. Elige otra.');
      }
    }

    // Cierra todas las sesiones abiertas del usuario afectado.
    const sessions = await ctx.runQuery(
      components.auth.public.listSessions,
      { userId: args.userId },
    );
    await ctx.runMutation(components.auth.public.revokeSessions, {
      sessionIds: sessions.map((session) => session.sessionId),
    });

    return null;
  },
});
