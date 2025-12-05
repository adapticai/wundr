/**
 * Enhanced Profile Validation Schemas
 * @module lib/validations/profile
 */

import { z } from 'zod';

export const PROFILE_LIMITS = {
  DISPLAY_NAME_MAX: 50,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  BIO_MAX: 500,
  LOCATION_MAX: 100,
  TITLE_MAX: 100,
  STATUS_MESSAGE_MAX: 100,
  SOCIAL_URL_MAX: 200,
} as const;

export const VISIBILITY_OPTIONS = ['public', 'workspace', 'private'] as const;

export type ProfileVisibility = (typeof VISIBILITY_OPTIONS)[number];

/**
 * Username validation - alphanumeric, hyphens, underscores only
 */
export const usernameSchema = z
  .string()
  .min(PROFILE_LIMITS.USERNAME_MIN, {
    message: `Username must be at least ${PROFILE_LIMITS.USERNAME_MIN} characters`,
  })
  .max(PROFILE_LIMITS.USERNAME_MAX, {
    message: `Username must be at most ${PROFILE_LIMITS.USERNAME_MAX} characters`,
  })
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, hyphens, and underscores',
  })
  .transform(val => val.toLowerCase());

/**
 * Social links schema
 */
export const socialLinksSchema = z.object({
  linkedin: z
    .string()
    .max(PROFILE_LIMITS.SOCIAL_URL_MAX)
    .url({ message: 'Invalid LinkedIn URL' })
    .optional()
    .or(z.literal('')),
  github: z
    .string()
    .max(PROFILE_LIMITS.SOCIAL_URL_MAX)
    .url({ message: 'Invalid GitHub URL' })
    .optional()
    .or(z.literal('')),
  twitter: z
    .string()
    .max(PROFILE_LIMITS.SOCIAL_URL_MAX)
    .url({ message: 'Invalid Twitter/X URL' })
    .optional()
    .or(z.literal('')),
  website: z
    .string()
    .max(PROFILE_LIMITS.SOCIAL_URL_MAX)
    .url({ message: 'Invalid website URL' })
    .optional()
    .or(z.literal('')),
  portfolio: z
    .string()
    .max(PROFILE_LIMITS.SOCIAL_URL_MAX)
    .url({ message: 'Invalid portfolio URL' })
    .optional()
    .or(z.literal('')),
});

/**
 * Profile visibility settings
 */
export const profileVisibilitySchema = z.object({
  profileVisibility: z.enum(VISIBILITY_OPTIONS).default('public'),
  showEmail: z.boolean().default(false),
  showLocation: z.boolean().default(true),
  showSocialLinks: z.boolean().default(true),
  showBio: z.boolean().default(true),
});

/**
 * Enhanced profile update schema
 */
export const enhancedProfileSchema = z.object({
  // Basic info
  name: z
    .string()
    .min(1, { message: 'Display name is required' })
    .max(PROFILE_LIMITS.DISPLAY_NAME_MAX, {
      message: `Display name must be at most ${PROFILE_LIMITS.DISPLAY_NAME_MAX} characters`,
    })
    .optional(),

  username: usernameSchema.optional(),

  bio: z
    .string()
    .max(PROFILE_LIMITS.BIO_MAX, {
      message: `Bio must be at most ${PROFILE_LIMITS.BIO_MAX} characters`,
    })
    .optional()
    .or(z.literal('')),

  location: z
    .string()
    .max(PROFILE_LIMITS.LOCATION_MAX, {
      message: `Location must be at most ${PROFILE_LIMITS.LOCATION_MAX} characters`,
    })
    .optional()
    .or(z.literal('')),

  timezone: z.string().optional(),

  // Professional info
  title: z
    .string()
    .max(PROFILE_LIMITS.TITLE_MAX, {
      message: `Title must be at most ${PROFILE_LIMITS.TITLE_MAX} characters`,
    })
    .optional()
    .or(z.literal('')),

  pronouns: z.string().optional().or(z.literal('')),
  customPronouns: z.string().optional().or(z.literal('')),

  statusMessage: z
    .string()
    .max(PROFILE_LIMITS.STATUS_MESSAGE_MAX, {
      message: `Status message must be at most ${PROFILE_LIMITS.STATUS_MESSAGE_MAX} characters`,
    })
    .optional()
    .or(z.literal('')),

  // Social links
  socialLinks: socialLinksSchema.optional(),

  // Visibility settings
  visibility: profileVisibilitySchema.optional(),
});

export type EnhancedProfileInput = z.infer<typeof enhancedProfileSchema>;
export type SocialLinks = z.infer<typeof socialLinksSchema>;
export type ProfileVisibilitySettings = z.infer<typeof profileVisibilitySchema>;

/**
 * Username availability check schema
 */
export const usernameCheckSchema = z.object({
  username: usernameSchema,
});

export type UsernameCheckInput = z.infer<typeof usernameCheckSchema>;
