import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  workspace: defineTable({
    key: v.string(),
    projects: v.any(),
    updatedAt: v.string(),
    profile: v.optional(
      v.object({
        name: v.string(),
        email: v.string(),
        color: v.string(),
      }),
    ),
  }).index('by_key', ['key']),
  pushSubscriptions: defineTable({
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    deviceId: v.string(),
    deviceName: v.string(),
    moduleIds: v.array(v.string()),
    deadlineReminders: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_endpoint', ['endpoint'])
    .index('by_device', ['deviceId']),
});
