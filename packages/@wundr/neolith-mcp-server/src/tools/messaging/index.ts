/**
 * Messaging Tools Module
 *
 * Exports all messaging-related MCP tools for Neolith.
 * These tools enable sending messages, managing threads, reactions, and DM conversations.
 *
 * @module tools/messaging
 */

// Export all handlers
export { sendMessageHandler, SendMessageSchema } from './send-message';
export { getMessagesHandler, GetMessagesSchema } from './get-messages';
export { getThreadHandler, GetThreadSchema } from './get-thread';
export { replyToThreadHandler, ReplyToThreadSchema } from './reply-to-thread';
export { editMessageHandler, EditMessageSchema } from './edit-message';
export { deleteMessageHandler, DeleteMessageSchema } from './delete-message';
export { addReactionHandler, AddReactionSchema } from './add-reaction';
export { removeReactionHandler, RemoveReactionSchema } from './remove-reaction';
export { getDMChannelsHandler, GetDMChannelsSchema } from './get-dm-channels';
export { createDMHandler, CreateDMSchema } from './create-dm';

// Export all types
export type { SendMessageInput } from './send-message';
export type { GetMessagesInput } from './get-messages';
export type { GetThreadInput } from './get-thread';
export type { ReplyToThreadInput } from './reply-to-thread';
export type { EditMessageInput } from './edit-message';
export type { DeleteMessageInput } from './delete-message';
export type { AddReactionInput } from './add-reaction';
export type { RemoveReactionInput } from './remove-reaction';
export type { GetDMChannelsInput } from './get-dm-channels';
export type { CreateDMInput } from './create-dm';

// Import schemas for the registry
import { SendMessageSchema as SendMsgSchema } from './send-message';
import { GetMessagesSchema as GetMsgSchema } from './get-messages';
import { GetThreadSchema as GetThrdSchema } from './get-thread';
import { ReplyToThreadSchema as ReplyThrdSchema } from './reply-to-thread';
import { EditMessageSchema as EditMsgSchema } from './edit-message';
import { DeleteMessageSchema as DeleteMsgSchema } from './delete-message';
import { AddReactionSchema as AddRxnSchema } from './add-reaction';
import { RemoveReactionSchema as RemoveRxnSchema } from './remove-reaction';
import { GetDMChannelsSchema as GetDMSchema } from './get-dm-channels';
import { CreateDMSchema as CreateDMSchemaImport } from './create-dm';

/**
 * Registry of all messaging tool schemas
 */
export const MessagingToolSchemas = {
  'neolith-send-message': {
    schema: SendMsgSchema,
    description: 'Send a message to a channel with optional attachments and mentions',
    category: 'messaging',
  },
  'neolith-get-messages': {
    schema: GetMsgSchema,
    description: 'Get messages from a channel with pagination',
    category: 'messaging',
  },
  'neolith-get-thread': {
    schema: GetThrdSchema,
    description: 'Get thread replies for a parent message',
    category: 'messaging',
  },
  'neolith-reply-to-thread': {
    schema: ReplyThrdSchema,
    description: 'Reply to a thread (parent message)',
    category: 'messaging',
  },
  'neolith-edit-message': {
    schema: EditMsgSchema,
    description: 'Edit an existing message (only your own messages)',
    category: 'messaging',
  },
  'neolith-delete-message': {
    schema: DeleteMsgSchema,
    description: 'Delete a message (only your own messages)',
    category: 'messaging',
  },
  'neolith-add-reaction': {
    schema: AddRxnSchema,
    description: 'Add an emoji reaction to a message',
    category: 'messaging',
  },
  'neolith-remove-reaction': {
    schema: RemoveRxnSchema,
    description: 'Remove an emoji reaction from a message',
    category: 'messaging',
  },
  'neolith-get-dm-channels': {
    schema: GetDMSchema,
    description: 'Get all DM and group DM conversations',
    category: 'messaging',
  },
  'neolith-create-dm': {
    schema: CreateDMSchemaImport,
    description: 'Create a new DM or group DM conversation with optional initial message',
    category: 'messaging',
  },
} as const;

export type MessagingToolName = keyof typeof MessagingToolSchemas;
