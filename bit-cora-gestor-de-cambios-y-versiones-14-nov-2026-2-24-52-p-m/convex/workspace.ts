import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const WORKSPACE_KEY = 'main';

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
  args: { projects: v.any() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('workspace')
      .withIndex('by_key', (q) => q.eq('key', WORKSPACE_KEY))
      .first();
    const updatedAt = new Date().toISOString();

    if (doc) {
      await ctx.db.patch(doc._id, { projects: args.projects, updatedAt });
      return doc._id;
    }

    return await ctx.db.insert('workspace', {
      key: WORKSPACE_KEY,
      projects: args.projects,
      updatedAt,
    });
  },
});
