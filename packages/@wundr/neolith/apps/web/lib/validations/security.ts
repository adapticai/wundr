/**
 * Security Validation Schemas
 *
 * Comprehensive validation schemas for account security features including
 * password changes, 2FA, sessions, login history, security questions,
 * account recovery, email/phone verification, and OAuth providers.
 *
 * @module lib/validations/security
 */

import { z } from 'zod';

/**
 * Password change validation
 */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
});

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * 2FA setup validation
 */
export const twoFactorSetupSchema = z.object({
  secret: z.string().min(16).max(64),
});

export const twoFactorVerifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/),
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/),
});

export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

/**
 * Session validation
 */
export const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
});

export type SessionIdInput = z.infer<typeof sessionIdSchema>;

/**
 * Security question validation
 */
export const securityQuestionSchema = z.object({
  question: z.string().min(5).max(200),
  answer: z.string().min(2).max(100),
});

export const securityQuestionsSchema = z.object({
  questions: z
    .array(securityQuestionSchema)
    .min(2, 'At least 2 security questions required')
    .max(5, 'Maximum 5 security questions allowed'),
});

export const verifySecurityAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1),
});

export type SecurityQuestionInput = z.infer<typeof securityQuestionSchema>;
export type SecurityQuestionsInput = z.infer<typeof securityQuestionsSchema>;
export type VerifySecurityAnswerInput = z.infer<
  typeof verifySecurityAnswerSchema
>;

/**
 * Email change validation
 */
export const emailChangeRequestSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const emailVerifySchema = z.object({
  token: z.string().min(32).max(128),
});

export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>;
export type EmailVerifyInput = z.infer<typeof emailVerifySchema>;

/**
 * Phone number validation
 */
export const phoneChangeRequestSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
});

export const phoneVerifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/),
});

export type PhoneChangeRequestInput = z.infer<typeof phoneChangeRequestSchema>;
export type PhoneVerifyInput = z.infer<typeof phoneVerifySchema>;

/**
 * Account recovery validation
 */
export const recoveryEmailSchema = z.object({
  recoveryEmail: z.string().email('Invalid email address'),
});

export const accountRecoverySchema = z.object({
  recoveryEmail: z.string().email().optional(),
  backupCodes: z.boolean().optional(),
  securityQuestions: z.boolean().optional(),
});

export type RecoveryEmailInput = z.infer<typeof recoveryEmailSchema>;
export type AccountRecoveryInput = z.infer<typeof accountRecoverySchema>;

/**
 * OAuth provider validation
 */
export const oauthProviderSchema = z.enum(['google', 'github', 'microsoft']);

export const connectOAuthSchema = z.object({
  provider: oauthProviderSchema,
  code: z.string().min(1),
  state: z.string().min(1),
});

export const disconnectOAuthSchema = z.object({
  provider: oauthProviderSchema,
  password: z.string().min(1, 'Password is required'),
});

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type ConnectOAuthInput = z.infer<typeof connectOAuthSchema>;
export type DisconnectOAuthInput = z.infer<typeof disconnectOAuthSchema>;

/**
 * Login history filters
 */
export const loginHistoryFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  deviceType: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  status: z.enum(['success', 'failed', 'blocked']).optional(),
});

export type LoginHistoryFilters = z.infer<typeof loginHistoryFiltersSchema>;

/**
 * Security audit log filters
 */
export const auditLogFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  eventType: z
    .enum([
      'password_change',
      'email_change',
      'phone_change',
      '2fa_enabled',
      '2fa_disabled',
      'session_revoked',
      'oauth_connected',
      'oauth_disconnected',
      'security_question_updated',
      'recovery_option_updated',
    ])
    .optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
});

export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>;

/**
 * Security settings update
 */
export const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  sessionTimeout: z.enum(['15', '30', '60', '120', 'never']).optional(),
  showOnlineStatus: z.boolean().optional(),
  showTypingIndicators: z.boolean().optional(),
  showReadReceipts: z.boolean().optional(),
  loginAlerts: z.boolean().optional(),
});

export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;

/**
 * Error codes for security operations
 */
export const SECURITY_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_CODE: 'INVALID_CODE',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
  PROVIDER_NOT_CONNECTED: 'PROVIDER_NOT_CONNECTED',
  PROVIDER_ALREADY_CONNECTED: 'PROVIDER_ALREADY_CONNECTED',
  LAST_AUTH_METHOD: 'LAST_AUTH_METHOD',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SecurityErrorCode =
  (typeof SECURITY_ERROR_CODES)[keyof typeof SECURITY_ERROR_CODES];
