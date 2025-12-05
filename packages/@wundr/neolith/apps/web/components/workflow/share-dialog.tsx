'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Share2,
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { WorkflowId } from '@/types/workflow';
import type {
  WorkflowPermissionLevel,
  PermissionSubjectType,
} from './workflow-permissions';

/**
 * User or team that can be shared with
 */
export interface ShareableEntity {
  id: string;
  type: 'user' | 'team';
  name: string;
  email?: string;
  avatarUrl?: string;
  memberCount?: number; // for teams
  currentPermission?: WorkflowPermissionLevel | null;
}

/**
 * Recipient selected for sharing
 */
export interface ShareRecipient {
  entity: ShareableEntity;
  level: WorkflowPermissionLevel;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: WorkflowId;
  workflowName: string;
  currentShares: ShareableEntity[];
  onShare: (recipients: ShareRecipient[], message?: string) => Promise<void>;
  onSearchEntities: (query: string, type: 'user' | 'team') => Promise<ShareableEntity[]>;
}

const PERMISSION_OPTIONS: {
  value: WorkflowPermissionLevel;
  label: string;
  description: string;
}[] = [
  {
    value: 'view',
    label: 'View',
    description: 'Can view workflow and execution history',
  },
  {
    value: 'edit',
    label: 'Edit',
    description: 'Can modify workflow configuration',
  },
  {
    value: 'execute',
    label: 'Execute',
    description: 'Can trigger and run the workflow',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full control including permissions',
  },
];

export function ShareDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
  currentShares,
  onShare,
  onSearchEntities,
}: ShareDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShareableEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Map<string, ShareRecipient>>(
    new Map()
  );
  const [defaultPermission, setDefaultPermission] = useState<WorkflowPermissionLevel>('view');
  const [message, setMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'user' | 'team'>('user');

  // Debounced search
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setShareError(null);

      try {
        const results = await onSearchEntities(query, searchType);
        // Filter out entities that are already shared
        const filtered = results.filter(
          (entity) => !currentShares.some((share) => share.id === entity.id)
        );
        setSearchResults(filtered);
      } catch (error) {
        setShareError('Failed to search. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearchEntities, searchType, currentShares]
  );

  // Trigger search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleAddRecipient = useCallback(
    (entity: ShareableEntity) => {
      setSelectedRecipients((prev) => {
        const next = new Map(prev);
        next.set(entity.id, {
          entity,
          level: entity.currentPermission || defaultPermission,
        });
        return next;
      });
      setSearchQuery('');
      setSearchResults([]);
    },
    [defaultPermission]
  );

  const handleRemoveRecipient = useCallback((entityId: string) => {
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      next.delete(entityId);
      return next;
    });
  }, []);

  const handleUpdateRecipientPermission = useCallback(
    (entityId: string, level: WorkflowPermissionLevel) => {
      setSelectedRecipients((prev) => {
        const next = new Map(prev);
        const recipient = next.get(entityId);
        if (recipient) {
          next.set(entityId, { ...recipient, level });
        }
        return next;
      });
    },
    []
  );

  const handleShare = useCallback(async () => {
    if (selectedRecipients.size === 0) return;

    setIsSharing(true);
    setShareError(null);

    try {
      await onShare(Array.from(selectedRecipients.values()), message.trim() || undefined);
      setShareSuccess(true);

      // Reset form after successful share
      setTimeout(() => {
        setSelectedRecipients(new Map());
        setMessage('');
        setShareSuccess(false);
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to share workflow');
    } finally {
      setIsSharing(false);
    }
  }, [selectedRecipients, message, onShare, onOpenChange]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const recipientsList = useMemo(
    () => Array.from(selectedRecipients.values()),
    [selectedRecipients]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Workflow
          </DialogTitle>
          <DialogDescription>
            Share "{workflowName}" with users or teams
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Success Message */}
          {shareSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Workflow shared successfully!
              </span>
            </div>
          )}

          {/* Error Message */}
          {shareError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-800 dark:text-red-200">{shareError}</span>
            </div>
          )}

          {/* Search Section */}
          <div className="space-y-2">
            <Label>Add people or teams</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${searchType === 'user' ? 'users' : 'teams'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Select
                value={searchType}
                onValueChange={(v) => {
                  setSearchType(v as 'user' | 'team');
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Users
                    </div>
                  </SelectItem>
                  <SelectItem value="team">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Teams
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg mt-2 overflow-hidden">
                <ScrollArea className="max-h-[200px]">
                  <div className="divide-y">
                    {searchResults.map((entity) => (
                      <button
                        key={entity.id}
                        onClick={() => handleAddRecipient(entity)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entity.avatarUrl} />
                          <AvatarFallback>{getInitials(entity.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{entity.name}</div>
                          {entity.email && (
                            <div className="text-xs text-muted-foreground truncate">
                              {entity.email}
                            </div>
                          )}
                          {entity.type === 'team' && entity.memberCount !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {entity.memberCount} member{entity.memberCount !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Selected Recipients */}
          {recipientsList.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>People and teams with access</Label>
                <div className="border rounded-lg">
                  <ScrollArea className="max-h-[250px]">
                    <div className="divide-y">
                      {recipientsList.map((recipient) => (
                        <div
                          key={recipient.entity.id}
                          className="flex items-center gap-3 p-3"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={recipient.entity.avatarUrl} />
                            <AvatarFallback>
                              {getInitials(recipient.entity.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{recipient.entity.name}</div>
                            {recipient.entity.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {recipient.entity.email}
                              </div>
                            )}
                          </div>
                          <Select
                            value={recipient.level}
                            onValueChange={(value) =>
                              handleUpdateRecipientPermission(
                                recipient.entity.id,
                                value as WorkflowPermissionLevel
                              )
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PERMISSION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleRemoveRecipient(recipient.entity.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}

          {/* Default Permission */}
          <div className="space-y-2">
            <Label htmlFor="default-permission">Default Permission Level</Label>
            <Select value={defaultPermission} onValueChange={(v) => setDefaultPermission(v as WorkflowPermissionLevel)}>
              <SelectTrigger id="default-permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="py-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Input
              id="message"
              placeholder="Add a message to the invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Current Shares Summary */}
          {currentShares.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  Currently shared with {currentShares.length} {currentShares.length === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSharing}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={recipientsList.length === 0 || isSharing}
          >
            {isSharing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" />
                Share with {recipientsList.length} {recipientsList.length === 1 ? 'person' : 'people'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Quick share button with dialog
 */
interface QuickShareButtonProps {
  workflowId: WorkflowId;
  workflowName: string;
  currentShares: ShareableEntity[];
  onShare: (recipients: ShareRecipient[], message?: string) => Promise<void>;
  onSearchEntities: (query: string, type: 'user' | 'team') => Promise<ShareableEntity[]>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function QuickShareButton({
  workflowId,
  workflowName,
  currentShares,
  onShare,
  onSearchEntities,
  variant = 'outline',
  size = 'default',
  showLabel = true,
}: QuickShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      // In a real implementation, this would copy a share link
      const shareLink = `${window.location.origin}/workflows/${workflowId}/shared`;
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy share link:', error);
    }
  }, [workflowId]);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            {showLabel && size !== 'icon' && <span className="ml-2">Copied!</span>}
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            {showLabel && size !== 'icon' && <span className="ml-2">Share</span>}
          </>
        )}
      </Button>

      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        workflowId={workflowId}
        workflowName={workflowName}
        currentShares={currentShares}
        onShare={onShare}
        onSearchEntities={onSearchEntities}
      />
    </>
  );
}
