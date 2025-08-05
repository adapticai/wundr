# Security Guidelines & Best Practices

This document outlines security standards and best practices for the monorepo refactoring toolkit.

## 🔒 Security Principles

### Core Security Tenets
1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal access rights for users and systems
3. **Zero Trust**: Never trust, always verify
4. **Fail Secure**: Systems should fail to a secure state
5. **Security by Design**: Security built in from the start

## 🛡️ Input Validation & Sanitization

### File Path Validation
```typescript
// ❌ Vulnerable to path traversal
function readUserFile(userPath: string) {
  return fs.readFileSync(userPath, 'utf-8');
}

// ✅ Secure path validation
import path from 'path';

function readUserFile(userPath: string, allowedDir: string) {
  // Normalize and resolve paths
  const normalizedPath = path.normalize(userPath);
  const resolvedPath = path.resolve(allowedDir, normalizedPath);
  
  // Ensure the resolved path is within allowed directory
  if (!resolvedPath.startsWith(path.resolve(allowedDir))) {
    throw new AppError('Invalid file path', 'SECURITY_VIOLATION');
  }
  
  // Additional validation
  if (normalizedPath.includes('..') || normalizedPath.includes('\\')) {
    throw new AppError('Path traversal detected', 'SECURITY_VIOLATION');
  }
  
  return fs.readFileSync(resolvedPath, 'utf-8');
}
```

### Command Injection Prevention
```typescript
// ❌ Vulnerable to command injection
function runGitCommand(userInput: string) {
  return execSync(`git ${userInput}`);
}

// ✅ Safe command execution
function runGitCommand(command: string, args: string[]) {
  const allowedCommands = ['status', 'log', 'diff', 'show'];
  
  if (!allowedCommands.includes(command)) {
    throw new AppError('Command not allowed', 'SECURITY_VIOLATION');
  }
  
  // Use spawn with separate arguments to prevent injection
  return spawn('git', [command, ...args], {
    stdio: 'pipe',
    timeout: 30000, // 30 second timeout
  });
}
```

### Regular Expression Security
```typescript
// ❌ Vulnerable to ReDoS (Regular Expression Denial of Service)
const vulnerableRegex = /^(a+)+$/;

// ✅ Safe regular expressions with timeouts
function safeRegexMatch(pattern: string, text: string, timeoutMs = 5000): boolean {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new AppError('Regex timeout', 'SECURITY_VIOLATION'));
    }, timeoutMs);
    
    try {
      const result = new RegExp(pattern).test(text);
      clearTimeout(timeout);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}
```

## 🔐 Authentication & Authorization

### Environment Variable Security
```typescript
// config/secure-config.ts
import crypto from 'crypto';

class SecureConfig {
  private static encryptionKey: Buffer;
  
  static initialize() {
    // Generate or load encryption key securely
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }
  
  static getSecureValue(key: string): string {
    const encryptedValue = process.env[key];
    if (!encryptedValue) {
      throw new AppError(`Missing required config: ${key}`, 'CONFIG_ERROR');
    }
    
    return this.decrypt(encryptedValue);
  }
  
  private static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  private static decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Token Management
```typescript
// security/token-manager.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export class TokenManager {
  private static readonly JWT_SECRET = SecureConfig.getSecureValue('JWT_SECRET');
  private static readonly TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  
  static generateAccessToken(payload: any): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.TOKEN_EXPIRY,
      issuer: 'monorepo-toolkit',
      audience: 'api-access',
    });
  }
  
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET, {
        issuer: 'monorepo-toolkit',
        audience: 'api-access',
      });
    } catch (error) {
      throw new AppError('Invalid token', 'AUTH_ERROR');
    }
  }
  
  static generateSecureRandomToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
```

## 🔍 Data Protection

### Sensitive Data Handling
```typescript
// security/data-protection.ts
export class DataProtection {
  // PII (Personally Identifiable Information) patterns
  private static readonly PII_PATTERNS = [
    /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit Card
    /\b\d{3}-?\d{3}-?\d{4}\b/g, // Phone Number
  ];
  
  static sanitizeForLogging(data: string): string {
    let sanitized = data;
    
    // Remove or mask PII
    this.PII_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    return sanitized;
  }
  
  static hashSensitiveValue(value: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(value, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  static verifySensitiveValue(value: string, hash: string): boolean {
    const [salt, originalHash] = hash.split(':');
    const verifyHash = crypto.pbkdf2Sync(value, salt, 100000, 64, 'sha512').toString('hex');
    return verifyHash === originalHash;
  }
}
```

### Secure File Operations
```typescript
// security/secure-file-ops.ts
export class SecureFileOperations {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_EXTENSIONS = ['.ts', '.js', '.json', '.md'];
  private static readonly SAFE_DIRECTORIES = ['./src', './scripts', './docs'];
  
  static async secureReadFile(filePath: string): Promise<string> {
    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new AppError('File type not allowed', 'SECURITY_VIOLATION');
    }
    
    // Validate file is in safe directory
    const resolvedPath = path.resolve(filePath);
    const isInSafeDir = this.SAFE_DIRECTORIES.some(dir => 
      resolvedPath.startsWith(path.resolve(dir))
    );
    
    if (!isInSafeDir) {
      throw new AppError('File location not allowed', 'SECURITY_VIOLATION');
    }
    
    // Check file size
    const stats = await fs.stat(resolvedPath);
    if (stats.size > this.MAX_FILE_SIZE) {
      throw new AppError('File too large', 'SECURITY_VIOLATION');
    }
    
    return fs.readFile(resolvedPath, 'utf-8');
  }
  
  static async secureWriteFile(filePath: string, content: string): Promise<void> {
    // All the same validations as read
    await this.validateFilePath(filePath);
    
    // Create secure temporary file first
    const tempFile = `${filePath}.tmp.${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      await fs.writeFile(tempFile, content, { mode: 0o644 });
      await fs.rename(tempFile, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }
}
```

## 🚨 Error Handling & Logging

### Secure Error Handling
```typescript
// security/error-handler.ts
export class SecureErrorHandler {
  static handleError(error: Error, context: string): void {
    // Log full error details securely (not to client)
    this.logError(error, context);
    
    // Return sanitized error to client
    throw this.sanitizeError(error);
  }
  
  private static sanitizeError(error: Error): AppError {
    // Never expose internal details to clients
    if (error instanceof AppError) {
      return error;
    }
    
    // Log the original error but return generic error
    return new AppError('Internal server error', 'INTERNAL_ERROR');
  }
  
  private static logError(error: Error, context: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      message: DataProtection.sanitizeForLogging(error.message),
      stack: error.stack,
      level: this.getErrorLevel(error),
    };
    
    // Use structured logging
    console.error(JSON.stringify(logEntry));
    
    // Send to monitoring system if configured
    if (process.env.MONITORING_ENDPOINT) {
      this.sendToMonitoring(logEntry);
    }
  }
}
```

### Security Logging
```typescript
// security/security-logger.ts
export class SecurityLogger {
  static logSecurityEvent(event: string, details: any): void {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      details: DataProtection.sanitizeForLogging(JSON.stringify(details)),
      severity: this.getSeverity(event),
      source: 'monorepo-toolkit',
    };
    
    // Always log security events
    console.warn(`[SECURITY] ${JSON.stringify(securityLog)}`);
    
    // Send to SIEM if configured
    if (process.env.SIEM_ENDPOINT) {
      this.sendToSIEM(securityLog);
    }
  }
  
  private static getSeverity(event: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap: Record<string, string> = {
      'path_traversal_attempt': 'HIGH',
      'command_injection_attempt': 'CRITICAL',
      'unauthorized_access': 'HIGH',
      'authentication_failure': 'MEDIUM',
      'suspicious_file_access': 'MEDIUM',
      'rate_limit_exceeded': 'LOW',
    };
    
    return (severityMap[event] as any) || 'MEDIUM';
  }
}
```

## 🔧 Dependency Security

### Dependency Scanning
```typescript
// security/dependency-scanner.ts
import { execSync } from 'child_process';

export class DependencyScanner {
  static async scanDependencies(): Promise<SecurityScanResult> {
    const results: SecurityScanResult = {
      vulnerabilities: [],
      outdatedPackages: [],
      suspiciousPackages: [],
    };
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf-8' });
      const audit = JSON.parse(auditResult);
      
      results.vulnerabilities = this.parseVulnerabilities(audit);
      
      // Check for outdated packages
      const outdatedResult = execSync('npm outdated --json', { encoding: 'utf-8' });
      const outdated = JSON.parse(outdatedResult || '{}');
      
      results.outdatedPackages = this.parseOutdated(outdated);
      
      // Check for suspicious packages
      results.suspiciousPackages = await this.checkSuspiciousPackages();
      
    } catch (error) {
      SecurityLogger.logSecurityEvent('dependency_scan_failed', { error: error.message });
    }
    
    return results;
  }
  
  private static checkSuspiciousPackages(): SuspiciousPackage[] {
    // List of patterns that might indicate malicious packages
    const suspiciousPatterns = [
      /bitcoin/i,
      /crypto.*mining/i,
      /wallet/i,
      /password.*steal/i,
    ];
    
    // Check package.json for suspicious dependencies
    // Implementation would analyze package names and descriptions
    return [];
  }
}
```

### License Compliance
```typescript
// security/license-checker.ts
export class LicenseChecker {
  private static readonly APPROVED_LICENSES = [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
  ];
  
  private static readonly FORBIDDEN_LICENSES = [
    'GPL-3.0',
    'AGPL-3.0',
    'WTFPL',
  ];
  
  static async checkLicenses(): Promise<LicenseReport> {
    const licenseResult = execSync('npm ls --json', { encoding: 'utf-8' });
    const dependencies = JSON.parse(licenseResult);
    
    const report: LicenseReport = {
      compliant: [],
      nonCompliant: [],
      unknown: [],
    };
    
    this.analyzeDependencies(dependencies, report);
    
    return report;
  }
}
```

## 🌐 Network Security

### Rate Limiting
```typescript
// security/rate-limiter.ts
export class RateLimiter {
  private static requests = new Map<string, number[]>();
  
  static checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create request history for this identifier
    const requestHistory = this.requests.get(identifier) || [];
    
    // Remove expired requests
    const validRequests = requestHistory.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (validRequests.length >= maxRequests) {
      SecurityLogger.logSecurityEvent('rate_limit_exceeded', {
        identifier,
        requests: validRequests.length,
        limit: maxRequests,
      });
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
}
```

### Secure HTTP Headers
```typescript
// security/http-security.ts
export class HTTPSecurity {
  static getSecurityHeaders(): Record<string, string> {
    return {
      // Prevent XSS
      'X-XSS-Protection': '1; mode=block',
      
      // Prevent MIME sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // HSTS
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      
      // CSP
      'Content-Security-Policy': this.getCSPHeader(),
      
      // Remove server info
      'Server': '',
      
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }
  
  private static getCSPHeader(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "img-src 'self' data:",
      "font-src 'self' https://cdnjs.cloudflare.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
  }
}
```

## 🔐 Secrets Management

### Environment Variable Security
```bash
# .env.example - Never include actual secrets
# Copy to .env and fill in real values

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=monorepo_toolkit
DB_USER=your_username
DB_PASSWORD=your_secure_password

# GitHub Integration
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key

# JWT
JWT_SECRET=your_jwt_signing_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# External Services
MONITORING_ENDPOINT=https://your-monitoring-service
SIEM_ENDPOINT=https://your-siem-service
```

### Secrets Rotation
```typescript
// security/secrets-manager.ts
export class SecretsManager {
  private static readonly ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  static async rotateSecrets(): Promise<void> {
    const secrets = await this.getSecretsToRotate();
    
    for (const secret of secrets) {
      try {
        await this.rotateSecret(secret);
        SecurityLogger.logSecurityEvent('secret_rotated', { secretId: secret.id });
      } catch (error) {
        SecurityLogger.logSecurityEvent('secret_rotation_failed', {
          secretId: secret.id,
          error: error.message,
        });
      }
    }
  }
  
  private static async rotateSecret(secret: SecretInfo): Promise<void> {
    const newValue = this.generateSecureSecret(secret.type);
    
    // Update in secure storage
    await this.updateSecretValue(secret.id, newValue);
    
    // Update application configuration
    await this.updateApplicationConfig(secret.id, newValue);
    
    // Invalidate old tokens/sessions if applicable
    if (secret.type === 'JWT_SECRET') {
      await this.invalidateAllTokens();
    }
  }
}
```

## 🚦 Security Testing

### Automated Security Tests
```typescript
// tests/security/security.test.ts
describe('Security Tests', () => {
  describe('Path Traversal Protection', () => {
    it('should reject path traversal attempts', () => {
      expect(() => {
        readUserFile('../../../etc/passwd', '/safe/directory');
      }).toThrow('Invalid file path');
    });
  });
  
  describe('Command Injection Protection', () => {
    it('should reject dangerous commands', () => {
      expect(() => {
        runGitCommand('status; rm -rf /', []);
      }).toThrow('Command not allowed');
    });
  });
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits', () => {
      const identifier = 'test-user';
      
      // Should allow first 10 requests
      for (let i = 0; i < 10; i++) {
        expect(RateLimiter.checkRateLimit(identifier, 10, 60000)).toBe(true);
      }
      
      // Should reject 11th request
      expect(RateLimiter.checkRateLimit(identifier, 10, 60000)).toBe(false);
    });
  });
});
```

### Penetration Testing Checklist
- [ ] Path traversal vulnerability testing
- [ ] Command injection testing
- [ ] SQL injection testing (if applicable)
- [ ] XSS vulnerability testing
- [ ] CSRF protection testing
- [ ] Authentication bypass testing
- [ ] Authorization testing
- [ ] Rate limiting testing
- [ ] Input validation testing
- [ ] File upload security testing

## 📋 Security Compliance

### OWASP Compliance
Ensure compliance with OWASP Top 10:
1. **Injection** - Use parameterized queries and input validation
2. **Broken Authentication** - Implement secure session management
3. **Sensitive Data Exposure** - Encrypt sensitive data and use HTTPS
4. **XML External Entities** - Disable XML external entity processing
5. **Broken Access Control** - Implement proper authorization checks
6. **Security Misconfiguration** - Use secure defaults and configurations
7. **Cross-Site Scripting** - Sanitize outputs and use CSP
8. **Insecure Deserialization** - Validate serialized data
9. **Using Components with Known Vulnerabilities** - Keep dependencies updated
10. **Insufficient Logging & Monitoring** - Implement comprehensive logging

### Security Audit Checklist
- [ ] All dependencies are up to date
- [ ] No known security vulnerabilities
- [ ] All secrets are properly managed
- [ ] Security headers are implemented
- [ ] Input validation is comprehensive
- [ ] Error handling doesn't leak information
- [ ] Logging includes security events
- [ ] Rate limiting is implemented
- [ ] File operations are secure
- [ ] Network communications are encrypted

---

## Quick Security Check Commands

```bash
# Run security audit
npm audit

# Check for outdated packages
npm outdated

# Run security tests
npm run test:security

# Scan dependencies
npm run security:scan

# Check licenses
npm run security:licenses

# Generate security report
npm run security:report
```

Remember: Security is an ongoing process, not a one-time implementation. Regular reviews and updates are essential.