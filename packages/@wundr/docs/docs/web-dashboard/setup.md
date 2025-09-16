# Dashboard Setup

Set up and configure the Wundr web dashboard for your team.

## Overview

The Wundr web dashboard provides a comprehensive view of your codebase quality, team metrics, and project health.

## Installation

### Local Setup

```bash
# Install dashboard package
npm install -g @wundr.io/dashboard

# Start dashboard server
wundr dashboard start --port 3000
```

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  wundr-dashboard:
    image: wundr/dashboard:latest
    ports:
      - "3000:3000"
    environment:
      - WUNDR_API_URL=http://localhost:8080
      - WUNDR_DB_URL=postgresql://user:pass@db:5432/wundr
    volumes:
      - ./config:/app/config
      - ./data:/app/data

  wundr-api:
    image: wundr/api:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/wundr
```

## Configuration

### Basic Configuration

```json
{
  "dashboard": {
    "title": "Team Quality Dashboard",
    "theme": "light",
    "refreshInterval": 30000,
    "features": {
      "realTimeUpdates": true,
      "notifications": true,
      "exports": true
    }
  }
}
```

### Authentication

```json
{
  "auth": {
    "enabled": true,
    "provider": "oauth",
    "github": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret"
    }
  }
}
```

## Dashboard Sections

### Project Overview
- Quality score trends
- Recent analysis results
- Active issues summary
- Team activity feed

### Code Quality
- Detailed quality metrics
- Pattern compliance reports
- Technical debt analysis
- Security findings

### Team Performance
- Individual contributor metrics
- Team velocity trends
- Code review statistics
- Collaboration insights

## Customization

### Widgets Configuration

```json
{
  "widgets": [
    {
      "type": "qualityTrend",
      "position": { "row": 1, "col": 1 },
      "size": { "width": 6, "height": 4 },
      "config": {
        "timeRange": "30d",
        "showPrediction": true
      }
    },
    {
      "type": "issueHeatmap",
      "position": { "row": 1, "col": 7 },
      "size": { "width": 6, "height": 4 }
    }
  ]
}
```

### Custom Themes

```css
/* custom-theme.css */
:root {
  --primary-color: #2196F3;
  --secondary-color: #FF9800;
  --background-color: #f5f5f5;
  --text-color: #333;
}
```

## Next Steps

- Learn about [Analysis View Features](./analysis.md)
- Explore [Team Collaboration Tools](./team.md)