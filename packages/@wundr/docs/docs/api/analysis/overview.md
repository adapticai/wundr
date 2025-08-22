---
title: Analysis API Overview
sidebar_label: Overview
---

# Analysis API

The Analysis API provides comprehensive code analysis capabilities for the Wundr platform.

## Features

- Code quality analysis
- Dependency analysis
- Security scanning
- Performance metrics
- Best practices validation

## Getting Started

```typescript
import { AnalysisEngine } from '@wundr.io/analysis-engine';

const engine = new AnalysisEngine();
const results = await engine.analyze(projectPath);
```

## Available Endpoints

- `/api/analysis/start` - Start analysis
- `/api/analysis/status` - Check analysis status
- `/api/analysis/results` - Get analysis results