# @wundr/security

Enterprise-grade security and compliance module for the Wundr platform. Provides comprehensive security features including credential management, secret scanning, vulnerability detection, compliance reporting, audit logging, and role-based access control.

## Features

### 🔐 Credential Management
- **OS Keychain Integration**: Secure credential storage using the system keychain
- **Encryption**: AES-256-GCM encryption for credential protection
- **Automatic Rotation**: Configurable credential rotation schedules
- **Bulk Operations**: Efficient batch processing of credentials

### 🔍 Secret Scanning
- **Pattern Detection**: Comprehensive secret pattern library (AWS keys, API tokens, passwords, etc.)
- **Custom Patterns**: Support for custom secret detection patterns
- **File System Scanning**: Recursive directory scanning with exclusion filters
- **Real-time Detection**: Scan text content in real-time
- **Remediation Suggestions**: Automatic generation of fix recommendations

### 🛡️ Vulnerability Scanning
- **Dependency Analysis**: Scan npm packages for known vulnerabilities
- **Multiple Sources**: Integration with npm, GitHub, and NVD databases
- **Automated Updates**: Regular vulnerability database updates
- **Risk Assessment**: CVSS scoring and severity classification
- **Fix Recommendations**: Automated upgrade suggestions

### 📊 Static Code Analysis (SAST)
- **Security Rules**: Built-in security rules for common vulnerabilities
- **Multi-language Support**: JavaScript, TypeScript, Python, Java, and more
- **Custom Rules**: Define custom security analysis rules
- **Auto-fix**: Automatic remediation for certain vulnerability types
- **OWASP Mapping**: Mapped to OWASP Top 10 and CWE classifications

### 📋 Compliance Reporting
- **Framework Support**: SOC 2 Type II, HIPAA, and custom frameworks
- **Automated Assessments**: Scheduled compliance checks
- **Evidence Collection**: Automatic evidence gathering and storage
- **Multiple Formats**: Export reports in JSON, HTML, PDF, and CSV
- **Compliance Tracking**: Historical compliance trend analysis

### 📝 Audit Logging
- **Comprehensive Logging**: Track all security-relevant events
- **Structured Storage**: JSON-based event storage with metadata
- **Query Interface**: Flexible event querying and filtering
- **Anomaly Detection**: Behavioral analysis and threat detection
- **Export Capabilities**: Multiple export formats for audit trails

### 👥 Role-Based Access Control (RBAC)
- **Fine-grained Permissions**: Resource and action-based permission system
- **Role Hierarchy**: Support for role inheritance and delegation
- **Conditional Access**: Context-aware access controls
- **Session Management**: User session tracking and timeout
- **Access Caching**: Performance-optimized permission checking

## Installation

```bash
npm install @wundr/security
```

## Quick Start

```typescript
import { SecurityManager, initializeSecurity } from '@wundr/security';

// Initialize with default configuration
const security = await initializeSecurity();

// Or create with custom config path
const security = await initializeSecurity('./custom-security.config.json');

// Perform comprehensive security scan
const results = await security.performSecurityScan('./my-project');

// Generate security reports
const reports = await security.generateSecurityReport(
  './my-project',
  './security-reports'
);
```

## Configuration

Create a `security.config.json` file to customize security settings:

```json
{
  "credentials": {
    "keychain": {
      "service": "@wundr/security",
      "encryptionAlgorithm": "AES-256-GCM",
      "rotationIntervalMs": 2592000000
    }
  },
  "scanning": {
    "secrets": {
      "enabled": true,
      "confidenceThreshold": 0.3,
      "excludePaths": ["node_modules", ".git", "dist"]
    },
    "vulnerabilities": {
      "enabled": true,
      "updateIntervalMs": 86400000,
      "autoUpdate": true
    }
  },
  "audit": {
    "enabled": true,
    "storage": {
      "provider": "file",
      "path": "./logs/audit"
    }
  },
  "rbac": {
    "enabled": true,
    "defaultDenyAll": true,
    "caching": {
      "enabled": true,
      "expirationMs": 300000
    }
  }
}
```

## Usage Examples

### Credential Management

```typescript
const credManager = security.getCredentialManager();

// Store encrypted credential
const credId = await credManager.storeCredential({
  service: 'database',
  account: 'admin',
  password: 'supersecret',
  metadata: { environment: 'production' }
});

// Retrieve credential
const credential = await credManager.retrieveCredential(credId);

// Rotate credential
await credManager.rotateCredential(credId, 'newsecretpassword');
```

### Secret Scanning

```typescript
const scanner = security.getSecretScanner();

// Scan directory for secrets
const results = await scanner.scanDirectory('./src');

// Scan text content
const matches = scanner.scanText('const apiKey = "AKIAIOSFODNN7EXAMPLE"');

// Check if text contains secrets
const hasSecrets = scanner.hasSecrets(sourceCode);

// Get remediation suggestions
const suggestions = scanner.createRemediationSuggestions(results.matches);
```

### Vulnerability Scanning

```typescript
const vulnScanner = security.getVulnerabilityScanner();

// Scan project for vulnerabilities
const results = await vulnScanner.scanProject('./my-app');

// Generate vulnerability report
const report = vulnScanner.generateReport(results);

// Get fix suggestions
const fixes = vulnScanner.getFixSuggestions(results.vulnerabilities);
```

### Static Code Analysis

```typescript
const analyzer = security.getStaticAnalyzer();

// Analyze directory for security issues
const results = await analyzer.analyzeDirectory('./src');

// Generate security report
const report = analyzer.generateReport(results);

// Add custom security rule
analyzer.addRule({
  id: 'custom-sql-injection',
  name: 'Custom SQL Injection Check',
  description: 'Detect potential SQL injection',
  severity: 'critical',
  category: 'security',
  pattern: /query\s*\(\s*['"]\s*SELECT.*?\+/gi,
  languages: ['js', 'ts'],
  recommendation: 'Use parameterized queries'
});
```

### Compliance Reporting

```typescript
const compliance = security.getComplianceReporter();

// Generate SOC 2 compliance report
const soc2Report = await compliance.generateReport('soc2-type2', {
  assessor: 'Security Team',
  includeEvidence: true
});

// Export report in multiple formats
await compliance.exportReport(soc2Report, 'html', './reports');
await compliance.exportReport(soc2Report, 'pdf', './reports');

// Track compliance over time
const trends = await compliance.trackCompliance('soc2-type2');
```

### Audit Logging

```typescript
const audit = security.getAuditLogger();

// Log security events
await audit.logLogin('user123', true, { ip: '192.168.1.1' });
await audit.logFileAccess('user123', '/sensitive/file.txt', 'read', true, { ip: '192.168.1.1' });
await audit.logSecurityEvent('intrusion_attempt', 'system', 'critical', { ip: '10.0.0.1' }, {});

// Query audit events
const events = await audit.queryEvents({
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-12-31'),
  severity: 'critical'
});

// Generate audit report
const auditReport = await audit.generateReport(
  new Date('2023-01-01'),
  new Date('2023-12-31')
);

// Export audit trail
const auditTrail = await audit.exportAuditTrail(
  new Date('2023-01-01'),
  new Date('2023-12-31'),
  'csv'
);
```

### Role-Based Access Control

```typescript
const rbac = security.getRBAC();

// Create user
const user = await rbac.createUser({
  username: 'john.doe',
  email: 'john@example.com',
  roles: [],
  permissions: [],
  isActive: true
});

// Create permission
const permission = await rbac.createPermission({
  name: 'files:read',
  description: 'Read file permission',
  resource: 'files',
  action: 'read'
});

// Create role with permission
const role = await rbac.createRole({
  name: 'File Reader',
  description: 'Can read files',
  permissions: [permission.id],
  isSystem: false
});

// Assign role to user
await rbac.assignRoleToUser(user.id, role.id);

// Check access
const hasAccess = await rbac.hasPermission(user.id, 'files', 'read');

// Check detailed access
const accessResult = await rbac.checkAccess({
  userId: user.id,
  resource: 'files',
  action: 'read',
  timestamp: new Date()
});
```

## Event System

All security components emit events for monitoring and integration:

```typescript
// Listen for security events
security.getSecretScanner().on('scan:started', (data) => {
  console.log(`Started scanning ${data.directory}`);
});

security.getRBAC().on('access:denied', (data) => {
  console.log(`Access denied for user ${data.request.userId}`);
});

security.getAuditLogger().on('anomaly:detected', (anomalies) => {
  console.log(`${anomalies.length} security anomalies detected`);
});
```

## Security Best Practices

1. **Credential Security**
   - Use strong master keys for encryption
   - Implement regular credential rotation
   - Never log or expose decrypted credentials

2. **Scanning Configuration**
   - Regularly update vulnerability databases
   - Customize secret patterns for your environment
   - Use appropriate confidence thresholds

3. **Access Control**
   - Follow principle of least privilege
   - Implement role hierarchies appropriately
   - Use conditional access controls

4. **Audit Logging**
   - Log all security-relevant events
   - Implement log retention policies
   - Monitor for anomalies regularly

5. **Compliance**
   - Schedule regular compliance assessments
   - Maintain evidence collection
   - Track compliance metrics over time

## API Reference

### Classes

- `SecurityManager` - Main security orchestration class
- `CredentialManager` - Secure credential storage and management
- `SecretScanner` - Secret detection and scanning
- `VulnerabilityScanner` - Dependency vulnerability analysis
- `StaticAnalyzer` - Static code security analysis
- `ComplianceReporter` - Compliance assessment and reporting
- `AuditLogger` - Security event logging and analysis
- `RoleBasedAccessControl` - Permission and access management
- `SecurityConfigManager` - Configuration management

### Interfaces

- `CredentialOptions` - Credential storage configuration
- `SecretPattern` - Secret detection pattern definition
- `SecurityRule` - Static analysis rule definition
- `ComplianceFramework` - Compliance framework structure
- `AuditEvent` - Security audit event structure
- `User`, `Role`, `Permission` - RBAC entity definitions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Issues

If you discover a security vulnerability, please email security@wundr.ai instead of using the issue tracker.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [https://docs.wundr.ai/security](https://docs.wundr.ai/security)
- Issues: [https://github.com/wundr/wundr/issues](https://github.com/wundr/wundr/issues)
- Security: security@wundr.ai