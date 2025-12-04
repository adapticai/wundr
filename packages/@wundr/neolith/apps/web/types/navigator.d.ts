/**
 * Type declarations for non-standard Navigator APIs
 * These are real Web APIs that TypeScript doesn't include by default
 */

/**
 * Badging API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
 */
interface Navigator {
  /**
   * Sets the application badge to a number
   * Used primarily in PWAs to show notification counts
   * @param count - The number to display on the badge (0-99 typically)
   */
  setAppBadge?(count?: number): Promise<void>;

  /**
   * Clears the application badge
   */
  clearAppBadge?(): Promise<void>;

  /**
   * Legacy IE property for detecting touch points
   * @deprecated Use navigator.maxTouchPoints instead
   */
  msMaxTouchPoints?: number;

  /**
   * Legacy property for user language in older browsers
   * @deprecated Use navigator.language instead
   */
  userLanguage?: string;
}
