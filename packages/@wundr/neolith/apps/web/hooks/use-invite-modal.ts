'use client';

import { useState, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

/**
 * Context types for invite modal
 */
export type InviteContext = 'workspace' | 'channel' | 'dm';

/**
 * Options for the useInviteModal hook
 */
export interface UseInviteModalOptions {
  /** Context in which invites are being sent */
  context: InviteContext;
  /** The workspace ID */
  workspaceId: string;
  /** Optional channel ID (required for channel context) */
  channelId?: string;
  /** Optional conversation/DM ID (required for dm context) */
  conversationId?: string;
  /** Callback fired on successful invite submission */
  onSuccess?: () => void;
}

/**
 * Return type for the useInviteModal hook
 */
export interface UseInviteModalReturn {
  // Modal state
  /** Whether the modal is open */
  isOpen: boolean;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;

  // Form state
  /** List of email addresses to invite */
  emails: string[];
  /** Update the emails list */
  setEmails: (emails: string[]) => void;
  /** List of selected user IDs (for existing workspace members) */
  selectedUserIds: string[];
  /** Update the selected user IDs */
  setSelectedUserIds: (ids: string[]) => void;
  /** Role to assign to invitees */
  role: string;
  /** Update the role */
  setRole: (role: string) => void;
  /** Optional message to include with invite */
  message: string;
  /** Update the message */
  setMessage: (message: string) => void;

  // Validation
  /** Current email validation error message */
  emailError: string | null;
  /** Validate a single email address */
  validateEmail: (email: string) => boolean;

  // Submission
  /** Whether a submission is in progress */
  isSubmitting: boolean;
  /** Error that occurred during submission */
  error: string | null;
  /** Submit the invites */
  submitInvites: () => Promise<void>;

  // Reset
  /** Reset all form state to initial values */
  reset: () => void;
}

// =============================================================================
// Email Validation
// =============================================================================

/**
 * Simple email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// =============================================================================
// Initial State
// =============================================================================

const INITIAL_STATE = {
  emails: [] as string[],
  selectedUserIds: [] as string[],
  role: 'member',
  message: '',
  emailError: null as string | null,
  error: null as string | null,
};

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing invite modal state and submission
 *
 * Provides a unified interface for inviting users to workspaces, channels, or DMs.
 * Handles modal state, form state, validation, and API submission.
 *
 * @param options - Configuration options for the invite modal
 * @returns Modal state, form state, validation, and submission handlers
 *
 * @example
 * ```tsx
 * function InviteToChannelButton() {
 *   const {
 *     isOpen,
 *     open,
 *     close,
 *     emails,
 *     setEmails,
 *     selectedUserIds,
 *     setSelectedUserIds,
 *     role,
 *     setRole,
 *     submitInvites,
 *     isSubmitting,
 *     error,
 *   } = useInviteModal({
 *     context: 'channel',
 *     workspaceId: 'workspace-123',
 *     channelId: 'channel-456',
 *     onSuccess: () => {
 *       console.log('Invites sent successfully!');
 *     },
 *   });
 *
 *   return (
 *     <>
 *       <button onClick={open}>Invite to Channel</button>
 *       <InviteModal
 *         isOpen={isOpen}
 *         onClose={close}
 *         emails={emails}
 *         onEmailsChange={setEmails}
 *         selectedUserIds={selectedUserIds}
 *         onSelectedUserIdsChange={setSelectedUserIds}
 *         role={role}
 *         onRoleChange={setRole}
 *         onSubmit={submitInvites}
 *         isSubmitting={isSubmitting}
 *         error={error}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useInviteModal(options: UseInviteModalOptions): UseInviteModalReturn {
  const { context, workspaceId, channelId, conversationId, onSuccess } = options;

  // Modal state
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [emails, setEmails] = useState<string[]>(INITIAL_STATE.emails);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(INITIAL_STATE.selectedUserIds);
  const [role, setRole] = useState<string>(INITIAL_STATE.role);
  const [message, setMessage] = useState<string>(INITIAL_STATE.message);

  // Validation and error state
  const [emailError, setEmailError] = useState<string | null>(INITIAL_STATE.emailError);
  const [error, setError] = useState<string | null>(INITIAL_STATE.error);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =============================================================================
  // Modal Controls
  // =============================================================================

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // =============================================================================
  // Validation
  // =============================================================================

  const validateEmail = useCallback((email: string): boolean => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email address is required');
      return false;
    }
    if (!isValidEmail(trimmedEmail)) {
      setEmailError('Invalid email address format');
      return false;
    }
    setEmailError(null);
    return true;
  }, []);

  // =============================================================================
  // Submission
  // =============================================================================

  const submitInvites = useCallback(async () => {
    // Reset errors
    setError(null);
    setEmailError(null);

    // Validate that we have either emails or selected users
    if (emails.length === 0 && selectedUserIds.length === 0) {
      setError('Please select users or enter email addresses to invite');
      return;
    }

    // Validate all emails
    if (emails.length > 0) {
      const invalidEmails = emails.filter((email) => !isValidEmail(email));
      if (invalidEmails.length > 0) {
        setEmailError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      switch (context) {
        case 'workspace':
          // Invite to workspace
          endpoint = `/api/workspaces/${workspaceId}/invites`;
          body = {
            emails,
            roleId: role !== 'member' ? role : undefined,
            message: message || undefined,
          };
          break;

        case 'channel':
          // Invite to channel
          if (!channelId) {
            throw new Error('Channel ID is required for channel invites');
          }
          endpoint = `/api/channels/${channelId}/members/invite`;
          body = {
            emails,
            userIds: selectedUserIds,
            role: role.toUpperCase(), // API expects uppercase role
            message: message || undefined,
          };
          break;

        case 'dm':
          // Invite to DM/conversation
          if (!conversationId) {
            throw new Error('Conversation ID is required for DM invites');
          }
          endpoint = `/api/conversations/${conversationId}/participants`;
          body = {
            userIds: selectedUserIds,
            message: message || undefined,
          };
          break;

        default:
          throw new Error(`Unsupported context: ${context}`);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send invites' }));
        throw new Error(errorData.error || errorData.message || 'Failed to send invites');
      }

      // Success - reset form and close modal
      reset();
      close();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    context,
    workspaceId,
    channelId,
    conversationId,
    emails,
    selectedUserIds,
    role,
    message,
    onSuccess,
    close,
  ]);

  // =============================================================================
  // Reset
  // =============================================================================

  const reset = useCallback(() => {
    setEmails(INITIAL_STATE.emails);
    setSelectedUserIds(INITIAL_STATE.selectedUserIds);
    setRole(INITIAL_STATE.role);
    setMessage(INITIAL_STATE.message);
    setEmailError(INITIAL_STATE.emailError);
    setError(INITIAL_STATE.error);
  }, []);

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // Modal state
    isOpen,
    open,
    close,

    // Form state
    emails,
    setEmails,
    selectedUserIds,
    setSelectedUserIds,
    role,
    setRole,
    message,
    setMessage,

    // Validation
    emailError,
    validateEmail,

    // Submission
    isSubmitting,
    error,
    submitInvites,

    // Reset
    reset,
  };
}
