import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  workspace: defineTable({
    key: v.string(),
    projects: v.any(),
    updatedAt: v.string(),
  }).index('by_key', ['key']),
});
