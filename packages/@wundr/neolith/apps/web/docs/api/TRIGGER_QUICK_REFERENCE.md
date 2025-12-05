# Workflow Triggers - Quick Reference Card

## Endpoints

### Webhook Trigger

```bash
POST /api/workspaces/:workspaceId/workflows/trigger/webhook/:token
GET  /api/workspaces/:workspaceId/workflows/trigger/webhook/:token (test)
```

### API Key Trigger

```bash
POST /api/workspaces/:workspaceId/workflows/trigger/api
Header: Authorization: Bearer wf_...
```

### Event Trigger (Internal)

```bash
POST /api/workspaces/:workspaceId/workflows/trigger
Auth: Session
```

### Configuration

```bash
GET  /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId
PUT  /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId
POST /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId/regenerate
```

### Logs

```bash
GET /api/workspaces/:workspaceId/workflows/trigger/logs?status=success&page=1&limit=20
```

## Rate Limits

| Type     | Limit    |
| -------- | -------- |
| webhook  | 100/min  |
| api      | 1000/min |
| schedule | 10/min   |
| event    | 500/min  |

## Webhook Signature

### Generate (Node.js)

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHash('sha256')
  .update(secret + JSON.stringify(payload))
  .digest('hex');
```

### Send

```bash
curl -X POST webhook_url \
  -H "X-Webhook-Signature: $signature" \
  -H "Content-Type: application/json" \
  -d '{"data": "value"}'
```

## Cron Examples

```
*/5 * * * *        Every 5 minutes
0 9 * * 1-5        Weekdays at 9 AM
0 0 1 * *          First of month
0 */2 * * *        Every 2 hours
```

## Error Codes

| Code                | Status | Description         |
| ------------------- | ------ | ------------------- |
| UNAUTHORIZED        | 401    | Auth failed         |
| WORKSPACE_NOT_FOUND | 404    | No access           |
| WORKFLOW_NOT_FOUND  | 404    | Workflow missing    |
| WORKFLOW_INACTIVE   | 400    | Workflow not active |
| VALIDATION_ERROR    | 400    | Invalid input       |
| VALIDATION_ERROR    | 429    | Rate limit exceeded |
| EXECUTION_FAILED    | 500    | Execution error     |
| INTERNAL_ERROR      | 500    | Server error        |

## Response Format

### Success

```json
{
  "success": true,
  "executionId": "exec_123",
  "status": "COMPLETED",
  "message": "Workflow triggered successfully",
  "duration": 245
}
```

### Rate Limited

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Rate limit exceeded"
}
```

Headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000000000
```

## Quick Start

### 1. Setup Webhook

```bash
# Get config to see webhook URL
curl GET /api/.../trigger/config/wf_123

# Or regenerate new token
curl POST /api/.../trigger/config/wf_123/regenerate \
  -d '{"type": "webhook_token"}'
```

### 2. Generate API Key

```bash
curl POST /api/.../trigger/config/wf_123/regenerate \
  -d '{"type": "api_key"}'
# Save the returned key securely!
```

### 3. Test Webhook

```bash
curl GET webhook_url
# Should return: {"message": "Webhook endpoint is active"}
```

### 4. Trigger Workflow

```bash
# Via webhook
curl POST webhook_url -d '{"test": true}'

# Via API key
curl POST /api/.../trigger/api \
  -H "Authorization: Bearer wf_..." \
  -d '{"workflowId": "wf_123", "data": {}}'
```

### 5. Check Logs

```bash
curl GET '/api/.../trigger/logs?status=success&limit=10'
```

## Files Location

```
apps/web/
├── app/api/workspaces/[workspaceSlug]/workflows/trigger/
│   ├── route.enhanced.ts              # Event triggers
│   ├── webhook/[token]/route.ts       # Webhook endpoint
│   ├── api/route.ts                   # API key endpoint
│   └── config/[workflowId]/route.ts   # Configuration
├── lib/workflow/
│   ├── trigger-auth.ts                # Auth utilities
│   ├── rate-limiter.ts                # Rate limiting
│   └── cron-validator.ts              # Cron validation
└── lib/validations/
    └── trigger.ts                     # Validation schemas
```

## Environment Variables

```bash
# Required for rate limiting
REDIS_URL=redis://localhost:6379
```

## Security Checklist

- [ ] Store API keys in environment variables
- [ ] Enable webhook signature verification
- [ ] Use HTTPS in production
- [ ] Rotate keys regularly
- [ ] Monitor rate limit usage
- [ ] Review trigger logs for anomalies
- [ ] Set appropriate rate limits
- [ ] Use strong webhook secrets

## Common Issues

### Rate Limited

```
Status: 429
Solution: Wait until X-RateLimit-Reset or increase limits
```

### Invalid Signature

```
Status: 401, "Invalid webhook signature"
Solution: Verify secret and signature generation
```

### Workflow Inactive

```
Status: 400, "Only active workflows can be executed"
Solution: Activate workflow first
```

## Support

- Full Docs: `/docs/api/workflow-triggers.md`
- Implementation: `/docs/api/workflow-triggers-implementation.md`
