import { Command } from 'commander';
import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import { ClaudeConfigGenerator } from '../../claude-generator/claude-config-generator.js';

interface AuditOptions {
  detailed?: boolean;
  json?: boolean;
  output?: string;
  fix?: boolean;
}

export function createClaudeAuditCommand(): Command {
  const command = new Command('claude-audit');
  
  command
    .description('Audit repository for Claude Code compatibility and quality')
    .option('-d, --detailed', 'Show detailed analysis of each category')
    .option('-j, --json', 'Output results in JSON format')
    .option('-o, --output <file>', 'Save audit results to file')
    .option('--fix', 'Show specific fix recommendations for each issue')
    .argument('[path]', 'Path to repository (defaults to current directory)', '.')
    .action(async (path: string, options: AuditOptions) => {
      const spinner = ora('Auditing repository...').start();
      
      try {
        const repoPath = resolve(path);
        const generator = new ClaudeConfigGenerator(repoPath);

        // Perform comprehensive audit
        spinner.text = 'Analyzing project structure...';
        const auditResult = await generator.auditRepository();
        
        spinner.text = 'Generating configuration analysis...';
        const config = await generator.generateConfig();

        spinner.stop();

        if (options.json) {
          const jsonResult = {
            timestamp: new Date().toISOString(),
            repository: repoPath,
            score: auditResult.score,
            projectType: config.projectType,
            issues: auditResult.issues,
            recommendations: auditResult.recommendations,
            structure: auditResult.structure,
            quality: auditResult.quality,
            config
          };

          const jsonOutput = JSON.stringify(jsonResult, null, 2);
          
          if (options.output) {
            writeFileSync(options.output, jsonOutput);
            console.log(chalk.green(`✅ Audit results saved to ${options.output}`));
          } else {
            console.log(jsonOutput);
          }
          return;
        }

        // Display comprehensive audit results
        console.log(chalk.blue('\n📊 Claude Code Repository Audit'));
        console.log(chalk.blue('=================================='));
        console.log(`${chalk.green('Repository:')} ${repoPath}`);
        console.log(`${chalk.green('Project Type:')} ${config.projectType}`);
        console.log(`${chalk.green('Overall Score:')} ${getScoreColor(auditResult.score)}${auditResult.score}/100`);
        console.log(`${chalk.green('Timestamp:')} ${new Date().toLocaleString()}`);

        // Score interpretation
        console.log(`\n${getScoreInterpretation(auditResult.score)}`);

        // Project structure summary
        if (options.detailed) {
          console.log(chalk.blue('\n📁 Project Structure Analysis'));
          console.log('================================');
          console.log(`${chalk.green('Package.json:')} ${auditResult.structure.hasPackageJson ? '✅' : '❌'}`);
          console.log(`${chalk.green('TypeScript:')} ${auditResult.structure.hasTsConfig ? '✅' : '❌'}`);
          console.log(`${chalk.green('Tests:')} ${auditResult.structure.hasTests ? '✅' : '❌'}`);
          console.log(`${chalk.green('Documentation:')} ${auditResult.structure.hasDocumentation ? '✅' : '❌'}`);
          console.log(`${chalk.green('CI/CD:')} ${auditResult.structure.hasCI ? '✅' : '❌'}`);
          
          if (auditResult.structure.frameworks.length > 0) {
            console.log(`${chalk.green('Frameworks:')} ${auditResult.structure.frameworks.join(', ')}`);
          }
          
          if (auditResult.structure.buildTools.length > 0) {
            console.log(`${chalk.green('Build Tools:')} ${auditResult.structure.buildTools.join(', ')}`);
          }
        }

        // Quality standards summary
        if (options.detailed) {
          console.log(chalk.blue('\n🛡️ Quality Standards Analysis'));
          console.log('=================================');
          console.log(`${chalk.green('Linting:')} ${auditResult.quality.linting.enabled ? '✅' : '❌'}`);
          console.log(`${chalk.green('Type Checking:')} ${auditResult.quality.typeChecking.enabled ? '✅' : '❌'}`);
          console.log(`${chalk.green('Testing:')} ${auditResult.quality.testing.enabled ? '✅' : '❌'}`);
          console.log(`${chalk.green('Formatting:')} ${auditResult.quality.formatting.enabled ? '✅' : '❌'}`);
          console.log(`${chalk.green('Pre-commit Hooks:')} ${auditResult.quality.preCommitHooks.enabled ? '✅' : '❌'}`);
          
          if (auditResult.quality.testing.frameworks.length > 0) {
            console.log(`${chalk.green('Test Frameworks:')} ${auditResult.quality.testing.frameworks.join(', ')}`);
          }
        }

        // Issues breakdown
        if (auditResult.issues.length > 0) {
          console.log(chalk.yellow('\n⚠️  Issues Found'));
          console.log('==================');
          
          const issuesByCategory = groupIssuesByCategory(auditResult.issues);
          const issuesBySeverity = groupIssuesBySeverity(auditResult.issues);

          console.log(`${chalk.red('Errors:')} ${issuesBySeverity.error?.length || 0}`);
          console.log(`${chalk.yellow('Warnings:')} ${issuesBySeverity.warning?.length || 0}`);
          console.log(`${chalk.blue('Info:')} ${issuesBySeverity.info?.length || 0}`);

          for (const [category, issues] of Object.entries(issuesByCategory)) {
            console.log(chalk.cyan(`\n${category.toUpperCase()} (${issues.length} issues):`));
            
            issues.forEach(issue => {
              const severityIcon = getSeverityIcon(issue.severity);
              console.log(`  ${severityIcon} ${issue.message}`);
              
              if (options.fix && issue.fix) {
                console.log(`    ${chalk.gray('💡 Fix:')} ${issue.fix}`);
              }
            });
          }
        } else {
          console.log(chalk.green('\n✅ No issues found!'));
        }

        // Recommendations
        if (auditResult.recommendations.length > 0) {
          console.log(chalk.green('\n💡 Recommendations'));
          console.log('====================');
          auditResult.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
          });
        }

        // Agent configuration preview
        if (options.detailed) {
          console.log(chalk.blue('\n🤖 Recommended Agent Configuration'));
          console.log('====================================');
          console.log(`${chalk.green('Topology:')} ${config.agentConfiguration.swarmTopology}`);
          console.log(`${chalk.green('Max Agents:')} ${config.agentConfiguration.maxAgents}`);
          console.log(`${chalk.green('Total Agents:')} ${config.agentConfiguration.agents.length}`);
          
          const specializedAgents = config.agentConfiguration.specializedAgents[config.projectType] || [];
          if (specializedAgents.length > 0) {
            console.log(`${chalk.green('Specialized:')} ${specializedAgents.join(', ')}`);
          }
        }

        // MCP tools preview
        if (options.detailed) {
          console.log(chalk.blue('\n🔧 Recommended MCP Tools'));
          console.log('==========================');
          config.mcpTools.tools.forEach(tool => {
            console.log(`  ✅ ${chalk.green(tool.name)} - ${tool.description}`);
          });
        }

        // Save to file if requested
        if (options.output && !options.json) {
          const reportContent = generateTextReport(auditResult, config);
          writeFileSync(options.output, reportContent);
          console.log(chalk.green(`\n✅ Detailed report saved to ${options.output}`));
        }

        // Next steps
        console.log(chalk.yellow('\n📋 Next Steps'));
        console.log('================');
        
        if (auditResult.score < 70) {
          console.log('1. 🚨 Fix critical issues first (errors and warnings)');
          console.log('2. 🛠️  Implement recommended quality tools');
          console.log('3. 📝 Add missing documentation and tests');
          console.log('4. 🔄 Re-run audit to track improvements');
        } else if (auditResult.score < 90) {
          console.log('1. 🔧 Address remaining warnings');
          console.log('2. 📈 Implement additional recommendations');
          console.log('3. 🤖 Initialize Claude Code with: wundr claude-init');
        } else {
          console.log('1. 🎉 Great job! Your repository is well-configured');
          console.log('2. 🚀 Initialize Claude Code with: wundr claude-init');
          console.log('3. 🔄 Run periodic audits to maintain quality');
        }

      } catch (error) {
        spinner.stop();
        console.error(chalk.red('❌ Error during repository audit:'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}

function getScoreColor(score: number): string {
  if (score >= 90) return chalk.green;
  if (score >= 70) return chalk.yellow;
  return chalk.red;
}

function getScoreInterpretation(score: number): string {
  if (score >= 90) {
    return chalk.green('🎉 Excellent! Your repository meets high quality standards.');
  } else if (score >= 70) {
    return chalk.yellow('👍 Good foundation with room for improvement.');
  } else if (score >= 50) {
    return chalk.yellow('⚠️  Needs attention - several issues to address.');
  } else {
    return chalk.red('🚨 Requires significant improvements for optimal Claude Code usage.');
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error': return chalk.red('🚨');
    case 'warning': return chalk.yellow('⚠️');
    case 'info': return chalk.blue('ℹ️');
    default: return '•';
  }
}

function groupIssuesByCategory(issues: any[]): Record<string, any[]> {
  return issues.reduce((groups, issue) => {
    const category = issue.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(issue);
    return groups;
  }, {});
}

function groupIssuesBySeverity(issues: any[]): Record<string, any[]> {
  return issues.reduce((groups, issue) => {
    const severity = issue.severity;
    if (!groups[severity]) {
      groups[severity] = [];
    }
    groups[severity].push(issue);
    return groups;
  }, {});
}

function generateTextReport(auditResult: any, config: any): string {
  const lines = [
    'Claude Code Repository Audit Report',
    '===================================',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    `Repository: ${process.cwd()}`,
    `Project Type: ${config.projectType}`,
    `Overall Score: ${auditResult.score}/100`,
    '',
    '## Summary',
    getScoreInterpretation(auditResult.score).replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, ''),
    '',
    '## Issues',
    ...auditResult.issues.map((issue: any) => 
      `- [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.message}`
    ),
    '',
    '## Recommendations',
    ...auditResult.recommendations.map((rec: string, i: number) => `${i + 1}. ${rec}`),
    '',
    '## Configuration Preview',
    `Swarm Topology: ${config.agentConfiguration.swarmTopology}`,
    `Max Agents: ${config.agentConfiguration.maxAgents}`,
    `MCP Tools: ${config.mcpTools.tools.length} available`
  ];

  return lines.join('\n');
}