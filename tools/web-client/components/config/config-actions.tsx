'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  Upload, 
  RotateCcw, 
  Save, 
  AlertTriangle 
} from 'lucide-react';
import { useConfig, useConfigPersistence } from '@/hooks/config/use-config';
import { useToast } from '@/hooks/use-toast';

export function ConfigActions() {
  const { resetAll } = useConfig();
  const { exportConfig, importConfig, save, isDirty } = useConfigPersistence();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportConfig();
      toast({
        title: 'Configuration Exported',
        description: 'Your configuration has been downloaded as a JSON file.',
      });
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Failed to export configuration. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importConfig(file);
      toast({
        title: 'Configuration Imported',
        description: 'Your configuration has been successfully imported.',
      });
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import configuration.',
        variant: 'destructive',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      resetAll();
      toast({
        title: 'Configuration Reset',
        description: 'All settings have been reset to their default values.',
      });
    }
  };

  const handleSave = async () => {
    try {
      await save();
      toast({
        title: 'Configuration Saved',
        description: 'Your configuration has been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save configuration.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save className="h-5 w-5" />
          Configuration Actions
        </CardTitle>
        <CardDescription>
          Save, export, import, or reset your configuration settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Save Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Save Changes</h4>
              <p className="text-xs text-muted-foreground">
                {isDirty ? 'You have unsaved changes' : 'Configuration is up to date'}
              </p>
            </div>
            <Button 
              onClick={handleSave}
              disabled={!isDirty}
              className="min-w-20"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
          {isDirty && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Remember to save your changes
            </div>
          )}
        </div>

        <Separator />

        {/* Import/Export Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Backup & Restore</h4>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export Config
            </Button>
            <Button variant="outline" onClick={handleImport} className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              Import Config
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Export your configuration as a JSON file or import a previously saved configuration
          </p>
        </div>

        <Separator />

        {/* Reset Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Reset Configuration</h4>
              <p className="text-xs text-muted-foreground">
                Restore all settings to their default values
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  );
}