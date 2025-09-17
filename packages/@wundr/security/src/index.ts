// Security Module Main Export
export * from './credential/CredentialManager';
export * from './scanner/SecretScanner';
export { VulnerabilityScanner, ScanResult as VulnScanResult } from './scanner/VulnerabilityScanner';
export * from './scanner/StaticAnalyzer';
export * from './compliance/ComplianceReporter';
export * from './audit/AuditLogger';
export * from './rbac/RoleBasedAccessControl';
export * from './config/SecurityConfig';
export * from './utils/logger';

import { CredentialManager } from './credential/CredentialManager';
import { SecretScanner } from './scanner/SecretScanner';
import { VulnerabilityScanner } from './scanner/VulnerabilityScanner';
import { StaticAnalyzer } from './scanner/StaticAnalyzer';
import { ComplianceReporter } from './compliance/ComplianceReporter';
import { AuditLogger, FileAuditStorage } from './audit/AuditLogger';
import { RoleBasedAccessControl } from './rbac/RoleBasedAccessControl';
import { SecurityConfigManager } from './config/SecurityConfig';

/**
 * Security scan result interfaces for type safety
 */
export interface SecurityScanResults {
  secrets: {
    findings: Array<{
      file: string;
      line: number;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      value?: string;
    }>;
    summary: {
      totalFiles: number;
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
    };
  } | null;
  vulnerabilities: {
    packages: Array<{
      name: string;
      version: string;
      vulnerabilities: Array<{
        id: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        title: string;
        description: string;
        references: string[];
      }>;
    }>;
    summary: {
      totalPackages: number;
      vulnerablePackages: number;
      totalVulnerabilities: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
    };
  } | null;
  staticAnalysis: {
    issues: Array<{
      file: string;
      line: number;
      column: number;
      rule: string;
      severity: 'error' | 'warning' | 'info';
      message: string;
      category: string;
    }>;
    metrics: {
      linesOfCode: number;
      complexity: number;
      maintainabilityIndex: number;
      testCoverage?: number;
    };
    summary: {
      totalFiles: number;
      totalIssues: number;
      errorCount: number;
      warningCount: number;
      infoCount: number;
    };
  } | null;
  compliance: {
    framework: string;
    status: 'compliant' | 'non-compliant' | 'partial';
    score: number;
    requirements: Array<{
      id: string;
      title: string;
      status: 'pass' | 'fail' | 'manual-review';
      evidence?: string[];
      recommendations?: string[];
    }>;
    summary: {
      totalRequirements: number;
      passedRequirements: number;
      failedRequirements: number;
      manualReviewRequired: number;
    };
  } | null;
}

/**
 * Security configuration interface
 */
export interface SecurityConfiguration {
  scanning: {
    secrets: {
      enabled: boolean;
      excludePaths?: string[];
      includeExtensions?: string[];
      patterns?: Record<string, string>;
    };
    vulnerabilities: {
      enabled: boolean;
      updateIntervalMs?: number;
      offline?: boolean;
      sources?: string[];
    };
    static: {
      enabled: boolean;
      rules?: string[];
      excludePatterns?: string[];
    };
  };
  audit: {
    enabled: boolean;
    storage: {
      type: 'file' | 'database' | 'remote';
      path: string;
      retention?: {
        days: number;
        maxSize?: string;
      };
    };
    format?: 'json' | 'csv' | 'syslog';
  };
  rbac: {
    enabled: boolean;
    caching: {
      enabled: boolean;
      expirationMs: number;
    };
    defaultDenyAll: boolean;
    hierarchicalRoles?: boolean;
    delegation?: {
      enabled: boolean;
      maxDepth: number;
    };
  };
  encryption: {
    algorithm: string;
    keySize: number;
    provider?: string;
  };
  compliance: {
    frameworks: string[];
    reporting: {
      enabled: boolean;
      schedule?: string;
      recipients?: string[];
    };
  };
}

/**
 * Main Security Manager Class
 * Coordinates all security components and provides unified interface
 */
export class SecurityManager {
  private credentialManager!: CredentialManager;
  private secretScanner!: SecretScanner;
  private vulnerabilityScanner!: VulnerabilityScanner;
  private staticAnalyzer!: StaticAnalyzer;
  private complianceReporter!: ComplianceReporter;
  private auditLogger!: AuditLogger;
  private rbac!: RoleBasedAccessControl;
  private configManager: SecurityConfigManager;

  constructor(configPath?: string) {
    this.configManager = new SecurityConfigManager(configPath);

    // Initialize components with default configurations
    this.initializeComponents();

    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize the security manager
   */
  async initialize(): Promise<void> {
    // Load configuration
    const config = await this.configManager.loadConfig();

    // Apply environment overrides
    this.configManager.applyEnvironmentOverrides();

    // Reinitialize components with loaded config
    await this.reinitializeWithConfig(config as any);

    // Start configuration watching
    await this.configManager.watchConfig();
  }

  /**
   * Get credential manager instance
   */
  getCredentialManager(): CredentialManager {
    return this.credentialManager;
  }

  /**
   * Get secret scanner instance
   */
  getSecretScanner(): SecretScanner {
    return this.secretScanner;
  }

  /**
   * Get vulnerability scanner instance
   */
  getVulnerabilityScanner(): VulnerabilityScanner {
    return this.vulnerabilityScanner;
  }

  /**
   * Get static analyzer instance
   */
  getStaticAnalyzer(): StaticAnalyzer {
    return this.staticAnalyzer;
  }

  /**
   * Get compliance reporter instance
   */
  getComplianceReporter(): ComplianceReporter {
    return this.complianceReporter;
  }

  /**
   * Get audit logger instance
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get RBAC instance
   */
  getRBAC(): RoleBasedAccessControl {
    return this.rbac;
  }

  /**
   * Get configuration manager instance
   */
  getConfigManager(): SecurityConfigManager {
    return this.configManager;
  }

  /**
   * Perform comprehensive security scan
   */
  async performSecurityScan(targetPath: string): Promise<SecurityScanResults> {
    const results = await Promise.allSettled([
      this.secretScanner.scanDirectory(targetPath),
      this.vulnerabilityScanner.scanProject(targetPath),
      this.staticAnalyzer.analyzeDirectory(targetPath),
      this.complianceReporter.generateReport('soc2-type2')
    ]);

    return {
      secrets: results[0].status === 'fulfilled' ? results[0].value as any : null,
      vulnerabilities: results[1].status === 'fulfilled' ? results[1].value as any : null,
      staticAnalysis: results[2].status === 'fulfilled' ? results[2].value as any : null,
      compliance: results[3].status === 'fulfilled' ? results[3].value as any : null
    };
  }

  /**
   * Generate comprehensive security report
   */
  async generateSecurityReport(targetPath: string, outputPath: string): Promise<string[]> {
    const scanResults = await this.performSecurityScan(targetPath);
    const reports: string[] = [];

    // Generate individual reports
    if (scanResults.secrets) {
      // Implementation would generate secret scan report
      reports.push(`${outputPath}/secret-scan-report.html`);
    }

    if (scanResults.vulnerabilities) {
      const vulnReport = this.vulnerabilityScanner.generateReport(scanResults.vulnerabilities as any);
      // Save report to file
      reports.push(`${outputPath}/vulnerability-report.html`);
    }

    if (scanResults.staticAnalysis) {
      const staticReport = this.staticAnalyzer.generateReport(scanResults.staticAnalysis as any);
      // Save report to file
      reports.push(`${outputPath}/static-analysis-report.html`);
    }

    if (scanResults.compliance) {
      await this.complianceReporter.exportReport(scanResults.compliance as any, 'html', outputPath);
      reports.push(`${outputPath}/compliance-report.html`);
    }

    return reports;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await Promise.allSettled([
      this.credentialManager.cleanup(),
      this.auditLogger.cleanup(),
      this.configManager.cleanup()
    ]);
  }

  private initializeComponents(): void {
    // Initialize with default configurations
    this.credentialManager = new CredentialManager();
    this.secretScanner = new SecretScanner();
    this.vulnerabilityScanner = new VulnerabilityScanner();
    this.staticAnalyzer = new StaticAnalyzer();
    this.complianceReporter = new ComplianceReporter();

    // Initialize audit logger with file storage
    const auditStorage = new FileAuditStorage('./logs/audit');
    this.auditLogger = new AuditLogger(auditStorage);

    this.rbac = new RoleBasedAccessControl();
  }

  private async reinitializeWithConfig(config: SecurityConfiguration): Promise<void> {
    // Reinitialize components with loaded configuration
    // This would be implemented based on specific configuration needs

    if (config.scanning?.secrets?.enabled) {
      this.secretScanner = new SecretScanner({
        excludePaths: config.scanning.secrets.excludePaths,
        includeExtensions: config.scanning.secrets.includeExtensions
      });
    }

    if (config.scanning?.vulnerabilities?.enabled) {
      this.vulnerabilityScanner = new VulnerabilityScanner({
        updateInterval: config.scanning.vulnerabilities.updateIntervalMs,
        offline: config.scanning.vulnerabilities.offline
      });
    }

    if (config.audit?.enabled && config.audit.storage) {
      const auditStorage = new FileAuditStorage(config.audit.storage.path);
      this.auditLogger = new AuditLogger(auditStorage);
    }

    if (config.rbac?.enabled) {
      this.rbac = new RoleBasedAccessControl({
        enableCaching: config.rbac.caching?.enabled ?? true,
        cacheExpirationMs: config.rbac.caching?.expirationMs ?? 300000,
        defaultDenyAll: config.rbac.defaultDenyAll,
        enableHierarchicalRoles: config.rbac.hierarchicalRoles,
        enableDelegation: config.rbac.delegation?.enabled,
        maxDelegationDepth: config.rbac.delegation?.maxDepth
      });
    }
  }

  private setupEventForwarding(): void {
    // Forward important events from components
    this.credentialManager.on('credential:stored', (data) => {
      this.auditLogger.logEvent({
        action: 'credential.stored',
        resource: `credential:${data}`,
        resourceType: 'system',
        outcome: 'success',
        severity: 'medium',
        source: { application: '@wundr/security' },
        details: { credentialId: data }
      });
    });

    this.rbac.on('access:denied', (data) => {
      this.auditLogger.logSecurityEvent(
        'access_denied',
        data.request.resource,
        'medium',
        { application: '@wundr/security' },
        {
          userId: data.request.userId,
          action: data.request.action,
          reason: data.result.reason
        }
      );
    });

    this.rbac.on('role:assigned', (data) => {
      this.auditLogger.logEvent({
        action: 'role.assigned',
        resource: `user:${data.userId}`,
        resourceType: 'user',
        outcome: 'success',
        severity: 'high',
        source: { application: '@wundr/security' },
        details: { roleId: data.roleId }
      });
    });

    // Forward configuration changes to audit
    this.configManager.on('config:updated', (data) => {
      this.auditLogger.logEvent({
        action: 'config.updated',
        resource: 'security.config',
        resourceType: 'configuration',
        outcome: 'success',
        severity: 'medium',
        source: { application: '@wundr/security' },
        details: data
      });
    });
  }
}

// Create and export default instance
export const securityManager = new SecurityManager();

// Export convenience functions
/**
 * Initialize security manager with optional configuration
 * @param configPath - Path to security configuration file
 * @returns Promise resolving to configured SecurityManager instance
 * @throws {Error} If configuration is invalid or initialization fails
 */
export const initializeSecurity = async (configPath?: string): Promise<SecurityManager> => {
  const manager = new SecurityManager(configPath);
  await manager.initialize();
  return manager;
};

export default SecurityManager;