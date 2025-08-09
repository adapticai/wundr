#!/usr/bin/env ts-node

/**
 * I18n Maintenance Script
 * 
 * This script helps maintain translations and provides utilities for:
 * - Validating translation completeness
 * - Finding missing translations
 * - Generating translation reports
 * - Syncing translation keys
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

interface TranslationReport {
  locale: string;
  totalKeys: number;
  missingKeys: string[];
  completeness: number;
  lastUpdated: Date;
}

interface I18nMaintenanceOptions {
  sourceLocale: string;
  targetLocales: string[];
  i18nDir: string;
  docsDir: string;
}

class I18nMaintenance {
  private options: I18nMaintenanceOptions;

  constructor() {
    this.options = {
      sourceLocale: 'en',
      targetLocales: ['es', 'fr', 'de'],
      i18nDir: path.resolve(__dirname, '../i18n'),
      docsDir: path.resolve(__dirname, '../docs'),
    };
  }

  async generateReport(): Promise<void> {
    console.log('🔍 Generating i18n maintenance report...');

    const reports: TranslationReport[] = [];
    
    for (const locale of this.options.targetLocales) {
      const report = await this.analyzeLocale(locale);
      reports.push(report);
    }

    await this.writeReport(reports);
    this.displaySummary(reports);
  }

  private async analyzeLocale(locale: string): Promise<TranslationReport> {
    const localeDir = path.join(this.options.i18nDir, locale);
    
    if (!await fs.pathExists(localeDir)) {
      return {
        locale,
        totalKeys: 0,
        missingKeys: [],
        completeness: 0,
        lastUpdated: new Date(),
      };
    }

    const sourceKeys = await this.getSourceKeys();
    const localeKeys = await this.getLocaleKeys(locale);
    
    const missingKeys = sourceKeys.filter(key => !localeKeys.includes(key));
    const completeness = ((sourceKeys.length - missingKeys.length) / sourceKeys.length) * 100;
    
    const stats = await fs.stat(localeDir);
    
    return {
      locale,
      totalKeys: localeKeys.length,
      missingKeys,
      completeness: Math.round(completeness * 100) / 100,
      lastUpdated: stats.mtime,
    };
  }

  private async getSourceKeys(): Promise<string[]> {
    const keys: string[] = [];
    
    // Get keys from English locale (reference)
    const enDir = path.join(this.options.i18nDir, 'en');
    if (await fs.pathExists(enDir)) {
      const jsonFiles = await glob(`${enDir}/**/*.json`);
      for (const file of jsonFiles) {
        const content = await fs.readJSON(file);
        keys.push(...Object.keys(content));
      }
    }
    
    // Also extract keys from source markdown files
    const mdFiles = await glob(`${this.options.docsDir}/**/*.md`);
    for (const file of mdFiles) {
      const content = await fs.readFile(file, 'utf-8');
      // Extract translatable strings (basic implementation)
      const matches = content.match(/^#+ .+$/gm) || [];
      keys.push(...matches.map(match => `heading.${match.replace(/^#+\s*/, '').toLowerCase().replace(/\s+/g, '-')}`));
    }
    
    return [...new Set(keys)];
  }

  private async getLocaleKeys(locale: string): Promise<string[]> {
    const keys: string[] = [];
    const localeDir = path.join(this.options.i18nDir, locale);
    
    if (!await fs.pathExists(localeDir)) {
      return keys;
    }
    
    const jsonFiles = await glob(`${localeDir}/**/*.json`);
    for (const file of jsonFiles) {
      try {
        const content = await fs.readJSON(file);
        keys.push(...Object.keys(content));
      } catch (error) {
        console.warn(`Failed to read ${file}:`, error);
      }
    }
    
    return [...new Set(keys)];
  }

  private async writeReport(reports: TranslationReport[]): Promise<void> {
    const reportDir = path.join(this.options.i18nDir, 'reports');
    await fs.ensureDir(reportDir);
    
    const reportFile = path.join(reportDir, `maintenance-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeJSON(reportFile, {
      generatedAt: new Date().toISOString(),
      reports,
      summary: {
        totalLocales: reports.length,
        averageCompleteness: reports.reduce((sum, r) => sum + r.completeness, 0) / reports.length,
        localesNeedingWork: reports.filter(r => r.completeness < 90).length,
      },
    }, { spaces: 2 });

    // Also generate markdown report
    const markdownReport = this.generateMarkdownReport(reports);
    const mdReportFile = path.join(reportDir, `maintenance-${new Date().toISOString().split('T')[0]}.md`);
    await fs.writeFile(mdReportFile, markdownReport);
    
    console.log(`📄 Reports written to ${reportDir}`);
  }

  private generateMarkdownReport(reports: TranslationReport[]): string {
    const date = new Date().toLocaleDateString();
    
    let markdown = `# I18n Maintenance Report - ${date}\n\n`;
    markdown += `Generated on ${new Date().toISOString()}\n\n`;
    
    // Summary table
    markdown += `## Summary\n\n`;
    markdown += `| Locale | Completeness | Total Keys | Missing Keys | Last Updated |\n`;
    markdown += `|--------|-------------|------------|--------------|-------------|\n`;
    
    reports.forEach(report => {
      const completenessBar = '█'.repeat(Math.floor(report.completeness / 10)) + 
                              '░'.repeat(10 - Math.floor(report.completeness / 10));
      markdown += `| ${report.locale.toUpperCase()} | ${completenessBar} ${report.completeness}% | ${report.totalKeys} | ${report.missingKeys.length} | ${report.lastUpdated.toLocaleDateString()} |\n`;
    });
    
    markdown += `\n`;
    
    // Missing keys details
    reports.forEach(report => {
      if (report.missingKeys.length > 0) {
        markdown += `## Missing Keys - ${report.locale.toUpperCase()}\n\n`;
        markdown += `The following keys are missing from the ${report.locale} locale:\n\n`;
        report.missingKeys.forEach(key => {
          markdown += `- \`${key}\`\n`;
        });
        markdown += `\n`;
      }
    });
    
    // Recommendations
    markdown += `## Recommendations\n\n`;
    const needsWork = reports.filter(r => r.completeness < 90);
    
    if (needsWork.length > 0) {
      markdown += `### High Priority\n\n`;
      needsWork.forEach(report => {
        markdown += `- **${report.locale.toUpperCase()}**: ${report.missingKeys.length} missing translations (${report.completeness}% complete)\n`;
      });
      markdown += `\n`;
    } else {
      markdown += `All locales are well-maintained (>90% complete). Great job! 🎉\n\n`;
    }
    
    markdown += `### Maintenance Tasks\n\n`;
    markdown += `1. Review and translate missing keys for priority locales\n`;
    markdown += `2. Test translated content for accuracy and context\n`;
    markdown += `3. Update translation files with new content\n`;
    markdown += `4. Run \`npm run build\` to verify translations work correctly\n`;
    markdown += `\n`;
    
    return markdown;
  }

  private displaySummary(reports: TranslationReport[]): void {
    console.log('\n📊 Translation Status Summary:');
    console.log('================================');
    
    reports.forEach(report => {
      const statusIcon = report.completeness >= 90 ? '✅' : 
                        report.completeness >= 70 ? '⚠️' : '❌';
      
      console.log(`${statusIcon} ${report.locale.toUpperCase()}: ${report.completeness}% complete (${report.missingKeys.length} missing)`);
    });
    
    const avgCompleteness = reports.reduce((sum, r) => sum + r.completeness, 0) / reports.length;
    console.log(`\n🎯 Average Completeness: ${Math.round(avgCompleteness * 100) / 100}%`);
    
    const needsWork = reports.filter(r => r.completeness < 90);
    if (needsWork.length > 0) {
      console.log(`\n⚠️  ${needsWork.length} locale(s) need attention:`);
      needsWork.forEach(report => {
        console.log(`   - ${report.locale.toUpperCase()}: ${report.missingKeys.length} missing keys`);
      });
    } else {
      console.log('\n🎉 All locales are well-maintained!');
    }
  }

  async syncTranslations(): Promise<void> {
    console.log('🔄 Syncing translation keys...');
    
    // This could be expanded to:
    // - Auto-translate missing keys using translation APIs
    // - Sync new keys from source locale to all targets
    // - Remove obsolete translation keys
    
    console.log('⚠️  Manual sync required - this feature is not yet implemented');
    console.log('   Use the maintenance report to identify missing translations');
  }

  async validate(): Promise<boolean> {
    console.log('✅ Validating translations...');
    
    let isValid = true;
    
    for (const locale of this.options.targetLocales) {
      const localeDir = path.join(this.options.i18nDir, locale);
      
      if (!await fs.pathExists(localeDir)) {
        console.log(`❌ Missing locale directory: ${locale}`);
        isValid = false;
        continue;
      }
      
      // Validate JSON files
      const jsonFiles = await glob(`${localeDir}/**/*.json`);
      for (const file of jsonFiles) {
        try {
          await fs.readJSON(file);
        } catch (error) {
          console.log(`❌ Invalid JSON in ${file}: ${error}`);
          isValid = false;
        }
      }
    }
    
    if (isValid) {
      console.log('✅ All translations are valid');
    }
    
    return isValid;
  }
}

// CLI interface
async function main() {
  const maintenance = new I18nMaintenance();
  const command = process.argv[2] || 'report';
  
  try {
    switch (command) {
      case 'report':
        await maintenance.generateReport();
        break;
      case 'sync':
        await maintenance.syncTranslations();
        break;
      case 'validate':
        const isValid = await maintenance.validate();
        process.exit(isValid ? 0 : 1);
        break;
      default:
        console.log('Usage: npm run i18n-maintenance [report|sync|validate]');
        console.log('');
        console.log('Commands:');
        console.log('  report   - Generate translation status report (default)');
        console.log('  sync     - Sync translation keys between locales');
        console.log('  validate - Validate translation files');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { I18nMaintenance };