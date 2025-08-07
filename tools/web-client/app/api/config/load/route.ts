import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configDir = path.join(process.cwd(), '.wundr');
    const configFile = path.join(configDir, 'config.json');

    // Check if config file exists
    try {
      await fs.access(configFile);
      const configData = await fs.readFile(configFile, 'utf8');
      const config = JSON.parse(configData);
      return NextResponse.json(config);
    } catch (error) {
      // Return default configuration if file doesn't exist
      const defaultConfig = {
        general: {
          theme: 'system',
          language: 'en',
          autoSave: true,
          notifications: true,
          compactMode: false,
          sidebarCollapsed: false,
        },
        analysis: {
          patternsToIgnore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
          duplicateThreshold: 0.8,
          complexityThreshold: 10,
          minFileSize: 100,
          excludeDirectories: ['node_modules', 'dist', 'build', '.git', 'coverage'],
          includeFileTypes: ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.java'],
          enableSmartAnalysis: false,
          analysisDepth: 'medium',
        },
        integration: {
          webhookUrls: {
            onAnalysisComplete: '',
            onReportGenerated: '',
            onError: '',
          },
          apiKeys: {
            github: '',
            slack: '',
            jira: '',
          },
          automations: {
            autoUpload: false,
            scheduleAnalysis: false,
            notifyOnCompletion: false,
          },
        },
        export: {
          defaultFormats: ['json', 'html'],
          defaultPath: './wundr-reports',
          includeMetadata: true,
          compressionEnabled: false,
          timestampFiles: true,
          maxFileSize: 50,
        },
      };
      return NextResponse.json(defaultConfig);
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}