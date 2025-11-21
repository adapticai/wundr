# @wundr.io/security

[![npm version](https://img.shields.io/npm/v/@wundr.io/security.svg)](https://www.npmjs.com/package/@wundr.io/security)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1+-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)](https://github.com/wundr/wundr)

Enterprise-grade security and compliance framework for the Wundr platform. Provides comprehensive
security scanning, role-based access control, audit logging, compliance reporting, and credential
management for mission-critical applications.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Security Scanning](#security-scanning)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Audit Logging](#audit-logging)
- [Compliance Frameworks](#compliance-frameworks)
- [Credential Management](#credential-management)
- [Security Monitoring](#security-monitoring)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Integration Examples](#integration-examples)
- [Related Packages](#related-packages)
- [License](#license)

## Overview

`@wundr.io/security` is a comprehensive security module designed for enterprise applications
requiring:

- **Multi-layer security scanning** - Secrets, vulnerabilities, static analysis
- **Byzantine fault-tolerant RBAC** - Enterprise-grade access control with delegation
- **Compliance automation** - SOC 2 Type II and HIPAA compliance reporting
- **Real-time security monitoring** - Threat detection and anomaly analysis
- **Secure credential management** - Hardware-backed credential storage
- **Comprehensive audit trails** - Complete security event logging

### Key Capabilities

- 🔍 **12+ Secret Pattern Detectors** - AWS, GitHub, API keys, private keys, PII
- 🛡️ **Byzantine Fault-Tolerant RBAC** - Hierarchical roles with delegation
- 📊 **Compliance Frameworks** - SOC 2 Type II and HIPAA with automated reporting
- 🔐 **Hardware-Backed Credentials** - Secure storage with keytar integration
- 🚨 **Real-Time Monitoring** - Anomaly detection and threat intelligence
- 📝 **Comprehensive Auditing** - Event logging with forensic capabilities

## Core Features

### 1. Security Scanning

#### Secret Detection

Automatically detects and reports exposed secrets in your codebase:

- AWS Access Keys and Secret Keys
- GitHub Personal Access Tokens
- Generic API Keys
- JWT Tokens
- Private Keys (RSA, DSA, EC)
- Database Connection Strings
- Slack and Google API Tokens
- Credit Card Numbers
- Social Security Numbers
- Password in URLs

#### Vulnerability Scanning

Identifies security vulnerabilities in dependencies:

- NPM package vulnerability detection
- CVE database integration
- Severity-based prioritization
- Automated remediation suggestions

#### Static Analysis

Code quality and security analysis:

- Security-focused code patterns
- Complexity metrics
- Maintainability index
- Best practice validation

### 2. Role-Based Access Control (RBAC)

Enterprise-grade access control with advanced features:

- **Hierarchical Roles** - Multi-level role inheritance
- **Dynamic Permissions** - Context-aware access decisions
- **Delegation Support** - Temporary permission delegation
- **Condition-Based Access** - Time, location, device, MFA constraints
- **Risk Assessment** - Real-time risk scoring for access requests
- **Caching** - Performance-optimized with configurable cache
- **Audit Integration** - Complete access event logging

### 3. Audit Logging

Comprehensive security event logging:

- **Multiple Storage Backends** - File, database, remote
- **Event Categories** - Authentication, authorization, data access, configuration
- **Anomaly Detection** - ML-based pattern recognition
- **Forensic Capabilities** - Complete event reconstruction
- **Retention Policies** - Configurable log retention
- **Export Formats** - JSON, CSV, Syslog

### 4. Compliance Reporting

Automated compliance framework support:

- **SOC 2 Type II** - Complete control framework
- **HIPAA** - Healthcare data protection
- **Custom Frameworks** - Extensible framework support
- **Evidence Collection** - Automated evidence gathering
- **Report Generation** - HTML, PDF, JSON, CSV formats
- **Trend Analysis** - Compliance tracking over time

### 5. Credential Management

Secure credential storage and retrieval:

- **Hardware-Backed Storage** - OS keychain integration
- **Encryption** - AES-256 encryption
- **Access Control** - Permission-based credential access
- **Rotation Support** - Automated credential rotation
- **Audit Trail** - Complete credential usage tracking

### 6. Security Monitoring

Real-time security monitoring and alerting:

- **Threat Detection** - Pattern-based threat identification
- **Anomaly Detection** - Behavioral analysis
- **Alert Management** - Configurable alerting
- **Metrics Collection** - Security metrics and KPIs
- **Dashboard Integration** - Real-time security dashboards

## Installation

```bash
npm install @wundr.io/security
```

### Peer Dependencies

```bash
npm install bcrypt jsonwebtoken winston
```

### Optional Dependencies

For enhanced functionality:

```bash
npm install keytar  # Hardware-backed credential storage
```

## Quick Start

### Basic Setup

```typescript
import { SecurityManager, initializeSecurity } from '@wundr.io/security';

// Initialize with default configuration
const security = await initializeSecurity();

// Or with custom configuration
const security = await initializeSecurity('./security-config.json');

// Access individual components
const secretScanner = security.getSecretScanner();
const rbac = security.getRBAC();
const auditLogger = security.getAuditLogger();
const complianceReporter = security.getComplianceReporter();
```

### Configuration File

Create `security-config.json`:

```json
{
  "scanning": {
    "secrets": {
      "enabled": true,
      "excludePaths": ["node_modules", "dist"],
      "includeExtensions": [".js", ".ts", ".env"]
    },
    "vulnerabilities": {
      "enabled": true,
      "updateIntervalMs": 3600000
    },
    "static": {
      "enabled": true,
      "rules": ["security", "best-practices"]
    }
  },
  "audit": {
    "enabled": true,
    "storage": {
      "type": "file",
      "path": "./logs/audit"
    }
  },
  "rbac": {
    "enabled": true,
    "caching": {
      "enabled": true,
      "expirationMs": 300000
    },
    "defaultDenyAll": true
  },
  "compliance": {
    "frameworks": ["soc2-type2", "hipaa"],
    "reporting": {
      "enabled": true,
      "schedule": "monthly"
    }
  }
}
```

## Security Scanning

### Secret Scanning

Scan your codebase for exposed secrets:

```typescript
import { SecretScanner } from '@wundr.io/security';

const scanner = new SecretScanner({
  excludePaths: ['node_modules', '.git', 'dist'],
  includeExtensions: ['.js', '.ts', '.env', '.yaml'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
});

// Scan entire directory
const result = await scanner.scanDirectory('./src');

console.log('Scan Results:');
console.log(`Files Scanned: ${result.filesScanned}`);
console.log(`Secrets Found: ${result.matches.length}`);
console.log(`Critical: ${result.summary.critical}`);
console.log(`High: ${result.summary.high}`);
console.log(`Medium: ${result.summary.medium}`);
console.log(`Low: ${result.summary.low}`);

// Display findings
result.matches.forEach(match => {
  console.log(`
    File: ${match.file}:${match.line}:${match.column}
    Type: ${match.pattern.name}
    Severity: ${match.pattern.severity}
    Confidence: ${(match.confidence * 100).toFixed(1)}%
    Context: ${match.context}
  `);
});

// Get remediation suggestions
const suggestions = scanner.createRemediationSuggestions(result.matches);
suggestions.forEach(({ file, suggestions }) => {
  console.log(`\nFile: ${file}`);
  suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
});
```

### Custom Secret Patterns

Add custom patterns for organization-specific secrets:

```typescript
scanner.addPattern({
  name: 'Internal API Token',
  pattern: /INTERNAL_TOKEN_[A-Za-z0-9]{32}/g,
  description: 'Internal API authentication token',
  severity: 'high',
  category: 'api',
});

// Scan with custom patterns
const customResult = await scanner.scanDirectory('./src');
```

### Vulnerability Scanning

Scan project dependencies for known vulnerabilities:

```typescript
import { VulnerabilityScanner } from '@wundr.io/security';

const vulnScanner = new VulnerabilityScanner({
  updateInterval: 3600000, // Update every hour
  offline: false,
});

// Scan project
const vulnResult = await vulnScanner.scanProject('./');

console.log('Vulnerability Report:');
console.log(`Total Packages: ${vulnResult.summary.totalPackages}`);
console.log(`Vulnerable Packages: ${vulnResult.summary.vulnerablePackages}`);
console.log(`Critical: ${vulnResult.summary.criticalCount}`);
console.log(`High: ${vulnResult.summary.highCount}`);

// Display vulnerable packages
vulnResult.packages.forEach(pkg => {
  console.log(`\n${pkg.name}@${pkg.version}:`);
  pkg.vulnerabilities.forEach(vuln => {
    console.log(`  - [${vuln.severity}] ${vuln.title}`);
    console.log(`    ${vuln.description}`);
    console.log(`    References: ${vuln.references.join(', ')}`);
  });
});

// Generate HTML report
const reportHtml = vulnScanner.generateReport(vulnResult);
```

### Static Analysis

Perform security-focused static code analysis:

```typescript
import { StaticAnalyzer } from '@wundr.io/security';

const analyzer = new StaticAnalyzer({
  rules: ['security', 'best-practices', 'complexity'],
  excludePatterns: ['*.test.ts', '*.spec.ts'],
});

const analysisResult = await analyzer.analyzeDirectory('./src');

console.log('Static Analysis Results:');
console.log(`Files Analyzed: ${analysisResult.summary.totalFiles}`);
console.log(`Issues Found: ${analysisResult.summary.totalIssues}`);
console.log(`Code Metrics:`);
console.log(`  Lines of Code: ${analysisResult.metrics.linesOfCode}`);
console.log(`  Complexity: ${analysisResult.metrics.complexity}`);
console.log(`  Maintainability: ${analysisResult.metrics.maintainabilityIndex}`);

// Display issues
analysisResult.issues.forEach(issue => {
  console.log(`
    ${issue.file}:${issue.line}:${issue.column}
    [${issue.severity}] ${issue.rule}: ${issue.message}
    Category: ${issue.category}
  `);
});
```

### Comprehensive Security Scan

Run all security scans in parallel:

```typescript
const securityManager = await initializeSecurity();

const scanResults = await securityManager.performSecurityScan('./src');

// Access individual results
if (scanResults.secrets) {
  console.log('Secret Scan:', scanResults.secrets.summary);
}

if (scanResults.vulnerabilities) {
  console.log('Vulnerability Scan:', scanResults.vulnerabilities.summary);
}

if (scanResults.staticAnalysis) {
  console.log('Static Analysis:', scanResults.staticAnalysis.summary);
}

if (scanResults.compliance) {
  console.log('Compliance:', scanResults.compliance.summary);
}

// Generate comprehensive report
const reports = await securityManager.generateSecurityReport('./src', './security-reports');

console.log('Generated Reports:', reports);
```

## Role-Based Access Control (RBAC)

### Basic RBAC Setup

```typescript
import { RoleBasedAccessControl } from '@wundr.io/security';

const rbac = new RoleBasedAccessControl({
  enableAuditLogging: true,
  enableCaching: true,
  cacheExpirationMs: 300000,
  defaultDenyAll: true,
  enableHierarchicalRoles: true,
  enableDelegation: true,
  maxDelegationDepth: 3,
});

// Create users
const admin = await rbac.createUser({
  username: 'admin',
  email: 'admin@example.com',
  roles: ['admin-role'],
  permissions: [],
  isActive: true,
});

const developer = await rbac.createUser({
  username: 'developer',
  email: 'dev@example.com',
  roles: ['developer-role'],
  permissions: [],
  isActive: true,
});

// Create roles
const adminRole = await rbac.createRole({
  name: 'Administrator',
  description: 'Full system access',
  permissions: ['admin-permission-id'],
  isSystem: false,
});

const devRole = await rbac.createRole({
  name: 'Developer',
  description: 'Development access',
  permissions: ['read-permission-id', 'write-permission-id'],
  isSystem: false,
});

// Create permissions
const readPermission = await rbac.createPermission({
  name: 'read:files',
  description: 'Read file access',
  resource: 'files/*',
  action: 'read',
});

const writePermission = await rbac.createPermission({
  name: 'write:files',
  description: 'Write file access',
  resource: 'files/*',
  action: 'write',
  conditions: [
    {
      type: 'time',
      operator: 'in_range',
      value: { min: 9, max: 17 },
      field: 'hour',
      description: 'Only during business hours',
    },
  ],
});
```

### Access Control

Check access with context:

```typescript
// Simple access check
const hasAccess = await rbac.hasPermission(developer.id, 'files/project1', 'read');

console.log('Has Access:', hasAccess);

// Detailed access check with context
const accessResult = await rbac.checkAccess({
  userId: developer.id,
  resource: 'files/project1',
  action: 'write',
  context: {
    ipAddress: '192.168.1.100',
    location: {
      country: 'US',
      city: 'San Francisco',
    },
    device: {
      id: 'device-123',
      type: 'desktop',
      trusted: true,
    },
    mfaVerified: true,
    riskScore: 0.2,
  },
  timestamp: new Date(),
});

console.log('Access Decision:', {
  granted: accessResult.granted,
  reason: accessResult.reason,
  confidence: accessResult.confidence,
  matchedPermissions: accessResult.matchedPermissions,
  failedConditions: accessResult.failedConditions,
});

// Review risk assessment
if (accessResult.metadata?.riskAssessment) {
  console.log('Risk Assessment:', {
    score: accessResult.metadata.riskAssessment.score,
    factors: accessResult.metadata.riskAssessment.factors,
    recommendations: accessResult.metadata.riskAssessment.recommendations,
  });
}
```

### Advanced Conditions

Create permissions with complex conditions:

```typescript
const sensitiveDataPermission = await rbac.createPermission({
  name: 'access:sensitive-data',
  description: 'Access to sensitive customer data',
  resource: 'data/customers/*',
  action: 'read',
  conditions: [
    // MFA required
    {
      type: 'mfa_verified',
      operator: 'equals',
      value: true,
    },
    // Only from trusted devices
    {
      type: 'device',
      operator: 'equals',
      value: true,
      field: 'trusted',
    },
    // Low risk score required
    {
      type: 'risk_score',
      operator: 'less_than',
      value: 0.3,
    },
    // Only from corporate IP range
    {
      type: 'ip_address',
      operator: 'within_radius',
      value: {
        ipRange: '10.0.0.0',
        cidr: 16,
      },
    },
    // Only during business hours
    {
      type: 'time',
      operator: 'in_range',
      value: { min: 9, max: 17 },
      field: 'hour',
    },
  ],
  metadata: {
    sensitivity: 'restricted',
    risk: {
      level: 'critical',
      factors: ['PII', 'financial-data'],
    },
  },
});
```

### Permission Delegation

Delegate permissions temporarily:

```typescript
// Delegate permission from manager to employee
const delegationId = await rbac.delegatePermission(manager.id, employee.id, writePermission.id, {
  duration: 24 * 60 * 60 * 1000, // 24 hours
  maxSubDelegations: 1,
  reason: 'Project deadline coverage',
  conditions: [
    {
      type: 'time',
      operator: 'less_than',
      value: new Date('2024-12-31'),
      field: 'timestamp',
    },
  ],
});

console.log('Delegation ID:', delegationId);

// Employee now has temporary access
const employeeAccess = await rbac.checkAccess({
  userId: employee.id,
  resource: 'files/project1',
  action: 'write',
  timestamp: new Date(),
});

console.log('Delegated Access:', employeeAccess.granted);
```

### Hierarchical Roles

Create role hierarchies:

```typescript
const seniorDevRole = await rbac.createRole({
  name: 'Senior Developer',
  description: 'Senior development role with additional permissions',
  permissions: [...devRole.permissions, codeReviewPermission.id],
  isSystem: false,
  metadata: {
    hierarchy: {
      level: 2,
      parentRoles: [devRole.id],
      childRoles: [],
    },
  },
});

// Assign hierarchical role
await rbac.assignRoleToUser(developer.id, seniorDevRole.id);

// Automatically inherits permissions from parent roles
const permissions = await rbac.getUserPermissions(developer);
console.log(
  'Inherited Permissions:',
  permissions.map(p => p.name)
);
```

## Audit Logging

### Basic Audit Logging

```typescript
import { AuditLogger, FileAuditStorage } from '@wundr.io/security';

// Create storage backend
const storage = new FileAuditStorage('./logs/audit', {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  retentionDays: 365,
  compressionEnabled: true,
});

const auditLogger = new AuditLogger(storage, {
  enableAnomalyDetection: true,
  severityThreshold: 'low',
  batchSize: 100,
  flushIntervalMs: 5000,
});

// Log events
await auditLogger.logEvent({
  action: 'user.login',
  resource: 'auth-system',
  resourceType: 'system',
  outcome: 'success',
  severity: 'low',
  source: {
    userId: 'user-123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
  },
  details: {
    method: 'password',
    mfaUsed: true,
  },
});

// Log security events
await auditLogger.logSecurityEvent(
  'unauthorized_access_attempt',
  'files/sensitive.txt',
  'high',
  {
    userId: 'user-456',
    ipAddress: '203.0.113.42',
  },
  {
    attemptedAction: 'delete',
    reason: 'insufficient_permissions',
  }
);

// Log data access
await auditLogger.logDataAccess('user-123', 'database', 'customers', 'read', 'success', {
  query: 'SELECT * FROM customers WHERE id = ?',
  recordsAccessed: 1,
});
```

### Query Audit Logs

```typescript
// Search by user
const userEvents = await auditLogger.searchEvents({
  userId: 'user-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
});

console.log(`Found ${userEvents.length} events`);

// Search by action
const loginEvents = await auditLogger.searchEvents({
  action: 'user.login',
  outcome: 'failure',
});

console.log('Failed login attempts:', loginEvents.length);

// Search security events
const securityEvents = await auditLogger.searchEvents({
  severity: 'high',
  resourceType: 'file',
});

// Get events by resource
const resourceEvents = await auditLogger.getEventsByResource('files/sensitive.txt');

// Get timeline
const timeline = await auditLogger.getEventTimeline(new Date('2024-01-01'), new Date(), 'day');

console.log('Events by day:', timeline);
```

### Anomaly Detection

```typescript
// Configure anomaly detection
auditLogger.on('anomaly:detected', anomaly => {
  console.log('Anomaly Detected:', {
    type: anomaly.type,
    score: anomaly.score,
    description: anomaly.description,
    affectedResources: anomaly.affectedResources,
    recommendations: anomaly.recommendations,
  });

  // Send alert
  sendSecurityAlert(anomaly);
});

// Manually detect anomalies
const anomalies = await auditLogger.detectAnomalies({
  timeWindowMs: 24 * 60 * 60 * 1000, // Last 24 hours
  minAnomalyScore: 0.7,
});

anomalies.forEach(anomaly => {
  console.log(`Anomaly: ${anomaly.description} (Score: ${anomaly.score})`);
});
```

### Export Audit Logs

```typescript
// Export to JSON
await auditLogger.exportLogs(
  {
    startDate: new Date('2024-01-01'),
    endDate: new Date(),
  },
  './exports/audit-2024.json',
  'json'
);

// Export to CSV
await auditLogger.exportLogs({ userId: 'user-123' }, './exports/user-123-audit.csv', 'csv');

// Export to Syslog format
await auditLogger.exportLogs({ severity: 'high' }, './exports/high-severity.log', 'syslog');
```

## Compliance Frameworks

### SOC 2 Type II Compliance

```typescript
import { ComplianceReporter } from '@wundr.io/security';

const reporter = new ComplianceReporter();

// Generate SOC 2 report
const soc2Report = await reporter.generateReport('soc2-type2', {
  assessor: 'Security Team',
  reportPeriod: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31'),
  },
  includeEvidence: true,
});

console.log('SOC 2 Compliance Report:');
console.log(`Framework: ${soc2Report.framework.name}`);
console.log(`Compliance: ${soc2Report.summary.compliancePercentage}%`);
console.log(`Total Requirements: ${soc2Report.summary.totalRequirements}`);
console.log(`Compliant: ${soc2Report.summary.compliant}`);
console.log(`Non-Compliant: ${soc2Report.summary.nonCompliant}`);
console.log(`Partial: ${soc2Report.summary.partial}`);

// Review findings
soc2Report.findings.forEach(finding => {
  console.log(`
    Finding: ${finding.title}
    Severity: ${finding.severity}
    Status: ${finding.status}
    Impact: ${finding.impact}
    Remediation: ${finding.remediation}
  `);
});

// Review recommendations
soc2Report.recommendations.forEach(rec => {
  console.log(`
    Recommendation: ${rec.title}
    Priority: ${rec.priority}
    Effort: ${rec.effort}
    Plan: ${rec.implementationPlan}
  `);
});

// Export report
await reporter.exportReport(soc2Report, 'html', './reports');
await reporter.exportReport(soc2Report, 'pdf', './reports');
await reporter.exportReport(soc2Report, 'json', './reports');
```

### HIPAA Compliance

```typescript
// Generate HIPAA compliance report
const hipaaReport = await reporter.generateReport('hipaa', {
  assessor: 'Compliance Officer',
  includeEvidence: true,
});

console.log('HIPAA Compliance Report:');
console.log(`Compliance: ${hipaaReport.summary.compliancePercentage}%`);

// Track compliance over time
const complianceTrend = await reporter.trackCompliance('hipaa');

console.log('Compliance Trend:');
complianceTrend.trend.forEach(point => {
  console.log(`${point.date.toDateString()}: ${point.compliancePercentage}%`);
});

console.log('Improvements:', complianceTrend.improvements);
console.log('Degradations:', complianceTrend.degradations);
```

### Custom Compliance Frameworks

Create custom compliance frameworks:

```typescript
const customFramework = {
  id: 'custom-iso27001',
  name: 'ISO 27001',
  version: '2022',
  description: 'ISO/IEC 27001:2022 Information Security Management',
  requirements: [
    {
      id: 'ISO-A.5',
      title: 'Information Security Policies',
      description: 'Management direction for information security',
      category: 'Organizational Controls',
      priority: 'critical',
      controls: [
        {
          id: 'ISO-A.5.1',
          description: 'Policies for information security',
          implementation: 'Document and approve security policies',
          automated: false,
          frequency: 'annually',
          responsible: 'CISO',
          status: 'implemented',
        },
      ],
    },
    {
      id: 'ISO-A.8',
      title: 'Asset Management',
      description: 'Identify and manage information assets',
      category: 'Organizational Controls',
      priority: 'high',
      controls: [
        {
          id: 'ISO-A.8.1',
          description: 'Inventory of assets',
          implementation: 'Automated asset discovery and tracking',
          automated: true,
          frequency: 'continuous',
          responsible: 'IT Operations',
          status: 'implemented',
        },
      ],
    },
  ],
};

reporter.addFramework(customFramework);

// Generate report for custom framework
const customReport = await reporter.generateReport('custom-iso27001');
```

### Update Requirement Status

```typescript
// Update individual requirement
reporter.updateRequirementStatus(
  'soc2-type2',
  'CC6.1',
  'compliant',
  'Security Team',
  'All access controls implemented and tested'
);

// Get requirement status
const reqStatus = reporter.getRequirementStatus('soc2-type2', 'CC6.1');
console.log('Requirement Status:', {
  title: reqStatus?.title,
  status: reqStatus?.status,
  lastAssessed: reqStatus?.lastAssessed,
  assessor: reqStatus?.assessor,
});
```

## Credential Management

### Secure Credential Storage

```typescript
import { CredentialManager } from '@wundr.io/security';

const credentialManager = new CredentialManager({
  encryptionAlgorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
});

// Store credentials
await credentialManager.storeCredential(
  'database-prod',
  {
    username: 'db_admin',
    password: 'super-secret-password',
    host: 'db.example.com',
    port: 5432,
  },
  {
    tags: ['production', 'database'],
    expiresAt: new Date('2025-12-31'),
    rotationPolicy: {
      enabled: true,
      intervalDays: 90,
    },
  }
);

// Retrieve credentials
const dbCreds = await credentialManager.getCredential('database-prod');
console.log('Database Credentials:', dbCreds);

// Update credentials
await credentialManager.updateCredential('database-prod', {
  password: 'new-super-secret-password',
});

// Delete credentials
await credentialManager.deleteCredential('database-prod');
```

### Credential Rotation

```typescript
// Enable automatic rotation
credentialManager.on('credential:rotation-needed', async event => {
  console.log(`Rotation needed for: ${event.credentialId}`);

  // Generate new credentials
  const newPassword = await generateSecurePassword();

  // Update in credential store
  await credentialManager.updateCredential(event.credentialId, {
    password: newPassword,
    rotatedAt: new Date(),
  });

  // Update in external system
  await updateExternalSystem(event.credentialId, newPassword);
});

// Manual rotation
await credentialManager.rotateCredential('database-prod');
```

### List and Search Credentials

```typescript
// List all credentials
const allCreds = await credentialManager.listCredentials();

// Search by tags
const prodCreds = await credentialManager.searchCredentials({
  tags: ['production'],
});

// Find expiring credentials
const expiringCreds = await credentialManager.findExpiringCredentials(30); // Next 30 days

expiringCreds.forEach(cred => {
  console.log(`${cred.id} expires on ${cred.metadata.expiresAt}`);
});
```

## Security Monitoring

### Real-Time Monitoring

```typescript
import { SecurityMonitor } from '@wundr.io/security';

const monitor = new SecurityMonitor({
  enableThreatDetection: true,
  enableAnomalyDetection: true,
  alertThreshold: 'medium',
  metricsCollectionInterval: 60000, // 1 minute
});

// Start monitoring
await monitor.start();

// Handle security events
monitor.on('threat:detected', threat => {
  console.log('Threat Detected:', {
    type: threat.type,
    severity: threat.severity,
    source: threat.source,
    description: threat.description,
    recommendedActions: threat.recommendedActions,
  });

  // Auto-response
  if (threat.severity === 'critical') {
    blockIpAddress(threat.source.ipAddress);
    sendEmergencyAlert(threat);
  }
});

monitor.on('anomaly:detected', anomaly => {
  console.log('Anomaly Detected:', anomaly);
});

// Collect metrics
const metrics = monitor.getSecurityMetrics();
console.log('Security Metrics:', {
  threatCount: metrics.threatCount,
  anomalyCount: metrics.anomalyCount,
  avgResponseTime: metrics.avgResponseTime,
  uptime: metrics.uptime,
});
```

### Threat Intelligence

```typescript
// Add threat intelligence sources
await monitor.addThreatSource({
  name: 'Known Malicious IPs',
  type: 'ip-blacklist',
  url: 'https://threat-feeds.example.com/ips',
  updateInterval: 3600000,
});

// Check IP against threat intelligence
const isThreat = await monitor.checkThreat('203.0.113.42');
if (isThreat) {
  console.log('IP is on threat list');
}

// Get threat report
const threatReport = await monitor.getThreatReport({
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
});
```

## Advanced Features

### Event-Driven Architecture

All security components emit events:

```typescript
// Secret Scanner Events
secretScanner.on('scan:started', data => {
  console.log('Scan started:', data);
});

secretScanner.on('scan:file', file => {
  console.log('Scanning:', file);
});

secretScanner.on('scan:completed', result => {
  console.log('Scan completed:', result.summary);
});

// RBAC Events
rbac.on('access:granted', ({ request, result }) => {
  console.log('Access granted:', request);
});

rbac.on('access:denied', ({ request, result }) => {
  console.log('Access denied:', result.reason);
});

rbac.on('role:assigned', ({ userId, roleId }) => {
  console.log(`Role ${roleId} assigned to user ${userId}`);
});

// Audit Logger Events
auditLogger.on('anomaly:detected', anomaly => {
  console.log('Anomaly:', anomaly);
});

auditLogger.on('threshold:exceeded', ({ metric, value, threshold }) => {
  console.log(`${metric} exceeded threshold: ${value} > ${threshold}`);
});
```

### Configuration Hot Reload

```typescript
import { SecurityConfigManager } from '@wundr.io/security';

const configManager = new SecurityConfigManager('./security-config.json');

// Watch for configuration changes
await configManager.watchConfig();

configManager.on('config:updated', changes => {
  console.log('Configuration updated:', changes);

  // Reinitialize affected components
  if (changes.scanning) {
    reinitializeScanner(changes.scanning);
  }

  if (changes.rbac) {
    reinitializeRBAC(changes.rbac);
  }
});

// Apply environment overrides
configManager.applyEnvironmentOverrides();

// Validate configuration
const validation = await configManager.validateConfig();
if (!validation.valid) {
  console.error('Invalid configuration:', validation.errors);
}
```

### Performance Optimization

```typescript
// Enable caching for RBAC
const rbac = new RoleBasedAccessControl({
  enableCaching: true,
  cacheExpirationMs: 300000, // 5 minutes
});

// Batch audit logging
const auditLogger = new AuditLogger(storage, {
  batchSize: 100,
  flushIntervalMs: 5000,
});

// Parallel scanning
const scanResults = await Promise.all([
  secretScanner.scanDirectory('./src'),
  vulnScanner.scanProject('./'),
  staticAnalyzer.analyzeDirectory('./src'),
]);
```

## API Reference

### SecurityManager

Main class coordinating all security components.

```typescript
class SecurityManager {
  constructor(configPath?: string);

  async initialize(): Promise<void>;
  async performSecurityScan(targetPath: string): Promise<SecurityScanResults>;
  async generateSecurityReport(targetPath: string, outputPath: string): Promise<string[]>;

  getCredentialManager(): CredentialManager;
  getSecretScanner(): SecretScanner;
  getVulnerabilityScanner(): VulnerabilityScanner;
  getStaticAnalyzer(): StaticAnalyzer;
  getComplianceReporter(): ComplianceReporter;
  getAuditLogger(): AuditLogger;
  getRBAC(): RoleBasedAccessControl;

  async cleanup(): Promise<void>;
}
```

### SecretScanner

Detects secrets in code and files.

```typescript
class SecretScanner extends EventEmitter {
  constructor(options?: ScanOptions);

  async scanDirectory(directoryPath: string, options?: ScanOptions): Promise<ScanResult>;
  async scanFile(filePath: string): Promise<SecretMatch[]>;
  scanText(text: string, fileName?: string): SecretMatch[];

  addPattern(pattern: SecretPattern): void;
  removePattern(name: string): void;
  getPatterns(): SecretPattern[];
  hasSecrets(text: string): boolean;

  createRemediationSuggestions(matches: SecretMatch[]): Array<{
    file: string;
    suggestions: string[];
  }>;
}
```

### RoleBasedAccessControl

Enterprise RBAC with delegation and conditions.

```typescript
class RoleBasedAccessControl extends EventEmitter {
  constructor(options?: RBACOptions);

  // User Management
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  async updateUser(userId: string, updates: Partial<User>): Promise<User>;
  async deleteUser(userId: string): Promise<void>;
  getUser(userId: string): User | null;
  listUsers(filter?: { active?: boolean; role?: string }): User[];

  // Role Management
  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;
  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role>;
  async deleteRole(roleId: string): Promise<void>;
  getRole(roleId: string): Role | null;
  listRoles(): Role[];

  // Permission Management
  async createPermission(permissionData: Omit<Permission, 'id'>): Promise<Permission>;
  async deletePermission(permissionId: string): Promise<void>;
  getPermission(permissionId: string): Permission | null;
  listPermissions(): Permission[];

  // Access Control
  async checkAccess(request: AccessRequest): Promise<AccessResult>;
  async getUserPermissions(user: User): Promise<Permission[]>;
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean>;

  // Delegation
  async delegatePermission(
    delegatorId: string,
    delegateeId: string,
    permissionId: string,
    options?: DelegationOptions
  ): Promise<string>;

  // Convenience Methods
  async assignRoleToUser(userId: string, roleId: string): Promise<void>;
  async removeRoleFromUser(userId: string, roleId: string): Promise<void>;
}
```

### AuditLogger

Comprehensive audit logging with anomaly detection.

```typescript
class AuditLogger extends EventEmitter {
  constructor(storage: AuditStorage, options?: AuditOptions);

  async logEvent(event: AuditEvent): Promise<void>;
  async logSecurityEvent(
    eventType: string,
    resource: string,
    severity: string,
    source: AuditEventSource,
    details?: Record<string, unknown>
  ): Promise<void>;
  async logDataAccess(
    userId: string,
    resourceType: string,
    resource: string,
    action: string,
    outcome: string,
    details?: Record<string, unknown>
  ): Promise<void>;

  async searchEvents(criteria: AuditSearchCriteria): Promise<AuditEvent[]>;
  async getEventsByUser(userId: string, options?: QueryOptions): Promise<AuditEvent[]>;
  async getEventsByResource(resource: string, options?: QueryOptions): Promise<AuditEvent[]>;
  async getEventTimeline(
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' | 'month'
  ): Promise<TimelineData[]>;

  async detectAnomalies(options?: AnomalyDetectionOptions): Promise<Anomaly[]>;
  async exportLogs(
    criteria: AuditSearchCriteria,
    outputPath: string,
    format: 'json' | 'csv' | 'syslog'
  ): Promise<void>;

  async cleanup(): Promise<void>;
}
```

### ComplianceReporter

Compliance framework reporting and tracking.

```typescript
class ComplianceReporter extends EventEmitter {
  async generateReport(frameworkId: string, options?: ReportOptions): Promise<ComplianceReport>;

  async exportReport(
    report: ComplianceReport,
    format: 'json' | 'html' | 'pdf' | 'csv',
    outputPath: string
  ): Promise<string>;

  addFramework(framework: ComplianceFramework): void;
  getRequirementStatus(frameworkId: string, requirementId: string): ComplianceRequirement | null;
  updateRequirementStatus(
    frameworkId: string,
    requirementId: string,
    status: ComplianceRequirement['status'],
    assessor: string,
    notes?: string
  ): void;

  async trackCompliance(frameworkId: string): Promise<ComplianceTrend>;
}
```

## Best Practices

### 1. Security Scanning

- **Run scans regularly** - Integrate into CI/CD pipeline
- **Scan before commits** - Use pre-commit hooks
- **Custom patterns** - Add organization-specific patterns
- **Remediate quickly** - Address critical findings immediately
- **Track metrics** - Monitor scan trends over time

### 2. Access Control

- **Principle of least privilege** - Grant minimum necessary permissions
- **Regular access reviews** - Audit and remove unnecessary access
- **Use conditions** - Apply context-aware access controls
- **Enable MFA** - Require multi-factor authentication for sensitive operations
- **Monitor access patterns** - Detect anomalous access attempts

### 3. Audit Logging

- **Log all security events** - Comprehensive event coverage
- **Centralize logs** - Aggregate logs from all sources
- **Retention policies** - Meet compliance requirements
- **Regular analysis** - Review logs for security incidents
- **Anomaly detection** - Enable automated anomaly detection

### 4. Compliance

- **Continuous monitoring** - Track compliance in real-time
- **Evidence collection** - Maintain audit evidence
- **Regular assessments** - Conduct periodic compliance reviews
- **Document everything** - Keep thorough documentation
- **Automate where possible** - Use automated compliance checks

### 5. Credential Management

- **Never hardcode credentials** - Use secure storage
- **Rotate regularly** - Implement credential rotation
- **Encrypt at rest** - Use strong encryption
- **Audit access** - Track credential usage
- **Expire credentials** - Set expiration dates

### 6. Security Monitoring

- **Real-time monitoring** - Enable continuous monitoring
- **Threat intelligence** - Integrate threat feeds
- **Alert fatigue** - Tune alerts to reduce noise
- **Incident response** - Have response procedures ready
- **Regular testing** - Test security controls regularly

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { SecurityManager } from '@wundr.io/security';

const app = express();
const security = await initializeSecurity();
const rbac = security.getRBAC();
const auditLogger = security.getAuditLogger();

// Authentication middleware
app.use(async (req, res, next) => {
  const user = await authenticateUser(req);
  if (user) {
    req.user = user;
    await auditLogger.logEvent({
      action: 'auth.success',
      resource: 'api',
      resourceType: 'system',
      outcome: 'success',
      severity: 'low',
      source: {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Authorization middleware
function requirePermission(resource: string, action: string) {
  return async (req: any, res: any, next: any) => {
    const accessResult = await rbac.checkAccess({
      userId: req.user.id,
      resource,
      action,
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        mfaVerified: req.user.mfaVerified,
      },
      timestamp: new Date(),
    });

    if (accessResult.granted) {
      next();
    } else {
      await auditLogger.logSecurityEvent(
        'access_denied',
        resource,
        'medium',
        {
          userId: req.user.id,
          ipAddress: req.ip,
        },
        {
          action,
          reason: accessResult.reason,
        }
      );
      res.status(403).json({ error: 'Forbidden', reason: accessResult.reason });
    }
  };
}

// Protected route
app.delete('/api/files/:id', requirePermission('files/*', 'delete'), async (req, res) => {
  const fileId = req.params.id;

  // Log data access
  await auditLogger.logDataAccess(req.user.id, 'file', `files/${fileId}`, 'delete', 'success', {
    fileId,
  });

  // Delete file
  await deleteFile(fileId);
  res.json({ success: true });
});
```

### CI/CD Integration

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run security scan
        run: |
          node -e "
          const { initializeSecurity } = require('@wundr.io/security');

          (async () => {
            const security = await initializeSecurity();
            const results = await security.performSecurityScan('./src');

            // Fail if critical secrets found
            if (results.secrets?.summary.critical > 0) {
              console.error('Critical secrets detected!');
              process.exit(1);
            }

            // Fail if critical vulnerabilities found
            if (results.vulnerabilities?.summary.criticalCount > 0) {
              console.error('Critical vulnerabilities detected!');
              process.exit(1);
            }

            console.log('Security scan passed');
          })();
          "
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install security scanning tools
RUN npm install -g @wundr.io/security

# Copy application
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Run security scan before build
RUN npx security-scan --fail-on-critical

# Build application
RUN npm run build

# Runtime security
ENV SECURITY_CONFIG=/app/security-config.json
EXPOSE 3000

CMD ["npm", "start"]
```

## Related Packages

- [@wundr.io/core](../core) - Core functionality and utilities
- [@wundr.io/governance](../governance) - Code governance and quality control
- [@wundr.io/monitoring](../monitoring) - Application monitoring and observability
- [@wundr.io/ai](../ai) - AI-powered code analysis

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [Wundr](https://github.com/wundr/wundr)

## Support

- Documentation: https://docs.wundr.io/security
- Issues: https://github.com/wundr/wundr/issues
- Discord: https://discord.gg/wundr

---

**Built with enterprise security in mind. Trusted by security-conscious organizations worldwide.**
