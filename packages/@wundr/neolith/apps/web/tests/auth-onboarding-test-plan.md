# Authentication & Onboarding Test Plan

**Version**: 1.0 **Application**: Neolith Web App **Base URL**: http://localhost:3000 **Test Type**:
Functional, UI Validation **Priority**: P0 (Critical Path)

---

## Test Environment Setup

### Prerequisites

- [ ] Application running on http://localhost:3000
- [ ] Playwright MCP server installed and configured
- [ ] Test database seeded with sample data
- [ ] Network access to OAuth providers (Google, GitHub)

### MCP Tools Required

```javascript
mcp__playwright__playwright_navigate;
mcp__playwright__playwright_fill;
mcp__playwright__playwright_click;
mcp__playwright__playwright_screenshot;
mcp__playwright__playwright_console_logs;
mcp__playwright__playwright_evaluate;
```

---

## Test Suite 1: Login Page (/login)

### TS1.1: Navigation & Page Load

**Objective**: Verify login page loads correctly

**Steps**:

1. Navigate to http://localhost:3000/login
   ```javascript
   mcp__playwright__playwright_navigate({ url: 'http://localhost:3000/login' });
   ```
2. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/login-page-load.png',
   });
   ```
3. Check console for errors
   ```javascript
   mcp__playwright__playwright_console_logs({});
   ```

**Expected Results**:

- [ ] Page loads within 3 seconds
- [ ] Login form visible with email and password fields
- [ ] OAuth buttons present (Google, GitHub)
- [ ] "Forgot Password" link visible
- [ ] "Sign Up" link visible
- [ ] No console errors

---

### TS1.2: Empty Form Validation

**Objective**: Verify validation when submitting empty form

**Steps**:

1. Click submit button without filling fields
   ```javascript
   mcp__playwright__playwright_click({ selector: 'button[type="submit"]' });
   ```
2. Capture validation screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/login-empty-validation.png',
   });
   ```

**Expected Results**:

- [ ] Email field shows "Email is required" error
- [ ] Password field shows "Password is required" error
- [ ] Error messages in red/visible color
- [ ] Form does not submit
- [ ] No console errors

---

### TS1.3: Invalid Email Format Validation

**Objective**: Verify email format validation

**Steps**:

1. Fill email with invalid format
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="email"]',
     value: 'notanemail',
   });
   ```
2. Fill password with valid value
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="password"]',
     value: 'Test123!@#',
   });
   ```
3. Submit form
4. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/login-invalid-email.png',
   });
   ```

**Expected Results**:

- [ ] Email field shows "Invalid email format" error
- [ ] Form does not submit
- [ ] Password field remains filled

---

### TS1.4: Valid Login Attempt (Non-existent User)

**Objective**: Verify error handling for invalid credentials

**Steps**:

1. Fill email with valid format
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="email"]',
     value: 'nonexistent@test.com',
   });
   ```
2. Fill password
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="password"]',
     value: 'WrongPassword123!',
   });
   ```
3. Submit form
4. Wait for response
5. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/login-invalid-credentials.png',
   });
   ```
6. Check console logs
   ```javascript
   mcp__playwright__playwright_console_logs({});
   ```

**Expected Results**:

- [ ] Error message displayed: "Invalid email or password"
- [ ] User remains on login page
- [ ] Form fields cleared or password cleared
- [ ] No sensitive error details exposed

---

### TS1.5: OAuth Buttons Presence

**Objective**: Verify OAuth integration UI elements

**Steps**:

1. Check for Google OAuth button
   ```javascript
   mcp__playwright__playwright_evaluate({
     expression: 'document.querySelector(\'[data-provider="google"]\') !== null',
   });
   ```
2. Check for GitHub OAuth button
   ```javascript
   mcp__playwright__playwright_evaluate({
     expression: 'document.querySelector(\'[data-provider="github"]\') !== null',
   });
   ```
3. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/login-oauth-buttons.png',
   });
   ```

**Expected Results**:

- [ ] Google OAuth button visible with Google branding
- [ ] GitHub OAuth button visible with GitHub branding
- [ ] Buttons are clickable (not disabled)
- [ ] Proper spacing and alignment

---

## Test Suite 2: Registration Page (/register)

### TS2.1: Navigation & Page Load

**Objective**: Verify registration page loads correctly

**Steps**:

1. Navigate to http://localhost:3000/register
   ```javascript
   mcp__playwright__playwright_navigate({ url: 'http://localhost:3000/register' });
   ```
2. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/register-page-load.png',
   });
   ```
3. Check console for errors
   ```javascript
   mcp__playwright__playwright_console_logs({});
   ```

**Expected Results**:

- [ ] Page loads within 3 seconds
- [ ] Registration form visible
- [ ] Required fields: Name, Email, Password, Confirm Password
- [ ] Terms & Conditions checkbox
- [ ] "Sign In" link visible
- [ ] No console errors

---

### TS2.2: Empty Form Validation

**Objective**: Verify validation when submitting empty registration form

**Steps**:

1. Click submit without filling fields
   ```javascript
   mcp__playwright__playwright_click({ selector: 'button[type="submit"]' });
   ```
2. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/register-empty-validation.png',
   });
   ```

**Expected Results**:

- [ ] All required fields show validation errors
- [ ] Name: "Name is required"
- [ ] Email: "Email is required"
- [ ] Password: "Password is required"
- [ ] Confirm Password: "Please confirm password"
- [ ] Form does not submit

---

### TS2.3: Password Mismatch Validation

**Objective**: Verify password confirmation matching

**Steps**:

1. Fill name
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="name"]',
     value: 'Test User',
   });
   ```
2. Fill email
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="email"]',
     value: 'test@example.com',
   });
   ```
3. Fill password
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="password"]',
     value: 'Test123!@#',
   });
   ```
4. Fill confirm password with different value
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="confirmPassword"]',
     value: 'DifferentPassword123!',
   });
   ```
5. Submit form
6. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/register-password-mismatch.png',
   });
   ```

**Expected Results**:

- [ ] Confirm password field shows "Passwords do not match" error
- [ ] Form does not submit
- [ ] Other fields remain filled

---

### TS2.4: Password Strength Validation

**Objective**: Verify password strength requirements

**Test Cases**:

**a) Too Short Password**

```javascript
mcp__playwright__playwright_fill({
  selector: 'input[name="password"]',
  value: 'Test1!',
});
```

- [ ] Error: "Password must be at least 8 characters"

**b) No Uppercase**

```javascript
mcp__playwright__playwright_fill({
  selector: 'input[name="password"]',
  value: 'test123!@#',
});
```

- [ ] Error: "Password must contain uppercase letter"

**c) No Lowercase**

```javascript
mcp__playwright__playwright_fill({
  selector: 'input[name="password"]',
  value: 'TEST123!@#',
});
```

- [ ] Error: "Password must contain lowercase letter"

**d) No Number**

```javascript
mcp__playwright__playwright_fill({
  selector: 'input[name="password"]',
  value: 'TestTest!@#',
});
```

- [ ] Error: "Password must contain a number"

**e) No Special Character**

```javascript
mcp__playwright__playwright_fill({
  selector: 'input[name="password"]',
  value: 'TestTest123',
});
```

- [ ] Error: "Password must contain special character"

**f) Valid Strong Password**

```javascript
mcp__playwright__playwright_fill({
  selector: 'input[name="password"]',
  value: 'Test123!@#',
});
```

- [ ] No error shown
- [ ] Green checkmark or success indicator

---

### TS2.5: Email Already Exists

**Objective**: Verify duplicate email handling

**Steps**:

1. Fill form with existing email address
2. Submit form
3. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/register-duplicate-email.png',
   });
   ```

**Expected Results**:

- [ ] Error message: "Email already registered"
- [ ] User remains on registration page
- [ ] Suggestion to login instead

---

## Test Suite 3: Forgot Password Page (/forgot-password)

### TS3.1: Navigation & Page Load

**Objective**: Verify forgot password page loads correctly

**Steps**:

1. Navigate to http://localhost:3000/forgot-password
   ```javascript
   mcp__playwright__playwright_navigate({
     url: 'http://localhost:3000/forgot-password',
   });
   ```
2. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/forgot-password-load.png',
   });
   ```

**Expected Results**:

- [ ] Page loads successfully
- [ ] Email input field visible
- [ ] Submit button visible
- [ ] "Back to Login" link present
- [ ] Clear instructions displayed

---

### TS3.2: Empty Email Validation

**Objective**: Verify validation for empty email

**Steps**:

1. Click submit without entering email
2. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/forgot-password-empty.png',
   });
   ```

**Expected Results**:

- [ ] Email field shows "Email is required" error
- [ ] Form does not submit

---

### TS3.3: Invalid Email Format

**Objective**: Verify email format validation

**Steps**:

1. Fill with invalid email
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="email"]',
     value: 'notanemail',
   });
   ```
2. Submit form
3. Capture screenshot

**Expected Results**:

- [ ] Email field shows "Invalid email format" error
- [ ] Form does not submit

---

### TS3.4: Valid Email Submission

**Objective**: Verify successful password reset request

**Steps**:

1. Fill with valid email
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="email"]',
     value: 'test@example.com',
   });
   ```
2. Submit form
3. Wait for response
4. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/forgot-password-success.png',
   });
   ```

**Expected Results**:

- [ ] Success message displayed
- [ ] Message: "Password reset link sent to your email"
- [ ] Email field cleared or disabled
- [ ] No sensitive information leaked

---

### TS3.5: Non-existent Email Handling

**Objective**: Verify security for non-existent emails

**Steps**:

1. Fill with non-existent email
2. Submit form
3. Capture screenshot

**Expected Results**:

- [ ] Generic success message (don't reveal if email exists)
- [ ] Same behavior as valid email for security
- [ ] No indication whether email is in system

---

## Test Suite 4: Onboarding Wizard (/onboarding)

### TS4.1: Navigation & Page Load

**Objective**: Verify onboarding page loads correctly

**Steps**:

1. Navigate to http://localhost:3000/onboarding
   ```javascript
   mcp__playwright__playwright_navigate({
     url: 'http://localhost:3000/onboarding',
   });
   ```
2. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/onboarding-load.png',
   });
   ```
3. Check console logs
   ```javascript
   mcp__playwright__playwright_console_logs({});
   ```

**Expected Results**:

- [ ] Page loads successfully
- [ ] Step indicator visible (e.g., Step 1 of 3)
- [ ] Progress bar visible
- [ ] Welcome message displayed
- [ ] No console errors

---

### TS4.2: Step 1 - Workspace Creation

**Objective**: Verify workspace creation step

**Steps**:

1. Check for workspace name field
2. Fill workspace name
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="workspaceName"]',
     value: 'Test Workspace',
   });
   ```
3. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/onboarding-step1-filled.png',
   });
   ```
4. Click "Next" button
   ```javascript
   mcp__playwright__playwright_click({
     selector: 'button:has-text("Next")',
   });
   ```

**Expected Results**:

- [ ] Workspace name field visible
- [ ] Optional: Workspace description field
- [ ] "Next" button enabled after filling required fields
- [ ] Progress indicator updates to step 2

---

### TS4.3: Step 1 - Empty Field Validation

**Objective**: Verify validation on workspace creation step

**Steps**:

1. Leave workspace name empty
2. Click "Next"
3. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/onboarding-step1-validation.png',
   });
   ```

**Expected Results**:

- [ ] Workspace name shows "Required" error
- [ ] User cannot proceed to next step
- [ ] Error message clearly visible

---

### TS4.4: Step 2 - Profile/Preferences

**Objective**: Verify second onboarding step

**Steps**:

1. Complete step 1
2. Check step 2 content
3. Fill required fields
4. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/onboarding-step2.png',
   });
   ```

**Expected Results**:

- [ ] Step 2 displays after completing step 1
- [ ] Profile/preference fields visible
- [ ] "Back" button available
- [ ] "Next" button available
- [ ] Progress indicator shows step 2

---

### TS4.5: Step Navigation - Back Button

**Objective**: Verify navigation between steps

**Steps**:

1. Complete step 1
2. On step 2, click "Back" button
   ```javascript
   mcp__playwright__playwright_click({
     selector: 'button:has-text("Back")',
   });
   ```
3. Capture screenshot

**Expected Results**:

- [ ] Returns to step 1
- [ ] Previously entered data preserved
- [ ] Progress indicator updates to step 1

---

### TS4.6: Step 3 - Completion

**Objective**: Verify final onboarding step and completion

**Steps**:

1. Complete steps 1 and 2
2. Verify step 3 content
3. Click "Complete" or "Get Started"
   ```javascript
   mcp__playwright__playwright_click({
     selector: 'button:has-text("Complete")',
   });
   ```
4. Wait for navigation
5. Capture screenshot
   ```javascript
   mcp__playwright__playwright_screenshot({
     path: 'tests/screenshots/onboarding-complete.png',
   });
   ```
6. Check console logs

**Expected Results**:

- [ ] Step 3 displays after completing step 2
- [ ] Summary or confirmation displayed
- [ ] "Complete" button visible
- [ ] After completion, redirected to dashboard/home
- [ ] No console errors

---

### TS4.7: Onboarding Skip Functionality

**Objective**: Verify skip onboarding option (if available)

**Steps**:

1. Look for "Skip" button
2. If present, click skip
3. Capture screenshot

**Expected Results**:

- [ ] Skip button visible (if feature exists)
- [ ] Redirects to dashboard/home
- [ ] Onboarding can be accessed later

---

## Test Suite 5: Cross-Cutting Concerns

### TS5.1: Responsive Design - Mobile View

**Objective**: Verify all pages work on mobile viewports

**Steps**:

1. Set viewport to mobile (375x667)
   ```javascript
   mcp__playwright__playwright_evaluate({
     expression: 'window.resizeTo(375, 667)',
   });
   ```
2. Test all pages
3. Capture screenshots

**Expected Results**:

- [ ] Forms readable and usable on mobile
- [ ] Buttons easily tappable
- [ ] No horizontal scrolling
- [ ] OAuth buttons stack vertically

---

### TS5.2: Keyboard Navigation

**Objective**: Verify keyboard accessibility

**Steps**:

1. Navigate through forms using Tab key
2. Submit forms using Enter key
3. Test focus indicators

**Expected Results**:

- [ ] All fields reachable via Tab
- [ ] Visible focus indicators
- [ ] Enter key submits forms
- [ ] Escape key closes modals (if any)

---

### TS5.3: Loading States

**Objective**: Verify loading indicators during async operations

**Steps**:

1. Submit forms and observe loading states
2. Capture screenshots during loading

**Expected Results**:

- [ ] Loading spinner/indicator visible
- [ ] Submit button disabled during loading
- [ ] No multiple submissions possible

---

### TS5.4: Error Recovery

**Objective**: Verify error handling and recovery

**Steps**:

1. Simulate network failure
2. Submit form
3. Observe error handling

**Expected Results**:

- [ ] User-friendly error message
- [ ] Form remains filled
- [ ] Retry option available

---

## Test Suite 6: Security Checks

### TS6.1: XSS Prevention

**Objective**: Verify input sanitization

**Steps**:

1. Fill fields with XSS payloads
   ```javascript
   mcp__playwright__playwright_fill({
     selector: 'input[name="email"]',
     value: "<script>alert('xss')</script>@test.com",
   });
   ```
2. Submit and observe

**Expected Results**:

- [ ] Script tags not executed
- [ ] Input sanitized or rejected

---

### TS6.2: CSRF Protection

**Objective**: Verify CSRF token implementation

**Steps**:

1. Inspect form for CSRF token
   ```javascript
   mcp__playwright__playwright_evaluate({
     expression: 'document.querySelector(\'input[name="_csrf"]\') !== null',
   });
   ```

**Expected Results**:

- [ ] CSRF token present in forms
- [ ] Token validated on submission

---

### TS6.3: Password Field Security

**Objective**: Verify password field best practices

**Steps**:

1. Inspect password field attributes
2. Check for autocomplete settings

**Expected Results**:

- [ ] Password field type="password"
- [ ] No password visible in page source
- [ ] Autocomplete handled appropriately

---

## Defect Reporting Template

### Defect ID: [AUTO-GENERATED]

**Title**: [Brief description] **Severity**: Critical / High / Medium / Low **Priority**: P0 / P1 /
P2 / P3

**Environment**:

- URL: http://localhost:3000/[page]
- Browser: Chrome/Firefox/Safari
- OS: macOS/Windows/Linux
- Viewport: Desktop/Mobile

**Steps to Reproduce**:

1.
2.
3.

**Expected Result**: [What should happen]

**Actual Result**: [What actually happens]

**Screenshot**: ![Screenshot](tests/screenshots/[filename].png)

**Console Errors**:

```
[Paste console errors]
```

**Additional Notes**: [Any other relevant information]

---

## Test Execution Checklist

### Pre-Execution

- [ ] Application running on localhost:3000
- [ ] Playwright MCP server configured
- [ ] Test database reset/seeded
- [ ] Screenshots directory created

### During Execution

- [ ] Follow test scripts exactly
- [ ] Capture screenshots for all scenarios
- [ ] Log all console errors
- [ ] Document unexpected behavior
- [ ] Note performance issues

### Post-Execution

- [ ] Compile defect list
- [ ] Prioritize issues
- [ ] Create detailed bug reports
- [ ] Share findings with team
- [ ] Update test cases if needed

---

## Test Coverage Summary

| Feature Area      | Test Cases | Priority | Status |
| ----------------- | ---------- | -------- | ------ |
| Login Page        | 5          | P0       | ⏳     |
| Registration      | 5          | P0       | ⏳     |
| Forgot Password   | 5          | P1       | ⏳     |
| Onboarding Wizard | 7          | P0       | ⏳     |
| Cross-Cutting     | 4          | P1       | ⏳     |
| Security          | 3          | P0       | ⏳     |
| **Total**         | **29**     | -        | ⏳     |

---

## Test Automation Script Example

```javascript
// Example Playwright MCP automation script for Login Page tests
async function testLoginPage() {
  // TS1.1: Navigation
  await mcp__playwright__playwright_navigate({
    url: 'http://localhost:3000/login',
  });

  await mcp__playwright__playwright_screenshot({
    path: 'tests/screenshots/login-page-load.png',
  });

  const consoleLogs = await mcp__playwright__playwright_console_logs({});

  // TS1.2: Empty form validation
  await mcp__playwright__playwright_click({
    selector: 'button[type="submit"]',
  });

  await mcp__playwright__playwright_screenshot({
    path: 'tests/screenshots/login-empty-validation.png',
  });

  // TS1.3: Invalid email
  await mcp__playwright__playwright_fill({
    selector: 'input[name="email"]',
    value: 'notanemail',
  });

  await mcp__playwright__playwright_fill({
    selector: 'input[name="password"]',
    value: 'Test123!@#',
  });

  await mcp__playwright__playwright_click({
    selector: 'button[type="submit"]',
  });

  await mcp__playwright__playwright_screenshot({
    path: 'tests/screenshots/login-invalid-email.png',
  });

  // Continue with remaining test cases...
}
```

---

## Notes for Tester

1. **Test Order**: Execute test suites in order (TS1 → TS6)
2. **Screenshots**: Capture ALL scenarios, especially error states
3. **Console Logs**: Check after EVERY navigation and form submission
4. **Browser Compatibility**: If time permits, test on Chrome, Firefox, Safari
5. **Network Conditions**: Test with throttled network to verify loading states
6. **Accessibility**: Use screen reader if available for basic a11y check

---

**Test Plan Version**: 1.0 **Created By**: QA Engineer Agent 1 **Date**: 2025-11-27 **Status**:
Ready for Execution
