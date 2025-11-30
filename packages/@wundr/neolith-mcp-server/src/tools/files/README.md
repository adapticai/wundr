# Neolith File Management MCP Tools

MCP tools for managing files in Neolith workspaces.

## Overview

This module provides 6 MCP tools for comprehensive file management in Neolith:

1. **neolith_list_files** - List files with filtering and pagination
2. **neolith_upload_file** - Upload files to workspace
3. **neolith_download_file** - Generate download URLs and download files
4. **neolith_share_file** - Share files to channels
5. **neolith_delete_file** - Delete files from workspace
6. **neolith_get_file_info** - Get detailed file metadata

## Architecture

### API Client

The tools use `NeolithApiClient` for HTTP communication with Neolith API endpoints:

- **Location**: `/src/client/neolith-api-client.ts`
- **Features**:
  - Authentication via API token or session cookie
  - Request/response formatting
  - Error handling
  - Multipart file upload support
  - Configurable timeouts

### Tool Structure

Each tool follows a consistent pattern:

1. **Zod Schema** - Input validation using Zod
2. **Handler Function** - Business logic for API interaction
3. **Tool Definition** - MCP tool metadata for registration

### File Organization

```
files/
├── types.ts              # Shared type definitions
├── list-files.ts         # List files tool
├── upload-file.ts        # Upload file tool
├── download-file.ts      # Download file tool
├── share-file.ts         # Share file tool
├── delete-file.ts        # Delete file tool
├── get-file-info.ts      # Get file info tool
└── index.ts              # Exports all tools
```

## Tools Reference

### 1. neolith_list_files

List files in workspace with filtering and pagination.

**Input:**
```typescript
{
  workspaceId?: string;      // Optional workspace filter
  type?: 'image' | 'document' | 'audio' | 'video' | 'archive';
  limit?: number;            // Default: 20, Max: 100
  cursor?: string;           // Pagination cursor
  sortBy?: 'createdAt' | 'size' | 'filename';
  sortOrder?: 'asc' | 'desc';
}
```

**Output:**
```typescript
{
  data: FileMetadata[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}
```

**Example:**
```typescript
const result = await listFilesHandler({
  workspaceId: 'ws_123',
  type: 'image',
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc'
}, client);
```

### 2. neolith_upload_file

Upload a file from local filesystem to workspace.

**Input:**
```typescript
{
  filePath: string;          // Local file path
  workspaceId: string;       // Target workspace
  channelId?: string;        // Optional channel association
}
```

**Output:**
```typescript
{
  file: FileMetadata;
}
```

**Notes:**
- Direct upload limited to 5MB
- Supports images, documents, audio, video, archives
- MIME type auto-detected from filename extension

**Example:**
```typescript
const result = await uploadFileHandler({
  filePath: '/path/to/document.pdf',
  workspaceId: 'ws_123',
  channelId: 'ch_456'
}, client);
```

### 3. neolith_download_file

Generate presigned download URL or download file to local filesystem.

**Input:**
```typescript
{
  fileId: string;            // File to download
  expiresIn?: number;        // URL expiration (default: 3600s)
  download?: boolean;        // Force download vs inline
  savePath?: string;         // Optional local save path
}
```

**Output:**
```typescript
{
  url: string;
  expiresAt: string | null;
  filename: string;
  mimeType: string;
  size: number;
  savedTo?: string;          // If savePath provided
}
```

**Example:**
```typescript
// Get download URL
const result = await downloadFileHandler({
  fileId: 'file_123',
  expiresIn: 7200
}, client);

// Download to local filesystem
const result = await downloadFileHandler({
  fileId: 'file_123',
  savePath: '/downloads/document.pdf'
}, client);
```

### 4. neolith_share_file

Share a file to a Neolith channel by creating a message.

**Input:**
```typescript
{
  fileId: string;            // File to share
  channelId: string;         // Target channel
  message?: string;          // Optional message text
}
```

**Output:**
```typescript
{
  success: boolean;
  channelId: string;
  messageId?: string;
}
```

**Example:**
```typescript
const result = await shareFileHandler({
  fileId: 'file_123',
  channelId: 'ch_456',
  message: 'Check out this document!'
}, client);
```

### 5. neolith_delete_file

Delete a file from workspace (uploader or admin only).

**Input:**
```typescript
{
  fileId: string;            // File to delete
}
```

**Output:**
```typescript
{
  message: string;
  deletedMessageCount: number;
}
```

**Notes:**
- Only uploader or workspace admins can delete
- Deletes associated saved items
- Soft-deletes messages containing the file
- Permanent deletion from storage and database

**Example:**
```typescript
const result = await deleteFileHandler({
  fileId: 'file_123'
}, client);
```

### 6. neolith_get_file_info

Get detailed metadata for a specific file.

**Input:**
```typescript
{
  fileId: string;            // File to retrieve
}
```

**Output:**
```typescript
{
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
  metadata: Record<string, unknown>;
  uploadedById: string;
  workspaceId: string;
  createdAt: string;
  url: string;
  uploadedBy: {...};
  workspace: {...};
}
```

**Example:**
```typescript
const result = await getFileInfoHandler({
  fileId: 'file_123'
}, client);
```

## API Endpoints

The tools interact with the following Neolith API endpoints:

| Tool | Endpoint | Method |
|------|----------|--------|
| list_files | `/api/files` | GET |
| upload_file | `/api/files` | POST |
| download_file | `/api/files/:id/download` | GET |
| share_file | `/api/channels/:id/messages` | POST |
| delete_file | `/api/files/:id` | DELETE |
| get_file_info | `/api/files/:id` | GET |

## Error Handling

All tools return a consistent error format:

```typescript
{
  success: false;
  error: string;
  errorDetails: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Input validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `API_ERROR` - API request failed
- `HANDLER_ERROR` - Tool handler error
- `FILE_READ_ERROR` - Failed to read local file
- `FILE_SAVE_ERROR` - Failed to save file locally
- `UPLOAD_ERROR` - File upload failed

## Usage Examples

### List and Download Files

```typescript
// List all images in workspace
const listResult = await listFilesHandler({
  workspaceId: 'ws_123',
  type: 'image',
  limit: 50
}, client);

// Download first file
if (listResult.success && listResult.data) {
  const file = listResult.data.data[0];
  const downloadResult = await downloadFileHandler({
    fileId: file.id,
    savePath: `/downloads/${file.filename}`
  }, client);
}
```

### Upload and Share Workflow

```typescript
// Upload file to workspace
const uploadResult = await uploadFileHandler({
  filePath: '/local/report.pdf',
  workspaceId: 'ws_123'
}, client);

// Share uploaded file to channel
if (uploadResult.success && uploadResult.data) {
  const shareResult = await shareFileHandler({
    fileId: uploadResult.data.file.id,
    channelId: 'ch_456',
    message: 'Monthly report is ready!'
  }, client);
}
```

### File Management

```typescript
// Get file details
const infoResult = await getFileInfoHandler({
  fileId: 'file_123'
}, client);

// Delete if needed
if (infoResult.success) {
  const deleteResult = await deleteFileHandler({
    fileId: 'file_123'
  }, client);
}
```

## Type Definitions

See `types.ts` for complete type definitions:

- `FileMetadata` - Complete file information
- `FileListResponse` - List response with pagination
- `UploadInitResponse` - Upload URL generation
- `FileUploadResponse` - Upload completion
- `DownloadUrlResponse` - Download URL data
- `FileShareResponse` - Share confirmation
- `FileDeletionResponse` - Deletion confirmation
- `McpToolResult<T>` - Generic tool result wrapper

## Integration

### Registering Tools

```typescript
import { fileTools, fileHandlers } from './tools/files';
import { createNeolithClient } from './client/neolith-api-client';

// Create client
const client = createNeolithClient({
  baseUrl: 'https://app.neolith.dev',
  apiToken: process.env.NEOLITH_API_TOKEN
});

// Register tools with handlers
fileTools.forEach(tool => {
  registry.register(tool, {
    handler: (input) => fileHandlers[tool.name](input, client)
  });
});
```

## Testing

Example test cases:

```typescript
// Mock client for testing
const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  uploadFile: jest.fn()
};

// Test list files
test('lists files successfully', async () => {
  mockClient.get.mockResolvedValue({
    data: {
      data: [mockFile],
      pagination: { hasMore: false, nextCursor: null }
    }
  });

  const result = await listFilesHandler({ limit: 20 }, mockClient);
  expect(result.success).toBe(true);
});
```

## Security Considerations

- All tools require authentication (API token or session cookie)
- File deletion restricted to uploader or workspace admins
- File access restricted to workspace members
- Download URLs expire (default 1 hour)
- File uploads validated for type and size
- Presigned URLs for secure S3 access

## Future Enhancements

- [ ] Batch file operations
- [ ] File versioning support
- [ ] Advanced metadata filtering
- [ ] File conversion tools
- [ ] OCR and extraction integration
- [ ] Thumbnail generation
- [ ] Multi-part upload for large files
- [ ] Progress tracking for uploads/downloads
