'use client';

/**
 * @neolith/hooks/settings/use-settings-validation
 *
 * Hook for validating settings form data with real-time validation
 * and error message formatting.
 *
 * @module hooks/settings/use-settings-validation
 */

import { useState, useCallback, useMemo } from 'react';

import {
  userSettingsSchema,
  generalSettingsSchema,
  notificationPreferencesSchema,
  appearanceSettingsSchema,
  privacySettingsSchema,
  type UserSettings,
  type GeneralSettings,
  type NotificationPreferences,
  type AppearanceSettings,
  type PrivacySettings,
} from '@/lib/validations/settings';

import type { z } from 'zod';

/**
 * Validation error type
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Options for useSettingsValidation hook
 */
export interface UseSettingsValidationOptions {
  /** Whether to validate on change */
  validateOnChange?: boolean;
  /** Debounce delay for validation in milliseconds */
  debounceMs?: number;
}

/**
 * Return type for useSettingsValidation hook
 */
export interface UseSettingsValidationReturn {
  /** Validate complete settings object */
  validate: (settings: Partial<UserSettings>) => ValidationResult;
  /** Validate general settings section */
  validateGeneral: (settings: Partial<GeneralSettings>) => ValidationResult;
  /** Validate notification preferences section */
  validateNotifications: (
    settings: Partial<NotificationPreferences>
  ) => ValidationResult;
  /** Validate appearance settings section */
  validateAppearance: (
    settings: Partial<AppearanceSettings>
  ) => ValidationResult;
  /** Validate privacy settings section */
  validatePrivacy: (settings: Partial<PrivacySettings>) => ValidationResult;
  /** Current validation errors */
  errors: ValidationError[];
  /** Whether there are any validation errors */
  hasErrors: boolean;
  /** Clear all validation errors */
  clearErrors: () => void;
  /** Get error message for a specific field */
  getFieldError: (field: string) => string | null;
  /** Check if a field has an error */
  hasFieldError: (field: string) => boolean;
}

/**
 * Hook for validating settings form data
 *
 * Provides comprehensive validation for all settings sections with
 * real-time error reporting and field-level error access.
 *
 * @param options - Configuration options
 * @returns Validation methods and error state
 *
 * @example
 * ```tsx
 * function SettingsForm() {
 *   const {
 *     validate,
 *     errors,
 *     hasErrors,
 *     getFieldError,
 *     clearErrors,
 *   } = useSettingsValidation({ validateOnChange: true });
 *
 *   const handleSubmit = (data: Partial<UserSettings>) => {
 *     const result = validate(data);
 *     if (!result.isValid) {
 *       console.error('Validation failed:', result.errors);
 *       return;
 *     }
 *     // Submit settings
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <Input
 *         name="language"
 *         error={getFieldError('general.language')}
 *       />
 *       {hasErrors && (
 *         <Alert>Please fix the errors before saving</Alert>
 *       )}
 *     </form>
 *   );
 * }
 * ```
 */
export function useSettingsValidation(
  options: UseSettingsValidationOptions = {}
): UseSettingsValidationReturn {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const hasErrors = errors.length > 0;

  // Convert Zod errors to ValidationError array
  const parseZodErrors = useCallback(
    (zodError: z.ZodError, prefix = ''): ValidationError[] => {
      return zodError.errors.map(err => ({
        field: prefix ? `${prefix}.${err.path.join('.')}` : err.path.join('.'),
        message: err.message,
      }));
    },
    []
  );

  // Validate complete settings object
  const validate = useCallback(
    (settings: Partial<UserSettings>): ValidationResult => {
      const result = userSettingsSchema.safeParse(settings);

      if (result.success) {
        setErrors([]);
        return { isValid: true, errors: [] };
      }

      const validationErrors = parseZodErrors(result.error);
      setErrors(validationErrors);
      return { isValid: false, errors: validationErrors };
    },
    [parseZodErrors]
  );

  // Validate general settings
  const validateGeneral = useCallback(
    (settings: Partial<GeneralSettings>): ValidationResult => {
      const result = generalSettingsSchema.safeParse(settings);

      if (result.success) {
        return { isValid: true, errors: [] };
      }

      const validationErrors = parseZodErrors(result.error, 'general');
      return { isValid: false, errors: validationErrors };
    },
    [parseZodErrors]
  );

  // Validate notification preferences
  const validateNotifications = useCallback(
    (settings: Partial<NotificationPreferences>): ValidationResult => {
      const result = notificationPreferencesSchema.safeParse(settings);

      if (result.success) {
        return { isValid: true, errors: [] };
      }

      const validationErrors = parseZodErrors(result.error, 'notifications');
      return { isValid: false, errors: validationErrors };
    },
    [parseZodErrors]
  );

  // Validate appearance settings
  const validateAppearance = useCallback(
    (settings: Partial<AppearanceSettings>): ValidationResult => {
      const result = appearanceSettingsSchema.safeParse(settings);

      if (result.success) {
        return { isValid: true, errors: [] };
      }

      const validationErrors = parseZodErrors(result.error, 'appearance');
      return { isValid: false, errors: validationErrors };
    },
    [parseZodErrors]
  );

  // Validate privacy settings
  const validatePrivacy = useCallback(
    (settings: Partial<PrivacySettings>): ValidationResult => {
      const result = privacySettingsSchema.safeParse(settings);

      if (result.success) {
        return { isValid: true, errors: [] };
      }

      const validationErrors = parseZodErrors(result.error, 'privacy');
      return { isValid: false, errors: validationErrors };
    },
    [parseZodErrors]
  );

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Get error for specific field
  const getFieldError = useCallback(
    (field: string): string | null => {
      const error = errors.find(err => err.field === field);
      return error?.message ?? null;
    },
    [errors]
  );

  // Check if field has error
  const hasFieldError = useCallback(
    (field: string): boolean => {
      return errors.some(err => err.field === field);
    },
    [errors]
  );

  return {
    validate,
    validateGeneral,
    validateNotifications,
    validateAppearance,
    validatePrivacy,
    errors,
    hasErrors,
    clearErrors,
    getFieldError,
    hasFieldError,
  };
}
