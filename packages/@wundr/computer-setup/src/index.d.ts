/**
 * @wundr/computer-setup
 *
 * Engineering team computer provisioning tool
 * Sets up new developer machines with all required tools, configurations, and environments
 * Based on the new-starter repository functionality
 */
export * from './types';
export * from './profiles';
export * from './installers';
export { default as RealSetupOrchestrator } from './installers/real-setup-orchestrator';
export * from './configurators';
export * from './personalizers';
export * from './validators';
export * from './templates';
export { ComputerSetupManager } from './manager';
export { SetupOrchestrator } from './orchestrator';
//# sourceMappingURL=index.d.ts.map