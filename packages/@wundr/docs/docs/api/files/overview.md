---
title: Files API Overview
sidebar_label: Overview
---

# Files API

The Files API provides file management capabilities for the Wundr platform.

## Features

- File upload and download
- File versioning
- Metadata management
- Batch operations

## Getting Started

```typescript
import { FileManager } from '@wundr.io/core';

const fileManager = new FileManager();
const file = await fileManager.upload(filePath);
```

## Available Endpoints

- `/api/files/upload` - Upload file
- `/api/files/:id/download` - Download file
- `/api/files/:id/metadata` - Get file metadata