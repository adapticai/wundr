/**
 * Type helpers for working with Inquirer in a type-safe way
 */

import type inquirer from 'inquirer';

/**
 * Inquirer prompt parameters type
 */
export type InquirerPromptParams = Parameters<typeof inquirer.prompt>[0];

/**
 * Cast our questions to Inquirer format safely
 * This is needed because Inquirer's types are complex and our simplified types don't match exactly
 */
export function asInquirerQuestions<T>(questions: T): InquirerPromptParams {
  // We know our questions are valid, but TypeScript can't verify the complex union types
  // This is a controlled type assertion after validation
  return questions as unknown as InquirerPromptParams;
}