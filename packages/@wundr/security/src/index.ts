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
    await this.reinitializeWithConfig(config);
    
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
  async performSecurityScan(targetPath: string): Promise<{
    secrets: any;
    vulnerabilities: any;
    staticAnalysis: any;
    compliance: any;
  }> {
    const results = await Promise.allSettled([
      this.secretScanner.scanDirectory(targetPath),
      this.vulnerabilityScanner.scanProject(targetPath),
      this.staticAnalyzer.analyzeDirectory(targetPath),
      this.complianceReporter.generateReport('soc2-type2')
    ]);

    return {
      secrets: results[0].status === 'fulfilled' ? results[0].value : null,
      vulnerabilities: results[1].status === 'fulfilled' ? results[1].value : null,
      staticAnalysis: results[2].status === 'fulfilled' ? results[2].value : null,
      compliance: results[3].status === 'fulfilled' ? results[3].value : null
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
      const vulnReport = this.vulnerabilityScanner.generateReport(scanResults.vulnerabilities);
      // Save report to file
      reports.push(`${outputPath}/vulnerability-report.html`);
    }

    if (scanResults.staticAnalysis) {
      const staticReport = this.staticAnalyzer.generateReport(scanResults.staticAnalysis);
      // Save report to file
      reports.push(`${outputPath}/static-analysis-report.html`);
    }

    if (scanResults.compliance) {
      await this.complianceReporter.exportReport(scanResults.compliance, 'html', outputPath);
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

  private async reinitializeWithConfig(config: any): Promise<void> {
    // Reinitialize components with loaded configuration
    // This would be implemented based on specific configuration needs
    
    if (config.scanning.secrets.enabled) {
      this.secretScanner = new SecretScanner({
        excludePaths: config.scanning.secrets.excludePaths,
        includeExtensions: config.scanning.secrets.includeExtensions
      });
    }

    if (config.scanning.vulnerabilities.enabled) {
      this.vulnerabilityScanner = new VulnerabilityScanner({
        updateInterval: config.scanning.vulnerabilities.updateIntervalMs,
        offline: config.scanning.vulnerabilities.offline
      });
    }

    if (config.audit.enabled) {
      const auditStorage = new FileAuditStorage(config.audit.storage.path);
      this.auditLogger = new AuditLogger(auditStorage);
    }

    if (config.rbac.enabled) {
      this.rbac = new RoleBasedAccessControl({
        enableCaching: config.rbac.caching.enabled,
        cacheExpirationMs: config.rbac.caching.expirationMs,
        defaultDenyAll: config.rbac.defaultDenyAll
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
export const initializeSecurity = async (configPath?: string): Promise<SecurityManager> => {
  const manager = new SecurityManager(configPath);
  await manager.initialize();
  return manager;
};

export default SecurityManager;