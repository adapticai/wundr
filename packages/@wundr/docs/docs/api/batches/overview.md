---
title: Batches API Overview
sidebar_label: Overview
---

# Batches API

The Batches API enables batch processing of multiple operations for improved performance.

## Features

- Batch analysis operations
- Parallel processing
- Progress tracking
- Result aggregation

## Getting Started

```typescript
import { BatchProcessor } from '@wundr.io/core';

const processor = new BatchProcessor();
const results = await processor.processBatch(operations);
```

## Available Endpoints

- `/api/batches/create` - Create new batch
- `/api/batches/:id/status` - Check batch status
- `/api/batches/:id/results` - Get batch results