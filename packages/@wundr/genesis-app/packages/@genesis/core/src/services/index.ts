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
