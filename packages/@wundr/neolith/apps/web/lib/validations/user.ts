/**
 * User Validation Schemas
 * @module lib/validations/user
 */

import { z } from 'zod';

export const USER_ERROR_CODES = {
  INVALID_EMAIL: 'USER_INVALID_EMAIL',
  INVALID_PASSWORD: 'USER_INVALID_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'USER_EMAIL_EXISTS',
  UNAUTHORIZED: 'USER_UNAUTHORIZED',
  VALIDATION_FAILED: 'USER_VALIDATION_FAILED',
  NOT_FOUND: 'USER_NOT_FOUND',
  VALIDATION_ERROR: 'USER_VALIDATION_ERROR',
  INTERNAL_ERROR: 'USER_INTERNAL_ERROR',
} as const;

export type UserErrorCode =
  (typeof USER_ERROR_CODES)[keyof typeof USER_ERROR_CODES];

export const userRoleSchema = z.enum([
  'user',
  'admin',
  'super_admin',
  'moderator',
]);

export const userStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'deleted',
]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  displayName: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
  role: userRoleSchema,
  status: userStatusSchema,
  emailVerified: z.boolean(),
  lastLoginAt: z.string().datetime().optional(),
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  displayName: z.string().max(100).optional(),
  role: userRoleSchema.optional(),
});

export const updateUserSchema = userSchema
  .partial()
  .required({ id: true })
  .omit({
    email: true,
    createdAt: true,
  });

export const userProfileSchema = z.object({
  userId: z.string(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
  social: z
    .object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
  timezone: z.string().optional(),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  notifications: z.record(z.boolean()).optional(),
  privacy: z.record(z.boolean()).optional(),
  // Profile fields
  fullName: z.string().optional(),
  title: z.string().optional(),
  pronouns: z.string().optional(),
  customPronouns: z.string().optional(),
  statusMessage: z.string().optional(),
}).passthrough(); // Allow additional fields not explicitly defined

/**
 * Create standardized user error response
 */
export function createUserErrorResponse(
  message: string,
  code: UserErrorCode,
  details?: Record<string, unknown>
) {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Update user profile schema
 */
export const updateUserProfileSchema = z.object({
  name: z.string().max(100).optional(),
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  avatarUrl: z.string().url().optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
  social: z
    .object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
  timezone: z.string().optional(),
  preferences: userPreferencesSchema.optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
