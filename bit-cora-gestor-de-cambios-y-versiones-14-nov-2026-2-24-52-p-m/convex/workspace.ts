import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';

type ModuleChange = {
  moduleId: string;
  moduleName: string;
  projectName: string;
};

function collectChangedModules(
  previousProjects: unknown,
  nextProjects: unknown,
): ModuleChange[] {
  if (!Array.isArray(previousProjects) || !Array.isArray(nextProjects)) {
    return [];
  }

  const previousById = new Map<string, string>();
  for (const project of previousProjects) {
    const modules = Array.isArray(project?.modules) ? project.modules : [];
    for (const module of modules) {
      if (typeof module?.id === 'string') {
        previousById.set(module.id, JSON.stringify(module));
      }
    }
  }

  const changes: ModuleChange[] = [];
  for (const project of nextProjects) {
    const modules = Array.isArray(project?.modules) ? project.modules : [];
    for (const module of modules) {
      if (typeof module?.id !== 'string') continue;
      if (previousById.get(module.id) === JSON.stringify(module)) continue;
      changes.push({
        moduleId: module.id,
        moduleName: String(module.name ?? 'Módulo'),
        projectName: String(project.name ?? 'Proyecto'),
      });
    }
  }

  return changes.slice(0, 20);
}

/**
 * Prepara el espacio de trabajo del usuario.
 * El primer usuario que entra hereda los datos del espacio antiguo (`main`).
 */
export const ensureForUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const own = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', userId))
      .first();
    if (own) return own._id;

    return await ctx.db.insert('workspace', {
      key: userId,
      projects: [],
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Indica si existe el espacio antiguo (`main`) pendiente de importar. */
export const legacyStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const legacy = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', 'main'))
      .first();
    const own = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', userId))
      .first();

    return {
      hasLegacy: Boolean(legacy),
      canClaim: Boolean(legacy),
    };
  },
});

/**
 * Importa el espacio antiguo a la cuenta actual. Requiere el código privado
 * configurado en LEGACY_CLAIM_CODE para que un visitante no pueda reclamarlo.
 */
export const claimLegacy = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const expected = process.env.LEGACY_CLAIM_CODE;
    if (!expected || args.code.trim() !== expected) {
      throw new Error('Código de importación incorrecto.');
    }

    const legacy = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', 'main'))
      .first();
    if (!legacy) throw new Error('No hay un espacio anterior para importar.');

    const own = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', userId))
      .first();
    const now = new Date().toISOString();

    if (own) {
      // Se agregan a lo que ya exista, sin pisar proyectos con el mismo id.
      const ownProjects = Array.isArray(own.projects) ? own.projects : [];
      const legacyProjects = Array.isArray(legacy.projects)
        ? legacy.projects
        : [];
      const existingIds = new Set(
        ownProjects
          .map((project: { id?: unknown }) => project?.id)
          .filter((id: unknown): id is string => typeof id === 'string'),
      );
      const merged = [
        ...ownProjects,
        ...legacyProjects.filter(
          (project: { id?: unknown }) =>
            typeof project?.id !== 'string' || !existingIds.has(project.id),
        ),
      ];

      await ctx.db.patch(own._id, {
        projects: merged,
        updatedAt: now,
      });
      await ctx.db.delete(legacy._id);
    } else {
      await ctx.db.patch(legacy._id, { key: userId, updatedAt: now });
    }

    return null;
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', userId))
      .first();
    return doc?.projects ?? null;
  },
});

export const save = mutation({
  args: {
    projects: v.any(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', userId))
      .first();
    const updatedAt = new Date().toISOString();

    if (doc) {
      await ctx.db.patch(doc._id, { projects: args.projects, updatedAt });

      const changes = collectChangedModules(doc.projects, args.projects);
      if (changes.length > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.push.sendModuleUpdates,
          {
            changes,
            originDeviceId: args.deviceId,
            ownerUserId: userId,
          },
        );
      }

      return doc._id;
    }

    return await ctx.db.insert('workspace', {
      key: userId,
      projects: args.projects,
      updatedAt,
    });
  },
});

/**
 * Borra todos los proyectos y módulos del usuario, pero conserva su cuenta,
 * su perfil y sus suscripciones de notificaciones.
 */
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('No autenticado');

    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', userId))
      .first();
    const updatedAt = new Date().toISOString();

    if (!doc) {
      await ctx.db.insert('workspace', {
        key: userId,
        projects: [],
        updatedAt,
      });
      return null;
    }

    await ctx.db.replace(doc._id, {
      key: userId,
      projects: [],
      updatedAt,
    });

    return null;
  },
});
