/**
 * @genesis/core - Services
 *
 * Central export for all service layer implementations.
 *
 * @packageDocumentation
 */

// =============================================================================
// VP Service
// =============================================================================

export {
  // Service implementation
  VPServiceImpl,
  createVPService,
  vpService,

  // Interfaces
  type VPService,
  type ServiceAccountService,
} from './vp-service';

// =============================================================================
// Message Service
// =============================================================================

export {
  // Service implementation
  MessageServiceImpl,
  createMessageService,
  messageService,

  // Interfaces
  type MessageService,
  type ThreadService,
  type ReactionService,
  type MessageEvents,

  // Errors
  MessageNotFoundError,
  ChannelNotFoundError,
  MessageValidationError,
  ReactionError,
} from './message-service';
