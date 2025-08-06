'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigSection } from '@/components/config/config-section';
import { ConfigToggle } from '@/components/config/config-toggle';
import { ConfigInput } from '@/components/config/config-input';
import { ConfigSelect } from '@/components/config/config-select';
import { ConfigList } from '@/components/config/config-list';
import { ConfigTemplates } from '@/components/config/config-templates';
import { ConfigActions } from '@/components/config/config-actions';
import { useConfigSection } from '@/hooks/config/use-config';
import { 
  Settings,
  BarChart3,
  Zap,
  Download,
  Palette
} from 'lucide-react';

function GeneralSettings() {
  const { config, updateConfig, resetSection, errors, hasErrors } = useConfigSection('general');

  const themeOptions = [
    { value: 'light', label: 'Light', description: 'Light theme' },
    { value: 'dark', label: 'Dark', description: 'Dark theme' },
    { value: 'system', label: 'System', description: 'Follow system preference' },
  ];

  const languageOptions = [
    { value: 'en', label: 'English', description: 'English (US)' },
    { value: 'es', label: 'Español', description: 'Spanish' },
    { value: 'fr', label: 'Français', description: 'French' },
    { value: 'de', label: 'Deutsch', description: 'German' },
    { value: 'zh', label: '中文', description: 'Chinese (Simplified)' },
  ];

  return (
    <ConfigSection
      title="General Settings"
      description="Basic application preferences and interface settings"
      onReset={resetSection}
      hasErrors={hasErrors}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConfigSelect
          label="Theme"
          description="Choose your preferred color theme"
          value={config.theme}
          onChange={(value) => updateConfig({ theme: value as 'light' | 'dark' | 'system' })}
          options={themeOptions}
          error={errors.theme}
        />

        <ConfigSelect
          label="Language"
          description="Select your preferred language"
          value={config.language}
          onChange={(value) => updateConfig({ language: value })}
          options={languageOptions}
          error={errors.language}
        />

        <ConfigToggle
          label="Auto Save"
          description="Automatically save changes as you make them"
          checked={config.autoSave}
          onChange={(checked) => updateConfig({ autoSave: checked })}
          error={errors.autoSave}
        />

        <ConfigToggle
          label="Notifications"
          description="Show desktop notifications for important events"
          checked={config.notifications}
          onChange={(checked) => updateConfig({ notifications: checked })}
          error={errors.notifications}
        />

        <ConfigToggle
          label="Compact Mode"
          description="Use a more compact interface with reduced spacing"
          checked={config.compactMode}
          onChange={(checked) => updateConfig({ compactMode: checked })}
          error={errors.compactMode}
        />

        <ConfigToggle
          label="Collapsed Sidebar"
          description="Start with the sidebar collapsed by default"
          checked={config.sidebarCollapsed}
          onChange={(checked) => updateConfig({ sidebarCollapsed: checked })}
          error={errors.sidebarCollapsed}
        />
      </div>
    </ConfigSection>
  );
}

function AnalysisSettings() {
  const { config, updateConfig, resetSection, errors, hasErrors } = useConfigSection('analysis');

  const analysisDepthOptions = [
    { value: 'shallow', label: 'Shallow', description: 'Fast analysis with basic detection' },
    { value: 'medium', label: 'Medium', description: 'Balanced analysis with good coverage' },
    { value: 'deep', label: 'Deep', description: 'Thorough analysis with detailed insights' },
  ];

  const commonFileTypes = [
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.java', '.cs', '.go', '.rs',
    '.php', '.rb', '.swift', '.kt', '.dart', '.cpp', '.c', '.h', '.hpp'
  ];

  return (
    <ConfigSection
      title="Analysis Settings"
      description="Configure how code analysis and duplicate detection works"
      onReset={resetSection}
      hasErrors={hasErrors}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigInput
            label="Duplicate Threshold"
            description="Similarity threshold for duplicate detection (0.0 - 1.0)"
            value={config.duplicateThreshold}
            onChange={(value) => updateConfig({ duplicateThreshold: parseFloat(value) || 0 })}
            type="number"
            min={0}
            max={1}
            step={0.01}
            error={errors.duplicateThreshold}
          />

          <ConfigInput
            label="Complexity Threshold"
            description="Maximum cyclomatic complexity before flagging"
            value={config.complexityThreshold}
            onChange={(value) => updateConfig({ complexityThreshold: parseInt(value) || 0 })}
            type="number"
            min={1}
            max={100}
            error={errors.complexityThreshold}
          />

          <ConfigInput
            label="Minimum File Size"
            description="Minimum file size in bytes to analyze"
            value={config.minFileSize}
            onChange={(value) => updateConfig({ minFileSize: parseInt(value) || 0 })}
            type="number"
            min={0}
            error={errors.minFileSize}
          />

          <ConfigSelect
            label="Analysis Depth"
            description="Choose how thorough the analysis should be"
            value={config.analysisDepth}
            onChange={(value) => updateConfig({ analysisDepth: value as 'shallow' | 'medium' | 'deep' })}
            options={analysisDepthOptions}
            error={errors.analysisDepth}
          />
        </div>

        <ConfigToggle
          label="Smart Analysis"
          description="Use AI-powered analysis for better accuracy"
          checked={config.enableSmartAnalysis}
          onChange={(checked) => updateConfig({ enableSmartAnalysis: checked })}
          error={errors.enableSmartAnalysis}
        />

        <ConfigList
          label="Patterns to Ignore"
          description="Glob patterns for files and directories to exclude from analysis"
          items={config.patternsToIgnore}
          onChange={(items) => updateConfig({ patternsToIgnore: items })}
          placeholder="e.g., node_modules/**, *.test.*, dist/**"
          error={errors.patternsToIgnore}
        />

        <ConfigList
          label="Exclude Directories"
          description="Directory names to exclude from analysis"
          items={config.excludeDirectories}
          onChange={(items) => updateConfig({ excludeDirectories: items })}
          placeholder="e.g., node_modules, dist, build"
          error={errors.excludeDirectories}
        />

        <ConfigList
          label="Include File Types"
          description="File extensions to include in analysis"
          items={config.includeFileTypes}
          onChange={(items) => updateConfig({ includeFileTypes: items })}
          placeholder="e.g., .ts, .tsx, .js"
          error={errors.includeFileTypes}
        />

        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-2">Common file types:</p>
          <div className="flex flex-wrap gap-1">
            {commonFileTypes.map((type) => (
              <button
                key={type}
                type="button"
                className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80"
                onClick={() => {
                  if (!config.includeFileTypes.includes(type)) {
                    updateConfig({ includeFileTypes: [...config.includeFileTypes, type] });
                  }
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ConfigSection>
  );
}

function IntegrationSettings() {
  const { config, updateConfig, resetSection, errors, hasErrors } = useConfigSection('integration');

  return (
    <ConfigSection
      title="Integration Settings"
      description="Configure webhooks, API keys, and external service integrations"
      onReset={resetSection}
      hasErrors={hasErrors}
    >
      <div className="space-y-6">
        <div>
          <h4 className="font-medium mb-4">Webhook URLs</h4>
          <div className="space-y-4">
            <ConfigInput
              label="Analysis Complete Webhook"
              description="URL to call when analysis is complete"
              value={config.webhookUrls.onAnalysisComplete}
              onChange={(value) => updateConfig({ 
                webhookUrls: { ...config.webhookUrls, onAnalysisComplete: value }
              })}
              type="url"
              placeholder="https://your-api.com/webhooks/analysis-complete"
              error={errors['webhookUrls.onAnalysisComplete']}
            />

            <ConfigInput
              label="Report Generated Webhook"
              description="URL to call when a report is generated"
              value={config.webhookUrls.onReportGenerated}
              onChange={(value) => updateConfig({ 
                webhookUrls: { ...config.webhookUrls, onReportGenerated: value }
              })}
              type="url"
              placeholder="https://your-api.com/webhooks/report-generated"
              error={errors['webhookUrls.onReportGenerated']}
            />

            <ConfigInput
              label="Error Webhook"
              description="URL to call when errors occur"
              value={config.webhookUrls.onError}
              onChange={(value) => updateConfig({ 
                webhookUrls: { ...config.webhookUrls, onError: value }
              })}
              type="url"
              placeholder="https://your-api.com/webhooks/error"
              error={errors['webhookUrls.onError']}
            />
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-4">API Keys</h4>
          <div className="space-y-4">
            <ConfigInput
              label="GitHub API Key"
              description="Personal access token for GitHub integration"
              value={config.apiKeys.github}
              onChange={(value) => updateConfig({ 
                apiKeys: { ...config.apiKeys, github: value }
              })}
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              error={errors['apiKeys.github']}
            />

            <ConfigInput
              label="Slack API Key"
              description="Bot token for Slack notifications"
              value={config.apiKeys.slack}
              onChange={(value) => updateConfig({ 
                apiKeys: { ...config.apiKeys, slack: value }
              })}
              type="password"
              placeholder="xoxb-xxxxxxxxxxxxxxxxxxxx"
              error={errors['apiKeys.slack']}
            />

            <ConfigInput
              label="Jira API Key"
              description="API token for Jira integration"
              value={config.apiKeys.jira}
              onChange={(value) => updateConfig({ 
                apiKeys: { ...config.apiKeys, jira: value }
              })}
              type="password"
              placeholder="ATATTxxxxxxxxxxxxxxxxxxx"
              error={errors['apiKeys.jira']}
            />
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-4">Automation Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigToggle
              label="Auto Upload"
              description="Automatically upload reports to configured services"
              checked={config.automations.autoUpload}
              onChange={(checked) => updateConfig({ 
                automations: { ...config.automations, autoUpload: checked }
              })}
              error={errors['automations.autoUpload']}
            />

            <ConfigToggle
              label="Schedule Analysis"
              description="Enable scheduled analysis runs"
              checked={config.automations.scheduleAnalysis}
              onChange={(checked) => updateConfig({ 
                automations: { ...config.automations, scheduleAnalysis: checked }
              })}
              error={errors['automations.scheduleAnalysis']}
            />

            <ConfigToggle
              label="Notify on Completion"
              description="Send notifications when analysis completes"
              checked={config.automations.notifyOnCompletion}
              onChange={(checked) => updateConfig({ 
                automations: { ...config.automations, notifyOnCompletion: checked }
              })}
              error={errors['automations.notifyOnCompletion']}
            />
          </div>
        </div>
      </div>
    </ConfigSection>
  );
}

function ExportSettings() {
  const { config, updateConfig, resetSection, errors, hasErrors } = useConfigSection('export');

  const formatOptions = [
    { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
    { value: 'csv', label: 'CSV', description: 'Comma Separated Values' },
    { value: 'html', label: 'HTML', description: 'Interactive HTML report' },
    { value: 'pdf', label: 'PDF', description: 'Portable Document Format' },
  ];

  return (
    <ConfigSection
      title="Export Settings"
      description="Configure default export formats and output options"
      onReset={resetSection}
      hasErrors={hasErrors}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigInput
            label="Default Export Path"
            description="Default directory for exported reports"
            value={config.defaultPath}
            onChange={(value) => updateConfig({ defaultPath: value })}
            placeholder="./reports"
            error={errors.defaultPath}
          />

          <ConfigInput
            label="Maximum File Size (MB)"
            description="Maximum size for exported files in megabytes"
            value={config.maxFileSize}
            onChange={(value) => updateConfig({ maxFileSize: parseInt(value) || 0 })}
            type="number"
            min={1}
            max={1000}
            error={errors.maxFileSize}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConfigToggle
            label="Include Metadata"
            description="Include analysis metadata in exports"
            checked={config.includeMetadata}
            onChange={(checked) => updateConfig({ includeMetadata: checked })}
            error={errors.includeMetadata}
          />

          <ConfigToggle
            label="Enable Compression"
            description="Compress exported files to reduce size"
            checked={config.compressionEnabled}
            onChange={(checked) => updateConfig({ compressionEnabled: checked })}
            error={errors.compressionEnabled}
          />

          <ConfigToggle
            label="Timestamp Files"
            description="Add timestamps to exported file names"
            checked={config.timestampFiles}
            onChange={(checked) => updateConfig({ timestampFiles: checked })}
            error={errors.timestampFiles}
          />
        </div>

        <div>
          <h4 className="font-medium mb-4">Default Export Formats</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {formatOptions.map((format) => (
              <div key={format.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`format-${format.value}`}
                  checked={config.defaultFormats.includes(format.value as 'json' | 'csv' | 'html' | 'pdf')}
                  onChange={(e) => {
                    const formats = e.target.checked
                      ? [...config.defaultFormats, format.value as 'json' | 'csv' | 'html' | 'pdf']
                      : config.defaultFormats.filter(f => f !== format.value);
                    updateConfig({ defaultFormats: formats });
                  }}
                  className="rounded border-gray-300"
                />
                <label 
                  htmlFor={`format-${format.value}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {format.label}
                </label>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Select which formats to include by default when exporting reports
          </p>
        </div>
      </div>
    </ConfigSection>
  );
}

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your dashboard preferences and analysis settings
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Integration
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <GeneralSettings />
          <ConfigActions />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <AnalysisSettings />
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          <IntegrationSettings />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <ExportSettings />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <ConfigTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}