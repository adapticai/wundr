/**
 * Core module - Consolidated orchestrator architecture
 *
 * Replaces the three overlapping orchestrators:
 * - RealSetupOrchestrator (installers/real-setup-orchestrator.ts)
 * - SetupOrchestrator (orchestrator/index.ts)
 * - ComputerSetupManager (manager/index.ts)
 *
 * with a single unified system consisting of:
 * - UnifiedOrchestrator: phased setup execution engine
 * - OperationRunner: safe command execution (no shell injection)
 * - PlatformDetector: cross-platform system detection
 * - ProfileManager: developer profile management and diffing
 */

export {
  UnifiedOrchestrator,
  type UnifiedOrchestratorConfig,
  type OrchestratorState,
  type ProgressCallback,
  type InstallerAdapter,
} from './unified-orchestrator';

export {
  OperationRunner,
  CommandError,
  type RunCommandOptions,
  type CommandResult,
} from './operation-runner';

export {
  PlatformDetector,
  type SystemRequirements,
  type SystemValidationResult,
} from './platform-detector';

export {
  ProfileManager,
  type ProfileDefinition,
  type ProfileToolEntry,
  type ProfileDiff,
} from './profile-manager';
