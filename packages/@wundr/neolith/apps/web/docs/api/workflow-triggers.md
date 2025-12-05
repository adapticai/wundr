# Workflow Triggers API Documentation

## Overview

The Workflow Triggers API provides comprehensive functionality for triggering workflows through multiple channels with robust authentication, rate limiting, and logging capabilities.

## Features

- **Multiple Trigger Types**
  - Webhook triggers with unique URLs
  - API key authentication
  - Schedule triggers with cron expressions
  - Event-based triggers with conditions and filters

- **Security**
  - API key authentication with secure hashing
  - Webhook signature verification
  - Rate limiting per workflow and trigger type
  - IP tracking and user agent logging

- **Monitoring**
  - Trigger history and logs
  - Rate limit status tracking
  - Execution statistics
  - Success/failure metrics

## API Endpoints

### 1. Event-Based Triggering (Internal)

**POST** `/api/workspaces/:workspaceId/workflows/trigger`

Trigger workflows by event type (internal API for other services).

**Authentication:** Session-based (authenticated users)

**Request Body:**
```json
{
  "event": "message.created",
  "eventType": "message.created",
  "data": {
    "messageId": "msg_123",
    "channelId": "ch_456",
    "userId": "user_789"
  },
  "source": "chat-service"
}
```

**Response:**
```json
{
  "triggered": 2,
  "executions": ["exec_abc", "exec_def"],
  "message": "Triggered 2 workflow(s)"
}
```

---

### 2. Webhook Triggering

**POST** `/api/workspaces/:workspaceId/workflows/trigger/webhook/:token`

Trigger a workflow via webhook using its unique token.

**Authentication:** Webhook token (no session required)

**Optional Headers:**
```
X-Webhook-Signature: sha256_signature_of_payload
Content-Type: application/json
```

**Request Body:**
```json
{
  "key": "value",
  "data": "any JSON structure"
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec_123",
  "status": "COMPLETED",
  "message": "Workflow triggered successfully",
  "duration": 245
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640000000000
```

**Test Endpoint:**

**GET** `/api/workspaces/:workspaceId/workflows/trigger/webhook/:token`

Returns webhook information for testing.

---

### 3. API Key Triggering

**POST** `/api/workspaces/:workspaceId/workflows/trigger/api`

Trigger a workflow using API key authentication.

**Authentication:** API key in Authorization header

**Headers:**
```
Authorization: Bearer wf_abc123...
Content-Type: application/json
```

**Request Body:**
```json
{
  "workflowId": "wf_456",
  "data": {
    "key": "value"
  },
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec_123",
  "status": "COMPLETED",
  "message": "Workflow triggered successfully",
  "duration": 245,
  "dryRun": false
}
```

**Example cURL:**
```bash
curl -X POST https://api.example.com/api/workspaces/ws_123/workflows/trigger/api \
  -H "Authorization: Bearer wf_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "wf_456", "data": {"key": "value"}}'
```

---

### 4. Trigger Configuration

#### Get Configuration

**GET** `/api/workspaces/:workspaceId/workflows/trigger/config/:workflowId`

Get trigger configuration for a workflow.

**Authentication:** Session-based

**Response:**
```json
{
  "config": {
    "workflowId": "wf_123",
    "workflowName": "My Workflow",
    "triggerType": "webhook",
    "enabled": true,
    "webhook": {
      "url": "https://api.example.com/api/workspaces/ws_123/workflows/trigger/webhook/abc123...",
      "token": "abc123...",
      "secret": "***",
      "requireSignature": true,
      "hasSecret": true
    },
    "apiKey": {
      "hasKey": true
    },
    "rateLimit": {
      "current": {
        "allowed": true,
        "limit": 100,
        "remaining": 95,
        "reset": 1640000000000
      },
      "config": {
        "maxRequests": 100,
        "windowMs": 60000
      }
    },
    "statistics": {
      "totalTriggers": 150,
      "successfulTriggers": 145,
      "failedTriggers": 3,
      "rateLimitedTriggers": 2
    }
  }
}
```

#### Update Configuration

**PUT** `/api/workspaces/:workspaceId/workflows/trigger/config/:workflowId`

Update trigger configuration.

**Authentication:** Session-based (workspace member)

**Request Body:**
```json
{
  "type": "webhook",
  "enabled": true,
  "config": {
    "requireSignature": true
  },
  "rateLimit": {
    "maxRequests": 200,
    "windowMs": 60000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trigger configuration updated successfully"
}
```

#### Regenerate Credentials

**POST** `/api/workspaces/:workspaceId/workflows/trigger/config/:workflowId/regenerate`

Regenerate webhook token, secret, or API key.

**Authentication:** Session-based (workspace member)

**Request Body:**
```json
{
  "type": "webhook_token"  // or "webhook_secret" or "api_key"
}
```

**Response (webhook_token):**
```json
{
  "success": true,
  "message": "webhook token regenerated successfully",
  "regenerated": "webhook_token",
  "webhookToken": "new_token_123...",
  "webhookUrl": "https://api.example.com/api/workspaces/ws_123/workflows/trigger/webhook/new_token_123..."
}
```

**Response (api_key):**
```json
{
  "success": true,
  "message": "api key regenerated successfully",
  "regenerated": "api_key",
  "apiKey": "wf_new_key_123...",
  "warning": "Save this API key securely - it will not be shown again"
}
```

---

### 5. Trigger Logs

**GET** `/api/workspaces/:workspaceId/workflows/trigger/logs`

Get trigger logs and history.

**Authentication:** Session-based

**Query Parameters:**
```
status: success | failure | rate_limited | unauthorized (optional)
from: ISO datetime (optional)
to: ISO datetime (optional)
page: number (default: 1)
limit: number (default: 20, max: 100)
sortOrder: asc | desc (default: desc)
```

**Response:**
```json
{
  "logs": [
    {
      "id": "webhook_1640000000000_abc123",
      "workflowId": "wf_123",
      "workflowName": "My Workflow",
      "triggerType": "webhook",
      "status": "success",
      "data": { "key": "value" },
      "executionId": "exec_abc",
      "ipAddress": "192.168.1.1",
      "userAgent": "curl/7.68.0",
      "timestamp": "2023-12-20T10:30:00.000Z",
      "duration": 245
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

---

## Rate Limiting

Rate limits are applied per workflow and trigger type:

| Trigger Type | Default Limit | Window |
|--------------|---------------|--------|
| webhook      | 100 requests  | 1 minute |
| api          | 1000 requests | 1 minute |
| schedule     | 10 requests   | 1 minute |
| event        | 500 requests  | 1 minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000000 (Unix timestamp)
```

**Rate Limit Error Response:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Rate limit exceeded"
}
```
Status: `429 Too Many Requests`

---

## Webhook Signature Verification

When webhook signature verification is enabled, requests must include a valid signature.

**1. Generate Signature:**
```javascript
const crypto = require('crypto');
const payload = JSON.stringify(requestBody);
const secret = 'your_webhook_secret';
const signature = crypto
  .createHash('sha256')
  .update(secret + payload)
  .digest('hex');
```

**2. Include in Request:**
```bash
curl -X POST https://api.example.com/api/workspaces/ws_123/workflows/trigger/webhook/token_123 \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: your_generated_signature" \
  -d '{"key": "value"}'
```

---

## Schedule Triggers

Configure workflows to run on a schedule using cron expressions.

**Supported Formats:**
- 5-field: `minute hour day month weekday`
- 6-field: `second minute hour day month weekday`

**Examples:**
```
*/5 * * * *        Every 5 minutes
0 9 * * 1-5        Weekdays at 9 AM
0 0 1 * *          First day of month at midnight
0 */2 * * *        Every 2 hours
```

**Common Presets:**
- `every-minute`: `* * * * *`
- `every-5-minutes`: `*/5 * * * *`
- `every-hour`: `0 * * * *`
- `every-day`: `0 0 * * *`
- `every-week`: `0 0 * * 0`
- `weekdays-9am`: `0 9 * * 1-5`

**Update Schedule:**
```json
{
  "type": "schedule",
  "config": {
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "enabled": true
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Missing or invalid authentication |
| WORKSPACE_NOT_FOUND | Workspace not found or access denied |
| WORKFLOW_NOT_FOUND | Workflow not found |
| WORKFLOW_INACTIVE | Workflow is not active |
| VALIDATION_ERROR | Invalid request data or rate limit exceeded |
| EXECUTION_FAILED | Workflow execution failed |
| INTERNAL_ERROR | Internal server error |

---

## Security Best Practices

1. **API Keys**
   - Store API keys securely (never commit to version control)
   - Rotate keys regularly
   - Use environment variables

2. **Webhook Secrets**
   - Always enable signature verification in production
   - Use strong, randomly generated secrets
   - Rotate secrets if compromised

3. **Rate Limiting**
   - Configure appropriate limits for your use case
   - Monitor rate limit usage
   - Implement retry logic with backoff

4. **Logging**
   - Review trigger logs regularly
   - Monitor failed and unauthorized attempts
   - Set up alerts for anomalies

---

## Examples

### Node.js Webhook Trigger
```javascript
const axios = require('axios');
const crypto = require('crypto');

const webhookUrl = 'https://api.example.com/api/workspaces/ws_123/workflows/trigger/webhook/token_abc';
const webhookSecret = 'your_secret';
const payload = { key: 'value' };

const payloadString = JSON.stringify(payload);
const signature = crypto
  .createHash('sha256')
  .update(webhookSecret + payloadString)
  .digest('hex');

axios.post(webhookUrl, payload, {
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
  },
})
  .then(response => console.log('Success:', response.data))
  .catch(error => console.error('Error:', error.response.data));
```

### Python API Key Trigger
```python
import requests

url = 'https://api.example.com/api/workspaces/ws_123/workflows/trigger/api'
headers = {
    'Authorization': 'Bearer wf_your_api_key',
    'Content-Type': 'application/json',
}
data = {
    'workflowId': 'wf_456',
    'data': {'key': 'value'},
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

### Bash Webhook Test
```bash
#!/bin/bash

WEBHOOK_URL="https://api.example.com/api/workspaces/ws_123/workflows/trigger/webhook/token_abc"
SECRET="your_secret"
PAYLOAD='{"key":"value"}'

# Generate signature
SIGNATURE=$(echo -n "${SECRET}${PAYLOAD}" | sha256sum | cut -d' ' -f1)

# Send request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

## Support

For issues or questions, please contact support or refer to the main API documentation.
