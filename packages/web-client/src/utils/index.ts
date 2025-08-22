/**
 * @fileoverview Shared utility functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Type definitions
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  status: number;
}

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface StorageItem<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
}

/**
 * Combines class names with Tailwind merge for optimal CSS
 * @param inputs - Class values to combine
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date according to the specified format
 * @param date - Date to format
 * @param format - Format type ('short', 'medium', 'long', 'relative')
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  format: 'short' | 'medium' | 'long' | 'relative' = 'medium',
  locale: string = 'en-US'
): string {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString(locale, {
        year: '2-digit',
        month: 'short',
        day: 'numeric'
      });
    case 'medium':
      return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    case 'long':
      return dateObj.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'relative':
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays === -1) return 'Tomorrow';
      if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 0 && diffDays > -7) return `In ${Math.abs(diffDays)} days`;
      
      return formatDate(date, 'short', locale);
    default:
      return dateObj.toLocaleDateString(locale);
  }
}

/**
 * Debounces a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttles a function call
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Safe localStorage wrapper with error handling
 */
export const storage = {
  /**
   * Get item from localStorage with optional expiration check
   * @param key - Storage key
   * @returns Parsed value or null
   */
  getItem<T = any>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const parsed: StorageItem<T> = JSON.parse(item);
      
      // Check if item has expired
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      
      return parsed.value;
    } catch (error) {
      console.warn(`Error reading from localStorage:`, error);
      return null;
    }
  },

  /**
   * Set item in localStorage with optional expiration
   * @param key - Storage key
   * @param value - Value to store
   * @param expiresInMs - Expiration time in milliseconds
   */
  setItem<T>(key: string, value: T, expiresInMs?: number): void {
    try {
      const item: StorageItem<T> = {
        value,
        timestamp: Date.now(),
        ...(expiresInMs && { expiresAt: Date.now() + expiresInMs })
      };
      
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.warn(`Error writing to localStorage:`, error);
    }
  },

  /**
   * Remove item from localStorage
   * @param key - Storage key
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Error removing from localStorage:`, error);
    }
  },

  /**
   * Clear all localStorage items
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn(`Error clearing localStorage:`, error);
    }
  }
};

/**
 * Utility functions for common operations
 */
export const utils = {
  /**
   * Generates a random ID
   * @param length - Length of the ID
   * @returns Random string ID
   */
  generateId(length: number = 8): string {
    return Math.random().toString(36).substring(2, length + 2);
  },

  /**
   * Capitalizes the first letter of a string
   * @param str - Input string
   * @returns Capitalized string
   */
  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Truncates text to specified length
   * @param text - Input text
   * @param length - Maximum length
   * @param suffix - Suffix to add when truncated
   * @returns Truncated text
   */
  truncate(text: string, length: number, suffix: string = '...'): string {
    if (text.length <= length) return text;
    return text.substring(0, length) + suffix;
  },

  /**
   * Checks if a value is empty (null, undefined, empty string, empty array)
   * @param value - Value to check
   * @returns True if empty
   */
  isEmpty(value: any): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },

  /**
   * Deep clones an object
   * @param obj - Object to clone
   * @returns Cloned object
   */
  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => utils.deepClone(item)) as unknown as T;
    
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = utils.deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

// Export everything
export * from './types';

// Re-export commonly used types
export type { ClassValue } from 'clsx';