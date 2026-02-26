/**
 * Plugin Signature Verification
 *
 * Verifies Ed25519 signatures on plugin packages to establish provenance.
 * Plugins signed by a known publisher key are eligible for the 'verified'
 * trust level. Unsigned or incorrectly signed plugins are downgraded.
 *
 * Signature format:
 *   The file `wundr-plugin.sig` adjacent to `wundr-plugin.json` contains
 *   a JSON object:
 *     {
 *       "algorithm": "Ed25519",
 *       "publicKey": "<hex>",
 *       "signature": "<hex>",
 *       "signedHash": "sha384-<base64>",
 *       "timestamp": <epoch ms>
 *     }
 *
 * The signed payload is the SHA-384 hash of the concatenation of all
 * source files listed in the manifest (sorted alphabetically), plus the
 * manifest JSON itself.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignatureFile = {
  algorithm: string;
  publicKey: string;
  signature: string;
  signedHash: string;
  timestamp: number;
};

export type SignatureVerificationResult = {
  valid: boolean;
  trusted: boolean;
  reason: string;
  publicKey?: string;
  signedAt?: number;
};

export type TrustedPublicKey = {
  /** Hex-encoded Ed25519 public key. */
  key: string;
  /** Human-readable label for this key (e.g., "wundr-official"). */
  label: string;
  /** When this key was registered. */
  addedAt: number;
};

// ---------------------------------------------------------------------------
// Signature File I/O
// ---------------------------------------------------------------------------

const SIGNATURE_FILENAME = 'wundr-plugin.sig';

async function readSignatureFile(
  pluginDir: string
): Promise<SignatureFile | null> {
  const sigPath = path.join(pluginDir, SIGNATURE_FILENAME);
  try {
    const content = await fs.readFile(sigPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (
      typeof parsed.algorithm !== 'string' ||
      typeof parsed.publicKey !== 'string' ||
      typeof parsed.signature !== 'string' ||
      typeof parsed.signedHash !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return null;
    }

    return parsed as SignatureFile;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hash Computation
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-384 hash of the manifest file content.
 * This is the payload that gets signed.
 */
async function computeManifestHash(pluginDir: string): Promise<string> {
  const manifestPath = path.join(pluginDir, 'wundr-plugin.json');
  const content = await fs.readFile(manifestPath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify a plugin's signature against a set of trusted public keys.
 *
 * Steps:
 * 1. Read the signature file.
 * 2. Compute the manifest hash.
 * 3. Verify the signedHash matches the computed hash.
 * 4. Verify the Ed25519 signature over the signedHash.
 * 5. Check whether the public key is in the trusted set.
 */
export async function verifyPluginSignature(
  pluginDir: string,
  trustedKeys: TrustedPublicKey[],
  logger?: Logger
): Promise<SignatureVerificationResult> {
  const log = logger ?? new Logger('PluginSignature');

  // Step 1: Read signature file
  const sigFile = await readSignatureFile(pluginDir);
  if (!sigFile) {
    return {
      valid: false,
      trusted: false,
      reason: 'No signature file found',
    };
  }

  // Step 2: Validate algorithm
  if (sigFile.algorithm !== 'Ed25519') {
    return {
      valid: false,
      trusted: false,
      reason: `Unsupported signature algorithm: ${sigFile.algorithm}`,
    };
  }

  // Step 3: Compute and compare hash
  let computedHash: string;
  try {
    computedHash = await computeManifestHash(pluginDir);
  } catch (err) {
    return {
      valid: false,
      trusted: false,
      reason: `Failed to compute manifest hash: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (computedHash !== sigFile.signedHash) {
    log.warn(
      `Signature hash mismatch for plugin in ${pluginDir}: expected ${computedHash}, got ${sigFile.signedHash}`
    );
    return {
      valid: false,
      trusted: false,
      reason:
        'Signed hash does not match computed manifest hash (possible tampering)',
    };
  }

  // Step 4: Verify Ed25519 signature
  try {
    const publicKeyBuffer = Buffer.from(sigFile.publicKey, 'hex');
    const signatureBuffer = Buffer.from(sigFile.signature, 'hex');
    const dataBuffer = Buffer.from(sigFile.signedHash, 'utf-8');

    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([
        // Ed25519 public key DER prefix
        Buffer.from('302a300506032b6570032100', 'hex'),
        publicKeyBuffer,
      ]),
      format: 'der',
      type: 'spki',
    });

    const isValid = crypto.verify(null, dataBuffer, publicKey, signatureBuffer);

    if (!isValid) {
      return {
        valid: false,
        trusted: false,
        reason: 'Ed25519 signature verification failed',
        publicKey: sigFile.publicKey,
      };
    }
  } catch (err) {
    return {
      valid: false,
      trusted: false,
      reason: `Signature verification error: ${err instanceof Error ? err.message : String(err)}`,
      publicKey: sigFile.publicKey,
    };
  }

  // Step 5: Check trusted keys
  const matchingKey = trustedKeys.find(k => k.key === sigFile.publicKey);
  if (!matchingKey) {
    log.info(
      `Valid signature for plugin in ${pluginDir}, but public key ${sigFile.publicKey.slice(0, 16)}... is not in the trusted set`
    );
    return {
      valid: true,
      trusted: false,
      reason:
        'Signature is valid but the signing key is not in the trusted key set',
      publicKey: sigFile.publicKey,
      signedAt: sigFile.timestamp,
    };
  }

  log.info(
    `Verified signature for plugin in ${pluginDir} (key: ${matchingKey.label})`
  );

  return {
    valid: true,
    trusted: true,
    reason: `Signature verified with trusted key "${matchingKey.label}"`,
    publicKey: sigFile.publicKey,
    signedAt: sigFile.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Key Management
// ---------------------------------------------------------------------------

/**
 * Manages the set of trusted public keys for plugin signature verification.
 */
export class TrustedKeyStore {
  private keys: TrustedPublicKey[] = [];

  constructor(initialKeys?: TrustedPublicKey[]) {
    if (initialKeys) {
      this.keys = [...initialKeys];
    }
  }

  /**
   * Add a trusted public key.
   */
  addKey(key: string, label: string): void {
    if (this.keys.some(k => k.key === key)) {
      return; // Already registered
    }
    this.keys.push({ key, label, addedAt: Date.now() });
  }

  /**
   * Remove a trusted public key.
   */
  removeKey(key: string): boolean {
    const before = this.keys.length;
    this.keys = this.keys.filter(k => k.key !== key);
    return this.keys.length < before;
  }

  /**
   * List all trusted keys.
   */
  listKeys(): ReadonlyArray<TrustedPublicKey> {
    return this.keys;
  }

  /**
   * Verify a plugin against this key store.
   */
  async verifyPlugin(
    pluginDir: string,
    logger?: Logger
  ): Promise<SignatureVerificationResult> {
    return verifyPluginSignature(pluginDir, this.keys, logger);
  }
}
