---
sidebar_position: 5
title: Files API
description: File operations, repository management, and content analysis API
keywords: [files, repository, content, upload, git, versioning]
---

# Files API

The Files API provides comprehensive file management capabilities including repository operations, file content analysis, upload/download functionality, and version control integration for seamless code management.

## Base URL

```
https://api.wundr.io/v1/files
```

## Overview

The Files API enables:

- **Repository Management** - Git repository integration and operations
- **File Operations** - Upload, download, and content management
- **Content Analysis** - File-level analysis and metadata extraction
- **Version Control** - Branch management and diff operations
- **Search & Discovery** - Intelligent file search and filtering
- **Batch Operations** - Bulk file processing and operations

## Endpoints

### Get Project File Tree

Retrieve the complete file structure for a project.

```http
GET /files/projects/{project_id}/tree
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch` | string | No | Git branch name (default: main) |
| `path` | string | No | Specific directory path |
| `depth` | integer | No | Maximum depth to traverse (default: unlimited) |
| `include_metadata` | boolean | No | Include file metadata (size, modified date, etc.) |
| `filter` | string | No | File extension filter (e.g., `.ts,.js,.tsx`) |
| `exclude_patterns` | string | No | Comma-separated exclude patterns |

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "branch": "main",
    "commit": "a1b2c3d4e5f6",
    "generated_at": "2024-09-16T10:30:00Z",
    "root": {
      "name": "root",
      "type": "directory",
      "path": "",
      "children": [
        {
          "name": "src",
          "type": "directory",
          "path": "src",
          "size": 1250000,
          "file_count": 45,
          "children": [
            {
              "name": "components",
              "type": "directory",
              "path": "src/components",
              "file_count": 12,
              "children": [
                {
                  "name": "Button.tsx",
                  "type": "file",
                  "path": "src/components/Button.tsx",
                  "size": 2048,
                  "language": "typescript",
                  "modified_at": "2024-09-16T09:15:00Z",
                  "lines": 85,
                  "complexity": 3,
                  "test_coverage": 95.5,
                  "quality_score": 8.7,
                  "issues": []
                }
              ]
            },
            {
              "name": "utils",
              "type": "directory",
              "path": "src/utils",
              "file_count": 8
            }
          ]
        },
        {
          "name": "tests",
          "type": "directory",
          "path": "tests",
          "file_count": 23
        },
        {
          "name": "package.json",
          "type": "file",
          "path": "package.json",
          "size": 1024,
          "language": "json",
          "modified_at": "2024-09-15T14:20:00Z"
        }
      ]
    },
    "summary": {
      "total_files": 68,
      "total_size": 1450000,
      "languages": {
        "typescript": 45,
        "javascript": 12,
        "json": 8,
        "markdown": 3
      },
      "directories": 15
    }
  }
}
```

### Get File Content

Retrieve the content of a specific file.

```http
GET /files/content
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |
| `path` | string | Yes | File path relative to project root |
| `branch` | string | No | Git branch (default: main) |
| `commit` | string | No | Specific commit hash |
| `format` | string | No | Response format: `raw`, `json`, `highlighted` |
| `include_metadata` | boolean | No | Include file analysis metadata |

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "file_path": "src/components/Button.tsx",
    "branch": "main",
    "commit": "a1b2c3d4e5f6",
    "content": "import React from 'react';\nimport { ButtonProps } from './types';\n\nexport const Button: React.FC<ButtonProps> = ({\n  children,\n  variant = 'primary',\n  size = 'medium',\n  disabled = false,\n  onClick,\n  ...props\n}) => {\n  return (\n    <button\n      className={`btn btn-${variant} btn-${size}`}\n      disabled={disabled}\n      onClick={onClick}\n      {...props}\n    >\n      {children}\n    </button>\n  );\n};",
    "metadata": {
      "size": 2048,
      "lines": 85,
      "language": "typescript",
      "encoding": "utf-8",
      "modified_at": "2024-09-16T09:15:00Z",
      "author": "jane.doe@company.com",
      "last_commit": {
        "hash": "a1b2c3d4e5f6",
        "message": "feat: add Button component with variants",
        "author": "Jane Doe",
        "date": "2024-09-16T09:15:00Z"
      }
    },
    "analysis": {
      "complexity": 3,
      "maintainability": 8.7,
      "test_coverage": 95.5,
      "issues": [],
      "dependencies": [
        {
          "name": "react",
          "type": "external",
          "version": "^18.2.0"
        },
        {
          "name": "./types",
          "type": "internal",
          "path": "src/components/types.ts"
        }
      ],
      "exports": [
        {
          "name": "Button",
          "type": "component",
          "line": 4
        }
      ]
    }
  }
}
```

### Upload Files

Upload files to a project.

```http
POST /files/upload
```

#### Request Body (multipart/form-data)

```
project_id: proj_abc123
path: src/components/NewComponent.tsx
branch: feature/new-component
message: Add new component
author_name: John Doe
author_email: john.doe@company.com
file: [binary file data]
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |
| `path` | string | Yes | Target file path |
| `branch` | string | No | Target branch (default: main) |
| `message` | string | No | Commit message |
| `author_name` | string | No | Commit author name |
| `author_email` | string | No | Commit author email |
| `overwrite` | boolean | No | Overwrite existing file |
| `create_branch` | boolean | No | Create branch if it doesn't exist |

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "file_path": "src/components/NewComponent.tsx",
    "branch": "feature/new-component",
    "commit": {
      "hash": "b2c3d4e5f6g7",
      "message": "Add new component",
      "author": "John Doe <john.doe@company.com>",
      "timestamp": "2024-09-16T11:00:00Z"
    },
    "file_info": {
      "size": 1536,
      "language": "typescript",
      "lines": 42,
      "encoding": "utf-8"
    },
    "analysis_triggered": true,
    "download_url": "https://api.wundr.io/v1/files/download/file_xyz789"
  }
}
```

### Bulk Upload

Upload multiple files in a single operation.

```http
POST /files/bulk-upload
```

#### Request Body

```json
{
  "project_id": "proj_abc123",
  "branch": "feature/bulk-update",
  "commit_message": "Bulk file upload",
  "author": {
    "name": "John Doe",
    "email": "john.doe@company.com"
  },
  "files": [
    {
      "path": "src/utils/helpers.ts",
      "content": "export const formatDate = (date: Date): string => { ... }",
      "encoding": "utf-8"
    },
    {
      "path": "src/utils/constants.ts",
      "content": "export const API_BASE_URL = 'https://api.example.com';",
      "encoding": "utf-8"
    }
  ],
  "options": {
    "create_branch": true,
    "trigger_analysis": true,
    "notification_webhook": "https://your-app.com/webhook"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "branch": "feature/bulk-update",
    "commit": {
      "hash": "c3d4e5f6g7h8",
      "message": "Bulk file upload",
      "files_added": 2,
      "files_modified": 0,
      "files_deleted": 0
    },
    "uploaded_files": [
      {
        "path": "src/utils/helpers.ts",
        "status": "created",
        "size": 256,
        "analysis_id": "analysis_helpers_123"
      },
      {
        "path": "src/utils/constants.ts",
        "status": "created",
        "size": 128,
        "analysis_id": "analysis_constants_124"
      }
    ],
    "analysis": {
      "triggered": true,
      "batch_id": "batch_upload_xyz789",
      "estimated_completion": "2024-09-16T11:15:00Z"
    }
  }
}
```

### Delete Files

Delete one or more files from a project.

```http
DELETE /files/{file_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_id` | string | Yes | File identifier |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `commit_message` | string | No | Deletion commit message |
| `branch` | string | No | Target branch |
| `force` | boolean | No | Force deletion (bypass protection) |

#### Response

```json
{
  "success": true,
  "data": {
    "file_id": "file_xyz789",
    "path": "src/utils/deprecated.ts",
    "deleted_at": "2024-09-16T11:30:00Z",
    "commit": {
      "hash": "d4e5f6g7h8i9",
      "message": "Remove deprecated utility file"
    },
    "backup_available": true,
    "recovery_expires": "2024-10-16T11:30:00Z"
  }
}
```

### Search Files

Search for files based on content, name, or metadata.

```http
GET /files/search
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |
| `query` | string | Yes | Search query |
| `type` | string | No | Search type: `content`, `name`, `path`, `metadata` |
| `language` | string | No | Filter by programming language |
| `extension` | string | No | Filter by file extension |
| `min_size` | integer | No | Minimum file size in bytes |
| `max_size` | integer | No | Maximum file size in bytes |
| `modified_after` | string | No | Files modified after date (ISO 8601) |
| `modified_before` | string | No | Files modified before date (ISO 8601) |
| `page` | integer | No | Page number |
| `per_page` | integer | No | Results per page (max 100) |

#### Response

```json
{
  "success": true,
  "data": {
    "query": "Button component",
    "search_type": "content",
    "total_results": 15,
    "search_time_ms": 45,
    "results": [
      {
        "file_id": "file_abc123",
        "path": "src/components/Button.tsx",
        "name": "Button.tsx",
        "relevance_score": 0.95,
        "matches": [
          {
            "line": 4,
            "content": "export const Button: React.FC<ButtonProps> = ({",
            "highlight": "Button",
            "context": "React functional component definition"
          },
          {
            "line": 15,
            "content": "  return (",
            "highlight": "Button",
            "context": "JSX element"
          }
        ],
        "metadata": {
          "size": 2048,
          "language": "typescript",
          "modified_at": "2024-09-16T09:15:00Z",
          "quality_score": 8.7
        }
      }
    ],
    "facets": {
      "languages": {
        "typescript": 8,
        "javascript": 4,
        "jsx": 3
      },
      "directories": {
        "src/components": 7,
        "src/utils": 3,
        "tests": 5
      }
    }
  }
}
```

### Get File History

Retrieve version history for a specific file.

```http
GET /files/history
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |
| `path` | string | Yes | File path |
| `branch` | string | No | Branch name |
| `limit` | integer | No | Maximum number of commits (default: 50) |
| `offset` | integer | No | Pagination offset |

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "file_path": "src/components/Button.tsx",
    "branch": "main",
    "history": [
      {
        "commit": "a1b2c3d4e5f6",
        "message": "feat: add Button component with variants",
        "author": {
          "name": "Jane Doe",
          "email": "jane.doe@company.com"
        },
        "timestamp": "2024-09-16T09:15:00Z",
        "changes": {
          "type": "added",
          "lines_added": 85,
          "lines_removed": 0,
          "size_change": 2048
        }
      },
      {
        "commit": "b2c3d4e5f6g7",
        "message": "fix: improve Button accessibility",
        "author": {
          "name": "John Smith",
          "email": "john.smith@company.com"
        },
        "timestamp": "2024-09-16T14:30:00Z",
        "changes": {
          "type": "modified",
          "lines_added": 12,
          "lines_removed": 3,
          "size_change": 156
        }
      }
    ],
    "pagination": {
      "total_commits": 8,
      "has_more": true,
      "next_offset": 2
    }
  }
}
```

### Compare File Versions

Compare two versions of a file.

```http
GET /files/compare
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |
| `path` | string | Yes | File path |
| `from_commit` | string | Yes | Source commit hash |
| `to_commit` | string | Yes | Target commit hash |
| `format` | string | No | Diff format: `unified`, `split`, `json` |

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "file_path": "src/components/Button.tsx",
    "from_commit": "a1b2c3d4e5f6",
    "to_commit": "b2c3d4e5f6g7",
    "diff": {
      "additions": 12,
      "deletions": 3,
      "changes": [
        {
          "type": "addition",
          "line_number": 15,
          "content": "+ aria-label={ariaLabel}",
          "context": "Adding accessibility attribute"
        },
        {
          "type": "deletion",
          "line_number": 20,
          "content": "- // TODO: Add accessibility",
          "context": "Removing completed TODO"
        },
        {
          "type": "modification",
          "line_number": 25,
          "old_content": "- <button className={className}>",
          "new_content": "+ <button className={`btn ${className}`}>",
          "context": "Updating CSS class structure"
        }
      ]
    },
    "analysis_diff": {
      "complexity_change": 0,
      "quality_score_change": 0.3,
      "new_issues": [],
      "resolved_issues": [
        {
          "type": "accessibility",
          "message": "Missing aria-label attribute"
        }
      ]
    }
  }
}
```

## Repository Operations

### Clone Repository

```http
POST /files/repositories/clone
```

### Create Branch

```http
POST /files/repositories/{project_id}/branches
```

### Merge Branches

```http
POST /files/repositories/{project_id}/merge
```

## Code Examples

### Node.js/TypeScript

```typescript
import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY
});

// Get project file tree
const tree = await client.files.getTree('proj_abc123', {
  includeMetadata: true,
  filter: '.ts,.tsx,.js,.jsx'
});

// Read file content
const file = await client.files.getContent({
  projectId: 'proj_abc123',
  path: 'src/components/Button.tsx',
  includeMetadata: true
});

// Upload new file
const upload = await client.files.upload({
  projectId: 'proj_abc123',
  path: 'src/components/NewComponent.tsx',
  content: componentCode,
  branch: 'feature/new-component',
  message: 'Add new component'
});

// Search files
const results = await client.files.search({
  projectId: 'proj_abc123',
  query: 'useState hook',
  type: 'content',
  language: 'typescript'
});

// Get file history
const history = await client.files.getHistory({
  projectId: 'proj_abc123',
  path: 'src/components/Button.tsx',
  limit: 10
});
```

### Python

```python
from wundr_sdk import WundrClient

client = WundrClient(api_key=os.getenv('WUNDR_API_KEY'))

# Get file tree
tree = client.files.get_tree(
    project_id='proj_abc123',
    include_metadata=True,
    filter='.py,.pyi'
)

# Read file content
content = client.files.get_content(
    project_id='proj_abc123',
    path='src/models/user.py',
    include_metadata=True
)

# Upload file
upload_result = client.files.upload(
    project_id='proj_abc123',
    path='src/utils/new_helper.py',
    content=python_code,
    message='Add new utility function'
)

# Search for files
search_results = client.files.search(
    project_id='proj_abc123',
    query='class User',
    type='content',
    language='python'
)
```

### CLI Commands

```bash
# Get file tree
wundr files tree proj_abc123 --depth 3 --format json

# Read file content
wundr files get proj_abc123 src/components/Button.tsx --metadata

# Upload file
wundr files upload proj_abc123 ./local-file.ts src/utils/new-util.ts \
  --branch feature/new-util --message "Add new utility"

# Search files
wundr files search proj_abc123 "useState" --type content --language typescript

# Compare file versions
wundr files diff proj_abc123 src/app.ts --from abc123 --to def456

# Get file history
wundr files history proj_abc123 src/components/Button.tsx --limit 10
```

## Webhook Events

### File Events

- `file.uploaded` - New file uploaded
- `file.modified` - File content changed
- `file.deleted` - File removed
- `file.moved` - File path changed
- `file.analysis_completed` - File analysis finished

### Repository Events

- `repository.cloned` - Repository cloned
- `branch.created` - New branch created
- `branch.merged` - Branch merged
- `commit.created` - New commit added

### Payload Example

```json
{
  "event": "file.uploaded",
  "project_id": "proj_abc123",
  "timestamp": "2024-09-16T11:00:00Z",
  "data": {
    "file_path": "src/components/NewComponent.tsx",
    "branch": "feature/new-component",
    "commit": "b2c3d4e5f6g7",
    "author": "john.doe@company.com",
    "size": 1536,
    "language": "typescript",
    "analysis_triggered": true
  }
}
```

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `FILE_NOT_FOUND` | File doesn't exist at specified path | Check file path and branch |
| `PERMISSION_DENIED` | Insufficient permissions | Verify project access rights |
| `FILE_TOO_LARGE` | File exceeds size limit | Split file or upgrade plan |
| `INVALID_ENCODING` | Unsupported file encoding | Convert to UTF-8 or binary upload |
| `BRANCH_NOT_FOUND` | Specified branch doesn't exist | Create branch or use existing one |
| `MERGE_CONFLICT` | Conflicting changes detected | Resolve conflicts manually |

## Rate Limits

| Plan | API Calls/Hour | Upload MB/Day | Storage GB |
|------|---------------|---------------|------------|
| **Free** | 1,000 | 100 | 1 |
| **Pro** | 10,000 | 1,000 | 50 |
| **Team** | 50,000 | 10,000 | 500 |
| **Enterprise** | Unlimited | Unlimited | Unlimited |

## Best Practices

### File Management

1. **Consistent Naming**: Use consistent file naming conventions
2. **Logical Structure**: Organize files in logical directory structures
3. **Version Control**: Leverage branch-based workflows
4. **Metadata Usage**: Include meaningful commit messages and metadata

### Performance Optimization

1. **Batch Operations**: Use bulk upload for multiple files
2. **Selective Loading**: Use filters to load only needed files
3. **Caching**: Cache frequently accessed file content
4. **Compression**: Compress large files before upload

### Security

1. **Access Control**: Implement proper file access permissions
2. **Content Validation**: Validate file content before upload
3. **Virus Scanning**: Enable automated security scanning
4. **Backup Strategy**: Maintain regular file backups

## Next Steps

- **[Analysis API](/api/analysis)** - Analyze uploaded files
- **[Batch Processing](/api/batches)** - Process multiple files
- **[File Search Guide](/guides/file-search)** - Advanced search techniques
- **[Repository Integration](/guides/git-integration)** - Git workflow integration