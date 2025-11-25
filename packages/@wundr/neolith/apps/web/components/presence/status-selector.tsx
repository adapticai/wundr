'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { PresenceIndicator, statusLabels } from './presence-indicator';

import type { PresenceStatus } from './presence-indicator';

/**
 * Props for the StatusSelector component
 */
interface StatusSelectorProps {
  /** Current presence status */
  currentStatus: PresenceStatus;
  /** Current custom status text */
  customStatusText?: string;
  /** Callback when status is changed */
  onStatusChange: (status: PresenceStatus) => void;
  /** Callback when custom status text is changed */
  onCustomStatusChange?: (text: string) => void;
  /** Callback when status is cleared */
  onClearStatus?: () => void;
  /** Optional CSS class name */
  className?: string;
}

interface StatusOption {
  status: PresenceStatus;
  label: string;
  description: string;
  icon: typeof CheckCircleIcon;
}

const statusOptions: StatusOption[] = [
  {
    status: 'online',
    label: 'Online',
    description: 'You are available',
    icon: CheckCircleIcon,
  },
  {
    status: 'away',
    label: 'Away',
    description: 'You may be slow to respond',
    icon: ClockIcon,
  },
  {
    status: 'busy',
    label: 'Busy',
    description: 'Do not disturb',
    icon: MinusCircleIcon,
  },
  {
    status: 'offline',
    label: 'Appear Offline',
    description: 'You will appear offline to others',
    icon: XCircleIcon,
  },
];

export function StatusSelector({
  currentStatus,
  customStatusText,
  onStatusChange,
  onCustomStatusChange,
  onClearStatus,
  className,
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState(customStatusText ?? '');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
      setShowCustomInput(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  const handleStatusSelect = (status: PresenceStatus) => {
    onStatusChange(status);
    setIsOpen(false);
  };

  const handleCustomStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customText.trim()) {
      onCustomStatusChange?.(customText.trim());
    }
    setShowCustomInput(false);
    setIsOpen(false);
  };

  const handleClearStatus = () => {
    setCustomText('');
    onClearStatus?.();
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 font-sans',
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <PresenceIndicator status={currentStatus} size="md" showPulse={false} />
        <span className="text-foreground">{statusLabels[currentStatus]}</span>
        {customStatusText && (
          <span className="text-muted-foreground">- {customStatusText}</span>
        )}
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border bg-card shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
          role="listbox"
          aria-label="Select status"
        >
          <div className="p-2">
            {/* Status Options */}
            <div className="space-y-1">
              {statusOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = currentStatus === option.status;

                return (
                  <button
                    key={option.status}
                    type="button"
                    onClick={() => handleStatusSelect(option.status)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-accent',
                    )}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <PresenceIndicator
                      status={option.status}
                      size="md"
                      showPulse={false}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {isSelected && (
                          <CheckIcon className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="my-2 h-px bg-border" />

            {/* Custom Status */}
            {showCustomInput ? (
              <form onSubmit={handleCustomStatusSubmit} className="space-y-2">
                <Input
                  ref={inputRef}
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="What's your status?"
                  maxLength={100}
                  className="font-sans"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-sans">
                    {customText.length}/100
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomInput(false)}
                      className="font-sans"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!customText.trim()}
                      className="font-sans"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                  'text-foreground hover:bg-accent',
                )}
              >
                <EditIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {customStatusText ? 'Edit custom status' : 'Set a custom status'}
                </span>
              </button>
            )}

            {/* Clear Status */}
            {customStatusText && !showCustomInput && (
              <button
                type="button"
                onClick={handleClearStatus}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                  'text-destructive hover:bg-destructive/10',
                )}
              >
                <XIcon className="h-4 w-4" />
                <span className="text-sm">Clear custom status</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MinusCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
