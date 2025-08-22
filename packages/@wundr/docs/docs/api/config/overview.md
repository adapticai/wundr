---
title: Configuration API Overview
sidebar_label: Overview
---

# Configuration API

The Configuration API manages all configuration settings for the Wundr platform.

## Features

- Dynamic configuration management
- Environment-specific settings
- Configuration validation
- Hot reload support

## Getting Started

```typescript
import { ConfigManager } from '@wundr.io/config';

const config = new ConfigManager();
const settings = await config.load();
```

## Available Endpoints

- `/api/config/get` - Get configuration
- `/api/config/set` - Update configuration
- `/api/config/validate` - Validate configuration