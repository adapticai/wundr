/**
 * Slack Canvas Capability
 *
 * Provides canvas (collaborative document) functionality for the VP (Virtual Principal) agent
 * to work with Slack canvases in workspaces like a human user.
 *
 * @module @wundr/slack-agent/capabilities/canvas
 */

import { WebClient } from '@slack/web-api';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported operations for canvas content changes
 */
export type CanvasOperation =
  | 'insert_after'
  | 'insert_before'
  | 'insert_at_start'
  | 'insert_at_end'
  | 'replace'
  | 'delete';

/**
 * Section types for canvas section filtering
 */
export type CanvasSectionType = 'any_header' | 'h1' | 'h2' | 'h3';

/**
 * Access level for canvas sharing
 */
export type CanvasAccessLevel = 'read' | 'write';

/**
 * Document content structure for canvas content
 * Slack canvases use markdown format for content
 */
export interface DocumentContent {
  /** The type of content - always 'markdown' for Slack canvases */
  type: 'markdown';
  /** The markdown content defining the canvas content */
  markdown: string;
}

/**
 * Canvas content - a convenience wrapper around DocumentContent
 */
export interface CanvasContent {
  /** Markdown content for the canvas */
  markdown: string;
}

/**
 * Represents a Slack canvas
 */
export interface Canvas {
  /** Unique canvas identifier */
  id: string;
  /** Canvas title (if set) */
  title?: string;
  /** Unix timestamp of creation */
  createdAt?: number;
  /** User ID of creator */
  createdBy?: string;
  /** Channel ID if canvas is associated with a channel */
  channelId?: string;
}

/**
 * A section within a canvas
 */
export interface CanvasSection {
  /** Section identifier */
  id: string;
}

/**
 * Criteria for looking up sections in a canvas
 */
export interface SectionLookupCriteria {
  /** Section types to filter by (1-3 types) */
  sectionTypes?: CanvasSectionType[];
  /** Text that must appear in the section */
  containsText?: string;
}

/**
 * A change to apply to a canvas
 */
export interface CanvasChange {
  /** The operation to perform */
  operation: CanvasOperation;
  /** The section ID to target (required for some operations) */
  sectionId?: string;
  /** The content to insert/replace (required for non-delete operations) */
  content?: CanvasContent;
}

/**
 * Configuration for SlackCanvasCapability
 */
export interface CanvasCapabilityConfig {
  /** Slack WebClient instance */
  client: WebClient;
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error indicating a canvas operation is not supported
 */
export class CanvasNotSupportedError extends Error {
  constructor(operation: string, reason: string) {
    super(`Canvas operation '${operation}' is not supported: ${reason}`);
    this.name = 'CanvasNotSupportedError';
  }
}

/**
 * Error for canvas-related failures
 */
export class CanvasError extends Error {
  public readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CanvasError';
    this.code = code;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert CanvasContent to Slack DocumentContent format
 */
function toDocumentContent(content: CanvasContent): DocumentContent {
  return {
    type: 'markdown',
    markdown: content.markdown,
  };
}

/**
 * Build section criteria for Slack API
 */
function buildCriteria(criteria: SectionLookupCriteria): {
  section_types?: CanvasSectionType[];
  contains_text?: string;
} {
  const result: { section_types?: CanvasSectionType[]; contains_text?: string } = {};

  if (criteria.sectionTypes && criteria.sectionTypes.length > 0) {
    result.section_types = criteria.sectionTypes;
  }

  if (criteria.containsText) {
    result.contains_text = criteria.containsText;
  }

  return result;
}

/**
 * Build a change object for the Slack API
 */
function buildChange(change: CanvasChange): Record<string, unknown> {
  const result: Record<string, unknown> = {
    operation: change.operation,
  };

  if (change.sectionId) {
    result.section_id = change.sectionId;
  }

  if (change.content) {
    result.document_content = toDocumentContent(change.content);
  }

  return result;
}

// =============================================================================
// SlackCanvasCapability Class
// =============================================================================

/**
 * SlackCanvasCapability - Manages Slack canvases
 *
 * Provides functionality for the VP agent to create, edit, delete, and share
 * canvases in Slack workspaces.
 *
 * @example
 * ```typescript
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const canvasCapability = new SlackCanvasCapability({ client });
 *
 * // Create a standalone canvas
 * const canvas = await canvasCapability.createCanvas('My Canvas', {
 *   markdown: '# Hello World\n\nThis is my canvas content.',
 * });
 *
 * // Create a canvas in a channel
 * const channelCanvas = await canvasCapability.createChannelCanvas(
 *   'C1234567890',
 *   'Team Notes',
 *   { markdown: '# Team Notes\n\n- Item 1\n- Item 2' }
 * );
 *
 * // Edit canvas content
 * await canvasCapability.editCanvas(canvas.id, { markdown: '# Updated Content' });
 *
 * // Share canvas with users
 * await canvasCapability.shareCanvas(canvas.id, ['U1234567890'], 'write');
 * ```
 */
export class SlackCanvasCapability {
  private client: WebClient;

  constructor(config: CanvasCapabilityConfig) {
    this.client = config.client;
  }

  // ===========================================================================
  // Canvas Creation
  // ===========================================================================

  /**
   * Create a new standalone canvas
   *
   * Creates a canvas that is not automatically associated with any channel.
   * The canvas can later be shared to channels or users.
   *
   * @param title - Title for the canvas
   * @param content - Optional initial content in markdown format
   * @returns Promise resolving to the created Canvas
   * @throws CanvasError if creation fails
   *
   * @example
   * ```typescript
   * const canvas = await capability.createCanvas('Project Plan', {
   *   markdown: '# Project Plan\n\n## Goals\n\n1. Define scope\n2. Build MVP',
   * });
   * console.log(`Created canvas: ${canvas.id}`);
   * ```
   */
  async createCanvas(title: string, content?: CanvasContent): Promise<Canvas> {
    try {
      const response = await this.client.canvases.create({
        title,
        document_content: content ? toDocumentContent(content) : undefined,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to create canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }

      if (!response.canvas_id) {
        throw new CanvasError('Canvas created but no canvas_id returned');
      }

      return {
        id: response.canvas_id,
        title,
      };
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to create canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to create canvas: Unknown error');
    }
  }

  /**
   * Create a canvas in a specific channel
   *
   * Creates a canvas that is automatically associated with and shared to the specified channel.
   *
   * @param channelId - The channel ID to create the canvas in
   * @param title - Title for the canvas
   * @param content - Optional initial content in markdown format
   * @returns Promise resolving to the created Canvas with channelId
   * @throws CanvasError if creation fails
   *
   * @example
   * ```typescript
   * const canvas = await capability.createChannelCanvas(
   *   'C0123456789',
   *   'Sprint Retrospective',
   *   { markdown: '# Sprint Retrospective\n\n## What went well?\n\n## What could improve?' }
   * );
   * ```
   */
  async createChannelCanvas(
    channelId: string,
    title: string,
    content?: CanvasContent,
  ): Promise<Canvas> {
    try {
      const response = await this.client.conversations.canvases.create({
        channel_id: channelId,
        title,
        document_content: content ? toDocumentContent(content) : undefined,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to create channel canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }

      if (!response.canvas_id) {
        throw new CanvasError('Channel canvas created but no canvas_id returned');
      }

      return {
        id: response.canvas_id,
        title,
        channelId,
      };
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to create channel canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to create channel canvas: Unknown error');
    }
  }

  // ===========================================================================
  // Canvas Editing
  // ===========================================================================

  /**
   * Edit a canvas by replacing all content
   *
   * Replaces the entire canvas content with new markdown content.
   *
   * @param canvasId - The canvas ID to edit
   * @param content - New content to replace the canvas with
   * @throws CanvasError if editing fails
   *
   * @example
   * ```typescript
   * await capability.editCanvas('F0123456789', {
   *   markdown: '# Updated Content\n\nThis replaces all previous content.',
   * });
   * ```
   */
  async editCanvas(canvasId: string, content: CanvasContent): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'replace',
            document_content: toDocumentContent(content),
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to edit canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to edit canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to edit canvas: Unknown error');
    }
  }

  /**
   * Append content to the end of a canvas
   *
   * Adds new content at the end of the existing canvas content.
   *
   * @param canvasId - The canvas ID to append to
   * @param content - Content to append
   * @throws CanvasError if appending fails
   *
   * @example
   * ```typescript
   * await capability.appendToCanvas('F0123456789', {
   *   markdown: '\n## New Section\n\nThis content is appended.',
   * });
   * ```
   */
  async appendToCanvas(canvasId: string, content: CanvasContent): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'insert_at_end',
            document_content: toDocumentContent(content),
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to append to canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to append to canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to append to canvas: Unknown error');
    }
  }

  /**
   * Prepend content to the beginning of a canvas
   *
   * Adds new content at the start of the existing canvas content.
   *
   * @param canvasId - The canvas ID to prepend to
   * @param content - Content to prepend
   * @throws CanvasError if prepending fails
   *
   * @example
   * ```typescript
   * await capability.prependToCanvas('F0123456789', {
   *   markdown: '# Important Notice\n\nRead this first!\n\n---\n',
   * });
   * ```
   */
  async prependToCanvas(canvasId: string, content: CanvasContent): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'insert_at_start',
            document_content: toDocumentContent(content),
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to prepend to canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to prepend to canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to prepend to canvas: Unknown error');
    }
  }

  /**
   * Apply multiple changes to a canvas in a single operation
   *
   * Allows fine-grained control over canvas content by applying multiple changes.
   *
   * @param canvasId - The canvas ID to edit
   * @param changes - Array of changes to apply
   * @throws CanvasError if editing fails
   *
   * @example
   * ```typescript
   * await capability.applyChanges('F0123456789', [
   *   { operation: 'insert_at_start', content: { markdown: '# Header\n' } },
   *   { operation: 'insert_at_end', content: { markdown: '\n---\nFooter' } },
   * ]);
   * ```
   */
  async applyChanges(canvasId: string, changes: CanvasChange[]): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    try {
      const formattedChanges = changes.map(buildChange);
      // The Slack API requires a non-empty tuple, but our array is guaranteed non-empty
      // due to the early return above. We use 'as unknown as' to satisfy the strict type.
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: formattedChanges as unknown as Parameters<typeof this.client.canvases.edit>[0]['changes'],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to apply changes to canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to apply changes to canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to apply changes to canvas: Unknown error');
    }
  }

  // ===========================================================================
  // Canvas Deletion
  // ===========================================================================

  /**
   * Delete a canvas
   *
   * Permanently deletes the specified canvas. This action cannot be undone.
   *
   * @param canvasId - The canvas ID to delete
   * @throws CanvasError if deletion fails
   *
   * @example
   * ```typescript
   * await capability.deleteCanvas('F0123456789');
   * ```
   */
  async deleteCanvas(canvasId: string): Promise<void> {
    try {
      const response = await this.client.canvases.delete({
        canvas_id: canvasId,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to delete canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to delete canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to delete canvas: Unknown error');
    }
  }

  // ===========================================================================
  // Canvas Retrieval
  // ===========================================================================

  /**
   * Get canvas content/details
   *
   * Note: The Slack API does not provide a direct method to retrieve canvas content.
   * This method throws a CanvasNotSupportedError explaining the limitation.
   *
   * Workaround: Use the sections.lookup method to find specific sections,
   * or access the canvas through the Slack UI.
   *
   * @param canvasId - The canvas ID to retrieve
   * @throws CanvasNotSupportedError - Always throws as this operation is not supported
   */
  async getCanvas(canvasId: string): Promise<Canvas> {
    throw new CanvasNotSupportedError(
      'getCanvas',
      'The Slack API does not provide a method to retrieve canvas content. ' +
        'Use lookupSections() to find specific sections within a canvas, ' +
        'or access the canvas through the Slack UI. ' +
        `Canvas ID: ${canvasId}`,
    );
  }

  /**
   * Look up sections within a canvas
   *
   * Finds sections in a canvas that match the specified criteria.
   * Useful for finding specific headers or text within a canvas.
   *
   * @param canvasId - The canvas ID to search
   * @param criteria - Criteria to filter sections
   * @returns Promise resolving to matching sections
   * @throws CanvasError if lookup fails
   *
   * @example
   * ```typescript
   * // Find all h1 headers
   * const sections = await capability.lookupSections('F0123456789', {
   *   sectionTypes: ['h1'],
   * });
   *
   * // Find sections containing specific text
   * const sections = await capability.lookupSections('F0123456789', {
   *   containsText: 'Important',
   * });
   * ```
   */
  async lookupSections(
    canvasId: string,
    criteria: SectionLookupCriteria,
  ): Promise<CanvasSection[]> {
    if (!criteria.sectionTypes?.length && !criteria.containsText) {
      throw new CanvasError(
        'At least one of sectionTypes or containsText must be provided',
      );
    }

    try {
      // Build criteria and cast to the expected type
      // The Slack API expects specific criteria combinations
      const builtCriteria = buildCriteria(criteria);
      const response = await this.client.canvases.sections.lookup({
        canvas_id: canvasId,
        criteria: builtCriteria as unknown as Parameters<typeof this.client.canvases.sections.lookup>[0]['criteria'],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to lookup sections: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }

      return (response.sections ?? []).map((section) => ({
        id: section.id ?? '',
      }));
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to lookup sections: ${error.message}`);
      }
      throw new CanvasError('Failed to lookup sections: Unknown error');
    }
  }

  // ===========================================================================
  // Canvas Sharing / Access Control
  // ===========================================================================

  /**
   * Share canvas with channels and/or users
   *
   * Sets access permissions for the specified channels and users on a canvas.
   *
   * @param canvasId - The canvas ID to share
   * @param channelIds - Array of channel IDs to share with
   * @param accessLevel - Access level to grant ('read' or 'write')
   * @throws CanvasError if sharing fails
   *
   * @example
   * ```typescript
   * // Share with channels as read-only
   * await capability.shareCanvas('F0123456789', ['C0123456789', 'C9876543210']);
   *
   * // Share with channels with write access
   * await capability.shareCanvas('F0123456789', ['C0123456789'], 'write');
   * ```
   */
  async shareCanvas(
    canvasId: string,
    channelIds: string[],
    accessLevel: CanvasAccessLevel = 'read',
  ): Promise<void> {
    if (channelIds.length === 0) {
      return;
    }

    try {
      // Cast to tuple type as required by Slack API (array is guaranteed non-empty due to early return)
      const channelIdsTuple = channelIds as unknown as [string, ...string[]];
      const response = await this.client.canvases.access.set({
        canvas_id: canvasId,
        channel_ids: channelIdsTuple,
        access_level: accessLevel,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to share canvas: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }

      // Check for partial failures
      if (
        response.failed_to_update_channel_ids &&
        response.failed_to_update_channel_ids.length > 0
      ) {
        throw new CanvasError(
          `Failed to share canvas with some channels: ${response.failed_to_update_channel_ids.join(', ')}`,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to share canvas: ${error.message}`);
      }
      throw new CanvasError('Failed to share canvas: Unknown error');
    }
  }

  /**
   * Share canvas with specific users
   *
   * Sets access permissions for the specified users on a canvas.
   *
   * @param canvasId - The canvas ID to share
   * @param userIds - Array of user IDs to share with
   * @param accessLevel - Access level to grant ('read' or 'write')
   * @throws CanvasError if sharing fails
   *
   * @example
   * ```typescript
   * await capability.shareCanvasWithUsers('F0123456789', ['U0123456789'], 'write');
   * ```
   */
  async shareCanvasWithUsers(
    canvasId: string,
    userIds: string[],
    accessLevel: CanvasAccessLevel = 'read',
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      // Cast to tuple type as required by Slack API (array is guaranteed non-empty due to early return)
      const userIdsTuple = userIds as unknown as [string, ...string[]];
      const response = await this.client.canvases.access.set({
        canvas_id: canvasId,
        user_ids: userIdsTuple,
        access_level: accessLevel,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to share canvas with users: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }

      // Check for partial failures
      if (response.failed_to_update_user_ids && response.failed_to_update_user_ids.length > 0) {
        throw new CanvasError(
          `Failed to share canvas with some users: ${response.failed_to_update_user_ids.join(', ')}`,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to share canvas with users: ${error.message}`);
      }
      throw new CanvasError('Failed to share canvas with users: Unknown error');
    }
  }

  /**
   * Remove access from channels
   *
   * Removes access permissions for the specified channels from a canvas.
   *
   * @param canvasId - The canvas ID
   * @param channelIds - Array of channel IDs to remove access from
   * @throws CanvasError if removal fails
   *
   * @example
   * ```typescript
   * await capability.removeChannelAccess('F0123456789', ['C0123456789']);
   * ```
   */
  async removeChannelAccess(canvasId: string, channelIds: string[]): Promise<void> {
    if (channelIds.length === 0) {
      return;
    }

    try {
      // Cast to tuple type as required by Slack API (array is guaranteed non-empty due to early return)
      const channelIdsTuple = channelIds as unknown as [string, ...string[]];
      const response = await this.client.canvases.access.delete({
        canvas_id: canvasId,
        channel_ids: channelIdsTuple,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to remove channel access: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to remove channel access: ${error.message}`);
      }
      throw new CanvasError('Failed to remove channel access: Unknown error');
    }
  }

  /**
   * Remove access from users
   *
   * Removes access permissions for the specified users from a canvas.
   *
   * @param canvasId - The canvas ID
   * @param userIds - Array of user IDs to remove access from
   * @throws CanvasError if removal fails
   *
   * @example
   * ```typescript
   * await capability.removeUserAccess('F0123456789', ['U0123456789']);
   * ```
   */
  async removeUserAccess(canvasId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      // Cast to tuple type as required by Slack API (array is guaranteed non-empty due to early return)
      const userIdsTuple = userIds as unknown as [string, ...string[]];
      const response = await this.client.canvases.access.delete({
        canvas_id: canvasId,
        user_ids: userIdsTuple,
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to remove user access: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to remove user access: ${error.message}`);
      }
      throw new CanvasError('Failed to remove user access: Unknown error');
    }
  }

  // ===========================================================================
  // Canvas Listing
  // ===========================================================================

  /**
   * List canvases in a channel
   *
   * Note: The Slack API does not provide a direct method to list canvases in a channel.
   * This method throws a CanvasNotSupportedError explaining the limitation.
   *
   * Workaround: Use the files.list API with type filter for canvases,
   * or track canvases in your application state.
   *
   * @param channelId - The channel ID to list canvases from
   * @throws CanvasNotSupportedError - Always throws as this operation is not supported
   */
  async listChannelCanvases(channelId: string): Promise<Canvas[]> {
    throw new CanvasNotSupportedError(
      'listChannelCanvases',
      'The Slack API does not provide a method to list canvases in a channel. ' +
        'Consider tracking canvases in your application state, ' +
        'or using the Slack UI to browse channel canvases. ' +
        `Channel ID: ${channelId}`,
    );
  }

  // ===========================================================================
  // Section Operations
  // ===========================================================================

  /**
   * Delete a specific section from a canvas
   *
   * @param canvasId - The canvas ID
   * @param sectionId - The section ID to delete
   * @throws CanvasError if deletion fails
   *
   * @example
   * ```typescript
   * // First find the section
   * const sections = await capability.lookupSections('F0123456789', {
   *   containsText: 'Remove this',
   * });
   * // Then delete it
   * if (sections.length > 0) {
   *   await capability.deleteSection('F0123456789', sections[0].id);
   * }
   * ```
   */
  async deleteSection(canvasId: string, sectionId: string): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'delete',
            section_id: sectionId,
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to delete section: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to delete section: ${error.message}`);
      }
      throw new CanvasError('Failed to delete section: Unknown error');
    }
  }

  /**
   * Insert content before a specific section
   *
   * @param canvasId - The canvas ID
   * @param sectionId - The section ID to insert before
   * @param content - Content to insert
   * @throws CanvasError if insertion fails
   */
  async insertBeforeSection(
    canvasId: string,
    sectionId: string,
    content: CanvasContent,
  ): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'insert_before',
            section_id: sectionId,
            document_content: toDocumentContent(content),
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to insert before section: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to insert before section: ${error.message}`);
      }
      throw new CanvasError('Failed to insert before section: Unknown error');
    }
  }

  /**
   * Insert content after a specific section
   *
   * @param canvasId - The canvas ID
   * @param sectionId - The section ID to insert after
   * @param content - Content to insert
   * @throws CanvasError if insertion fails
   */
  async insertAfterSection(
    canvasId: string,
    sectionId: string,
    content: CanvasContent,
  ): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'insert_after',
            section_id: sectionId,
            document_content: toDocumentContent(content),
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to insert after section: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to insert after section: ${error.message}`);
      }
      throw new CanvasError('Failed to insert after section: Unknown error');
    }
  }

  /**
   * Replace content of a specific section
   *
   * @param canvasId - The canvas ID
   * @param sectionId - The section ID to replace
   * @param content - New content for the section
   * @throws CanvasError if replacement fails
   */
  async replaceSection(
    canvasId: string,
    sectionId: string,
    content: CanvasContent,
  ): Promise<void> {
    try {
      const response = await this.client.canvases.edit({
        canvas_id: canvasId,
        changes: [
          {
            operation: 'replace',
            section_id: sectionId,
            document_content: toDocumentContent(content),
          },
        ],
      });

      if (!response.ok) {
        throw new CanvasError(
          `Failed to replace section: ${response.error ?? 'Unknown error'}`,
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof CanvasError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CanvasError(`Failed to replace section: ${error.message}`);
      }
      throw new CanvasError('Failed to replace section: Unknown error');
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SlackCanvasCapability instance with a WebClient
 *
 * @param token - Slack bot or user token with canvas permissions
 * @returns Configured SlackCanvasCapability instance
 *
 * @example
 * ```typescript
 * const canvasCapability = createCanvasCapability(process.env.SLACK_TOKEN);
 *
 * const canvas = await canvasCapability.createCanvas('My Canvas', {
 *   markdown: '# Hello World',
 * });
 * ```
 */
export function createCanvasCapability(token: string): SlackCanvasCapability {
  const client = new WebClient(token);
  return new SlackCanvasCapability({ client });
}

/**
 * Create a SlackCanvasCapability instance from an existing WebClient
 *
 * @param client - Existing WebClient instance
 * @returns Configured SlackCanvasCapability instance
 */
export function createCanvasCapabilityFromClient(client: WebClient): SlackCanvasCapability {
  return new SlackCanvasCapability({ client });
}

// =============================================================================
// Exports
// =============================================================================

export default SlackCanvasCapability;
