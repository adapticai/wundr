/**
 * Settings Section Components
 * @module components/settings/settings-section
 *
 * Reusable components for consistent settings page layouts.
 * Provides standardized patterns for section headers, groups, and rows.
 */
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';

/**
 * Props for the SettingsSection component
 */
export interface SettingsSectionProps {
  /** Section title displayed in the card header */
  title: string;
  /** Optional description text displayed below the title */
  description?: string;
  /** Content to render inside the section */
  children: React.ReactNode;
  /** Additional CSS classes to apply to the card */
  className?: string;
}

/**
 * SettingsSection - Wraps a card with title/description header
 *
 * Use this as the main container for a settings category.
 * It provides a consistent card-based layout with a header.
 *
 * @example
 * ```tsx
 * <SettingsSection
 *   title="Privacy"
 *   description="Manage your privacy settings"
 * >
 *   <SettingsGroup>...</SettingsGroup>
 * </SettingsSection>
 * ```
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className='space-y-6'>{children}</CardContent>
    </Card>
  );
}

/**
 * Props for the SettingsGroup component
 */
export interface SettingsGroupProps {
  /** Optional group title (sub-header within a section) */
  title?: string;
  /** Optional description for the group */
  description?: string;
  /** Settings rows to render in this group */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SettingsGroup - Groups related settings with optional sub-header
 *
 * Use this to organize multiple related settings within a section.
 * Can be nested inside SettingsSection.
 *
 * @example
 * ```tsx
 * <SettingsGroup
 *   title="Notifications"
 *   description="Configure notification preferences"
 * >
 *   <SettingsRow>...</SettingsRow>
 *   <SettingsRow>...</SettingsRow>
 * </SettingsGroup>
 * ```
 */
export function SettingsGroup({
  title,
  description,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className='space-y-1'>
          {title && (
            <h4 className='text-sm font-medium leading-none'>{title}</h4>
          )}
          {description && (
            <p className='text-sm text-muted-foreground'>{description}</p>
          )}
        </div>
      )}
      <div className='space-y-4'>{children}</div>
    </div>
  );
}

/**
 * Props for the SettingsRow component
 */
export interface SettingsRowProps {
  /** Label text for the setting */
  label: string;
  /** Optional description/help text below the label */
  description?: string;
  /** HTML for attribute to associate label with control */
  htmlFor?: string;
  /** The control element (Switch, Input, Select, etc.) */
  children: React.ReactNode;
  /** Optional action button/link on the right side */
  action?: React.ReactNode;
  /** Additional CSS classes for the row container */
  className?: string;
}

/**
 * SettingsRow - Standard row layout with label on left, control on right
 *
 * Provides a consistent horizontal layout for individual settings.
 * The label and description are on the left, control on the right.
 * Responsive: stacks vertically on mobile devices.
 *
 * @example
 * ```tsx
 * <SettingsRow
 *   label="Enable notifications"
 *   description="Receive updates about your account"
 *   htmlFor="notifications"
 * >
 *   <Switch id="notifications" />
 * </SettingsRow>
 * ```
 *
 * @example with action
 * ```tsx
 * <SettingsRow
 *   label="API Key"
 *   description="Your personal API key"
 *   action={<Button variant="ghost" size="sm">Regenerate</Button>}
 * >
 *   <Input type="password" value="sk_..." readOnly />
 * </SettingsRow>
 * ```
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  action,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      {/* Label and description on the left */}
      <div className='flex-1 space-y-1'>
        <Label
          htmlFor={htmlFor}
          className='text-sm font-medium leading-none cursor-pointer'
        >
          {label}
        </Label>
        {description && (
          <p className='text-sm text-muted-foreground leading-relaxed'>
            {description}
          </p>
        )}
      </div>

      {/* Control and optional action on the right */}
      <div className='flex items-center gap-3 sm:flex-shrink-0'>
        <div className='flex items-center'>{children}</div>
        {action && <div className='flex items-center'>{action}</div>}
      </div>
    </div>
  );
}

/**
 * SettingsDivider - Visual separator between setting groups
 *
 * Use this to add visual separation between different setting groups
 * within the same section.
 *
 * @example
 * ```tsx
 * <SettingsGroup>...</SettingsGroup>
 * <SettingsDivider />
 * <SettingsGroup>...</SettingsGroup>
 * ```
 */
export function SettingsDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-px bg-border my-6', className)}
      role='separator'
      aria-orientation='horizontal'
    />
  );
}
