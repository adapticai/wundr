import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  controls: ComplianceControl[];
  evidence?: string[];
  status?: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
  lastAssessed?: Date;
  assessor?: string;
  notes?: string;
}

export interface ComplianceControl {
  id: string;
  description: string;
  implementation: string;
  automated: boolean;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  responsible: string;
  evidence?: string[];
  status?: 'implemented' | 'not-implemented' | 'partial' | 'not-applicable';
  lastTested?: Date;
  testResults?: any;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  generatedAt: Date;
  generatedBy: string;
  reportPeriod: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequirements: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notApplicable: number;
    compliancePercentage: number;
  };
  findings: ComplianceFinding[];
  recommendations: ComplianceRecommendation[];
  evidence: EvidenceCollection;
}

export interface ComplianceFinding {
  requirementId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  remediation: string;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted-risk';
  dueDate?: Date;
  assignee?: string;
}

export interface ComplianceRecommendation {
  category: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  implementationPlan: string;
}

export interface EvidenceCollection {
  documents: string[];
  screenshots: string[];
  logs: string[];
  configurations: string[];
  policies: string[];
}

export class ComplianceReporter extends EventEmitter {
  private frameworks: Map<string, ComplianceFramework> = new Map();
  private assessmentResults: Map<string, ComplianceReport> = new Map();

  constructor() {
    super();
    this.initializeFrameworks();
  }

  /**
   * Generate compliance report for a specific framework
   */
  async generateReport(
    frameworkId: string,
    options: {
      assessor?: string;
      reportPeriod?: { start: Date; end: Date };
      includeEvidence?: boolean;
    } = {}
  ): Promise<ComplianceReport> {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) {
      throw new Error(`Framework ${frameworkId} not found`);
    }

    this.emit('report:started', { framework: frameworkId });

    try {
      // Perform compliance assessment
      const assessmentResults = await this.performAssessment(framework);
      
      // Generate report
      const report: ComplianceReport = {
        framework,
        generatedAt: new Date(),
        generatedBy: options.assessor || 'Automated System',
        reportPeriod: options.reportPeriod || {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          end: new Date()
        },
        summary: this.generateSummary(assessmentResults),
        findings: this.generateFindings(assessmentResults),
        recommendations: this.generateRecommendations(assessmentResults),
        evidence: options.includeEvidence ? await this.collectEvidence() : {
          documents: [],
          screenshots: [],
          logs: [],
          configurations: [],
          policies: []
        }
      };

      this.assessmentResults.set(frameworkId, report);
      this.emit('report:completed', { framework: frameworkId, report });

      return report;
    } catch (error) {
      logger.error(`Failed to generate compliance report for ${frameworkId}:`, error);
      throw error;
    }
  }

  /**
   * Export report to various formats
   */
  async exportReport(report: ComplianceReport, format: 'json' | 'html' | 'pdf' | 'csv', outputPath: string): Promise<string> {
    switch (format) {
      case 'json':
        return this.exportToJson(report, outputPath);
      case 'html':
        return this.exportToHtml(report, outputPath);
      case 'pdf':
        return this.exportToPdf(report, outputPath);
      case 'csv':
        return this.exportToCsv(report, outputPath);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Add custom compliance framework
   */
  addFramework(framework: ComplianceFramework): void {
    this.frameworks.set(framework.id, framework);
  }

  /**
   * Get compliance status for a specific requirement
   */
  getRequirementStatus(frameworkId: string, requirementId: string): ComplianceRequirement | null {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) return null;

    return framework.requirements.find(req => req.id === requirementId) || null;
  }

  /**
   * Update requirement status
   */
  updateRequirementStatus(
    frameworkId: string,
    requirementId: string,
    status: ComplianceRequirement['status'],
    assessor: string,
    notes?: string
  ): void {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) throw new Error(`Framework ${frameworkId} not found`);

    const requirement = framework.requirements.find(req => req.id === requirementId);
    if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

    requirement.status = status;
    requirement.lastAssessed = new Date();
    requirement.assessor = assessor;
    if (notes) requirement.notes = notes;

    this.emit('requirement:updated', { frameworkId, requirementId, status });
  }

  /**
   * Track compliance over time
   */
  async trackCompliance(frameworkId: string): Promise<{
    trend: Array<{ date: Date; compliancePercentage: number }>;
    improvements: string[];
    degradations: string[];
  }> {
    // Mock implementation - in reality, this would query historical data
    const trend = [
      { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), compliancePercentage: 75 },
      { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), compliancePercentage: 80 },
      { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), compliancePercentage: 85 },
      { date: new Date(), compliancePercentage: 90 }
    ];

    return {
      trend,
      improvements: [
        'Implemented automated vulnerability scanning',
        'Enhanced access control policies',
        'Improved incident response procedures'
      ],
      degradations: [
        'Some documentation outdated',
        'Manual processes still in use'
      ]
    };
  }

  private initializeFrameworks(): void {
    // SOC 2 Type II Framework
    const soc2Framework: ComplianceFramework = {
      id: 'soc2-type2',
      name: 'SOC 2 Type II',
      version: '2017',
      description: 'SOC 2 Type II compliance framework focusing on security, availability, processing integrity, confidentiality, and privacy',
      requirements: [
        {
          id: 'CC6.1',
          title: 'Logical and Physical Access Controls',
          description: 'The entity implements logical and physical access controls to restrict unauthorized access to system resources',
          category: 'Common Criteria',
          priority: 'critical',
          controls: [
            {
              id: 'CC6.1.1',
              description: 'Multi-factor authentication for privileged users',
              implementation: 'Implemented via SSO with MFA requirement',
              automated: true,
              frequency: 'continuous',
              responsible: 'Security Team',
              status: 'implemented'
            },
            {
              id: 'CC6.1.2',
              description: 'Regular access reviews',
              implementation: 'Quarterly access review process',
              automated: false,
              frequency: 'quarterly',
              responsible: 'HR and Security Team',
              status: 'implemented'
            }
          ]
        },
        {
          id: 'CC7.1',
          title: 'System Monitoring',
          description: 'The entity monitors system components and the operation of controls',
          category: 'Common Criteria',
          priority: 'high',
          controls: [
            {
              id: 'CC7.1.1',
              description: 'Continuous monitoring of system performance and security events',
              implementation: 'SIEM and monitoring tools deployed',
              automated: true,
              frequency: 'continuous',
              responsible: 'DevOps Team',
              status: 'implemented'
            }
          ]
        }
      ]
    };

    // HIPAA Framework
    const hipaaFramework: ComplianceFramework = {
      id: 'hipaa',
      name: 'HIPAA',
      version: '2013',
      description: 'Health Insurance Portability and Accountability Act compliance framework',
      requirements: [
        {
          id: 'HIPAA-164.308',
          title: 'Administrative Safeguards',
          description: 'Implement administrative safeguards to protect electronic PHI',
          category: 'Administrative',
          priority: 'critical',
          controls: [
            {
              id: 'HIPAA-164.308.1',
              description: 'Assigned security responsibility',
              implementation: 'Security Officer appointed',
              automated: false,
              frequency: 'annually',
              responsible: 'Executive Team',
              status: 'implemented'
            }
          ]
        },
        {
          id: 'HIPAA-164.312',
          title: 'Technical Safeguards',
          description: 'Implement technical safeguards to protect electronic PHI',
          category: 'Technical',
          priority: 'critical',
          controls: [
            {
              id: 'HIPAA-164.312.1',
              description: 'Access control to electronic PHI',
              implementation: 'Role-based access control system',
              automated: true,
              frequency: 'continuous',
              responsible: 'Security Team',
              status: 'implemented'
            }
          ]
        }
      ]
    };

    this.frameworks.set(soc2Framework.id, soc2Framework);
    this.frameworks.set(hipaaFramework.id, hipaaFramework);
  }

  private async performAssessment(framework: ComplianceFramework): Promise<ComplianceRequirement[]> {
    // Mock assessment logic - in reality, this would run automated tests and checks
    const assessedRequirements = framework.requirements.map(requirement => {
      const assessment = this.assessRequirement(requirement);
      return {
        ...requirement,
        ...assessment
      };
    });

    return assessedRequirements;
  }

  private assessRequirement(requirement: ComplianceRequirement): Partial<ComplianceRequirement> {
    // Mock assessment logic
    const implementedControls = requirement.controls.filter(control => control.status === 'implemented').length;
    const totalControls = requirement.controls.length;
    
    let status: ComplianceRequirement['status'];
    if (implementedControls === totalControls) {
      status = 'compliant';
    } else if (implementedControls > 0) {
      status = 'partial';
    } else {
      status = 'non-compliant';
    }

    return {
      status,
      lastAssessed: new Date(),
      assessor: 'Automated System'
    };
  }

  private generateSummary(requirements: ComplianceRequirement[]) {
    const total = requirements.length;
    const compliant = requirements.filter(req => req.status === 'compliant').length;
    const nonCompliant = requirements.filter(req => req.status === 'non-compliant').length;
    const partial = requirements.filter(req => req.status === 'partial').length;
    const notApplicable = requirements.filter(req => req.status === 'not-applicable').length;

    return {
      totalRequirements: total,
      compliant,
      nonCompliant,
      partial,
      notApplicable,
      compliancePercentage: Math.round((compliant / (total - notApplicable)) * 100)
    };
  }

  private generateFindings(requirements: ComplianceRequirement[]): ComplianceFinding[] {
    const findings: ComplianceFinding[] = [];

    for (const requirement of requirements) {
      if (requirement.status === 'non-compliant' || requirement.status === 'partial') {
        findings.push({
          requirementId: requirement.id,
          severity: requirement.priority === 'critical' ? 'critical' : requirement.priority,
          title: `Non-compliance with ${requirement.title}`,
          description: requirement.description,
          impact: this.getImpactDescription(requirement.priority),
          remediation: this.getRemediationSuggestion(requirement),
          status: 'open'
        });
      }
    }

    return findings;
  }

  private generateRecommendations(requirements: ComplianceRequirement[]): ComplianceRecommendation[] {
    const recommendations: ComplianceRecommendation[] = [];

    // Analyze patterns and generate recommendations
    const nonCompliantCategories = new Map<string, number>();
    
    for (const requirement of requirements) {
      if (requirement.status === 'non-compliant') {
        const count = nonCompliantCategories.get(requirement.category) || 0;
        nonCompliantCategories.set(requirement.category, count + 1);
      }
    }

    for (const [category, count] of nonCompliantCategories) {
      if (count > 1) {
        recommendations.push({
          category,
          title: `Address ${category} compliance gaps`,
          description: `Multiple requirements in the ${category} category are non-compliant`,
          priority: 'high',
          effort: 'medium',
          implementationPlan: `Create dedicated project to address all ${category} requirements`
        });
      }
    }

    return recommendations;
  }

  private async collectEvidence(): Promise<EvidenceCollection> {
    // Mock evidence collection
    return {
      documents: [
        'policies/security-policy.pdf',
        'policies/privacy-policy.pdf',
        'procedures/incident-response.md'
      ],
      screenshots: [
        'evidence/access-control-screenshot.png',
        'evidence/monitoring-dashboard.png'
      ],
      logs: [
        'logs/access-log-2023.txt',
        'logs/security-events.json'
      ],
      configurations: [
        'config/firewall-rules.json',
        'config/access-policies.yaml'
      ],
      policies: [
        'Security Policy v2.1',
        'Privacy Policy v1.3',
        'Incident Response Plan v1.0'
      ]
    };
  }

  private async exportToJson(report: ComplianceReport, outputPath: string): Promise<string> {
    const fileName = path.join(outputPath, `compliance-report-${report.framework.id}-${Date.now()}.json`);
    await fs.writeFile(fileName, JSON.stringify(report, null, 2));
    return fileName;
  }

  private async exportToHtml(report: ComplianceReport, outputPath: string): Promise<string> {
    const html = this.generateHtmlReport(report);
    const fileName = path.join(outputPath, `compliance-report-${report.framework.id}-${Date.now()}.html`);
    await fs.writeFile(fileName, html);
    return fileName;
  }

  private async exportToPdf(report: ComplianceReport, outputPath: string): Promise<string> {
    // Mock PDF generation - would use a library like puppeteer
    const fileName = path.join(outputPath, `compliance-report-${report.framework.id}-${Date.now()}.pdf`);
    await fs.writeFile(fileName, 'Mock PDF content');
    return fileName;
  }

  private async exportToCsv(report: ComplianceReport, outputPath: string): Promise<string> {
    const csvData = this.generateCsvData(report);
    const fileName = path.join(outputPath, `compliance-report-${report.framework.id}-${Date.now()}.csv`);
    await fs.writeFile(fileName, csvData);
    return fileName;
  }

  private generateHtmlReport(report: ComplianceReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report - ${report.framework.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 20px; margin: 20px 0; }
        .finding { border-left: 4px solid #ff6b6b; padding: 10px; margin: 10px 0; }
        .compliant { border-left-color: #51cf66; }
        .partial { border-left-color: #ffd43b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Compliance Report: ${report.framework.name}</h1>
        <p>Generated: ${report.generatedAt.toISOString()}</p>
        <p>Generated By: ${report.generatedBy}</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>Compliance Percentage: ${report.summary.compliancePercentage}%</p>
        <p>Total Requirements: ${report.summary.totalRequirements}</p>
        <p>Compliant: ${report.summary.compliant}</p>
        <p>Non-Compliant: ${report.summary.nonCompliant}</p>
        <p>Partial: ${report.summary.partial}</p>
    </div>
    
    <div class="findings">
        <h2>Findings</h2>
        ${report.findings.map(finding => `
            <div class="finding">
                <h3>${finding.title}</h3>
                <p><strong>Severity:</strong> ${finding.severity}</p>
                <p><strong>Description:</strong> ${finding.description}</p>
                <p><strong>Remediation:</strong> ${finding.remediation}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  private generateCsvData(report: ComplianceReport): string {
    const headers = ['Requirement ID', 'Title', 'Category', 'Status', 'Priority', 'Last Assessed'];
    const rows = [headers.join(',')];

    for (const requirement of report.framework.requirements) {
      const row = [
        requirement.id,
        `"${requirement.title}"`,
        requirement.category,
        requirement.status || 'unknown',
        requirement.priority,
        requirement.lastAssessed?.toISOString() || ''
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private getImpactDescription(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'High risk to organization security and compliance';
      case 'high':
        return 'Significant risk to security posture';
      case 'medium':
        return 'Moderate risk that should be addressed';
      case 'low':
        return 'Low risk with minimal impact';
      default:
        return 'Unknown impact';
    }
  }

  private getRemediationSuggestion(requirement: ComplianceRequirement): string {
    const nonImplementedControls = requirement.controls.filter(
      control => control.status !== 'implemented'
    );

    if (nonImplementedControls.length > 0) {
      return `Implement missing controls: ${nonImplementedControls.map(c => c.id).join(', ')}`;
    }

    return 'Review and update existing controls to ensure full compliance';
  }
}