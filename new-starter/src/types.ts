import { z } from 'zod';

export const SetupOptionsSchema = z.object({
  email: z.string().email().optional(),
  githubUsername: z.string().optional(),
  githubEmail: z.string().email().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  jobTitle: z.string().optional(),
  rootDir: z.string().default('~/Development'),
  skipPrompts: z.boolean().default(false),
  verbose: z.boolean().default(false),
  only: z.string().optional(),
  exclude: z.string().optional(),
});

export type SetupOptions = z.infer<typeof SetupOptionsSchema>;

export interface Tool {
  name: string;
  displayName: string;
  description: string;
  required: boolean;
  script: string;
  dependencies?: string[];
  validate?: () => Promise<boolean>;
}

export interface ValidationResult {
  tool: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  canFix?: boolean;
}

export interface ConfigOptions {
  list?: boolean;
  get?: string;
  set?: string;
  reset?: boolean;
}

export interface SetupContext {
  email: string;
  githubUsername: string;
  githubEmail: string;
  fullName: string;
  company?: string | undefined;
  role: string;
  jobTitle: string;
  rootDir: string;
  os: 'macos' | 'linux' | 'windows';
  skipPrompts: boolean;
  verbose: boolean;
  selectedTools: string[];
}