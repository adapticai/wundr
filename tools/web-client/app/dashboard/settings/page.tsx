'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigSection } from '@/components/config/config-section';
import { ConfigToggle } from '@/components/config/config-toggle';
import { ConfigInput, ConfigNumberInput, ConfigUrlInput, ConfigPasswordInput } from '@/components/config/config-input';
import { ConfigSelect, ConfigThemeSelect, ConfigAnalysisDepthSelect } from '@/components/config/config-select';
import { ConfigList } from '@/components/config/config-list';
import { ConfigTemplates } from '@/components/config/config-templates';
import { ConfigActions } from '@/components/config/config-actions';
import { ConfigThemeColorPicker } from '@/components/config/config-color-picker';
// Removed unused import
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Settings,
  BarChart3,
  Zap,
  Download,
  Palette,
  Upload,
  Save,
  RotateCcw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Copy,
  Archive
} from 'lucide-react';
import type { ConfigurationState } from '@/types/config';
import { useConfig } from '@/lib/contexts/config/config-context';
import { templates } from '@/lib/contexts/config/config-templates';

function GeneralSettings() {
  const { config, updateConfig, resetConfig, errors } = useConfig();
  const hasErrors = Object.keys(errors).length > 0;

  const languageOptions = [
    { value: 'en', label: 'English', description: 'English (US)' },
    { value: 'es', label: 'Español', description: 'Spanish' },
    { value: 'fr', label: 'Français', description: 'French' },
    { value: 'de', label: 'Deutsch', description: 'German' },
    { value: 'zh', label: '中文', description: 'Chinese (Simplified)' },
    { value: 'ja', label: '日本語', description: 'Japanese' },
    { value: 'ko', label: '한국어', description: 'Korean' },
    { value: 'pt', label: 'Português', description: 'Portuguese' },
    { value: 'ru', label: 'Русский', description: 'Russian' },
    { value: 'ar', label: 'العربية', description: 'Arabic' },
  ];

  return (
    <ConfigSection
      title="General Settings"
      description="Basic application preferences and interface settings"
      onReset={() => resetConfig()}
      hasErrors={hasErrors}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConfigThemeSelect
          label="Theme"
          description="Choose your preferred color theme"
          value={config.theme.mode}
          onChange={(value) => updateConfig({
            theme: { ...config.theme, mode: value as 'light' | 'dark' | 'system' }
          })}
          error={errors.theme}
          section="general"
          field="theme"
        />

        <ConfigSelect
          label="Language"
          description="Select your preferred language"
          value={config.language}
          onChange={(value) => updateConfig({ language: value })}
          options={languageOptions}
          error={errors.language}
          section="general"
          field="language"
          searchable
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
          checked={config.compactMode || false}
          onChange={(checked) => updateConfig({ compactMode: checked })}
          error={errors.compactMode}
        />

        <ConfigToggle
          label="Collapsed Sidebar"
          description="Start with the sidebar collapsed by default"
          checked={config.sidebarCollapsed || false}
          onChange={(checked) => updateConfig({ sidebarCollapsed: checked })}
          error={errors.sidebarCollapsed}
        />
      </div>
    </ConfigSection>
  );
}

function AnalysisSettings() {
  const { config, updateConfig, resetConfig, errors } = useConfig();
  const hasErrors = Object.keys(errors).length > 0;

  const commonFileTypes = [
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.java', '.cs', '.go', '.rs',
    '.php', '.rb', '.swift', '.kt', '.dart', '.cpp', '.c', '.h', '.hpp', '.css', '.scss',
    '.html', '.xml', '.json', '.yaml', '.yml', '.md', '.sql'
  ];

  const commonIgnorePatterns = [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.next/**',
    'coverage/**',
    '*.test.*',
    '*.spec.*',
    '*.min.*',
    '*.bundle.*',
    '.git/**',
    'vendor/**',
    '__pycache__/**',
    '*.pyc',
    'target/**',
    'bin/**',
    'obj/**'
  ];

  return (
    <ConfigSection
      title="Analysis Settings"
      description="Configure how code analysis and duplicate detection works"
      onReset={() => resetConfig()}
      hasErrors={hasErrors}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigNumberInput
            label="Duplicate Threshold"
            description="Similarity threshold for duplicate detection (0.0 - 1.0)"
            value={config.duplicateThreshold || 80}
            onChange={(value) => updateConfig({ duplicateThreshold: parseFloat(value) || 0 })}
            min={0}
            max={1}
            step={0.01}
            error={errors.duplicateThreshold}
            section="analysis"
            field="duplicateThreshold"
          />

          <ConfigNumberInput
            label="Complexity Threshold"
            description="Maximum cyclomatic complexity before flagging"
            value={config.complexityThreshold || 10}
            onChange={(value) => updateConfig({ complexityThreshold: parseInt(value) || 0 })}
            min={1}
            max={100}
            error={errors.complexityThreshold}
            section="analysis"
            field="complexityThreshold"
          />

          <ConfigNumberInput
            label="Minimum File Size (bytes)"
            description="Minimum file size in bytes to analyze"
            value={config.minFileSize || 1000}
            onChange={(value) => updateConfig({ minFileSize: parseInt(value) || 0 })}
            min={0}
            error={errors.minFileSize}
            section="analysis"
            field="minFileSize"
          />

          <ConfigAnalysisDepthSelect
            label="Analysis Depth"
            description="Choose how thorough the analysis should be"
            value={config.analysisDepth || 'medium'}
            onChange={(value) => updateConfig({ analysisDepth: value as 'shallow' | 'medium' | 'deep' })}
            error={errors.analysisDepth}
            section="analysis"
            field="analysisDepth"
          />
        </div>

        <ConfigToggle
          label="Smart Analysis"
          description="Use AI-powered analysis for better accuracy (experimental)"
          checked={config.enableSmartAnalysis || false}
          onChange={(checked) => updateConfig({ enableSmartAnalysis: checked })}
          error={errors.enableSmartAnalysis}
        />

        <ConfigList
          label="Patterns to Ignore"
          description="Glob patterns for files and directories to exclude from analysis"
          items={config.patternsToIgnore || []}
          onChange={(items) => updateConfig({ patternsToIgnore: items })}
          placeholder="e.g., node_modules/**, *.test.*, dist/**"
          error={errors.patternsToIgnore}
        />

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Common ignore patterns:</p>
            <div className="flex flex-wrap gap-1">
              {commonIgnorePatterns.map((pattern) => (
                <button
                  key={pattern}
                  type="button"
                  className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
                  onClick={() => {
                    const patterns = config.patternsToIgnore || [];
                    if (!patterns.includes(pattern)) {
                      updateConfig({ patternsToIgnore: [...patterns, pattern] });
                    }
                  }}
                  title={`Click to add: ${pattern}`}
                >
                  + {pattern}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ConfigList
          label="Exclude Directories"
          description="Directory names to exclude from analysis"
          items={config.excludeDirectories || []}
          onChange={(items) => updateConfig({ excludeDirectories: items })}
          placeholder="e.g., node_modules, dist, build"
          error={errors.excludeDirectories}
        />

        <ConfigList
          label="Include File Types"
          description="File extensions to include in analysis"
          items={config.includeFileTypes || []}
          onChange={(items) => updateConfig({ includeFileTypes: items })}
          placeholder="e.g., .ts, .tsx, .js"
          error={errors.includeFileTypes}
        />

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Common file types:</p>
            <div className="flex flex-wrap gap-1">
              {commonFileTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
                  onClick={() => {
                    const fileTypes = config.includeFileTypes || [];
                    if (!fileTypes.includes(type)) {
                      updateConfig({ includeFileTypes: [...fileTypes, type] });
                    }
                  }}
                  title={`Click to add: ${type}`}
                >
                  + {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ConfigSection>
  );
}

function IntegrationSettings() {
  const { config, updateConfig, resetConfig, errors } = useConfig();
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <ConfigSection
      title="Integration Settings"
      description="Configure webhooks, API keys, and external service integrations"
      onReset={() => resetConfig()}
      hasErrors={hasErrors}
    >
      <div className="space-y-6">
        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Webhook URLs
          </h4>
          <div className="space-y-4">
            <ConfigUrlInput
              label="Analysis Complete Webhook"
              description="URL to call when analysis is complete"
              value={config.webhookUrls?.onAnalysisComplete || ''}
              onChange={(value) => updateConfig({ 
                webhookUrls: { ...config.webhookUrls, onAnalysisComplete: value }
              })}
              placeholder="https://your-api.com/webhooks/analysis-complete"
              error={errors['webhookUrls.onAnalysisComplete']}
              section="integration"
              field="webhookUrls.onAnalysisComplete"
            />

            <ConfigUrlInput
              label="Report Generated Webhook"
              description="URL to call when a report is generated"
              value={config.webhookUrls?.onReportGenerated || ''}
              onChange={(value) => updateConfig({ 
                webhookUrls: { ...config.webhookUrls, onReportGenerated: value }
              })}
              placeholder="https://your-api.com/webhooks/report-generated"
              error={errors['webhookUrls.onReportGenerated']}
              section="integration"
              field="webhookUrls.onReportGenerated"
            />

            <ConfigUrlInput
              label="Error Webhook"
              description="URL to call when errors occur"
              value={config.webhookUrls?.onError || ''}
              onChange={(value) => updateConfig({ 
                webhookUrls: { ...config.webhookUrls, onError: value }
              })}
              placeholder="https://your-api.com/webhooks/error"
              error={errors['webhookUrls.onError']}
              section="integration"
              field="webhookUrls.onError"
            />
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            API Keys
          </h4>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              API keys are stored securely and encrypted. They are only used for authorized integrations.
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <ConfigPasswordInput
              label="GitHub API Key"
              description="Personal access token for GitHub integration"
              value={config.apiKeys?.github || ''}
              onChange={(value) => updateConfig({ 
                apiKeys: { ...config.apiKeys, github: value }
              })}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              error={errors['apiKeys.github']}
              section="integration"
              field="apiKeys.github"
            />

            <ConfigPasswordInput
              label="Slack API Key"
              description="Bot token for Slack notifications"
              value={config.apiKeys?.slack || ''}
              onChange={(value) => updateConfig({ 
                apiKeys: { ...config.apiKeys, slack: value }
              })}
              placeholder="xoxb-xxxxxxxxxxxxxxxxxxxx"
              error={errors['apiKeys.slack']}
              section="integration"
              field="apiKeys.slack"
            />

            <ConfigPasswordInput
              label="Jira API Key"
              description="API token for Jira integration"
              value={config.apiKeys?.jira || ''}
              onChange={(value) => updateConfig({ 
                apiKeys: { ...config.apiKeys, jira: value }
              })}
              placeholder="ATATTxxxxxxxxxxxxxxxxxxx"
              error={errors['apiKeys.jira']}
              section="integration"
              field="apiKeys.jira"
            />
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Automation Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigToggle
              label="Auto Upload"
              description="Automatically upload reports to configured services"
              checked={config.automations?.autoUpload || false}
              onChange={(checked) => updateConfig({ 
                automations: { ...config.automations, autoUpload: checked }
              })}
              error={errors['automations.autoUpload']}
            />

            <ConfigToggle
              label="Schedule Analysis"
              description="Enable scheduled analysis runs"
              checked={config.automations?.scheduleAnalysis || false}
              onChange={(checked) => updateConfig({ 
                automations: { ...config.automations, scheduleAnalysis: checked }
              })}
              error={errors['automations.scheduleAnalysis']}
            />

            <ConfigToggle
              label="Notify on Completion"
              description="Send notifications when analysis completes"
              checked={config.automations?.notifyOnCompletion || false}
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
  const { config, updateConfig, resetConfig, errors } = useConfig();
  const hasErrors = Object.keys(errors).length > 0;

  const formatOptions = [
    { value: 'json', label: 'JSON', description: 'JavaScript Object Notation for data exchange' },
    { value: 'csv', label: 'CSV', description: 'Comma Separated Values for spreadsheet analysis' },
    { value: 'html', label: 'HTML', description: 'Interactive HTML report for web viewing' },
    { value: 'pdf', label: 'PDF', description: 'Portable Document Format for presentations' },
    { value: 'xml', label: 'XML', description: 'Extensible Markup Language for structured data' },
    { value: 'xlsx', label: 'Excel', description: 'Microsoft Excel format for detailed analysis' },
  ];

  return (
    <ConfigSection
      title="Export Settings"
      description="Configure default export formats and output options"
      onReset={() => resetConfig()}
      hasErrors={hasErrors}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigInput
            label="Default Export Path"
            description="Default directory for exported reports"
            value={config.defaultPath || ''}
            onChange={(value) => updateConfig({ defaultPath: value })}
            placeholder="./wundr-reports"
            error={errors.defaultPath}
            section="export"
            field="defaultPath"
          />

          <ConfigNumberInput
            label="Maximum File Size (MB)"
            description="Maximum size for exported files in megabytes"
            value={config.maxFileSize || 0}
            onChange={(value) => updateConfig({ maxFileSize: parseInt(value) || 0 })}
            min={1}
            max={1000}
            error={errors.maxFileSize}
            section="export"
            field="maxFileSize"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConfigToggle
            label="Include Metadata"
            description="Include analysis metadata in exports"
            checked={config.includeMetadata || false}
            onChange={(checked) => updateConfig({ includeMetadata: checked })}
            error={errors.includeMetadata}
          />

          <ConfigToggle
            label="Enable Compression"
            description="Compress exported files to reduce size"
            checked={config.compressionEnabled || false}
            onChange={(checked) => updateConfig({ compressionEnabled: checked })}
            error={errors.compressionEnabled}
          />

          <ConfigToggle
            label="Timestamp Files"
            description="Add timestamps to exported file names"
            checked={config.timestampFiles || false}
            onChange={(checked) => updateConfig({ timestampFiles: checked })}
            error={errors.timestampFiles}
          />
        </div>

        <div>
          <h4 className="font-medium mb-4">Default Export Formats</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formatOptions.map((format) => (
              <Card key={format.value} className="cursor-pointer transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={`format-${format.value}`}
                      checked={(config.defaultFormats || []).includes(format.value as any)}
                      onChange={(e) => {
                        const formats = e.target.checked
                          ? [...(config.defaultFormats || []), format.value as any]
                          : (config.defaultFormats || []).filter((f: any) => f !== format.value);
                        updateConfig({ defaultFormats: formats });
                      }}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <label 
                        htmlFor={`format-${format.value}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {format.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Select which formats to include by default when exporting reports. You can always choose different formats during export.
          </p>
        </div>
      </div>
    </ConfigSection>
  );
}

function ConfigurationManagement() {
  const { exportConfig, importConfig, save, isDirty, resetAll, updateConfig } = useConfig();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      exportConfig();
    } finally {
      setIsExporting(false);
    }
  }, [exportConfig]);

  const handleImport = useCallback(async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    try {
      const text = await importFile.text();
      await importConfig(text);
      setImportFile(null);
    } catch (_error) {
      // Error logged - details available in network tab;
    } finally {
      setIsImporting(false);
    }
  }, [importConfig, importFile]);

  const handleReset = useCallback(async () => {
    try {
      await resetAll();
      setShowResetDialog(false);
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  }, [resetAll]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Configuration Management
          </CardTitle>
          <CardDescription>
            Export, import, and manage your configuration settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDirty && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Remember to save your configuration.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={!isDirty}>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>

            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Configuration'}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Configuration
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Configuration</DialogTitle>
                  <DialogDescription>
                    Select a configuration file to import. This will replace your current settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportFile(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleImport} disabled={!importFile || isImporting}>
                    {isImporting ? 'Importing...' : 'Import'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset All Settings</DialogTitle>
                  <DialogDescription>
                    This will reset all settings to their default values. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleReset}>
                    Reset All Settings
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Configuration Templates
          </CardTitle>
          <CardDescription>
            Quick setup templates for common project types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.slice(0, 6).map((template) => (
              <Card key={template.id} className="cursor-pointer transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium">{template.metadata.name}</h4>
                      <div className="flex gap-1">
                        {template.metadata.tags.slice(0, 2).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.metadata.description}
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        updateConfig(template.config);
                      }}
                    >
                      Apply Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your dashboard preferences, analysis settings, and integrations
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
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
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Manage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <GeneralSettings />
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

        <TabsContent value="manage" className="space-y-6">
          <ConfigurationManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}