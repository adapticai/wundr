---
title: Reports API Overview
sidebar_label: Overview
---

# Reports API

The Reports API generates comprehensive reports for analysis results and metrics.

## Features

- Multiple report formats (JSON, HTML, PDF)
- Custom report templates
- Scheduled report generation
- Report distribution

## Getting Started

```typescript
import { ReportGenerator } from '@wundr.io/core';

const generator = new ReportGenerator();
const report = await generator.generate(data, template);
```

## Available Endpoints

- `/api/reports/generate` - Generate report
- `/api/reports/:id/download` - Download report
- `/api/reports/templates` - List available templates