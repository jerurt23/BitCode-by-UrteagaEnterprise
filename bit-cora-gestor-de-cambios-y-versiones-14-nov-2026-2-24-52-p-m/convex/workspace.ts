import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

const WORKSPACE_KEY = 'main';

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

export const get = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', WORKSPACE_KEY))
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
    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', WORKSPACE_KEY))
      .first();
    const updatedAt = new Date().toISOString();

    if (doc) {
      await ctx.db.patch(doc._id, { projects: args.projects, updatedAt });

      // Avisa a los otros dispositivos suscritos a estos módulos.
      const changes = collectChangedModules(doc.projects, args.projects);
      if (changes.length > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.push.sendModuleUpdates,
          {
            changes,
            originDeviceId: args.deviceId,
          },
        );
      }

      return doc._id;
    }

    return await ctx.db.insert('workspace', {
      key: WORKSPACE_KEY,
      projects: args.projects,
      updatedAt,
    });
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', WORKSPACE_KEY))
      .first();
    return doc?.profile ?? null;
  },
});

export const saveProfile = mutation({
  args: {
    profile: v.object({
      name: v.string(),
      email: v.string(),
      color: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', WORKSPACE_KEY))
      .first();
    const updatedAt = new Date().toISOString();

    if (doc) {
      await ctx.db.patch(doc._id, { profile: args.profile, updatedAt });
      return doc._id;
    }

    return await ctx.db.insert('workspace', {
      key: WORKSPACE_KEY,
      projects: [],
      profile: args.profile,
      updatedAt,
    });
  },
});

/**
 * Borra todos los proyectos y el perfil, dejando el espacio de trabajo vacío.
 * Las suscripciones de notificaciones del dispositivo se conservan.
 */
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', WORKSPACE_KEY))
      .first();

    if (!doc) return null;

    await ctx.db.replace(doc._id, {
      key: WORKSPACE_KEY,
      projects: [],
      updatedAt: new Date().toISOString(),
    });

    return null;
  },
});
