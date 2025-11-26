import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Form Submission Validation Template
 *
 * Tests form validation, submission, and success/error handling.
 * Use this template for validating forms with various input types and validation states.
 *
 * @template
 * @category Forms
 *
 * Example usage:
 * ```typescript
 * test('login form submission works correctly', async ({ page }) => {
 *   await formSubmissionTemplate(page, {
 *     formSelector: 'form[data-testid="login-form"]',
 *     fields: [
 *       { selector: 'input[name="email"]', value: 'test@example.com' },
 *       { selector: 'input[name="password"]', value: 'password123' },
 *     ],
 *     submitButtonSelector: 'button[type="submit"]',
 *     expectedSuccessIndicator: '[data-testid="success-message"]',
 *     successTimeout: 5000,
 *   });
 * });
 * ```
 */

export interface FormField {
  selector: string;
  value: string | number;
  type?: 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'radio' | 'select' | 'textarea';
  clearFirst?: boolean;
}

export interface FormValidationRule {
  fieldSelector: string;
  triggerEvent?: 'blur' | 'change' | 'input';
  expectedErrorMessage?: string | RegExp;
  expectedErrorSelector?: string;
}

export interface FormSubmissionConfig {
  formSelector: string;
  fields: FormField[];
  submitButtonSelector: string;
  expectedSuccessIndicator?: string | RegExp;
  expectedErrorIndicator?: string | RegExp;
  successTimeout?: number;
  errorTimeout?: number;
  validationRules?: FormValidationRule[];
  beforeSubmit?: (page: Page) => Promise<void>;
  afterSubmit?: (page: Page) => Promise<void>;
  expectSuccess?: boolean;
  expectedUrl?: string | RegExp;
}

export async function formSubmissionTemplate(
  page: Page,
  config: FormSubmissionConfig
): Promise<void> {
  const {
    formSelector,
    fields,
    submitButtonSelector,
    expectedSuccessIndicator,
    expectedErrorIndicator,
    successTimeout = 5000,
    errorTimeout = 3000,
    validationRules = [],
    beforeSubmit,
    afterSubmit,
    expectSuccess = true,
    expectedUrl,
  } = config;

  // Validate form exists
  const form = page.locator(formSelector);
  await expect(form).toBeVisible({ timeout: 5000 });

  // Fill form fields
  for (const field of fields) {
    const fieldLocator = page.locator(field.selector);
    await expect(fieldLocator).toBeVisible({ timeout: 3000 });

    if (field.clearFirst !== false) {
      await fieldLocator.clear();
    }

    switch (field.type || 'text') {
      case 'checkbox':
        if (field.value) {
          await fieldLocator.check();
        }
        break;
      case 'radio':
        await fieldLocator.check();
        break;
      case 'select':
        await fieldLocator.selectOption(String(field.value));
        break;
      case 'textarea':
        await fieldLocator.fill(String(field.value));
        break;
      default:
        await fieldLocator.fill(String(field.value));
    }
  }

  // Validate form fields with validation rules
  for (const rule of validationRules) {
    const field = page.locator(rule.fieldSelector);
    const triggerEvent = rule.triggerEvent || 'blur';

    if (triggerEvent === 'blur') {
      await field.blur();
    } else {
      await field.dispatchEvent(triggerEvent);
    }

    if (rule.expectedErrorMessage || rule.expectedErrorSelector) {
      if (rule.expectedErrorSelector) {
        const errorElement = page.locator(rule.expectedErrorSelector);
        await expect(errorElement).toBeVisible({ timeout: 2000 });
      }

      if (rule.expectedErrorMessage) {
        const errorText = rule.expectedErrorMessage;
        const formContent = await form.textContent();
        if (typeof errorText === 'string') {
          expect(formContent).toContain(errorText);
        } else {
          expect(formContent).toMatch(errorText);
        }
      }
    }
  }

  // Run before submit hook
  if (beforeSubmit) {
    await beforeSubmit(page);
  }

  // Submit form
  const submitButton = page.locator(submitButtonSelector);
  await expect(submitButton).toBeEnabled({ timeout: 3000 });
  await submitButton.click();

  // Wait for form to process
  await page.waitForLoadState('networkidle', { timeout: successTimeout });

  // Validate success or error state
  if (expectSuccess) {
    if (expectedSuccessIndicator) {
      if (typeof expectedSuccessIndicator === 'string') {
        const successElement = page.locator(expectedSuccessIndicator);
        await expect(successElement).toBeVisible({ timeout: successTimeout });
      } else {
        const pageContent = await page.textContent('body');
        expect(pageContent).toMatch(expectedSuccessIndicator);
      }
    }

    if (expectedUrl) {
      if (typeof expectedUrl === 'string') {
        expect(page.url()).toContain(expectedUrl);
      } else {
        expect(page.url()).toMatch(expectedUrl);
      }
    }
  } else {
    if (expectedErrorIndicator) {
      const errorElement = page.locator(expectedErrorIndicator as string);
      await expect(errorElement).toBeVisible({ timeout: errorTimeout });
    }
  }

  // Run after submit hook
  if (afterSubmit) {
    await afterSubmit(page);
  }
}

/**
 * Helper to validate form field is disabled
 */
export async function expectFieldDisabled(
  page: Page,
  fieldSelector: string
): Promise<void> {
  const field = page.locator(fieldSelector);
  await expect(field).toBeDisabled();
}

/**
 * Helper to validate form field is enabled
 */
export async function expectFieldEnabled(
  page: Page,
  fieldSelector: string
): Promise<void> {
  const field = page.locator(fieldSelector);
  await expect(field).toBeEnabled();
}

/**
 * Helper to get form field value
 */
export async function getFormFieldValue(
  page: Page,
  fieldSelector: string
): Promise<string> {
  const field = page.locator(fieldSelector);
  const value = await field.inputValue();
  return value || '';
}

/**
 * Helper to clear form
 */
export async function clearForm(page: Page, formSelector: string): Promise<void> {
  const form = page.locator(formSelector);
  const inputs = await form.locator('input, textarea, select').all();

  for (const input of inputs) {
    const type = await input.getAttribute('type');
    if (type === 'checkbox' || type === 'radio') {
      await input.uncheck().catch(() => {});
    } else {
      await input.clear();
    }
  }
}
