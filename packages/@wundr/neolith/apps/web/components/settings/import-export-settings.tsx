/**
 * Import/Export and Backup Settings Component
 * Comprehensive data management for personal settings
 */
'use client';

import {
  Download,
  Upload,
  Clock,
  Database,
  FileJson,
  Archive,
  RefreshCw,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  MessageSquare,
  AlertCircle,
  Info,
  Share2,
  HardDrive,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  SETTINGS_CATEGORIES,
  exportSettings,
  importSettings,
  downloadSettingsFile,
  readSettingsFile,
  getBackupHistory,
  restoreFromBackup,
  deleteBackup,
  downloadBackup,
  configureAutoBackup,
  getAutoBackupConfig,
  estimateBackupSize,
  type AutoBackupConfig,
} from '@/lib/settings-backup';

interface BackupHistoryItem {
  id: string;
  timestamp: string;
  categories: string[];
  size: number;
  automatic: boolean;
}

export function ImportExportSettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [includeConversations, setIncludeConversations] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);

  // Backup history
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  // Auto backup
  const [autoBackupConfig, setAutoBackupConfig] = useState<AutoBackupConfig>({
    enabled: false,
    frequency: 'weekly',
    maxBackups: 10,
    includeConversations: false,
    categories: ['all'],
  });
  const [isSavingAutoConfig, setIsSavingAutoConfig] = useState(false);

  // Dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteBackupDialogOpen, setDeleteBackupDialogOpen] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    categories: string[];
    timestamp: string;
    platform: string;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    loadBackupHistory();
    loadAutoBackupConfig();
  }, []);

  const loadBackupHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const history = await getBackupHistory();
      setBackupHistory(history);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load backup history',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadAutoBackupConfig = async () => {
    try {
      const config = await getAutoBackupConfig();
      setAutoBackupConfig(config);
    } catch (error) {
      // Silently fail - use defaults
      console.error('Failed to load auto backup config:', error);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const categories =
        selectedCategories.includes('all') || selectedCategories.length === 0
          ? SETTINGS_CATEGORIES.map(c => c.id)
          : selectedCategories;

      const jsonData = await exportSettings(categories, includeConversations);

      clearInterval(progressInterval);
      setExportProgress(100);

      downloadSettingsFile(jsonData);

      toast({
        title: 'Export Successful',
        description: 'Your settings have been exported successfully',
      });

      setExportDialogOpen(false);
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description:
          error instanceof Error ? error.message : 'Failed to export settings',
        variant: 'destructive',
      });
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
return;
}

    try {
      const content = await readSettingsFile(file);
      const data = JSON.parse(content);

      setImportFile(file);
      setImportPreview({
        categories: data.metadata?.categories || [],
        timestamp: data.metadata?.timestamp || 'Unknown',
        platform: data.metadata?.platform || 'unknown',
      });
      setImportDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Invalid File',
        description:
          error instanceof Error ? error.message : 'Failed to read file',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async (overwrite: boolean) => {
    if (!importFile) {
return;
}

    try {
      setIsImporting(true);
      setImportProgress(0);

      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const content = await readSettingsFile(importFile);
      const result = await importSettings(content, { overwrite });

      clearInterval(progressInterval);
      setImportProgress(100);

      toast({
        title: 'Import Successful',
        description: `Imported ${result.imported.length} categories successfully`,
      });

      setImportDialogOpen(false);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportFile(null);
        setImportPreview(null);
      }, 1000);

      // Reload to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        title: 'Import Failed',
        description:
          error instanceof Error ? error.message : 'Failed to import settings',
        variant: 'destructive',
      });
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) {
return;
}

    try {
      const result = await restoreFromBackup(selectedBackup);

      toast({
        title: 'Restore Successful',
        description: `Restored ${result.restored.length} categories`,
      });

      setRestoreDialogOpen(false);
      setSelectedBackup(null);

      // Reload to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        title: 'Restore Failed',
        description:
          error instanceof Error ? error.message : 'Failed to restore backup',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteBackup = async () => {
    if (!selectedBackup) {
return;
}

    try {
      await deleteBackup(selectedBackup);

      toast({
        title: 'Backup Deleted',
        description: 'The backup has been deleted successfully',
      });

      setDeleteBackupDialogOpen(false);
      setSelectedBackup(null);
      loadBackupHistory();
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete backup',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    try {
      await downloadBackup(backupId);

      toast({
        title: 'Download Complete',
        description: 'Backup downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description:
          error instanceof Error ? error.message : 'Failed to download backup',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAutoBackupConfig = async () => {
    try {
      setIsSavingAutoConfig(true);
      await configureAutoBackup(autoBackupConfig);

      toast({
        title: 'Settings Saved',
        description: 'Auto-backup configuration updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save auto-backup config',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAutoConfig(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    if (categoryId === 'all') {
      setSelectedCategories(['all']);
      return;
    }

    setSelectedCategories(prev => {
      const filtered = prev.filter(c => c !== 'all');
      if (filtered.includes(categoryId)) {
        return filtered.filter(c => c !== categoryId);
      }
      return [...filtered, categoryId];
    });
  };

  const estimatedSize = estimateBackupSize(
    selectedCategories.includes('all')
      ? SETTINGS_CATEGORIES.map(c => c.id)
      : selectedCategories,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import/Export & Backup</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your settings backups and data exports
        </p>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <CardTitle>Export Settings</CardTitle>
              </div>
              <CardDescription>
                Download your settings and data in JSON format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="export-all">Select all categories</Label>
                  <Checkbox
                    id="export-all"
                    checked={selectedCategories.includes('all')}
                    onCheckedChange={() => toggleCategory('all')}
                  />
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  {SETTINGS_CATEGORIES.map(category => (
                    <div
                      key={category.id}
                      className="flex items-start space-x-3 space-y-0"
                    >
                      <Checkbox
                        id={`export-${category.id}`}
                        checked={
                          selectedCategories.includes('all') ||
                          selectedCategories.includes(category.id)
                        }
                        onCheckedChange={() => toggleCategory(category.id)}
                        disabled={selectedCategories.includes('all')}
                      />
                      <div className="space-y-1 leading-none">
                        <Label
                          htmlFor={`export-${category.id}`}
                          className="font-medium"
                        >
                          {category.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-conversations">
                      Include conversation history
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Export all messages and chat history (may be large)
                    </p>
                  </div>
                  <Switch
                    id="include-conversations"
                    checked={includeConversations}
                    onCheckedChange={setIncludeConversations}
                  />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Estimated export size: <strong>{estimatedSize} KB</strong>
                    {includeConversations &&
                      ' (conversations can significantly increase size)'}
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setExportDialogOpen(true)}
                  disabled={
                    isExporting ||
                    (selectedCategories.length === 0 &&
                      !selectedCategories.includes('all'))
                  }
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Export */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Export</CardTitle>
              <CardDescription>
                Commonly used export configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4"
                  onClick={async () => {
                    setSelectedCategories(['all']);
                    setIncludeConversations(false);
                    setExportDialogOpen(true);
                  }}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Settings2 className="h-5 w-5 mt-0.5" />
                    <div>
                      <div className="font-semibold">Settings Only</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Export all settings without conversations
                      </div>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-auto py-4"
                  onClick={async () => {
                    setSelectedCategories(['all']);
                    setIncludeConversations(true);
                    setExportDialogOpen(true);
                  }}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Database className="h-5 w-5 mt-0.5" />
                    <div>
                      <div className="font-semibold">Complete Backup</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Export everything including conversations
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                <CardTitle>Import Settings</CardTitle>
              </div>
              <CardDescription>
                Restore settings from a previously exported JSON file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full h-32 flex-col gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <div className="font-medium">Select JSON File</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Choose a settings backup file to import
                  </div>
                </div>
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Importing will merge or overwrite your current settings. You
                  can choose the import mode in the next step.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Import from other platforms */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                <CardTitle className="text-base">Import from Other Platforms</CardTitle>
              </div>
              <CardDescription>
                Import data from Slack, Discord, or other platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" disabled>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Slack Export
                  <Badge variant="secondary" className="ml-2">
                    Coming Soon
                  </Badge>
                </Button>
                <Button variant="outline" disabled>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Discord Export
                  <Badge variant="secondary" className="ml-2">
                    Coming Soon
                  </Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups" className="space-y-4">
          {/* Auto Backup */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                <CardTitle>Automatic Backups</CardTitle>
              </div>
              <CardDescription>
                Schedule automatic backups of your settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-backup">Enable automatic backups</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create backups on a schedule
                  </p>
                </div>
                <Switch
                  id="auto-backup"
                  checked={autoBackupConfig.enabled}
                  onCheckedChange={enabled =>
                    setAutoBackupConfig(prev => ({ ...prev, enabled }))
                  }
                />
              </div>

              {autoBackupConfig.enabled && (
                <>
                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backup-frequency">Backup Frequency</Label>
                      <Select
                        value={autoBackupConfig.frequency}
                        onValueChange={frequency =>
                          setAutoBackupConfig(prev => ({
                            ...prev,
                            frequency: frequency as AutoBackupConfig['frequency'],
                          }))
                        }
                      >
                        <SelectTrigger id="backup-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-backups">Maximum Backups</Label>
                      <Select
                        value={autoBackupConfig.maxBackups.toString()}
                        onValueChange={max =>
                          setAutoBackupConfig(prev => ({
                            ...prev,
                            maxBackups: parseInt(max),
                          }))
                        }
                      >
                        <SelectTrigger id="max-backups">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 backups</SelectItem>
                          <SelectItem value="10">10 backups</SelectItem>
                          <SelectItem value="15">15 backups</SelectItem>
                          <SelectItem value="30">30 backups</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Older backups will be automatically deleted
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-include-conversations">
                          Include conversations
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Backup conversation history
                        </p>
                      </div>
                      <Switch
                        id="auto-include-conversations"
                        checked={autoBackupConfig.includeConversations}
                        onCheckedChange={includeConversations =>
                          setAutoBackupConfig(prev => ({
                            ...prev,
                            includeConversations,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveAutoBackupConfig}
                      disabled={isSavingAutoConfig}
                    >
                      {isSavingAutoConfig ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Configuration'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Backup History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  <CardTitle>Backup History</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadBackupHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <CardDescription>
                View and manage your backup history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : backupHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No backups found</p>
                  <p className="text-sm mt-1">
                    Create your first backup by exporting your settings
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {backupHistory.map(backup => (
                    <div
                      key={backup.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {new Date(backup.timestamp).toLocaleString()}
                            </span>
                            {backup.automatic && (
                              <Badge variant="secondary" className="text-xs">
                                Auto
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {backup.categories.length} categories •{' '}
                            {(backup.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadBackup(backup.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup.id);
                            setRestoreDialogOpen(true);
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup.id);
                            setDeleteBackupDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Settings</DialogTitle>
            <DialogDescription>
              Your settings will be downloaded as a JSON file
            </DialogDescription>
          </DialogHeader>

          {isExporting ? (
            <div className="space-y-4 py-4">
              <Progress value={exportProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Preparing export... {exportProgress}%
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <Alert>
                <FileJson className="h-4 w-4" />
                <AlertDescription>
                  A JSON file containing your selected settings will be
                  downloaded to your device.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Settings</DialogTitle>
            <DialogDescription>
              Choose how to import your settings
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="space-y-4 py-4">
              <Progress value={importProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Importing settings... {importProgress}%
              </p>
            </div>
          ) : importPreview ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">File</p>
                  <p className="text-sm text-muted-foreground">
                    {importFile?.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(importPreview.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Categories</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {importPreview.categories.map(cat => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                {importPreview.platform !== 'neolith' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This backup was created from {importPreview.platform}.
                      Some data may be converted.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Choose whether to merge with existing settings or overwrite
                  them completely.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportFile(null);
                setImportPreview(null);
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleImport(false)}
              disabled={isImporting}
            >
              Merge
            </Button>
            <Button onClick={() => handleImport(true)} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Overwrite'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <AlertDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your settings from the selected backup. Your
              current settings will be overwritten. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreBackup}>
              Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Backup Dialog */}
      <AlertDialog
        open={deleteBackupDialogOpen}
        onOpenChange={setDeleteBackupDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected backup. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBackup}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
