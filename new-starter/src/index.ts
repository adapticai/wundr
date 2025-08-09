export { SetupCommand } from './commands/setup';
export { ValidateCommand } from './commands/validate';
export { ConfigCommand } from './commands/config';
export type { SetupOptions, ValidationResult, ConfigOptions } from './types';
export { logger } from './utils/logger';
export { executeShellScript, checkCommand, getOS } from './utils/system';
export * from './constants';