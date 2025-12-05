/**
 * Workflow Trigger Authentication Utilities
 *
 * Handles API key generation, validation, and webhook signature verification.
 *
 * @module lib/workflow/trigger-auth
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Generate a secure API key for workflow triggers
 */
export function generateApiKey(): string {
  return `wf_${randomBytes(32).toString('hex')}`;
}

/**
 * Generate a secret for webhook signature verification
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify an API key against its hash
 */
export function verifyApiKey(apiKey: string, hash: string): boolean {
  try {
    const computedHash = hashApiKey(apiKey);
    const hashBuffer = Buffer.from(hash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (hashBuffer.length !== computedBuffer.length) {
      return false;
    }

    return timingSafeEqual(hashBuffer, computedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate webhook signature for payload
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
): string {
  return createHash('sha256')
    .update(`${secret}${payload}`)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expectedSignature = generateWebhookSignature(payload, secret);
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a unique webhook URL token
 */
export function generateWebhookToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(
  authHeader: string | null,
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return /^wf_[a-f0-9]{64}$/.test(apiKey);
}

/**
 * Validate webhook token format
 */
export function isValidWebhookTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
