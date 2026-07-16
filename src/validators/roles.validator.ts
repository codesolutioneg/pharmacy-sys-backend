import { z } from 'zod';

export const createRoleSchema = z.object({
  displayName: z.string().min(1).max(125),
  permissionNames: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(125).optional(),
  permissionNames: z.array(z.string()).optional(),
});
