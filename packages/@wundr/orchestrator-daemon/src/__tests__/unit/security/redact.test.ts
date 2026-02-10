/**
 * Tests for the credential redaction module (src/security/redact.ts).
 *
 * Covers:
 *  - Provider-specific token redaction (GitHub, AWS, GCP, Azure, Stripe, etc.)
 *  - Luhn validation for credit card numbers
 *  - Stream-safe buffered redaction (RedactingStream)
 *  - Custom pattern registration and removal
 *  - Redaction statistics tracking
 *  - Config object redaction and sentinel round-trip
 *  - Identifier hashing
 *  - Environment variable formatting
 *  - WebSocket payload redaction
 *  - Edge cases (empty strings, partial matches, overlapping patterns)
 *  - Redaction placeholder formatting
 *  - Multiple secrets in a single string
 *  - Base64-encoded secrets
 *  - PEM / PGP / SSH key block redaction
 *  - Database connection URL redaction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  redactSensitiveText,
  redactConfigObject,
  redactConfigSnapshot,
  restoreRedactedValues,
  redactIdentifier,
  redactWsPayload,
  formatEnvValue,
  isSensitiveKey,
  isSensitiveEnvKey,
  getRedactionStats,
  resetRedactionStats,
  registerRedactPatterns,
  clearCustomRedactPatterns,
  getCustomPatternCount,
  getDefaultRedactPatterns,
  RedactingStream,
  RedactingLogger,
  createRedactingLogger,
  LogLevel,
  REDACTED_SENTINEL,
} from '../../../security/redact';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a realistic-looking fake token of a given length.
 * Uses a deterministic character set so tests are reproducible.
 */
function fakeChars(prefix: string, length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = result.length; i < length; i++) {
    result += chars[i % chars.length];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Credential Redaction (security/redact)', () => {
  beforeEach(() => {
    resetRedactionStats();
    clearCustomRedactPatterns();
  });

  afterEach(() => {
    clearCustomRedactPatterns();
  });

  // =========================================================================
  // redactSensitiveText -- basic behavior
  // =========================================================================

  describe('redactSensitiveText', () => {
    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    describe('edge cases', () => {
      it('should return empty string unchanged', () => {
        expect(redactSensitiveText('')).toBe('');
      });

      it('should return null/undefined-ish falsy values unchanged', () => {
        // The function checks for !text, so empty string is the main falsy case
        expect(redactSensitiveText('')).toBe('');
      });

      it('should return plain text without secrets unchanged', () => {
        const text = 'Hello, this is a normal log message with no secrets.';
        expect(redactSensitiveText(text)).toBe(text);
      });

      it('should not redact when mode is off', () => {
        const text = 'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
        expect(redactSensitiveText(text, { mode: 'off' })).toBe(text);
      });

      it('should redact in tools mode (default)', () => {
        const text = 'key is ghp_ABCDEFGHIJKLMNOPQRSTx1234';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTx1234');
      });

      it('should redact in all mode', () => {
        const text = 'key is ghp_ABCDEFGHIJKLMNOPQRSTx1234';
        const result = redactSensitiveText(text, { mode: 'all' });
        expect(result).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTx1234');
      });

      it('should handle a string with only whitespace', () => {
        const text = '   \n\t  ';
        expect(redactSensitiveText(text)).toBe(text);
      });
    });

    // -----------------------------------------------------------------------
    // Token masking format
    // -----------------------------------------------------------------------

    describe('token masking format', () => {
      it('should fully mask tokens shorter than 18 characters', () => {
        // A short Slack token that matches the pattern (xoxb- + >=10 chars)
        // but the captured portion is under 18 chars total.
        // Use the env-assignment pattern which captures the value.
        const text = 'MY_TOKEN=shortvalue1234';
        const result = redactSensitiveText(text);
        expect(result).toContain('***');
      });

      it('should preserve start/end for tokens >= 18 characters', () => {
        // Token: ghp_ + 30 alphanumeric = 34 chars total
        const token = fakeChars('ghp_', 34);
        const text = `token: ${token}`;
        const result = redactSensitiveText(text);
        // Should show first 6 chars and last 4 chars with ... between
        const expectedStart = token.slice(0, 6);
        const expectedEnd = token.slice(-4);
        expect(result).toContain(expectedStart);
        expect(result).toContain(expectedEnd);
        expect(result).toContain('...');
        expect(result).not.toContain(token);
      });
    });

    // -----------------------------------------------------------------------
    // Multiple secrets in one string
    // -----------------------------------------------------------------------

    describe('multiple secrets in a single string', () => {
      it('should redact multiple different provider tokens', () => {
        const ghToken = fakeChars('ghp_', 40);
        const slackToken = fakeChars('xoxb-', 40);
        const text = `GitHub: ${ghToken} and Slack: ${slackToken}`;

        const result = redactSensitiveText(text);

        expect(result).not.toContain(ghToken);
        expect(result).not.toContain(slackToken);
      });

      it('should redact multiple instances of the same pattern', () => {
        const token1 = fakeChars('ghp_', 30);
        // Make them actually distinct
        const t2 = 'ghp_' + 'Z'.repeat(26);
        const text = `first: ${token1}, second: ${t2}`;

        const result = redactSensitiveText(text);

        expect(result).not.toContain(token1);
        expect(result).not.toContain(t2);
      });
    });
  });

  // =========================================================================
  // Provider-specific pattern tests
  // =========================================================================

  describe('provider-specific patterns', () => {
    // -----------------------------------------------------------------------
    // GitHub
    // -----------------------------------------------------------------------

    describe('GitHub tokens', () => {
      it('should redact personal access tokens (ghp_)', () => {
        const token = fakeChars('ghp_', 40);
        const result = redactSensitiveText(`Authenticated with ${token}`);
        expect(result).not.toContain(token);
      });

      it('should redact fine-grained personal access tokens (github_pat_)', () => {
        const token = fakeChars('github_pat_', 60);
        const result = redactSensitiveText(`PAT: ${token}`);
        expect(result).not.toContain(token);
      });

      it('should redact OAuth access tokens (gho_)', () => {
        const token = fakeChars('gho_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact user-to-server tokens (ghu_)', () => {
        const token = fakeChars('ghu_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact server-to-server tokens (ghs_)', () => {
        const token = fakeChars('ghs_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact refresh tokens (ghr_)', () => {
        const token = fakeChars('ghr_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });
    });

    // -----------------------------------------------------------------------
    // AWS
    // -----------------------------------------------------------------------

    describe('AWS credentials', () => {
      it('should redact AWS access key IDs (AKIA...)', () => {
        const keyId = 'AKIAIOSFODNN7EXAMPLE';
        const result = redactSensitiveText(`AWS_ACCESS_KEY_ID=${keyId}`);
        expect(result).not.toContain(keyId);
      });

      it('should redact AWS secret access keys', () => {
        const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
        const text = `aws_secret_access_key = ${secret}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(secret);
      });

      it('should redact AWS session tokens', () => {
        const sessionToken = fakeChars('', 120);
        const text = `AWS_SESSION_TOKEN = ${sessionToken}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(sessionToken);
      });
    });

    // -----------------------------------------------------------------------
    // GCP / Google
    // -----------------------------------------------------------------------

    describe('GCP credentials', () => {
      it('should redact GCP API keys (AIza...)', () => {
        const key = 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe';
        const result = redactSensitiveText(`Google API key: ${key}`);
        expect(result).not.toContain(key);
      });

      it('should redact GCP service account private_key_id fields', () => {
        const keyId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
        const text = `"private_key_id": "${keyId}"`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(keyId);
      });

      it('should redact GCP service account private_key JSON fields', () => {
        const text = '"private_key": "-----BEGIN RSA PRIVATE KEY-----\\nMIIE...base64data...\\n-----END RSA PRIVATE KEY-----"';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('MIIE...base64data...');
      });
    });

    // -----------------------------------------------------------------------
    // Azure
    // -----------------------------------------------------------------------

    describe('Azure credentials', () => {
      it('should redact Azure connection string AccountKey', () => {
        const key = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
        const text = `AccountKey=${key}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(key);
      });

      it('should redact Azure SharedAccessKey values', () => {
        const key = fakeChars('', 44) + '==';
        const text = `SharedAccessKey=${key}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(key);
      });
    });

    // -----------------------------------------------------------------------
    // Stripe
    // -----------------------------------------------------------------------

    describe('Stripe keys', () => {
      it('should redact live secret keys (sk_live_)', () => {
        const key = fakeChars('sk_live_', 40);
        const result = redactSensitiveText(`Stripe key: ${key}`);
        expect(result).not.toContain(key);
      });

      it('should redact test secret keys (sk_test_)', () => {
        const key = fakeChars('sk_test_', 40);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact publishable keys (pk_live_, pk_test_)', () => {
        const liveKey = fakeChars('pk_live_', 40);
        const testKey = fakeChars('pk_test_', 40);
        const text = `Live: ${liveKey}, Test: ${testKey}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(liveKey);
        expect(result).not.toContain(testKey);
      });

      it('should redact restricted keys (rk_live_, rk_test_)', () => {
        const key = fakeChars('rk_live_', 40);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact webhook signing secrets (whsec_)', () => {
        const secret = fakeChars('whsec_', 40);
        const result = redactSensitiveText(`Webhook: ${secret}`);
        expect(result).not.toContain(secret);
      });
    });

    // -----------------------------------------------------------------------
    // OpenAI
    // -----------------------------------------------------------------------

    describe('OpenAI keys', () => {
      it('should redact sk- prefixed keys', () => {
        const key = fakeChars('sk-', 50);
        const result = redactSensitiveText(`key=${key}`);
        expect(result).not.toContain(key);
      });

      it('should redact sk-proj- prefixed keys', () => {
        const key = fakeChars('sk-proj-', 60);
        const result = redactSensitiveText(`OPENAI_API_KEY=${key}`);
        expect(result).not.toContain(key);
      });
    });

    // -----------------------------------------------------------------------
    // Anthropic
    // -----------------------------------------------------------------------

    describe('Anthropic keys', () => {
      it('should redact sk-ant- prefixed keys', () => {
        const key = fakeChars('sk-ant-api03-', 60);
        const result = redactSensitiveText(`Anthropic key: ${key}`);
        expect(result).not.toContain(key);
      });
    });

    // -----------------------------------------------------------------------
    // Slack
    // -----------------------------------------------------------------------

    describe('Slack tokens', () => {
      it('should redact bot tokens (xoxb-)', () => {
        const token = fakeChars('xoxb-', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact user tokens (xoxp-)', () => {
        const token = fakeChars('xoxp-', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact app-level tokens (xapp-)', () => {
        const token = fakeChars('xapp-', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });
    });

    // -----------------------------------------------------------------------
    // Other providers
    // -----------------------------------------------------------------------

    describe('other provider tokens', () => {
      it('should redact Groq API keys (gsk_)', () => {
        const key = fakeChars('gsk_', 40);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact Perplexity API keys (pplx-)', () => {
        const key = fakeChars('pplx-', 40);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact npm tokens (npm_)', () => {
        const token = fakeChars('npm_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Telegram bot tokens', () => {
        const token = '123456789:ABCdefGhIJKlmNoPQRsTUVwxYZ_12345678';
        const result = redactSensitiveText(`Bot token: ${token}`);
        expect(result).not.toContain(token);
      });

      it('should redact Twilio Account SIDs', () => {
        const sid = 'AC' + 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
        const result = redactSensitiveText(sid);
        expect(result).not.toContain(sid);
      });

      it('should redact SendGrid API keys', () => {
        // SendGrid pattern: SG.{22 chars}.{43 chars}
        const key = 'SG.' + 'x'.repeat(22) + '.' + 'y'.repeat(43);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact Mailgun API keys', () => {
        const key = 'key-' + 'a'.repeat(32);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact GitLab personal access tokens (glpat-)', () => {
        const token = fakeChars('glpat-', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Bitbucket app passwords (ATBB)', () => {
        const token = fakeChars('ATBB', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Hashicorp Vault tokens (hvs.)', () => {
        const token = fakeChars('hvs.', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Doppler tokens (dp.st.)', () => {
        const token = fakeChars('dp.st.', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Vercel tokens', () => {
        const token = fakeChars('vercel_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Linear API keys', () => {
        const key = fakeChars('lin_api_', 40);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact Supabase service role keys (sbp_)', () => {
        const key = fakeChars('sbp_', 40);
        const result = redactSensitiveText(key);
        expect(result).not.toContain(key);
      });

      it('should redact Shopify access tokens (shpat_)', () => {
        const token = 'shpat_' + 'aabbccdd'.repeat(4);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact Fastly API tokens', () => {
        const token = fakeChars('fastly_', 40);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });

      it('should redact DigitalOcean personal access tokens (dop_v1_)', () => {
        const token = 'dop_v1_' + 'a1b2c3d4'.repeat(8);
        const result = redactSensitiveText(token);
        expect(result).not.toContain(token);
      });
    });
  });

  // =========================================================================
  // Structural patterns
  // =========================================================================

  describe('structural patterns', () => {
    // -----------------------------------------------------------------------
    // ENV-style assignments
    // -----------------------------------------------------------------------

    describe('ENV-style assignments', () => {
      it('should redact KEY=value assignments', () => {
        const text = 'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
      });

      it('should redact TOKEN=value assignments', () => {
        const text = 'GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc123';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZabc123');
      });

      it('should redact SECRET=value assignments', () => {
        const text = 'CLIENT_SECRET = some-secret-value-here-1234';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('some-secret-value-here-1234');
      });

      it('should redact quoted assignments', () => {
        const text = 'MY_PASSWORD="super-secret-password-12345678"';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('super-secret-password-12345678');
      });
    });

    // -----------------------------------------------------------------------
    // JSON fields
    // -----------------------------------------------------------------------

    describe('JSON-style fields', () => {
      it('should redact "apiKey" JSON fields', () => {
        const text = '{"apiKey":"sk-proj-fake-key-abcdefghijklmno123"}';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('sk-proj-fake-key-abcdefghijklmno123');
      });

      it('should redact "password" JSON fields', () => {
        const text = '{"password":"my-super-secret-pass-12345"}';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('my-super-secret-pass-12345');
      });

      it('should redact "accessToken" JSON fields', () => {
        const text = '{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"}';
        const result = redactSensitiveText(text);
        // The JWT should be redacted
        expect(result).not.toContain('dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U');
      });
    });

    // -----------------------------------------------------------------------
    // Authorization headers
    // -----------------------------------------------------------------------

    describe('authorization headers', () => {
      it('should redact Bearer tokens in Authorization headers', () => {
        const token = fakeChars('', 40);
        const text = `Authorization: Bearer ${token}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(token);
      });

      it('should redact Basic auth credentials', () => {
        const encoded = Buffer.from('admin:secretpassword1234').toString('base64');
        const text = `Authorization: Basic ${encoded}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(encoded);
      });
    });

    // -----------------------------------------------------------------------
    // CLI flags
    // -----------------------------------------------------------------------

    describe('CLI flags', () => {
      it('should redact --api-key flag values', () => {
        const text = '--api-key sk-proj-abcdefghijklmnopqrstuvw';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('sk-proj-abcdefghijklmnopqrstuvw');
      });

      it('should redact --token flag values', () => {
        const token = fakeChars('tok_', 30);
        const text = `--token ${token}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(token);
      });

      it('should redact --password flag values', () => {
        const text = '--password "my-secret-password-goes-here"';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('my-secret-password-goes-here');
      });
    });

    // -----------------------------------------------------------------------
    // OAuth tokens in URLs
    // -----------------------------------------------------------------------

    describe('OAuth tokens in URL parameters', () => {
      it('should redact access_token URL parameter', () => {
        const token = fakeChars('', 30);
        const text = `https://api.example.com/data?access_token=${token}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(token);
      });

      it('should redact refresh_token URL parameter', () => {
        const token = fakeChars('', 30);
        const text = `https://api.example.com/auth?refresh_token=${token}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(token);
      });

      it('should redact client_secret URL parameter', () => {
        const secret = fakeChars('', 30);
        const text = `?client_id=myapp&client_secret=${secret}`;
        const result = redactSensitiveText(text);
        expect(result).not.toContain(secret);
      });
    });

    // -----------------------------------------------------------------------
    // PEM / PGP / SSH key blocks
    // -----------------------------------------------------------------------

    describe('key block redaction', () => {
      it('should redact PEM private keys while preserving markers', () => {
        const pem = [
          '-----BEGIN RSA PRIVATE KEY-----',
          'MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF...',
          'xyzbase64dataxyzbase64dataxyzbase64data...',
          '-----END RSA PRIVATE KEY-----',
        ].join('\n');

        const result = redactSensitiveText(pem);

        expect(result).toContain('-----BEGIN RSA PRIVATE KEY-----');
        expect(result).toContain('-----END RSA PRIVATE KEY-----');
        expect(result).toContain('...redacted...');
        expect(result).not.toContain('MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn');
      });

      it('should redact EC private keys', () => {
        const pem = [
          '-----BEGIN EC PRIVATE KEY-----',
          'MHQCAQEEIBkg4LVWM9nuwNSk3yByxZpYRTBnzl...',
          '-----END EC PRIVATE KEY-----',
        ].join('\n');

        const result = redactSensitiveText(pem);

        expect(result).toContain('-----BEGIN EC PRIVATE KEY-----');
        expect(result).toContain('...redacted...');
        expect(result).not.toContain('MHQCAQEEIBkg4LVWM9nuwNSk3yByxZpYRTBnzl');
      });

      it('should redact PGP private key blocks', () => {
        const pgp = [
          '-----BEGIN PGP PRIVATE KEY BLOCK-----',
          'lQOYBF0...',
          'fake-pgp-data-here',
          '-----END PGP PRIVATE KEY BLOCK-----',
        ].join('\n');

        const result = redactSensitiveText(pgp);

        expect(result).toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
        expect(result).toContain('...redacted...');
        expect(result).not.toContain('fake-pgp-data-here');
      });

      it('should redact OpenSSH private keys', () => {
        const ssh = [
          '-----BEGIN OPENSSH PRIVATE KEY-----',
          'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...',
          'morebase64data...',
          '-----END OPENSSH PRIVATE KEY-----',
        ].join('\n');

        const result = redactSensitiveText(ssh);

        expect(result).toContain('-----BEGIN OPENSSH PRIVATE KEY-----');
        expect(result).toContain('...redacted...');
        expect(result).not.toContain('b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA');
      });
    });

    // -----------------------------------------------------------------------
    // Database connection URLs
    // -----------------------------------------------------------------------

    describe('database connection URLs', () => {
      it('should redact PostgreSQL connection passwords', () => {
        const text = 'postgres://admin:s3cretP4ss@db.example.com:5432/mydb';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('s3cretP4ss');
        expect(result).toContain('postgres://');
        expect(result).toContain('admin');
        expect(result).toContain('***');
      });

      it('should redact MySQL connection passwords', () => {
        const text = 'mysql://root:myp4ssword@localhost:3306/testdb';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('myp4ssword');
        expect(result).toContain('root');
        expect(result).toContain('***');
      });

      it('should redact MongoDB connection passwords', () => {
        const text = 'mongodb+srv://appuser:M0ngoSecr3t@cluster0.example.net/production';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('M0ngoSecr3t');
        expect(result).toContain('appuser');
      });

      it('should redact Redis connection passwords', () => {
        const text = 'redis://:mysuperpassword@redis.example.com:6379';
        const result = redactSensitiveText(text);
        expect(result).not.toContain('mysuperpassword');
        expect(result).toContain('***');
      });
    });

    // -----------------------------------------------------------------------
    // JWT tokens
    // -----------------------------------------------------------------------

    describe('JWT token redaction', () => {
      it('should redact JWT tokens (three dot-separated base64url segments)', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const result = redactSensitiveText(`Bearer ${jwt}`);
        expect(result).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
      });
    });
  });

  // =========================================================================
  // Luhn validation for credit card numbers
  // =========================================================================

  describe('credit card number redaction (Luhn validation)', () => {
    it('should redact a valid Visa card number', () => {
      // 4539 1488 0343 6467 passes Luhn check
      const cc = '4539148803436467';
      const result = redactSensitiveText(`Card: ${cc}`);
      expect(result).toContain('****-****-****-');
      expect(result).not.toContain('4539148803436467');
    });

    it('should redact a valid Visa card with separators', () => {
      const cc = '4539-1488-0343-6467';
      const result = redactSensitiveText(`Card: ${cc}`);
      expect(result).not.toContain('4539-1488-0343-6467');
    });

    it('should redact a valid Mastercard number', () => {
      // 5425 2334 3010 9903 passes Luhn
      const cc = '5425233430109903';
      const result = redactSensitiveText(`Card: ${cc}`);
      expect(result).toContain('****-****-****-');
      expect(result).not.toContain('5425233430109903');
    });

    it('should NOT redact an invalid credit card number (fails Luhn)', () => {
      // 4539 1488 0343 6466 -- last digit changed to fail Luhn
      const cc = '4539148803436466';
      const result = redactSensitiveText(`Number: ${cc}`);
      // Should remain unchanged since it fails Luhn
      expect(result).toContain('4539148803436466');
    });

    it('should show only the last 4 digits of a redacted card', () => {
      const cc = '4539148803436467';
      const result = redactSensitiveText(cc);
      expect(result).toContain('6467');
      expect(result).toMatch(/\*{4}-\*{4}-\*{4}-6467/);
    });
  });

  // =========================================================================
  // Base64-encoded secrets
  // =========================================================================

  describe('base64-encoded secrets', () => {
    it('should redact Basic Auth base64-encoded credentials', () => {
      const creds = Buffer.from('user:password123secret').toString('base64');
      const text = `Authorization: Basic ${creds}`;
      const result = redactSensitiveText(text);
      expect(result).not.toContain(creds);
    });

    it('should redact base64 connection strings (Azure SharedAccessKey)', () => {
      const key = Buffer.from('some-shared-access-key-value-1234567890').toString('base64');
      const text = `SharedAccessKey=${key}`;
      const result = redactSensitiveText(text);
      expect(result).not.toContain(key);
    });
  });

  // =========================================================================
  // Custom pattern registration
  // =========================================================================

  describe('custom pattern registration', () => {
    afterEach(() => {
      clearCustomRedactPatterns();
    });

    it('should register and apply a custom string pattern', () => {
      registerRedactPatterns([
        { name: 'internal-key', pattern: String.raw`\b(intkey_[A-Za-z0-9]{20,})\b` },
      ]);

      const token = fakeChars('intkey_', 40);
      const result = redactSensitiveText(token);
      expect(result).not.toContain(token);
    });

    it('should register and apply a custom RegExp pattern', () => {
      registerRedactPatterns([
        { name: 'custom-id', pattern: /\b(CUST_[A-Z0-9]{10,})\b/ },
      ]);

      const id = 'CUST_' + 'ABCDEF1234567890';
      const result = redactSensitiveText(id);
      expect(result).not.toContain(id);
    });

    it('should report the correct custom pattern count', () => {
      expect(getCustomPatternCount()).toBe(0);

      registerRedactPatterns([
        { name: 'p1', pattern: 'test1' },
        { name: 'p2', pattern: 'test2' },
      ]);

      expect(getCustomPatternCount()).toBe(2);
    });

    it('should clear all custom patterns', () => {
      registerRedactPatterns([
        { name: 'temp', pattern: String.raw`\b(TEMP_[A-Z0-9]{20})\b` },
      ]);
      expect(getCustomPatternCount()).toBe(1);

      clearCustomRedactPatterns();
      expect(getCustomPatternCount()).toBe(0);
    });

    it('should not affect default patterns when clearing custom patterns', () => {
      registerRedactPatterns([
        { name: 'extra', pattern: 'extra_pattern' },
      ]);
      clearCustomRedactPatterns();

      // Default GitHub pattern should still work
      const ghToken = fakeChars('ghp_', 40);
      const result = redactSensitiveText(ghToken);
      expect(result).not.toContain(ghToken);
    });

    it('should use category from CustomRedactPattern if provided', () => {
      registerRedactPatterns([
        {
          name: 'my-pattern',
          pattern: String.raw`\b(CATTEST_[A-Z0-9]{20,})\b`,
          category: 'custom-category',
        },
      ]);

      const token = 'CATTEST_' + 'A'.repeat(20);
      redactSensitiveText(token, { trackStats: true });

      const stats = getRedactionStats();
      expect(stats.categories['custom-category']).toBeGreaterThan(0);
    });

    it('should fall back to name as category when category is omitted', () => {
      registerRedactPatterns([
        {
          name: 'fallback-name',
          pattern: String.raw`\b(FBTEST_[A-Z0-9]{20,})\b`,
        },
      ]);

      const token = 'FBTEST_' + 'B'.repeat(20);
      redactSensitiveText(token, { trackStats: true });

      const stats = getRedactionStats();
      expect(stats.categories['fallback-name']).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Statistics tracking
  // =========================================================================

  describe('redaction statistics', () => {
    beforeEach(() => {
      resetRedactionStats();
    });

    it('should not track stats by default', () => {
      const ghToken = fakeChars('ghp_', 40);
      redactSensitiveText(ghToken);

      const stats = getRedactionStats();
      expect(stats.totalRedactions).toBe(0);
    });

    it('should track stats when trackStats option is true', () => {
      const ghToken = fakeChars('ghp_', 40);
      redactSensitiveText(ghToken, { trackStats: true });

      const stats = getRedactionStats();
      expect(stats.totalRedactions).toBeGreaterThan(0);
    });

    it('should break down stats by category', () => {
      const ghToken = fakeChars('ghp_', 40);
      const slackToken = fakeChars('xoxb-', 40);

      redactSensitiveText(`${ghToken} ${slackToken}`, { trackStats: true });

      const stats = getRedactionStats();
      expect(stats.categories['github']).toBeGreaterThan(0);
      expect(stats.categories['slack']).toBeGreaterThan(0);
    });

    it('should accumulate stats across multiple calls', () => {
      const token1 = fakeChars('ghp_', 40);
      // Use a different token that still matches
      const token2Real = 'ghp_' + 'Z'.repeat(36);

      redactSensitiveText(token1, { trackStats: true });
      redactSensitiveText(token2Real, { trackStats: true });

      const stats = getRedactionStats();
      expect(stats.categories['github']).toBeGreaterThanOrEqual(2);
    });

    it('should reset stats correctly', () => {
      const ghToken = fakeChars('ghp_', 40);
      redactSensitiveText(ghToken, { trackStats: true });

      resetRedactionStats();

      const stats = getRedactionStats();
      expect(stats.totalRedactions).toBe(0);
      expect(Object.keys(stats.categories)).toHaveLength(0);
    });

    it('should include a lastResetAt timestamp', () => {
      const before = new Date();
      resetRedactionStats();
      const stats = getRedactionStats();
      const after = new Date();

      expect(stats.lastResetAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stats.lastResetAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return a snapshot (not a mutable reference)', () => {
      const ghToken = fakeChars('ghp_', 40);
      redactSensitiveText(ghToken, { trackStats: true });

      const snapshot1 = getRedactionStats();
      const snapshot2 = getRedactionStats();

      // Mutating snapshot1 should not affect snapshot2
      snapshot1.totalRedactions = 999;
      expect(snapshot2.totalRedactions).not.toBe(999);
    });
  });

  // =========================================================================
  // getDefaultRedactPatterns
  // =========================================================================

  describe('getDefaultRedactPatterns', () => {
    it('should return an array of pattern strings', () => {
      const patterns = getDefaultRedactPatterns();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      for (const p of patterns) {
        expect(typeof p).toBe('string');
      }
    });

    it('should return a copy (not the internal array)', () => {
      const patterns1 = getDefaultRedactPatterns();
      const patterns2 = getDefaultRedactPatterns();
      patterns1.push('extra');
      expect(patterns2).not.toContain('extra');
    });
  });

  // =========================================================================
  // Custom pattern list via options
  // =========================================================================

  describe('custom patterns via options', () => {
    it('should use explicitly provided pattern strings instead of defaults', () => {
      const customPattern = String.raw`\b(MYTOKEN_[A-Z0-9]{10,})\b`;
      const token = 'MYTOKEN_ABCDEFGHIJ1234';

      const result = redactSensitiveText(token, { patterns: [customPattern] });
      expect(result).not.toContain(token);
    });

    it('should not apply default patterns when custom patterns are provided', () => {
      const ghToken = fakeChars('ghp_', 40);
      // Custom pattern that only matches MYPREFIX_ tokens
      const customPattern = String.raw`\b(MYPREFIX_[A-Z]{10,})\b`;

      const result = redactSensitiveText(ghToken, { patterns: [customPattern] });
      // GitHub token should NOT be redacted since we overrode patterns
      expect(result).toContain(ghToken);
    });

    it('should ignore empty/invalid custom patterns gracefully', () => {
      const text = 'Normal text without secrets';
      const result = redactSensitiveText(text, { patterns: ['', '   ', '[invalid('] });
      expect(result).toBe(text);
    });
  });

  // =========================================================================
  // isSensitiveKey
  // =========================================================================

  describe('isSensitiveKey', () => {
    it.each([
      'token',
      'apiToken',
      'api_token',
      'password',
      'PASSWORD',
      'passwd',
      'secret',
      'clientSecret',
      'apiKey',
      'api_key',
      'API_KEY',
      'credential',
      'privateKey',
      'private_key',
      'authKey',
      'signingKey',
      'encryptionKey',
      'accessKey',
      'connectionString',
    ])('should detect "%s" as sensitive', (key) => {
      expect(isSensitiveKey(key)).toBe(true);
    });

    it.each([
      'name',
      'email',
      'model',
      'host',
      'port',
      'region',
      'timeout',
      'maxRetries',
    ])('should not detect "%s" as sensitive', (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    });
  });

  // =========================================================================
  // isSensitiveEnvKey
  // =========================================================================

  describe('isSensitiveEnvKey', () => {
    it.each([
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GITHUB_TOKEN',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'STRIPE_SECRET_KEY',
      'DATABASE_URL',
      'REDIS_URL',
      'REDIS_PASSWORD',
      'SLACK_TOKEN',
      'AZURE_CLIENT_SECRET',
      'VAULT_TOKEN',
      'DOPPLER_TOKEN',
      'NPM_TOKEN',
    ])('should detect "%s" as sensitive', (key) => {
      expect(isSensitiveEnvKey(key)).toBe(true);
    });

    it('should fall back to generic key heuristic for unknown env names', () => {
      // "MY_SECRET" matches the /secret/i pattern
      expect(isSensitiveEnvKey('MY_SECRET')).toBe(true);
      expect(isSensitiveEnvKey('CUSTOM_API_KEY')).toBe(true);
    });

    it.each([
      'HOME',
      'PATH',
      'NODE_ENV',
      'PORT',
      'LOG_LEVEL',
    ])('should not detect "%s" as sensitive', (key) => {
      expect(isSensitiveEnvKey(key)).toBe(false);
    });
  });

  // =========================================================================
  // Config object redaction
  // =========================================================================

  describe('redactConfigObject', () => {
    it('should replace sensitive string values with the sentinel', () => {
      const config = {
        openai: {
          apiKey: 'sk-real-key-abcdef',
          model: 'gpt-4o',
        },
      };

      const result = redactConfigObject(config);

      expect(result.openai.apiKey).toBe(REDACTED_SENTINEL);
      expect(result.openai.model).toBe('gpt-4o');
    });

    it('should handle nested objects', () => {
      const config = {
        providers: {
          github: {
            token: 'ghp_abc123def456ghi789jklmnopqrstuvwxyz',
          },
          aws: {
            accessKey: 'AKIAIOSFODNN7EXAMPLE',
            region: 'us-east-1',
          },
        },
      };

      const result = redactConfigObject(config);

      expect(result.providers.github.token).toBe(REDACTED_SENTINEL);
      expect(result.providers.aws.accessKey).toBe(REDACTED_SENTINEL);
      expect(result.providers.aws.region).toBe('us-east-1');
    });

    it('should handle arrays', () => {
      const config = {
        services: [
          { name: 'svc1', password: 'secret1' },
          { name: 'svc2', password: 'secret2' },
        ],
      };

      const result = redactConfigObject(config);

      expect(result.services[0].password).toBe(REDACTED_SENTINEL);
      expect(result.services[1].password).toBe(REDACTED_SENTINEL);
      expect(result.services[0].name).toBe('svc1');
    });

    it('should preserve null and undefined values on sensitive keys', () => {
      const config = {
        apiKey: null as string | null,
        secret: undefined as string | undefined,
      };

      const result = redactConfigObject(config);

      expect(result.apiKey).toBeNull();
      expect(result.secret).toBeUndefined();
    });

    it('should handle null and undefined input gracefully', () => {
      expect(redactConfigObject(null)).toBeNull();
      expect(redactConfigObject(undefined)).toBeUndefined();
    });

    it('should return a new object (not mutate the original)', () => {
      const config = { apiKey: 'original-key', name: 'test' };
      const result = redactConfigObject(config);

      expect(result).not.toBe(config);
      expect(config.apiKey).toBe('original-key');
      expect(result.apiKey).toBe(REDACTED_SENTINEL);
    });
  });

  // =========================================================================
  // Config snapshot redaction
  // =========================================================================

  describe('redactConfigSnapshot', () => {
    it('should redact both config object and raw text', () => {
      const config = { apiKey: 'sk-real-key-12345' };
      const raw = '{ "apiKey": "sk-real-key-12345" }';

      const result = redactConfigSnapshot(config, raw);

      expect(result.config.apiKey).toBe(REDACTED_SENTINEL);
      expect(result.raw).not.toContain('sk-real-key-12345');
    });

    it('should return null raw when raw is null', () => {
      const config = { apiKey: 'sk-test' };

      const result = redactConfigSnapshot(config, null);

      expect(result.config.apiKey).toBe(REDACTED_SENTINEL);
      expect(result.raw).toBeNull();
    });

    it('should return null raw when raw is undefined', () => {
      const config = { model: 'gpt-4o' };

      const result = redactConfigSnapshot(config);

      expect(result.config.model).toBe('gpt-4o');
      expect(result.raw).toBeNull();
    });

    it('should redact longest values first to prevent partial leaks', () => {
      const config = {
        password: 'short',
        apiKey: 'longer-api-key-value-here',
      };
      const raw = 'apiKey: "longer-api-key-value-here", password: "short"';

      const result = redactConfigSnapshot(config, raw);

      expect(result.raw).not.toContain('longer-api-key-value-here');
      expect(result.raw).not.toContain('"short"');
    });
  });

  // =========================================================================
  // Sentinel restoration (round-trip)
  // =========================================================================

  describe('restoreRedactedValues', () => {
    it('should restore sentinel values from original config', () => {
      const incoming = {
        openai: { apiKey: REDACTED_SENTINEL, model: 'gpt-4o' },
      };
      const original = {
        openai: { apiKey: 'sk-real-key-abcdef', model: 'gpt-4' },
      };

      const result = restoreRedactedValues(incoming, original) as typeof incoming;

      expect(result.openai.apiKey).toBe('sk-real-key-abcdef');
      expect(result.openai.model).toBe('gpt-4o');
    });

    it('should throw when sentinel found on key missing from original', () => {
      const incoming = { newField: { secret: REDACTED_SENTINEL } };
      const original = { newField: {} };

      expect(() => restoreRedactedValues(incoming, original)).toThrow(
        /config write rejected/,
      );
    });

    it('should preserve non-sensitive sentinel values unchanged', () => {
      const incoming = { name: REDACTED_SENTINEL };
      const original = { name: 'test' };

      const result = restoreRedactedValues(incoming, original) as typeof incoming;
      // 'name' is not a sensitive key, so sentinel stays as literal value
      expect(result.name).toBe(REDACTED_SENTINEL);
    });

    it('should handle arrays correctly', () => {
      const incoming = [
        { password: REDACTED_SENTINEL },
        { password: REDACTED_SENTINEL },
      ];
      const original = [
        { password: 'pass1' },
        { password: 'pass2' },
      ];

      const result = restoreRedactedValues(incoming, original) as typeof incoming;

      expect(result[0].password).toBe('pass1');
      expect(result[1].password).toBe('pass2');
    });

    it('should handle null incoming gracefully', () => {
      expect(restoreRedactedValues(null, {})).toBeNull();
    });

    it('should handle undefined incoming gracefully', () => {
      expect(restoreRedactedValues(undefined, {})).toBeUndefined();
    });

    it('should handle missing original gracefully (non-sentinel values)', () => {
      const incoming = { name: 'test', count: 5 };
      const result = restoreRedactedValues(incoming, undefined) as typeof incoming;
      expect(result.name).toBe('test');
      expect(result.count).toBe(5);
    });
  });

  // =========================================================================
  // Identifier hashing
  // =========================================================================

  describe('redactIdentifier', () => {
    it('should produce a sha256: prefixed hash', () => {
      const result = redactIdentifier('session-12345');
      expect(result).toMatch(/^sha256:[a-f0-9]+$/);
    });

    it('should default to 12-character hash prefix', () => {
      const result = redactIdentifier('test-id');
      // "sha256:" prefix + 12 hex chars
      expect(result).toBe(`sha256:${result.slice(7)}`);
      expect(result.slice(7)).toHaveLength(12);
    });

    it('should support custom hash length', () => {
      const result = redactIdentifier('test-id', { len: 8 });
      expect(result.slice(7)).toHaveLength(8);
    });

    it('should produce deterministic output', () => {
      const a = redactIdentifier('same-input');
      const b = redactIdentifier('same-input');
      expect(a).toBe(b);
    });

    it('should produce different output for different inputs', () => {
      const a = redactIdentifier('input-a');
      const b = redactIdentifier('input-b');
      expect(a).not.toBe(b);
    });

    it('should return "-" for empty input', () => {
      expect(redactIdentifier('')).toBe('-');
    });

    it('should return "-" for undefined input', () => {
      expect(redactIdentifier(undefined)).toBe('-');
    });

    it('should return "-" for whitespace-only input', () => {
      expect(redactIdentifier('   ')).toBe('-');
    });

    it('should trim input before hashing', () => {
      const trimmed = redactIdentifier('value');
      const padded = redactIdentifier('  value  ');
      expect(trimmed).toBe(padded);
    });

    it('should clamp len to at least 1', () => {
      const result = redactIdentifier('test', { len: 0 });
      expect(result.slice(7).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle non-finite len gracefully', () => {
      const result = redactIdentifier('test', { len: NaN });
      // Falls back to 12
      expect(result.slice(7)).toHaveLength(12);
    });
  });

  // =========================================================================
  // Environment variable formatting
  // =========================================================================

  describe('formatEnvValue', () => {
    it('should redact values for known sensitive env keys', () => {
      expect(formatEnvValue('sk-real-key-abc', 'OPENAI_API_KEY')).toBe('<redacted>');
      expect(formatEnvValue('ghp_abc123', 'GITHUB_TOKEN')).toBe('<redacted>');
    });

    it('should redact values matching generic sensitive patterns', () => {
      expect(formatEnvValue('some-secret', 'MY_SECRET')).toBe('<redacted>');
    });

    it('should return the value unchanged for non-sensitive keys', () => {
      expect(formatEnvValue('production', 'NODE_ENV')).toBe('production');
    });

    it('should truncate long values to 160 characters', () => {
      const longValue = 'a'.repeat(200);
      const result = formatEnvValue(longValue);
      expect(result).toHaveLength(163); // 160 + "..."
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should not truncate values of exactly 160 characters', () => {
      const value = 'b'.repeat(160);
      expect(formatEnvValue(value)).toBe(value);
    });

    it('should collapse multiline values to single line', () => {
      const value = 'line1\nline2\n  line3';
      const result = formatEnvValue(value);
      expect(result).toBe('line1 line2 line3');
    });

    it('should handle formatting when no key is provided', () => {
      const value = 'just-a-value';
      expect(formatEnvValue(value)).toBe(value);
    });
  });

  // =========================================================================
  // WebSocket payload redaction
  // =========================================================================

  describe('redactWsPayload', () => {
    it('should redact strings inside payload objects', () => {
      const payload = {
        type: 'tool-result',
        data: {
          output: 'Found key ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc123',
        },
      };

      const result = redactWsPayload(payload);

      expect(result.data.output).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc123');
    });

    it('should redact strings in arrays', () => {
      const payload = {
        messages: [
          'Normal message',
          'Secret: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc123',
        ],
      };

      const result = redactWsPayload(payload);

      expect(result.messages[0]).toBe('Normal message');
      expect(result.messages[1]).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc123');
    });

    it('should preserve non-string/non-object values', () => {
      const payload = {
        count: 42,
        enabled: true,
        nothing: null,
      };

      const result = redactWsPayload(payload);

      expect(result.count).toBe(42);
      expect(result.enabled).toBe(true);
      expect(result.nothing).toBeNull();
    });

    it('should preserve Date instances', () => {
      const date = new Date('2025-01-15T00:00:00Z');
      const result = redactWsPayload(date);
      expect(result).toBe(date);
    });

    it('should handle null payload', () => {
      expect(redactWsPayload(null)).toBeNull();
    });

    it('should handle undefined payload', () => {
      expect(redactWsPayload(undefined)).toBeUndefined();
    });

    it('should handle primitive string payload', () => {
      const token = fakeChars('ghp_', 40);
      const result = redactWsPayload(token);
      expect(result).not.toContain(token);
    });

    it('should redact sensitive keys in objects using text-based redaction', () => {
      const payload = {
        apiKey: fakeChars('sk-proj-', 50),
        model: 'gpt-4o',
      };

      const result = redactWsPayload(payload);

      expect(result.apiKey).not.toBe(payload.apiKey);
      expect(result.model).toBe('gpt-4o');
    });
  });

  // =========================================================================
  // Stream-safe redaction (RedactingStream)
  // =========================================================================

  describe('RedactingStream', () => {
    it('should redact a credential that arrives in a single chunk', () => {
      const stream = new RedactingStream();
      const token = fakeChars('ghp_', 40);

      const part1 = stream.write(`Here is a token: ${token} end`);
      const part2 = stream.flush();
      const combined = part1 + part2;

      expect(combined).not.toContain(token);
    });

    it('should redact a credential split across two chunks', () => {
      const stream = new RedactingStream();
      const token = fakeChars('ghp_', 40);

      // Split the token in the middle
      const half = Math.floor(token.length / 2);
      const chunk1 = `prefix text ${token.slice(0, half)}`;
      const chunk2 = `${token.slice(half)} suffix text`;

      const part1 = stream.write(chunk1);
      const part2 = stream.write(chunk2);
      const part3 = stream.flush();
      const combined = part1 + part2 + part3;

      expect(combined).not.toContain(token);
      expect(combined).toContain('prefix text');
      expect(combined).toContain('suffix text');
    });

    it('should buffer small chunks entirely', () => {
      const stream = new RedactingStream(undefined, 256);

      // A chunk smaller than the window size should be buffered entirely
      const result = stream.write('small');
      expect(result).toBe('');

      const flushed = stream.flush();
      expect(flushed).toBe('small');
    });

    it('should emit text beyond the window size immediately', () => {
      const stream = new RedactingStream(undefined, 16);
      const longText = 'A'.repeat(100);

      const emitted = stream.write(longText);
      // Should emit everything except the trailing window
      expect(emitted.length).toBe(100 - 16);
    });

    it('should flush remaining buffer content', () => {
      const stream = new RedactingStream();

      stream.write('some buffered content that is not too long');
      const flushed = stream.flush();

      expect(flushed).toContain('some buffered content');
    });

    it('should reset the internal state', () => {
      const stream = new RedactingStream();

      stream.write('data that will be buffered');
      stream.reset();
      const flushed = stream.flush();

      expect(flushed).toBe('');
    });

    it('should apply redaction options passed via constructor', () => {
      const stream = new RedactingStream({ mode: 'off' });
      const token = fakeChars('ghp_', 40);

      const part1 = stream.write(token);
      const part2 = stream.flush();
      const combined = part1 + part2;

      // Mode is off, so token should not be redacted
      expect(combined).toContain(token);
    });

    it('should handle empty flush gracefully', () => {
      const stream = new RedactingStream();
      expect(stream.flush()).toBe('');
    });

    it('should handle empty writes', () => {
      const stream = new RedactingStream();
      expect(stream.write('')).toBe('');
    });
  });

  // =========================================================================
  // RedactingLogger
  // =========================================================================

  describe('RedactingLogger', () => {
    it('should create a logger via createRedactingLogger', () => {
      const logger = createRedactingLogger('TestService');
      expect(logger).toBeInstanceOf(RedactingLogger);
    });

    it('should create a logger with custom level and options', () => {
      const logger = createRedactingLogger('TestService', LogLevel.DEBUG, {
        mode: 'all',
      });
      expect(logger).toBeInstanceOf(RedactingLogger);
    });

    it('should support setLevel', () => {
      const logger = new RedactingLogger('Test');
      // Should not throw
      expect(() => logger.setLevel(LogLevel.WARN)).not.toThrow();
    });

    it('should expose all standard log methods', () => {
      const logger = new RedactingLogger('Test', LogLevel.DEBUG);
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  // =========================================================================
  // REDACTED_SENTINEL constant
  // =========================================================================

  describe('REDACTED_SENTINEL', () => {
    it('should be the expected value', () => {
      expect(REDACTED_SENTINEL).toBe('__WUNDR_REDACTED__');
    });
  });

  // =========================================================================
  // Config password patterns (YAML/TOML/INI)
  // =========================================================================

  describe('config password patterns', () => {
    it('should redact password: value in YAML-like config', () => {
      const text = '\npassword: my-secret-password-value123';
      const result = redactSensitiveText(text);
      expect(result).not.toContain('my-secret-password-value123');
    });

    it('should redact api_key = value in INI-like config', () => {
      const text = '\napi_key = some-key-value-1234567890abcdef';
      const result = redactSensitiveText(text);
      expect(result).not.toContain('some-key-value-1234567890abcdef');
    });
  });

  // =========================================================================
  // SSH public key pattern
  // =========================================================================

  describe('SSH public key redaction', () => {
    it('should redact ssh-rsa public keys', () => {
      const pubKey = 'ssh-rsa ' + 'A'.repeat(60) + ' user@host';
      const result = redactSensitiveText(`Pub: ${pubKey}`);
      expect(result).not.toContain('A'.repeat(60));
    });

    it('should redact ssh-ed25519 public keys', () => {
      const pubKey = 'ssh-ed25519 ' + 'B'.repeat(60) + ' admin@server';
      const result = redactSensitiveText(`Pub: ${pubKey}`);
      expect(result).not.toContain('B'.repeat(60));
    });
  });

  // =========================================================================
  // parsePattern edge cases (indirectly tested via options.patterns)
  // =========================================================================

  describe('pattern parsing edge cases', () => {
    it('should handle /slash/-delimited patterns', () => {
      const result = redactSensitiveText('MYTOKEN_12345678901234567890', {
        patterns: ['/MYTOKEN_[0-9]{20,}/'],
      });
      expect(result).not.toContain('MYTOKEN_12345678901234567890');
    });

    it('should handle /slash/-delimited patterns with flags', () => {
      const result = redactSensitiveText('mytoken_ABCDEFGHIJKLMNOPQRST', {
        patterns: ['/mytoken_[a-z]{20,}/i'],
      });
      expect(result).not.toContain('mytoken_ABCDEFGHIJKLMNOPQRST');
    });

    it('should ensure the g flag is always present', () => {
      // Two occurrences should both be redacted
      const result = redactSensitiveText('AAA_1234567890 and AAA_0987654321', {
        patterns: ['/AAA_[0-9]{10}/'],
      });
      expect(result).not.toContain('AAA_1234567890');
      expect(result).not.toContain('AAA_0987654321');
    });
  });
});
