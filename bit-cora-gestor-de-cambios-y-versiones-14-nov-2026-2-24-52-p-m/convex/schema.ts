import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  }),
  workspace: defineTable({
    // userId del dueño del espacio de trabajo (o 'main' en datos antiguos).
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
    // Opcional para suscripciones creadas antes de habilitar las cuentas.
    userId: v.optional(v.string()),
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
    .index('by_device', ['deviceId'])
    .index('by_user', ['userId']),
});
