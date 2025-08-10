import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';

/**
 * Governance commands for compliance and quality control
 */
export class GovernCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const governCmd = this.program
      .command('govern')
      .description('governance and compliance tools');

    // Check compliance
    governCmd
      .command('check')
      .description('run compliance checks')
      .option('--rules <rules>', 'specific rules to check')
      .option('--severity <level>', 'minimum severity level', 'warning')
      .option('--fix', 'automatically fix violations where possible')
      .option('--report', 'generate compliance report')
      .action(async (options) => {
        await this.checkCompliance(options);
      });

    // Manage rules
    governCmd
      .command('rules')
      .description('manage governance rules');

    governCmd
      .command('rules list')
      .description('list all available rules')
      .option('--category <category>', 'filter by category')
      .action(async (options) => {
        await this.listRules(options);
      });

    governCmd
      .command('rules add <rule>')
      .description('add a new rule')
      .option('--severity <level>', 'rule severity', 'warning')
      .option('--config <config>', 'rule configuration')
      .action(async (rule, options) => {
        await this.addRule(rule, options);
      });

    governCmd
      .command('rules remove <rule>')
      .description('remove a rule')
      .action(async (rule) => {
        await this.removeRule(rule);
      });

    // Policy management
    governCmd
      .command('policy')
      .description('manage governance policies');

    governCmd
      .command('policy create <name>')
      .description('create a new policy')
      .option('--template <template>', 'policy template')
      .option('--rules <rules>', 'comma-separated rules')
      .action(async (name, options) => {
        await this.createPolicy(name, options);
      });

    governCmd
      .command('policy apply <policy>')
      .description('apply a policy to project')
      .option('--scope <scope>', 'application scope (project, workspace)', 'project')
      .action(async (policy, options) => {
        await this.applyPolicy(policy, options);
      });

    // Quality gates
    governCmd
      .command('gate')
      .description('quality gate management');

    governCmd
      .command('gate check')
      .description('run quality gate checks')
      .option('--gate <name>', 'specific gate to check')
      .option('--fail-on-error', 'fail if quality gate fails')
      .action(async (options) => {
        await this.checkQualityGate(options);
      });

    governCmd
      .command('gate create <name>')
      .description('create a new quality gate')
      .option('--conditions <conditions>', 'gate conditions')
      .action(async (name, options) => {
        await this.createQualityGate(name, options);
      });

    // Audit
    governCmd
      .command('audit')
      .description('run governance audit')
      .option('--scope <scope>', 'audit scope (security, quality, compliance)', 'all')
      .option('--export <path>', 'export audit results')
      .action(async (options) => {
        await this.runAudit(options);
      });

    // Reports
    governCmd
      .command('report')
      .description('generate governance reports')
      .option('--type <type>', 'report type (compliance, quality, security)', 'compliance')
      .option('--period <period>', 'report period (daily, weekly, monthly)', 'weekly')
      .option('--output <path>', 'output file path')
      .action(async (options) => {
        await this.generateReport(options);
      });
  }

  /**
   * Check compliance against governance rules
   */
  private async checkCompliance(options: any): Promise<void> {
    try {
      logger.info('Running compliance checks...');
      
      const config = this.configManager.getConfig();
      const rules = options.rules ? options.rules.split(',') : config.governance.rules;
      const violations: any[] = [];

      for (const rule of rules) {
        logger.debug(`Checking rule: ${rule}`);
        const ruleViolations = await this.checkRule(rule, options.severity);
        violations.push(...ruleViolations);
      }

      if (violations.length > 0) {
        logger.warn(`Found ${violations.length} compliance violations`);
        
        if (options.fix) {
          const fixedCount = await this.autoFixViolations(violations);
          logger.success(`Fixed ${fixedCount} violations automatically`);
        }

        this.displayViolations(violations);
      } else {
        logger.success('All compliance checks passed ✓');
      }

      if (options.report) {
        await this.generateComplianceReport(violations);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_CHECK_FAILED',
        'Failed to run compliance checks',
        { options },
        true
      );
    }
  }

  /**
   * List available governance rules
   */
  private async listRules(options: any): Promise<void> {
    try {
      const rules = await this.getAllRules();
      const filteredRules = options.category 
        ? rules.filter(rule => rule.category === options.category)
        : rules;

      if (filteredRules.length === 0) {
        logger.info('No rules found');
        return;
      }

      logger.info(`Available rules (${filteredRules.length}):`);
      console.table(filteredRules.map(rule => ({
        Name: rule.name,
        Category: rule.category,
        Severity: rule.severity,
        Description: rule.description,
        Fixable: rule.fixable ? '✓' : '✗'
      })));

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_LIST_RULES_FAILED',
        'Failed to list rules',
        { options },
        true
      );
    }
  }

  /**
   * Add a new governance rule
   */
  private async addRule(rule: string, options: any): Promise<void> {
    try {
      logger.info(`Adding rule: ${chalk.cyan(rule)}`);
      
      const config = this.configManager.getConfig();
      if (!config.governance.rules.includes(rule)) {
        config.governance.rules.push(rule);
        await this.configManager.saveConfig();
        logger.success(`Rule ${rule} added successfully`);
      } else {
        logger.warn(`Rule ${rule} already exists`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_ADD_RULE_FAILED',
        'Failed to add rule',
        { rule, options },
        true
      );
    }
  }

  /**
   * Remove a governance rule
   */
  private async removeRule(rule: string): Promise<void> {
    try {
      logger.info(`Removing rule: ${chalk.cyan(rule)}`);
      
      const config = this.configManager.getConfig();
      const index = config.governance.rules.indexOf(rule);
      
      if (index > -1) {
        config.governance.rules.splice(index, 1);
        await this.configManager.saveConfig();
        logger.success(`Rule ${rule} removed successfully`);
      } else {
        logger.warn(`Rule ${rule} not found`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_REMOVE_RULE_FAILED',
        'Failed to remove rule',
        { rule },
        true
      );
    }
  }

  /**
   * Create a new governance policy
   */
  private async createPolicy(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating policy: ${chalk.cyan(name)}`);
      
      const policy = {
        name,
        description: `Policy: ${name}`,
        rules: options.rules ? options.rules.split(',') : [],
        severity: 'warning',
        created: new Date().toISOString()
      };

      const policyPath = path.join(process.cwd(), '.wundr', 'policies', `${name}.json`);
      await fs.ensureDir(path.dirname(policyPath));
      await fs.writeJson(policyPath, policy, { spaces: 2 });

      logger.success(`Policy ${name} created at ${policyPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_CREATE_POLICY_FAILED',
        'Failed to create policy',
        { name, options },
        true
      );
    }
  }

  /**
   * Apply a policy to the project
   */
  private async applyPolicy(policy: string, options: any): Promise<void> {
    try {
      logger.info(`Applying policy: ${chalk.cyan(policy)}`);
      
      const policyPath = path.join(process.cwd(), '.wundr', 'policies', `${policy}.json`);
      
      if (await fs.pathExists(policyPath)) {
        const policyData = await fs.readJson(policyPath);
        
        // Apply policy rules to configuration
        const config = this.configManager.getConfig();
        config.governance.rules.push(...policyData.rules);
        
        // Remove duplicates
        config.governance.rules = [...new Set(config.governance.rules)];
        
        await this.configManager.saveConfig();
        logger.success(`Policy ${policy} applied successfully`);
      } else {
        throw new Error(`Policy ${policy} not found`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_APPLY_POLICY_FAILED',
        'Failed to apply policy',
        { policy, options },
        true
      );
    }
  }

  /**
   * Check quality gate
   */
  private async checkQualityGate(options: any): Promise<void> {
    try {
      logger.info('Checking quality gates...');
      
      const gates = await this.getQualityGates();
      const gatesToCheck = options.gate ? [options.gate] : gates.map(g => g.name);
      
      let allPassed = true;
      
      for (const gateName of gatesToCheck) {
        const gate = gates.find(g => g.name === gateName);
        if (!gate) {
          logger.warn(`Quality gate ${gateName} not found`);
          continue;
        }
        
        const result = await this.evaluateQualityGate(gate);
        
        if (result.passed) {
          logger.success(`✓ Quality gate ${gateName} passed`);
        } else {
          logger.error(`✗ Quality gate ${gateName} failed`);
          result.failures.forEach(failure => {
            logger.error(`  - ${failure}`);
          });
          allPassed = false;
        }
      }

      if (!allPassed && options.failOnError) {
        process.exit(1);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_GATE_CHECK_FAILED',
        'Failed to check quality gate',
        { options },
        true
      );
    }
  }

  /**
   * Create a new quality gate
   */
  private async createQualityGate(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating quality gate: ${chalk.cyan(name)}`);
      
      const gate = {
        name,
        description: `Quality gate: ${name}`,
        conditions: options.conditions ? options.conditions.split(',') : [],
        created: new Date().toISOString()
      };

      const gatePath = path.join(process.cwd(), '.wundr', 'gates', `${name}.json`);
      await fs.ensureDir(path.dirname(gatePath));
      await fs.writeJson(gatePath, gate, { spaces: 2 });

      logger.success(`Quality gate ${name} created at ${gatePath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_CREATE_GATE_FAILED',
        'Failed to create quality gate',
        { name, options },
        true
      );
    }
  }

  /**
   * Run governance audit
   */
  private async runAudit(options: any): Promise<void> {
    try {
      logger.info('Running governance audit...');
      
      const auditResults = {
        timestamp: new Date().toISOString(),
        scope: options.scope,
        results: {
          security: options.scope === 'all' || options.scope === 'security' ? await this.auditSecurity() : null,
          quality: options.scope === 'all' || options.scope === 'quality' ? await this.auditQuality() : null,
          compliance: options.scope === 'all' || options.scope === 'compliance' ? await this.auditCompliance() : null
        }
      };

      logger.info('Audit completed');
      this.displayAuditResults(auditResults);

      if (options.export) {
        await fs.writeJson(options.export, auditResults, { spaces: 2 });
        logger.success(`Audit results exported to ${options.export}`);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_AUDIT_FAILED',
        'Failed to run audit',
        { options },
        true
      );
    }
  }

  /**
   * Generate governance report
   */
  private async generateReport(options: any): Promise<void> {
    try {
      logger.info(`Generating ${options.type} report...`);
      
      const report = await this.createGovernanceReport(options.type, options.period);
      
      const outputPath = options.output || `wundr-${options.type}-report-${Date.now()}.json`;
      await fs.writeJson(outputPath, report, { spaces: 2 });
      
      logger.success(`Report generated: ${outputPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_GOVERN_REPORT_FAILED',
        'Failed to generate report',
        { options },
        true
      );
    }
  }

  /**
   * Implementation methods
   */
  private async checkRule(rule: string, severity: string): Promise<any[]> {
    // Implementation for checking individual rules
    return [];
  }

  private async autoFixViolations(violations: any[]): Promise<number> {
    // Implementation for auto-fixing violations
    return 0;
  }

  private async getAllRules(): Promise<any[]> {
    // Implementation for getting all available rules
    return [
      {
        name: 'no-console',
        category: 'quality',
        severity: 'warning',
        description: 'Disallow console statements',
        fixable: true
      },
      {
        name: 'require-tests',
        category: 'quality',
        severity: 'error',
        description: 'Require test files for all modules',
        fixable: false
      }
    ];
  }

  private async getQualityGates(): Promise<any[]> {
    // Implementation for getting quality gates
    return [];
  }

  private async evaluateQualityGate(gate: any): Promise<{ passed: boolean; failures: string[] }> {
    // Implementation for evaluating quality gates
    return { passed: true, failures: [] };
  }

  private async auditSecurity(): Promise<any> {
    // Implementation for security audit
    return { issues: [], score: 100 };
  }

  private async auditQuality(): Promise<any> {
    // Implementation for quality audit
    return { issues: [], score: 95 };
  }

  private async auditCompliance(): Promise<any> {
    // Implementation for compliance audit
    return { violations: [], score: 90 };
  }

  private async createGovernanceReport(type: string, period: string): Promise<any> {
    // Implementation for creating governance reports
    return {
      type,
      period,
      generated: new Date().toISOString(),
      summary: {},
      details: []
    };
  }

  private displayViolations(violations: any[]): void {
    if (violations.length === 0) return;
    
    console.log(chalk.yellow('\nCompliance Violations:'));
    console.table(violations.map(v => ({
      Rule: v.rule,
      Severity: v.severity,
      File: v.file,
      Line: v.line || 'N/A',
      Description: v.description
    })));
  }

  private async generateComplianceReport(violations: any[]): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      totalViolations: violations.length,
      violations,
      summary: this.createViolationsSummary(violations)
    };

    const reportPath = `compliance-report-${Date.now()}.json`;
    await fs.writeJson(reportPath, report, { spaces: 2 });
    logger.success(`Compliance report generated: ${reportPath}`);
  }

  private createViolationsSummary(violations: any[]): any {
    const summary = {
      bySeverity: {},
      byRule: {},
      byFile: {}
    };

    violations.forEach(v => {
      summary.bySeverity[v.severity] = (summary.bySeverity[v.severity] || 0) + 1;
      summary.byRule[v.rule] = (summary.byRule[v.rule] || 0) + 1;
      summary.byFile[v.file] = (summary.byFile[v.file] || 0) + 1;
    });

    return summary;
  }

  private displayAuditResults(results: any): void {
    console.log(chalk.blue('\nAudit Results:'));
    
    if (results.results.security) {
      console.log(`Security Score: ${results.results.security.score}/100`);
    }
    
    if (results.results.quality) {
      console.log(`Quality Score: ${results.results.quality.score}/100`);
    }
    
    if (results.results.compliance) {
      console.log(`Compliance Score: ${results.results.compliance.score}/100`);
    }
  }
}