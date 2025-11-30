'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Charter Identity data structure
 */
export interface CharterIdentity {
  name: string;
  slug: string;
  persona?: string;
  slackHandle?: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Props for the CharterIdentitySection component
 */
interface CharterIdentitySectionProps {
  /** Current identity values */
  value: CharterIdentity;
  /** Callback fired when identity values change */
  onChange: (identity: CharterIdentity) => void;
  /** Field-level validation errors */
  errors?: Record<string, string>;
}

/**
 * Generates a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Charter Identity Section Component
 *
 * Handles the identity portion of a charter including:
 * - Name (required, auto-generates slug)
 * - Slug (editable, URL-friendly)
 * - Persona (AI behavior description)
 * - Slack Handle (optional)
 * - Email (optional, validated)
 * - Avatar URL (optional, with preview)
 */
export function CharterIdentitySection({
  value,
  onChange,
  errors = {},
}: CharterIdentitySectionProps) {
  const [slugTouched, setSlugTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Auto-generate slug from name when name changes and slug hasn't been manually edited
  useEffect(() => {
    if (!slugTouched && value.name) {
      const newSlug = generateSlug(value.name);
      if (newSlug !== value.slug) {
        onChange({ ...value, slug: newSlug });
      }
    }
  }, [value.name, slugTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, name: e.target.value });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true);
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^\w-]/g, '')
      .substring(0, 50);
    onChange({ ...value, slug });
  };

  const handlePersonaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, persona: e.target.value });
  };

  const handleSlackHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, slackHandle: e.target.value });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    onChange({ ...value, email });

    // Validate email on change
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError(null);
    }
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, avatarUrl: e.target.value });
  };

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="charter-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="charter-name"
          type="text"
          value={value.name}
          onChange={handleNameChange}
          placeholder="e.g. Engineering Orchestrator"
          className={cn(errors.name && 'border-destructive focus-visible:ring-destructive')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" className="text-xs text-destructive" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="charter-slug">Slug</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">@</span>
          <Input
            id="charter-slug"
            type="text"
            value={value.slug}
            onChange={handleSlugChange}
            placeholder="engineering-orchestrator"
            className={cn(
              'flex-1',
              errors.slug && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? 'slug-error' : 'slug-hint'}
          />
        </div>
        {errors.slug ? (
          <p id="slug-error" className="text-xs text-destructive" role="alert">
            {errors.slug}
          </p>
        ) : (
          <p id="slug-hint" className="text-xs text-muted-foreground">
            URL-friendly identifier auto-generated from name
          </p>
        )}
      </div>

      {/* Persona */}
      <div className="space-y-2">
        <Label htmlFor="charter-persona">
          Persona{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="charter-persona"
          value={value.persona ?? ''}
          onChange={handlePersonaChange}
          placeholder="Describe the AI personality and behavior style..."
          rows={4}
          className={cn(errors.persona && 'border-destructive focus-visible:ring-destructive')}
          aria-invalid={!!errors.persona}
          aria-describedby={errors.persona ? 'persona-error' : 'persona-hint'}
        />
        {errors.persona ? (
          <p id="persona-error" className="text-xs text-destructive" role="alert">
            {errors.persona}
          </p>
        ) : (
          <p id="persona-hint" className="text-xs text-muted-foreground">
            Define how the orchestrator should communicate and behave
          </p>
        )}
      </div>

      {/* Slack Handle */}
      <div className="space-y-2">
        <Label htmlFor="charter-slack">
          Slack Handle{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">@</span>
          <Input
            id="charter-slack"
            type="text"
            value={value.slackHandle ?? ''}
            onChange={handleSlackHandleChange}
            placeholder="slack-username"
            className={cn(
              'flex-1',
              errors.slackHandle && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={!!errors.slackHandle}
            aria-describedby={errors.slackHandle ? 'slack-error' : undefined}
          />
        </div>
        {errors.slackHandle && (
          <p id="slack-error" className="text-xs text-destructive" role="alert">
            {errors.slackHandle}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="charter-email">
          Email{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="charter-email"
          type="email"
          value={value.email ?? ''}
          onChange={handleEmailChange}
          placeholder="orchestrator@example.com"
          className={cn(
            (errors.email || emailError) && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!(errors.email || emailError)}
          aria-describedby={errors.email || emailError ? 'email-error' : undefined}
        />
        {(errors.email || emailError) && (
          <p id="email-error" className="text-xs text-destructive" role="alert">
            {errors.email || emailError}
          </p>
        )}
      </div>

      {/* Avatar URL */}
      <div className="space-y-2">
        <Label htmlFor="charter-avatar">
          Avatar URL{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="charter-avatar"
          type="url"
          value={value.avatarUrl ?? ''}
          onChange={handleAvatarUrlChange}
          placeholder="https://example.com/avatar.png"
          className={cn(errors.avatarUrl && 'border-destructive focus-visible:ring-destructive')}
          aria-invalid={!!errors.avatarUrl}
          aria-describedby={errors.avatarUrl ? 'avatar-error' : 'avatar-hint'}
        />
        {errors.avatarUrl ? (
          <p id="avatar-error" className="text-xs text-destructive" role="alert">
            {errors.avatarUrl}
          </p>
        ) : (
          <p id="avatar-hint" className="text-xs text-muted-foreground">
            URL to an image for the orchestrator avatar
          </p>
        )}

        {/* Avatar Preview */}
        {value.avatarUrl && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.avatarUrl}
                alt="Avatar preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <div
                className="hidden h-full w-full items-center justify-center text-xs text-muted-foreground"
                style={{ display: 'none' }}
              >
                Invalid
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Avatar Preview</p>
              <p className="text-xs text-muted-foreground">
                This image will represent the orchestrator
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
