import { test, expect } from '@playwright/test';
import { formSubmissionTemplate, clearForm, getFormFieldValue } from '@/templates/form-submission.template';
import { setupTestPage } from '@/helpers/test-setup';

/**
 * Example form testing using the form submission template
 *
 * Demonstrates how to test various form scenarios:
 * - Valid form submission
 * - Form validation
 * - Error handling
 * - Form reset
 */

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestPage(page);
    await page.goto('/contact');
  });

  test('submits form successfully with valid data', async ({ page }) => {
    await formSubmissionTemplate(page, {
      formSelector: 'form[data-testid="contact-form"]',
      fields: [
        {
          selector: 'input[name="name"]',
          value: 'John Doe',
          type: 'text',
        },
        {
          selector: 'input[name="email"]',
          value: 'john@example.com',
          type: 'email',
        },
        {
          selector: 'textarea[name="message"]',
          value: 'This is a test message about my inquiry.',
          type: 'textarea',
        },
        {
          selector: 'input[name="subscribe"]',
          value: true,
          type: 'checkbox',
        },
      ],
      submitButtonSelector: 'button[type="submit"]',
      expectedSuccessIndicator: '[data-testid="success-message"]',
      successTimeout: 5000,
      expectSuccess: true,
      beforeSubmit: async (page) => {
        // Can perform actions before submit
        console.log('Form is ready to submit');
      },
      afterSubmit: async (page) => {
        // Can perform actions after submit
        console.log('Form submitted successfully');
      },
    });
  });

  test('validates email field on blur', async ({ page }) => {
    await page.goto('/contact');

    await formSubmissionTemplate(page, {
      formSelector: 'form[data-testid="contact-form"]',
      fields: [
        {
          selector: 'input[name="email"]',
          value: 'invalid-email',
          type: 'email',
        },
      ],
      submitButtonSelector: 'button[type="submit"]',
      validationRules: [
        {
          fieldSelector: 'input[name="email"]',
          triggerEvent: 'blur',
          expectedErrorSelector: '[data-testid="email-error"]',
          expectedErrorMessage: /Please enter a valid email/i,
        },
      ],
      expectSuccess: false,
    });
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/contact');

    const form = page.locator('form[data-testid="contact-form"]');
    const submitButton = form.locator('button[type="submit"]');

    // Try to submit without filling required fields
    await submitButton.click();

    // Verify validation errors are shown
    const nameError = page.locator('[data-testid="name-error"]');
    const emailError = page.locator('[data-testid="email-error"]');

    await expect(nameError).toBeVisible();
    await expect(emailError).toBeVisible();
  });

  test('shows server validation error', async ({ page, context }) => {
    // Mock API to return validation error
    await context.route('**/api/contact', (route) => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          error: 'Email already exists',
          field: 'email',
        }),
      });
    });

    await formSubmissionTemplate(page, {
      formSelector: 'form[data-testid="contact-form"]',
      fields: [
        {
          selector: 'input[name="name"]',
          value: 'John Doe',
          type: 'text',
        },
        {
          selector: 'input[name="email"]',
          value: 'existing@example.com',
          type: 'email',
        },
        {
          selector: 'textarea[name="message"]',
          value: 'Test message',
          type: 'textarea',
        },
      ],
      submitButtonSelector: 'button[type="submit"]',
      expectedErrorIndicator: '[data-testid="form-error"]',
      expectSuccess: false,
    });

    // Verify error message
    const errorMessage = page.locator('[data-testid="form-error"]');
    await expect(errorMessage).toContainText('Email already exists');
  });

  test('clears form and resets to initial state', async ({ page }) => {
    await page.goto('/contact');

    // Fill form
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    const messageInput = page.locator('textarea[name="message"]');

    await nameInput.fill('John Doe');
    await emailInput.fill('john@example.com');
    await messageInput.fill('Test message');

    // Verify values are set
    expect(await getFormFieldValue(page, 'input[name="name"]')).toBe('John Doe');

    // Clear form using reset button
    const resetButton = page.locator('button[type="reset"]');
    await resetButton.click();

    // Verify form is cleared
    await expect(nameInput).toHaveValue('');
    await expect(emailInput).toHaveValue('');
    await expect(messageInput).toHaveValue('');
  });

  test('handles form with select field', async ({ page }) => {
    await formSubmissionTemplate(page, {
      formSelector: 'form[data-testid="contact-form"]',
      fields: [
        {
          selector: 'input[name="name"]',
          value: 'John Doe',
          type: 'text',
        },
        {
          selector: 'input[name="email"]',
          value: 'john@example.com',
          type: 'email',
        },
        {
          selector: 'select[name="subject"]',
          value: 'inquiry',
          type: 'select',
        },
        {
          selector: 'textarea[name="message"]',
          value: 'Test message',
          type: 'textarea',
        },
      ],
      submitButtonSelector: 'button[type="submit"]',
      expectedSuccessIndicator: '[data-testid="success-message"]',
      expectSuccess: true,
    });
  });

  test('handles form with radio buttons', async ({ page }) => {
    await formSubmissionTemplate(page, {
      formSelector: 'form[data-testid="contact-form"]',
      fields: [
        {
          selector: 'input[name="name"]',
          value: 'John Doe',
          type: 'text',
        },
        {
          selector: 'input[name="email"]',
          value: 'john@example.com',
          type: 'email',
        },
        {
          selector: 'input[name="priority"][value="high"]',
          value: true,
          type: 'radio',
        },
        {
          selector: 'textarea[name="message"]',
          value: 'Urgent message',
          type: 'textarea',
        },
      ],
      submitButtonSelector: 'button[type="submit"]',
      expectedSuccessIndicator: '[data-testid="success-message"]',
      expectSuccess: true,
    });
  });

  test('disables submit button while submitting', async ({ page }) => {
    await page.goto('/contact');

    const form = page.locator('form[data-testid="contact-form"]');
    const submitButton = form.locator('button[type="submit"]');

    // Fill form
    await form.locator('input[name="name"]').fill('John Doe');
    await form.locator('input[name="email"]').fill('john@example.com');
    await form.locator('textarea[name="message"]').fill('Test message');

    // Initially button should be enabled
    await expect(submitButton).toBeEnabled();

    // Click submit
    await submitButton.click();

    // Button should be disabled while submitting
    await expect(submitButton).toBeDisabled();

    // Wait for response
    await page.waitForLoadState('networkidle');

    // Button should be enabled again after submission
    await expect(submitButton).toBeEnabled();
  });

  test('shows loading indicator during submission', async ({ page }) => {
    await page.goto('/contact');

    const form = page.locator('form[data-testid="contact-form"]');

    // Fill form
    await form.locator('input[name="name"]').fill('John Doe');
    await form.locator('input[name="email"]').fill('john@example.com');
    await form.locator('textarea[name="message"]').fill('Test message');

    const submitButton = form.locator('button[type="submit"]');
    const loadingIndicator = form.locator('[data-testid="submit-loading"]');

    // Submit form
    await submitButton.click();

    // Loading indicator should appear
    await expect(loadingIndicator).toBeVisible({ timeout: 1000 });

    // Wait for submission to complete
    await page.waitForLoadState('networkidle');

    // Loading indicator should disappear
    await expect(loadingIndicator).not.toBeVisible();
  });

  test('preserves form data when validation fails', async ({ page }) => {
    await page.goto('/contact');

    const form = page.locator('form[data-testid="contact-form"]');
    const nameInput = form.locator('input[name="name"]');
    const emailInput = form.locator('input[name="email"]');

    // Fill form with valid name but invalid email
    await nameInput.fill('John Doe');
    await emailInput.fill('invalid-email');

    // Try to submit
    const submitButton = form.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify data is preserved
    expect(await getFormFieldValue(page, 'input[name="name"]')).toBe('John Doe');
    expect(await getFormFieldValue(page, 'input[name="email"]')).toBe('invalid-email');
  });

  test('clears error messages when field is corrected', async ({ page }) => {
    await page.goto('/contact');

    const form = page.locator('form[data-testid="contact-form"]');
    const emailInput = form.locator('input[name="email"]');
    const emailError = page.locator('[data-testid="email-error"]');

    // Enter invalid email
    await emailInput.fill('invalid-email');
    await emailInput.blur();

    // Error should appear
    await expect(emailError).toBeVisible();

    // Correct the email
    await emailInput.fill('valid@example.com');
    await emailInput.blur();

    // Error should disappear
    await expect(emailError).not.toBeVisible();
  });
});

test.describe('Multi-Step Form', () => {
  test('completes multi-step form successfully', async ({ page }) => {
    await setupTestPage(page);
    await page.goto('/signup');

    // Step 1: User Info
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.click('button[data-testid="next-button"]');

    await page.waitForSelector('[data-testid="step-2"]');

    // Step 2: Address Info
    await page.fill('input[name="street"]', '123 Main St');
    await page.fill('input[name="city"]', 'New York');
    await page.fill('input[name="zipCode"]', '10001');
    await page.click('button[data-testid="next-button"]');

    await page.waitForSelector('[data-testid="step-3"]');

    // Step 3: Confirm
    await page.click('button[data-testid="confirm-button"]');

    // Verify success
    const successMessage = page.locator('[data-testid="signup-success"]');
    await expect(successMessage).toBeVisible();
  });

  test('allows going back in multi-step form', async ({ page }) => {
    await setupTestPage(page);
    await page.goto('/signup');

    // Fill step 1
    await page.fill('input[name="firstName"]', 'John');
    await page.click('button[data-testid="next-button"]');

    await page.waitForSelector('[data-testid="step-2"]');

    // Go back
    await page.click('button[data-testid="back-button"]');

    await page.waitForSelector('[data-testid="step-1"]');

    // Verify data is preserved
    expect(await getFormFieldValue(page, 'input[name="firstName"]')).toBe('John');
  });
});
