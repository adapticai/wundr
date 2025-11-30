/**
 * @genesis/core - File Record Service
 *
 * Service for managing file records in the database.
 * Tracks uploaded files with metadata and relationships.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import { GenesisError, TransactionError } from '../errors';

import type {
  CreateFileRecordInput,
  UpdateFileRecordInput,
  FileRecordWithRelations,
  FileRecordListOptions,
  PaginatedFileRecordResult,
} from '../types/storage';
import type { PrismaClient, Prisma, FileStatus } from '@neolith/database';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a file record is not found.
 */
export class FileRecordNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 's3Key' = 'id') {
    super(
      `File record not found with ${identifierType}: ${identifier}`,
      'FILE_RECORD_NOT_FOUND',
      404,
      { identifier, identifierType },
    );
    this.name = 'FileRecordNotFoundError';
  }
}

/**
 * Error thrown when file record validation fails.
 */
export class FileRecordValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'FILE_RECORD_VALIDATION_ERROR', 400, { errors });
    this.name = 'FileRecordValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when workspace is not found.
 */
export class WorkspaceNotFoundError extends GenesisError {
  constructor(workspaceId: string) {
    super(
      `Workspace not found: ${workspaceId}`,
      'WORKSPACE_NOT_FOUND',
      404,
      { workspaceId },
    );
    this.name = 'WorkspaceNotFoundError';
  }
}

/**
 * Error thrown when user is not found.
 */
export class UserNotFoundError extends GenesisError {
  constructor(userId: string) {
    super(
      `User not found: ${userId}`,
      'USER_NOT_FOUND',
      404,
      { userId },
    );
    this.name = 'UserNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for file record database operations.
 */
export interface FileRecordService {
  /**
   * Creates a new file record in the database.
   *
   * @param input - File record creation input
   * @returns The created file record
   * @throws {WorkspaceNotFoundError} If workspace doesn't exist
   * @throws {UserNotFoundError} If user doesn't exist
   * @throws {FileRecordValidationError} If validation fails
   */
  createRecord(input: CreateFileRecordInput): Promise<FileRecordWithRelations>;

  /**
   * Gets a file record by ID.
   *
   * @param id - The file record ID
   * @returns The file record or null if not found
   */
  getRecord(id: string): Promise<FileRecordWithRelations | null>;

  /**
   * Gets a file record by S3 key.
   *
   * @param s3Key - The S3 object key
   * @returns The file record or null if not found
   */
  getRecordByS3Key(s3Key: string): Promise<FileRecordWithRelations | null>;

  /**
   * Gets all file records for a message.
   *
   * @param messageId - The message ID
   * @returns Array of file records attached to the message
   */
  getRecordsByMessage(messageId: string): Promise<FileRecordWithRelations[]>;

  /**
   * Gets all file records in a channel.
   *
   * @param channelId - The channel ID
   * @param options - List options
   * @returns Paginated file records
   */
  getRecordsByChannel(
    channelId: string,
    options?: FileRecordListOptions
  ): Promise<PaginatedFileRecordResult>;

  /**
   * Gets all file records in a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param options - List options
   * @returns Paginated file records
   */
  getRecordsByWorkspace(
    workspaceId: string,
    options?: FileRecordListOptions
  ): Promise<PaginatedFileRecordResult>;

  /**
   * Gets all file records uploaded by a user.
   *
   * @param userId - The user ID
   * @param options - List options
   * @returns Paginated file records
   */
  getRecordsByUser(
    userId: string,
    options?: FileRecordListOptions
  ): Promise<PaginatedFileRecordResult>;

  /**
   * Updates a file record.
   *
   * @param id - The file record ID
   * @param data - Update data
   * @returns The updated file record
   * @throws {FileRecordNotFoundError} If file record doesn't exist
   */
  updateRecord(id: string, data: UpdateFileRecordInput): Promise<FileRecordWithRelations>;

  /**
   * Updates file record status.
   *
   * @param id - The file record ID
   * @param status - New status
   * @returns The updated file record
   * @throws {FileRecordNotFoundError} If file record doesn't exist
   */
  updateStatus(
    id: string,
    status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  ): Promise<FileRecordWithRelations>;

  /**
   * Deletes a file record.
   *
   * @param id - The file record ID
   * @throws {FileRecordNotFoundError} If file record doesn't exist
   */
  deleteRecord(id: string): Promise<void>;

  /**
   * Deletes multiple file records.
   *
   * @param ids - Array of file record IDs
   */
  deleteRecords(ids: string[]): Promise<void>;

  /**
   * Attaches a file to a message.
   *
   * @param fileId - The file record ID
   * @param messageId - The message ID
   * @throws {FileRecordNotFoundError} If file record doesn't exist
   */
  attachToMessage(fileId: string, messageId: string): Promise<void>;

  /**
   * Detaches a file from a message.
   *
   * @param fileId - The file record ID
   * @param messageId - The message ID
   */
  detachFromMessage(fileId: string, messageId: string): Promise<void>;

  /**
   * Checks if a file record exists.
   *
   * @param id - The file record ID
   * @returns True if record exists
   */
  recordExists(id: string): Promise<boolean>;

  /**
   * Gets total storage used by a workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Total bytes used
   */
  getWorkspaceStorageUsage(workspaceId: string): Promise<bigint>;

  /**
   * Gets total storage used by a user.
   *
   * @param userId - The user ID
   * @returns Total bytes used
   */
  getUserStorageUsage(userId: string): Promise<bigint>;
}

// =============================================================================
// Default List Options
// =============================================================================

/**
 * Default options for listing file records.
 */
export const DEFAULT_FILE_RECORD_LIST_OPTIONS: Required<
  Omit<FileRecordListOptions, 'status' | 'mimeType'>
> = {
  skip: 0,
  take: 50,
  orderBy: 'createdAt',
  orderDirection: 'desc',
  includeWorkspace: false,
  includeUploader: false,
};

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * File record service implementation.
 */
export class FileRecordServiceImpl implements FileRecordService {
  private readonly db: PrismaClient;

  /**
   * Creates a new FileRecordServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  /**
   * Creates a new file record.
   */
  async createRecord(input: CreateFileRecordInput): Promise<FileRecordWithRelations> {
    // Validate input
    this.validateCreateInput(input);

    // Verify workspace exists
    const workspace = await this.db.workspace.findUnique({
      where: { id: input.workspaceId },
    });

    if (!workspace) {
      throw new WorkspaceNotFoundError(input.workspaceId);
    }

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: input.uploadedById },
    });

    if (!user) {
      throw new UserNotFoundError(input.uploadedById);
    }

    try {
      const file = await this.db.file.create({
        data: {
          filename: input.filename,
          originalName: input.originalName,
          mimeType: input.mimeType,
          size: input.size,
          s3Key: input.s3Key,
          s3Bucket: input.s3Bucket,
          workspaceId: input.workspaceId,
          uploadedById: input.uploadedById,
          thumbnailUrl: input.thumbnailUrl,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          status: 'PENDING',
        },
        include: this.getIncludeOptions(true, true),
      });

      return this.mapToFileRecord(file);
    } catch (error) {
      throw new TransactionError('createFileRecord', error instanceof Error ? error : undefined);
    }
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Gets a file record by ID.
   */
  async getRecord(id: string): Promise<FileRecordWithRelations | null> {
    const file = await this.db.file.findUnique({
      where: { id },
      include: this.getIncludeOptions(true, true),
    });

    return file ? this.mapToFileRecord(file) : null;
  }

  /**
   * Gets a file record by S3 key.
   */
  async getRecordByS3Key(s3Key: string): Promise<FileRecordWithRelations | null> {
    const file = await this.db.file.findFirst({
      where: { s3Key },
      include: this.getIncludeOptions(true, true),
    });

    return file ? this.mapToFileRecord(file) : null;
  }

  /**
   * Gets file records attached to a message.
   */
  async getRecordsByMessage(messageId: string): Promise<FileRecordWithRelations[]> {
    const attachments = await this.db.messageAttachment.findMany({
      where: { messageId },
      include: {
        file: {
          include: this.getIncludeOptions(true, true),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return attachments.map((a: typeof attachments[number]) => this.mapToFileRecord(a.file));
  }

  /**
   * Gets file records in a channel (via message attachments).
   */
  async getRecordsByChannel(
    channelId: string,
    options: FileRecordListOptions = {},
  ): Promise<PaginatedFileRecordResult> {
    const {
      status,
      mimeType,
      skip = DEFAULT_FILE_RECORD_LIST_OPTIONS.skip,
      take = DEFAULT_FILE_RECORD_LIST_OPTIONS.take,
      orderBy = DEFAULT_FILE_RECORD_LIST_OPTIONS.orderBy,
      orderDirection = DEFAULT_FILE_RECORD_LIST_OPTIONS.orderDirection,
      includeWorkspace = DEFAULT_FILE_RECORD_LIST_OPTIONS.includeWorkspace,
      includeUploader = DEFAULT_FILE_RECORD_LIST_OPTIONS.includeUploader,
    } = options;

    // Build where clause for files in channel messages
    const where: Prisma.fileWhereInput = {
      messageAttachments: {
        some: {
          message: {
            channelId,
          },
        },
      },
      ...(status && { status }),
      ...(mimeType && { mimeType: { startsWith: mimeType } }),
    };

    const [files, total] = await Promise.all([
      this.db.file.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: this.getIncludeOptions(includeWorkspace, includeUploader),
      }),
      this.db.file.count({ where }),
    ]);

    return {
      files: files.map((f: typeof files[number]) => this.mapToFileRecord(f)),
      total,
      hasMore: skip + files.length < total,
    };
  }

  /**
   * Gets file records in a workspace.
   */
  async getRecordsByWorkspace(
    workspaceId: string,
    options: FileRecordListOptions = {},
  ): Promise<PaginatedFileRecordResult> {
    const {
      status,
      mimeType,
      skip = DEFAULT_FILE_RECORD_LIST_OPTIONS.skip,
      take = DEFAULT_FILE_RECORD_LIST_OPTIONS.take,
      orderBy = DEFAULT_FILE_RECORD_LIST_OPTIONS.orderBy,
      orderDirection = DEFAULT_FILE_RECORD_LIST_OPTIONS.orderDirection,
      includeWorkspace = DEFAULT_FILE_RECORD_LIST_OPTIONS.includeWorkspace,
      includeUploader = DEFAULT_FILE_RECORD_LIST_OPTIONS.includeUploader,
    } = options;

    const where: Prisma.fileWhereInput = {
      workspaceId,
      ...(status && { status }),
      ...(mimeType && { mimeType: { startsWith: mimeType } }),
    };

    const [files, total] = await Promise.all([
      this.db.file.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: this.getIncludeOptions(includeWorkspace, includeUploader),
      }),
      this.db.file.count({ where }),
    ]);

    return {
      files: files.map((f: typeof files[number]) => this.mapToFileRecord(f)),
      total,
      hasMore: skip + files.length < total,
    };
  }

  /**
   * Gets file records uploaded by a user.
   */
  async getRecordsByUser(
    userId: string,
    options: FileRecordListOptions = {},
  ): Promise<PaginatedFileRecordResult> {
    const {
      status,
      mimeType,
      skip = DEFAULT_FILE_RECORD_LIST_OPTIONS.skip,
      take = DEFAULT_FILE_RECORD_LIST_OPTIONS.take,
      orderBy = DEFAULT_FILE_RECORD_LIST_OPTIONS.orderBy,
      orderDirection = DEFAULT_FILE_RECORD_LIST_OPTIONS.orderDirection,
      includeWorkspace = DEFAULT_FILE_RECORD_LIST_OPTIONS.includeWorkspace,
      includeUploader = DEFAULT_FILE_RECORD_LIST_OPTIONS.includeUploader,
    } = options;

    const where: Prisma.fileWhereInput = {
      uploadedById: userId,
      ...(status && { status }),
      ...(mimeType && { mimeType: { startsWith: mimeType } }),
    };

    const [files, total] = await Promise.all([
      this.db.file.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
        include: this.getIncludeOptions(includeWorkspace, includeUploader),
      }),
      this.db.file.count({ where }),
    ]);

    return {
      files: files.map((f: typeof files[number]) => this.mapToFileRecord(f)),
      total,
      hasMore: skip + files.length < total,
    };
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  /**
   * Updates a file record.
   */
  async updateRecord(
    id: string,
    data: UpdateFileRecordInput,
  ): Promise<FileRecordWithRelations> {
    // Check record exists
    const existing = await this.getRecord(id);
    if (!existing) {
      throw new FileRecordNotFoundError(id);
    }

    const updateData: Prisma.fileUpdateInput = {};

    if (data.filename !== undefined) {
      updateData.filename = data.filename;
    }

    if (data.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = data.thumbnailUrl;
    }

    if (data.status !== undefined) {
      updateData.status = data.status as FileStatus;
    }

    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata as Prisma.InputJsonValue;
    }

    const file = await this.db.file.update({
      where: { id },
      data: updateData,
      include: this.getIncludeOptions(true, true),
    });

    return this.mapToFileRecord(file);
  }

  /**
   * Updates file record status.
   */
  async updateStatus(
    id: string,
    status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED',
  ): Promise<FileRecordWithRelations> {
    // Check record exists
    const existing = await this.getRecord(id);
    if (!existing) {
      throw new FileRecordNotFoundError(id);
    }

    const file = await this.db.file.update({
      where: { id },
      data: { status: status as FileStatus },
      include: this.getIncludeOptions(true, true),
    });

    return this.mapToFileRecord(file);
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  /**
   * Deletes a file record.
   */
  async deleteRecord(id: string): Promise<void> {
    // Check record exists
    const existing = await this.getRecord(id);
    if (!existing) {
      throw new FileRecordNotFoundError(id);
    }

    try {
      await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete message attachments first
        await tx.messageAttachment.deleteMany({
          where: { fileId: id },
        });

        // Delete the file record
        await tx.file.delete({
          where: { id },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteFileRecord', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Deletes multiple file records.
   */
  async deleteRecords(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete message attachments first
        await tx.messageAttachment.deleteMany({
          where: { fileId: { in: ids } },
        });

        // Delete the file records
        await tx.file.deleteMany({
          where: { id: { in: ids } },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteFileRecords', error instanceof Error ? error : undefined);
    }
  }

  // ===========================================================================
  // Message Attachment Operations
  // ===========================================================================

  /**
   * Attaches a file to a message.
   */
  async attachToMessage(fileId: string, messageId: string): Promise<void> {
    // Check file exists
    const file = await this.getRecord(fileId);
    if (!file) {
      throw new FileRecordNotFoundError(fileId);
    }

    // Check if already attached
    const existing = await this.db.messageAttachment.findUnique({
      where: {
        messageId_fileId: {
          messageId,
          fileId,
        },
      },
    });

    if (existing) {
      return; // Already attached
    }

    await this.db.messageAttachment.create({
      data: {
        messageId,
        fileId,
      },
    });
  }

  /**
   * Detaches a file from a message.
   */
  async detachFromMessage(fileId: string, messageId: string): Promise<void> {
    await this.db.messageAttachment.deleteMany({
      where: {
        messageId,
        fileId,
      },
    });
  }

  // ===========================================================================
  // Utility Operations
  // ===========================================================================

  /**
   * Checks if a file record exists.
   */
  async recordExists(id: string): Promise<boolean> {
    const count = await this.db.file.count({
      where: { id },
    });

    return count > 0;
  }

  /**
   * Gets total storage used by a workspace.
   */
  async getWorkspaceStorageUsage(workspaceId: string): Promise<bigint> {
    const result = await this.db.file.aggregate({
      where: { workspaceId },
      _sum: { size: true },
    });

    return result._sum.size ?? BigInt(0);
  }

  /**
   * Gets total storage used by a user.
   */
  async getUserStorageUsage(userId: string): Promise<bigint> {
    const result = await this.db.file.aggregate({
      where: { uploadedById: userId },
      _sum: { size: true },
    });

    return result._sum.size ?? BigInt(0);
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Validates create input.
   */
  private validateCreateInput(input: CreateFileRecordInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.filename || input.filename.trim().length === 0) {
      errors.filename = ['Filename is required'];
    }

    if (!input.originalName || input.originalName.trim().length === 0) {
      errors.originalName = ['Original name is required'];
    }

    if (!input.mimeType || input.mimeType.trim().length === 0) {
      errors.mimeType = ['MIME type is required'];
    }

    if (input.size === undefined || input.size < 0) {
      errors.size = ['Valid file size is required'];
    }

    if (!input.s3Key || input.s3Key.trim().length === 0) {
      errors.s3Key = ['S3 key is required'];
    }

    if (!input.s3Bucket || input.s3Bucket.trim().length === 0) {
      errors.s3Bucket = ['S3 bucket is required'];
    }

    if (!input.workspaceId) {
      errors.workspaceId = ['Workspace ID is required'];
    }

    if (!input.uploadedById) {
      errors.uploadedById = ['Uploader ID is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new FileRecordValidationError('File record validation failed', errors);
    }
  }

  /**
   * Gets include options for Prisma queries.
   */
  private getIncludeOptions(
    includeWorkspace: boolean,
    includeUploader: boolean,
  ): Prisma.fileInclude {
    return {
      ...(includeWorkspace && {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      }),
      ...(includeUploader && {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      }),
    };
  }

  /**
   * Maps a Prisma file to FileRecordWithRelations.
   */
  private mapToFileRecord(file: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: bigint;
    s3Key: string;
    s3Bucket: string;
    thumbnailUrl: string | null;
    status: FileStatus;
    metadata: Prisma.JsonValue;
    workspaceId: string;
    uploadedById: string;
    createdAt: Date;
    updatedAt: Date;
    workspace?: {
      id: string;
      name: string;
      slug: string;
    };
    uploader?: {
      id: string;
      name: string | null;
      email: string;
    };
  }): FileRecordWithRelations {
    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      thumbnailUrl: file.thumbnailUrl,
      status: file.status,
      metadata: (file.metadata as Record<string, unknown>) ?? {},
      workspaceId: file.workspaceId,
      uploadedById: file.uploadedById,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      workspace: file.workspace,
      uploader: file.uploader,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new file record service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns File record service instance
 *
 * @example
 * ```typescript
 * const fileRecordService = createFileRecordService();
 *
 * // Create a file record after uploading to S3
 * const record = await fileRecordService.createRecord({
 *   filename: 'document.pdf',
 *   originalName: 'My Document.pdf',
 *   mimeType: 'application/pdf',
 *   size: BigInt(1024000),
 *   s3Key: 'workspace123/2024/01/abc123/document.pdf',
 *   s3Bucket: 'genesis-files',
 *   workspaceId: 'workspace123',
 *   uploadedById: 'user456',
 * });
 *
 * // Update status after processing
 * await fileRecordService.updateStatus(record.id, 'READY');
 *
 * // Attach to a message
 * await fileRecordService.attachToMessage(record.id, 'message789');
 * ```
 */
export function createFileRecordService(database?: PrismaClient): FileRecordServiceImpl {
  return new FileRecordServiceImpl(database);
}

/**
 * Default file record service instance using the singleton Prisma client.
 */
export const fileRecordService = createFileRecordService();
