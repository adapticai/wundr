/**
 * Type definitions for Inquirer prompts and questions
 */

import type { Answers } from 'inquirer';

/**
 * Valid question types for Inquirer
 */
export type QuestionType = 
  | 'input'
  | 'number'
  | 'confirm'
  | 'list'
  | 'rawlist'
  | 'expand'
  | 'checkbox'
  | 'password'
  | 'editor';

/**
 * Base question interface that extends Inquirer's Question
 */
export interface BaseQuestion {
  type?: QuestionType;
  name: string;
  message: string | ((answers: Answers) => string);
  default?: unknown | ((answers: Answers) => unknown);
  choices?: Array<string | { name: string; value: unknown }> | ((answers: Answers) => Array<string | { name: string; value: unknown }>);
  validate?: (input: unknown, answers?: Answers) => boolean | string | Promise<boolean | string>;
  filter?: (input: unknown, answers: Answers) => unknown;
  transformer?: (input: unknown, answers: Answers, flags: { isFinal?: boolean }) => string;
  when?: boolean | ((answers: Answers) => boolean | Promise<boolean>);
  pageSize?: number;
  prefix?: string;
  suffix?: string;
  askAnswered?: boolean;
  loop?: boolean;
}

/**
 * Input question for text input
 */
export interface InputQuestion extends BaseQuestion {
  type: 'input';
  default?: string | ((answers: Answers) => string);
}

/**
 * Confirm question for yes/no
 */
export interface ConfirmQuestion extends BaseQuestion {
  type: 'confirm';
  default?: boolean | ((answers: Answers) => boolean);
}

/**
 * List question for single selection
 */
export interface ListQuestion extends BaseQuestion {
  type: 'list';
  choices: Array<string | { name: string; value: unknown }> | ((answers: Answers) => Array<string | { name: string; value: unknown }>);
}

/**
 * Checkbox question for multiple selection
 */
export interface CheckboxQuestion extends BaseQuestion {
  type: 'checkbox';
  choices: Array<string | { name: string; value: unknown; checked?: boolean }> | ((answers: Answers) => Array<string | { name: string; value: unknown; checked?: boolean }>);
}

/**
 * Password question for hidden input
 */
export interface PasswordQuestion extends BaseQuestion {
  type: 'password';
  mask?: string | boolean;
}

/**
 * Union type of all question types
 */
export type Question = 
  | InputQuestion
  | ConfirmQuestion
  | ListQuestion
  | CheckboxQuestion
  | PasswordQuestion
  | BaseQuestion;

/**
 * Array of questions
 */
export type Questions = Question[];

/**
 * Type-safe prompt wrapper
 */
export function createQuestion<T extends QuestionType>(
  type: T,
  name: string,
  message: string,
  options?: Partial<BaseQuestion>
): BaseQuestion {
  return {
    type,
    name,
    message,
    ...options
  };
}

/**
 * Create an input question
 */
export function createInputQuestion(
  name: string,
  message: string,
  defaultValue?: string,
  validate?: (input: unknown) => boolean | string
): InputQuestion {
  const question: InputQuestion = {
    type: 'input',
    name,
    message
  };
  
  if (defaultValue !== undefined) {
    question.default = defaultValue;
  }
  
  if (validate !== undefined) {
    question.validate = validate;
  }
  
  return question;
}

/**
 * Create a confirm question
 */
export function createConfirmQuestion(
  name: string,
  message: string,
  defaultValue: boolean = false
): ConfirmQuestion {
  return {
    type: 'confirm',
    name,
    message,
    default: defaultValue
  };
}

/**
 * Create a list question
 */
export function createListQuestion(
  name: string,
  message: string,
  choices: Array<string | { name: string; value: unknown }>
): ListQuestion {
  return {
    type: 'list',
    name,
    message,
    choices
  };
}

/**
 * Create a checkbox question
 */
export function createCheckboxQuestion(
  name: string,
  message: string,
  choices: Array<string | { name: string; value: unknown; checked?: boolean }>
): CheckboxQuestion {
  return {
    type: 'checkbox',
    name,
    message,
    choices
  };
}

/**
 * Convert our typed questions to Inquirer's format
 */
export function toInquirerQuestions(questions: Questions): Questions {
  return questions;
}