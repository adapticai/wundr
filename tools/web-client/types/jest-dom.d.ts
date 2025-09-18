// Jest DOM matcher type definitions
import '@testing-library/jest-dom'

// Extend the global namespace to include jest-dom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
      toBeVisible(): R
      toBeDisabled(): R
      toBeEnabled(): R
      toBeEmptyDOMElement(): R
      toBeInvalid(): R
      toBeRequired(): R
      toBeValid(): R
      toHaveAttribute(attr: string, value?: any): R
      toHaveClass(...classNames: string[]): R
      toHaveFocus(): R
      toHaveFormValues(expectedValues: Record<string, any>): R
      toHaveStyle(css: string | Record<string, any>): R
      toHaveTextContent(text: string | RegExp | ((content: string) => boolean)): R
      toHaveValue(value: string | string[] | number): R
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R
      toBeChecked(): R
      toBePartiallyChecked(): R
      toHaveDescription(text?: string | RegExp | ((content: string) => boolean)): R
      toHaveAccessibleDescription(text?: string | RegExp | ((content: string) => boolean)): R
      toHaveAccessibleName(text?: string | RegExp | ((content: string) => boolean)): R
      toBeFinite(): R
    }
  }
  
  // Add custom jest matchers to expect
  namespace Vi {
    interface Assertion<T = any> extends jest.Matchers<void, T> {
      // Extended from jest.Matchers - inherits all matchers
      // This interface provides type safety for Vitest assertions
    }
  }
}