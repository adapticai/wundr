import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface DriftDetectionArgs {
  action: 'create-baseline' | 'detect' | 'list-baselines' | 'trends';
  baselineVersion?: string;
}

export class DriftDetectionHandler {
  private scriptPath: string;

  constructor() {
    // Path to the actual drift-detection script
    this.scriptPath = path.resolve(
      process.cwd(),
      'scripts/governance/drift-detection.ts'
    );
  }

  async execute(args: DriftDetectionArgs): Promise<string> {
    const { action, baselineVersion } = args;

    // Validate script exists
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(
        `Drift detection script not found at: ${this.scriptPath}`
      );
    }

    try {
      let command = `npx ts-node ${this.scriptPath} ${action}`;

      if (baselineVersion && action === 'detect') {
        command += ` ${baselineVersion}`;
      }

      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      // Parse and format the output based on action
      switch (action) {
        case 'create-baseline':
          return this.formatBaselineCreation(output);

        case 'detect':
          return this.formatDriftDetection(output);

        case 'list-baselines':
          return this.formatBaselineList(output);

        case 'trends':
          return this.formatTrends(output);

        default:
          return output;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Drift detection failed: ${error.message}`);
      }
      throw error;
    }
  }

  private formatBaselineCreation(output: string): string {
    const lines = output.split('\n');
    const baselineInfo = lines.find(line => line.includes('Baseline created:'));

    if (baselineInfo) {
      const match = baselineInfo.match(/baseline-(.+)\.json/);
      const version = match ? match[1] : 'unknown';

      return JSON.stringify(
        {
          success: true,
          action: 'create-baseline',
          version,
          message: 'Baseline created successfully',
          details: output,
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        success: false,
        action: 'create-baseline',
        error: 'Failed to create baseline',
        details: output,
      },
      null,
      2
    );
  }

  private formatDriftDetection(output: string): string {
    const severityMatch = output.match(/Severity: (\w+)/);
    const severity = severityMatch ? severityMatch[1].toLowerCase() : 'unknown';

    // Extract recommendations
    const recommendationsStart = output.indexOf('Recommendations:');
    const recommendations: string[] = [];

    if (recommendationsStart !== -1) {
      const recSection = output.substring(recommendationsStart);
      const recLines = recSection.split('\n').slice(1);

      for (const line of recLines) {
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          recommendations.push(line.trim().substring(1).trim());
        } else if (!line.trim()) {
          break;
        }
      }
    }

    // Check if drift report was saved
    const reportMatch = output.match(/Drift report saved: (.+)/);
    const reportPath = reportMatch ? reportMatch[1] : null;

    return JSON.stringify(
      {
        success: true,
        action: 'detect',
        severity,
        recommendations,
        reportPath,
        summary: `Drift detection completed with ${severity} severity`,
        details: output,
      },
      null,
      2
    );
  }

  private formatBaselineList(output: string): string {
    const baselines: Array<{
      version: string;
      timestamp: string;
      entities: number;
    }> = [];

    const lines = output.split('\n');

    for (const line of lines) {
      // Parse lines like: "main-abc123 - 2024-01-01T00:00:00Z (150 entities)"
      const match = line.match(/^\s*(.+?)\s+-\s+(.+?)\s+\((\d+)\s+entities\)/);
      if (match) {
        baselines.push({
          version: match[1],
          timestamp: match[2],
          entities: parseInt(match[3], 10),
        });
      }
    }

    return JSON.stringify(
      {
        success: true,
        action: 'list-baselines',
        count: baselines.length,
        baselines,
        message:
          baselines.length === 0
            ? 'No baselines found. Create one with create-baseline action.'
            : `Found ${baselines.length} baseline(s)`,
      },
      null,
      2
    );
  }

  private formatTrends(output: string): string {
    // Extract trend information
    const trendData: Record<string, string> = {};

    const entityGrowth = output.match(/Entity Growth:\s+(.+)/);
    const duplicateTrend = output.match(/Duplicate Trend:\s+(.+)/);
    const complexityTrend = output.match(/Complexity Trend:\s+(.+)/);

    if (entityGrowth) trendData.entityGrowth = entityGrowth[1];
    if (duplicateTrend) trendData.duplicateTrend = duplicateTrend[1];
    if (complexityTrend) trendData.complexityTrend = complexityTrend[1];

    // Check if trend report was saved
    const reportMatch = output.match(/Trend analysis saved to (.+)/);
    const reportPath = reportMatch ? reportMatch[1] : null;

    return JSON.stringify(
      {
        success: true,
        action: 'trends',
        trends: trendData,
        reportPath,
        message: 'Trend analysis completed',
        details: output,
      },
      null,
      2
    );
  }
}
