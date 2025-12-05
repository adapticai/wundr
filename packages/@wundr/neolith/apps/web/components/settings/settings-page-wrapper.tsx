'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { toast } from 'sonner';

import { SettingsHeader } from './settings-header';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

import { useSettingsKeyboard } from '@/hooks/use-settings-keyboard';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

interface SettingsPageWrapperProps {
  workspaceSlug: string;
  title: string;
  description?: string;
  children: ReactNode;
  onSave?: () => Promise<void>;
  onReset?: () => void;
  enableUnsavedChangesWarning?: boolean;
}

/**
 * Wrapper component for individual settings pages.
 * Provides header, keyboard shortcuts, and unsaved changes handling.
 */
export function SettingsPageWrapper({
  workspaceSlug,
  title,
  description,
  children,
  onSave,
  onReset,
  enableUnsavedChangesWarning = false,
}: SettingsPageWrapperProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);

  const {
    hasUnsavedChanges,
    showDialog,
    setShowDialog,
    handleSave,
    handleDiscard,
  } = useUnsavedChanges({
    enabled: enableUnsavedChangesWarning,
    onSave: async () => {
      if (onSave) {
        try {
          await onSave();
          toast.success('Changes saved successfully');
        } catch (error) {
          toast.error('Failed to save changes');
          throw error;
        }
      }
    },
    onDiscard: onReset,
  });

  useSettingsKeyboard({
    workspaceSlug,
    onOpenSearch: () => setSearchOpen(true),
    onOpenQuickSettings: () => setQuickSettingsOpen(true),
    onSave: async () => {
      if (onSave && hasUnsavedChanges) {
        try {
          await onSave();
          toast.success('Changes saved successfully');
        } catch (error) {
          toast.error('Failed to save changes');
        }
      }
    },
  });

  return (
    <>
      <div className="space-y-6">
        <SettingsHeader
          workspaceSlug={workspaceSlug}
          title={title}
          description={description}
        />
        {children}
      </div>

      <UnsavedChangesDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}
