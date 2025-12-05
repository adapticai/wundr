'use client';

/**
 * EXAMPLE USAGE: Settings Navigation Components
 *
 * This file demonstrates how to use the settings navigation and layout components.
 * DO NOT DELETE - This serves as documentation for developers.
 */

import { Bell, Lock, Palette } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  CollapsibleSettingsSection,
  SettingsPageWrapper,
  SettingsTabs,
} from '@/components/settings';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

// Example 1: Basic Settings Page with Header and Breadcrumb
export function BasicSettingsPageExample() {
  return (
    <SettingsPageWrapper
      workspaceSlug="workspace-123"
      title="Notifications"
      description="Manage how you receive notifications"
    >
      <div className="space-y-4">
        {/* Your settings content here */}
        <div className="flex items-center justify-between">
          <Label htmlFor="email-notifications">Email Notifications</Label>
          <Switch id="email-notifications" />
        </div>
      </div>
    </SettingsPageWrapper>
  );
}

// Example 2: Settings Page with Tabs
export function SettingsPageWithTabsExample() {
  const tabs = [
    {
      label: 'General',
      href: '/workspace-123/settings/notifications/general',
      value: 'general',
    },
    {
      label: 'Email',
      href: '/workspace-123/settings/notifications/email',
      value: 'email',
    },
    {
      label: 'Push',
      href: '/workspace-123/settings/notifications/push',
      value: 'push',
    },
  ];

  return (
    <SettingsPageWrapper
      workspaceSlug="workspace-123"
      title="Notifications"
      description="Control how and when you receive notifications"
    >
      <SettingsTabs tabs={tabs} />
      {/* Tab content here */}
    </SettingsPageWrapper>
  );
}

// Example 3: Settings with Collapsible Sections
export function CollapsibleSectionsExample() {
  return (
    <SettingsPageWrapper
      workspaceSlug="workspace-123"
      title="Privacy & Data"
      description="Manage your privacy settings and data"
    >
      <div className="space-y-4">
        <CollapsibleSettingsSection
          title="Data Collection"
          description="Control what data we collect"
          icon={<Lock className="h-5 w-5" />}
          defaultOpen={true}
          badge={<Badge variant="outline">Recommended</Badge>}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Analytics</Label>
                <p className="text-sm text-muted-foreground">
                  Help us improve by sharing usage data
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Privacy Controls"
          description="Manage who can see your information"
          icon={<Bell className="h-5 w-5" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Profile Visibility</Label>
              <Switch />
            </div>
          </div>
        </CollapsibleSettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}

// Example 4: Settings Page with Unsaved Changes Warning
export function UnsavedChangesExample() {
  const [formData, setFormData] = useState({
    name: 'John Doe',
    email: 'john@example.com',
  });

  const {
    hasUnsavedChanges,
    markAsDirty,
    markAsClean,
    showDialog,
    setShowDialog,
    handleSave,
    handleDiscard,
  } = useUnsavedChanges({
    enabled: true,
    onSave: async () => {
      // Save logic here
      console.log('Saving...', formData);
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onDiscard: () => {
      setFormData({ name: 'John Doe', email: 'john@example.com' });
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markAsDirty();
  };

  const saveChanges = async () => {
    await handleSave();
    markAsClean();
  };

  return (
    <SettingsPageWrapper
      workspaceSlug="workspace-123"
      title="Profile"
      description="Update your personal information"
      enableUnsavedChangesWarning={true}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={e => handleChange('email', e.target.value)}
          />
        </div>
        {hasUnsavedChanges && (
          <div className="flex gap-2">
            <Button onClick={saveChanges}>Save Changes</Button>
            <Button variant="outline" onClick={handleDiscard}>
              Discard
            </Button>
          </div>
        )}
      </div>
    </SettingsPageWrapper>
  );
}

// Example 5: Using Enhanced Layout Directly
export function EnhancedLayoutExample() {
  // This is typically used in the layout.tsx file
  // See app/(workspace)/[workspaceSlug]/settings/layout.tsx for real usage
  return null;
}

/**
 * KEYBOARD SHORTCUTS:
 *
 * ⌘K (Cmd+K) - Open settings search
 * ⌘, (Cmd+,) - Open quick settings modal
 * ⌘S (Cmd+S) - Save changes (if form has changes)
 * ⌘[ (Cmd+[) - Go back
 * ESC - Return to settings home (when not in input/dialog)
 */

/**
 * COMPONENT FEATURES:
 *
 * 1. Settings Header with Breadcrumb
 *    - Automatic breadcrumb generation
 *    - Search button with keyboard shortcut hint
 *
 * 2. Settings Search (⌘K)
 *    - Full-text search across all settings
 *    - Grouped by category
 *    - Keyboard navigation
 *
 * 3. Quick Settings Modal (⌘,)
 *    - Theme switcher (Light/Dark/System)
 *    - Sound effects toggle
 *    - Reduced motion toggle
 *
 * 4. Collapsible Sections
 *    - Expand/collapse to organize content
 *    - Icons and badges support
 *    - Remembered state per section
 *
 * 5. Settings Tabs
 *    - Sub-navigation within settings pages
 *    - Active state tracking
 *
 * 6. Unsaved Changes Protection
 *    - Browser navigation warning
 *    - Internal navigation confirmation
 *    - Save/Discard options
 *
 * 7. Mobile Responsive
 *    - Drawer navigation on mobile
 *    - Optimized touch targets
 *    - Bottom navigation support
 *
 * 8. Accessibility
 *    - Keyboard navigation
 *    - Screen reader support
 *    - Focus management
 */
