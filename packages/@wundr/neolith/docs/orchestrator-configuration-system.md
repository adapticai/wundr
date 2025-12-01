# Orchestrator Configuration System

## Overview

A comprehensive self-service configuration system for orchestrators in Neolith. This system allows
orchestrators to manage their own settings, capabilities, triggers, and behavior while providing
administrators with override and lock capabilities.

## Database Schema

### vp_configs Table

Created in
`/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/prisma/schema.prisma`

**Fields:**

- `id` (String, PK) - Unique configuration ID
- `vp_id` (String, Unique) - Reference to orchestrator
- **General Settings:**
  - `auto_reply` (Boolean) - Auto-respond to messages (default: true)
  - `reply_delay` (Int) - Delay in seconds before replying (default: 0)
  - `max_daily_actions` (Int?) - Rate limit per day
  - `max_hourly_actions` (Int?) - Rate limit per hour
- **Trigger Configuration:**
  - `triggers` (Json) - Array of trigger configurations
  - `watched_channels` (String[]) - Channel IDs to monitor
  - `mention_only` (Boolean) - Only respond when mentioned (default: false)
  - `keyword_triggers` (String[]) - Keywords that trigger response
- **Capability Configuration:**
  - `enabled_capabilities` (Json) - Map of capability_name -> config
  - `capability_limits` (Json) - Rate limits per capability
- **Response Templates:**
  - `response_templates` (Json) - Predefined response templates
  - `custom_prompts` (Json) - Custom prompts per scenario
- **LLM Configuration:**
  - `llm_provider` (String) - Provider (default: "anthropic")
  - `llm_model` (String) - Model name (default: "claude-3-5-sonnet-20241022")
  - `temperature` (Float) - Temperature setting (default: 0.7)
  - `max_tokens` (Int) - Max tokens (default: 4096)
- **Integration Settings:**
  - `integration_config` (Json) - Third-party integration settings
  - `webhook_urls` (String[]) - Webhook endpoints for notifications
  - `assigned_workspaces` (String[]) - Workspace IDs accessible to orchestrator
- **Admin Controls:**
  - `admin_overrides` (Json) - Admin-set restrictions/overrides
  - `is_locked` (Boolean) - Whether config is locked by admin (default: false)
- **Timestamps:**
  - `created_at` (DateTime)
  - `updated_at` (DateTime)

**Relations:**

- `orchestrator` -> `vps` (via vp_id, cascade delete)

**Indexes:**

- `vp_id` (unique)

## API Endpoints

### GET /api/orchestrators/[id]/config

**Access:** Orchestrator (self) or Admin

Returns the complete configuration for an orchestrator. Creates default config if none exists.

**Response:**

```json
{
  "data": {
    "id": "config_id",
    "orchestratorId": "vp_id",
    "autoReply": true,
    "replyDelay": 0,
    "triggers": [],
    "enabledCapabilities": {},
    "llmModel": "claude-3-5-sonnet-20241022",
    ...
  }
}
```

### PUT /api/orchestrators/[id]/config

**Access:** Orchestrator (self) or Admin

Updates orchestrator configuration. Locked configs can only be modified by admins.

**Request:**

```json
{
  "autoReply": true,
  "replyDelay": 5,
  "keywordTriggers": ["help", "support"],
  "llmModel": "claude-3-5-sonnet-20241022",
  "temperature": 0.8
}
```

**Response:**

```json
{
  "data": {
    /* updated config */
  },
  "message": "Configuration updated successfully"
}
```

### GET /api/orchestrators/[id]/capabilities

**Access:** Orchestrator (self) or Admin

Returns only capability-related configuration.

**Response:**

```json
{
  "data": {
    "enabledCapabilities": {
      "respond_to_messages": {
        "type": "respond_to_messages",
        "enabled": true,
        "permissionLevel": "write",
        "rateLimit": {
          "maxPerHour": 100,
          "maxPerDay": 500
        }
      },
      ...
    },
    "capabilityLimits": {}
  }
}
```

### PUT /api/orchestrators/[id]/capabilities

**Access:** Orchestrator (self) or Admin

Updates capability configuration.

**Request:**

```json
{
  "capabilities": {
    "respond_to_messages": {
      "type": "respond_to_messages",
      "enabled": true,
      "permissionLevel": "write",
      "rateLimit": {
        "maxPerHour": 100
      }
    }
  }
}
```

## Type Definitions

### /Users/iroselli/wundr/packages/@wundr/neolith/apps/web/lib/validations/orchestrator-config.ts

**Key Types:**

- `CapabilityType` - Enum of capability types
- `PermissionLevel` - none | read | write | admin
- `TriggerType` - Enum of trigger types
- `LLMProvider` - anthropic | openai | custom
- `CapabilityConfig` - Configuration for a single capability
- `TriggerConfig` - Configuration for a trigger
- `ResponseTemplate` - Response template structure
- `LLMModelConfig` - LLM model configuration
- `OrchestratorConfigInput` - Complete config input type
- `UpdateOrchestratorConfigInput` - Partial update input

**Default Capabilities:**

```typescript
{
  respond_to_messages: { enabled: true, permissionLevel: 'write', rateLimit: { maxPerHour: 100, maxPerDay: 500 } },
  create_tasks: { enabled: true, permissionLevel: 'write', rateLimit: { maxPerHour: 50, maxPerDay: 200 } },
  execute_code: { enabled: false, permissionLevel: 'none' },
  file_operations: { enabled: true, permissionLevel: 'read', rateLimit: { maxPerHour: 30, maxPerDay: 100 } },
  api_calls: { enabled: true, permissionLevel: 'read', rateLimit: { maxPerHour: 100, maxPerDay: 500 } }
}
```

## UI Components

### Settings Page

**Path:**
`/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/settings/page.tsx`

**Route:** `/{workspaceSlug}/orchestrators/{orchestratorId}/settings`

**Access Control:**

- Orchestrator can access their own settings
- Organization admins can access any orchestrator settings

**Features:**

- Tab-based navigation for different setting categories
- Real-time save with optimistic updates
- Lock indicator when config is locked by admin
- Admin-only controls for locking/unlocking configuration

### Component Structure

#### OrchestratorSettingsForm.tsx

Main form component with tabbed interface:

- General settings
- Capabilities
- Triggers
- Response templates
- Model configuration
- Integrations

#### GeneralSettings.tsx

- Profile information (read-only, admin-editable)
- Auto-reply toggle
- Reply delay configuration
- Rate limits (hourly/daily)

#### CapabilitySettings.tsx

- List of all available capabilities
- Toggle enable/disable per capability
- Permission level selector (none/read/write/admin)
- Rate limit configuration per capability
- Collapsible advanced settings

#### CapabilityToggle.tsx

Individual capability card with:

- Icon and description
- Enable/disable switch
- Permission level dropdown
- Rate limit inputs
- Collapsible configuration panel

#### TriggerSettings.tsx

- Mention-only mode toggle
- Keyword triggers (add/remove)
- Watched channels (add/remove)
- Badge display for active triggers

#### ResponseTemplates.tsx

- Create/edit/delete response templates
- Template list with preview
- Variable support in templates
- Trigger keyword association

#### ModelSelector.tsx

- LLM provider selection (Anthropic/OpenAI)
- Model selection dropdown
- Temperature slider
- Max tokens input
- Model capabilities display

#### IntegrationSettings.tsx

- Webhook URL management
- Available events display
- Third-party integration info

## Capability System

### Available Capability Types

1. **respond_to_messages** - Send messages in channels and threads
2. **create_tasks** - Create and assign tasks to team members
3. **execute_code** - Run code snippets and scripts (use with caution)
4. **file_operations** - Read and write files in the workspace
5. **api_calls** - Make external API calls and integrations
6. **data_analysis** - Analyze data and generate insights
7. **workflow_automation** - Create and manage automated workflows
8. **integration_management** - Manage third-party integrations
9. **team_coordination** - Coordinate tasks between team members

### Permission Levels

- **none** - Capability disabled
- **read** - Read-only access
- **write** - Full access
- **admin** - Administrative access (admin-only)

### Rate Limiting

Each capability can have:

- `maxPerHour` - Maximum actions per hour
- `maxPerDay` - Maximum actions per day

## Self-Service Features

### For Orchestrators

1. **Configuration Management**
   - View and edit their own configuration
   - Cannot modify settings when locked by admin
   - See all capability options and limits

2. **Capability Control**
   - Enable/disable capabilities
   - Set permission levels (except admin level)
   - Configure rate limits within admin-set bounds

3. **Trigger Customization**
   - Set response triggers
   - Define keyword triggers
   - Choose watched channels

4. **Response Personalization**
   - Create custom response templates
   - Define custom prompts
   - Set communication preferences

5. **Model Selection**
   - Choose LLM provider and model
   - Adjust temperature and token limits
   - See model capabilities

### For Administrators

1. **Override Control**
   - Can modify any orchestrator's configuration
   - Can set `adminOverrides` to restrict options
   - Can lock configuration to prevent changes

2. **Lock Mechanism**
   - Set `isLocked: true` to prevent orchestrator edits
   - Orchestrators can view but not modify locked configs
   - Admins can still modify locked configs

3. **Permission Management**
   - Can grant admin-level permissions to capabilities
   - Can override rate limits
   - Can restrict workspace assignments

## Security Considerations

1. **Access Control**
   - Orchestrators can only modify their own configuration
   - Admins can modify any configuration
   - Config lock prevents unauthorized changes

2. **Permission Validation**
   - Non-admins cannot set admin permission levels
   - Non-admins cannot modify `adminOverrides` or `isLocked`
   - Capability permissions validated server-side

3. **Rate Limiting**
   - Enforced at both config and capability levels
   - Admin-set limits cannot be exceeded by orchestrators
   - Tracked across hourly and daily windows

## Integration Points

### With Orchestrator System

- Configuration loaded when orchestrator initializes
- Capabilities checked before actions
- Triggers evaluated for message processing
- Rate limits enforced in real-time

### With Workspace System

- `assignedWorkspaces` controls workspace access
- Workspace admins can manage orchestrator configs
- Workspace-level integrations accessible based on capabilities

### With Messaging System

- `mentionOnly` flag affects message processing
- `keywordTriggers` evaluated for auto-responses
- `watchedChannels` determines monitoring scope

## Future Enhancements

1. **Capability Templates** - Predefined capability sets for common roles
2. **Audit Logging** - Track configuration changes
3. **A/B Testing** - Test different configurations
4. **Performance Metrics** - Track capability usage and effectiveness
5. **Advanced Triggers** - Complex trigger conditions and rules
6. **Template Library** - Shared response template library

## File Locations

### Database

- Schema:
  `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/prisma/schema.prisma`
- Table: `vp_configs`

### API Routes

- Config endpoint:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/orchestrators/[orchestratorId]/config/route.ts`
- Capabilities endpoint:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/orchestrators/[orchestratorId]/capabilities/route.ts`

### Validations

- Schema:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/lib/validations/orchestrator-config.ts`

### UI Components

- Settings page:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/settings/page.tsx`
- Components directory:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/settings/components/`

### Components Created

1. OrchestratorSettingsForm.tsx
2. SettingsSkeleton.tsx
3. GeneralSettings.tsx
4. CapabilitySettings.tsx
5. CapabilityToggle.tsx
6. TriggerSettings.tsx
7. ResponseTemplates.tsx
8. ModelSelector.tsx
9. IntegrationSettings.tsx

## Usage Examples

### Create Default Configuration

```typescript
import { createDefaultOrchestratorConfig } from '@/lib/validations/orchestrator-config';

const defaultConfig = createDefaultOrchestratorConfig();
await prisma.orchestratorConfig.create({
  data: {
    orchestratorId: 'vp_id',
    ...defaultConfig,
  },
});
```

### Update Capability

```typescript
await fetch(`/api/orchestrators/${orchestratorId}/capabilities`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    capabilities: {
      respond_to_messages: {
        type: 'respond_to_messages',
        enabled: true,
        permissionLevel: 'write',
        rateLimit: { maxPerHour: 100, maxPerDay: 500 },
      },
    },
  }),
});
```

### Lock Configuration (Admin Only)

```typescript
await fetch(`/api/orchestrators/${orchestratorId}/config`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isLocked: true,
    adminOverrides: {
      maxDailyActions: 1000, // Hard limit
    },
  }),
});
```

## Testing Checklist

- [ ] Database schema created successfully
- [ ] Prisma client generated with new types
- [ ] API endpoints accessible
- [ ] Orchestrators can view their own config
- [ ] Orchestrators can update their own config
- [ ] Locked configs cannot be modified by orchestrators
- [ ] Admins can modify any config
- [ ] Admins can lock/unlock configs
- [ ] Capability permissions validated correctly
- [ ] Rate limits enforced
- [ ] UI components render correctly
- [ ] Settings page accessible at correct route
- [ ] Form submissions work
- [ ] Admin controls only visible to admins
- [ ] Lock indicator displays correctly

## Implementation Status

- [x] Database schema added
- [x] Schema migration completed
- [x] Prisma client generated
- [x] Type definitions created
- [x] Validation schemas implemented
- [x] API endpoints created
- [x] Settings page created
- [x] All UI components implemented
- [x] Access control implemented
- [x] Default capabilities defined

## Migration Notes

The `vp_configs` table was successfully created with all required fields. The Prisma schema has been
updated and formatted. The database is now in sync with the schema.

**Migration verified:** `prisma db push` completed successfully. **Schema formatted:**
`prisma format` completed successfully. **Client generated:** `prisma generate` completed
successfully.
