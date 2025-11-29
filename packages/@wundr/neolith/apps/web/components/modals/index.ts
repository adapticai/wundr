/**
 * Modal Components
 *
 * A comprehensive set of modal components for invitations and member management.
 */

export { default as InviteMembersModal } from './invite-members-modal';
export type {
  InviteRole,
  InviteContext,
  InviteMembersModalProps,
} from './invite-members-modal';

// Note: DMAddPeopleModal is located in components/channel/
// Export it from the channel index instead
// Re-export here for convenience if needed in the future
