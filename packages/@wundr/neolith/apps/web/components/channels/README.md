# Channel Templates Feature

This directory contains the implementation of the channel templates feature for the Neolith messaging system.

## Overview

Channel templates allow users to quickly compose common message formats without retyping the same structure repeatedly. Admins can create custom templates specific to their channels, and the system provides built-in templates for common scenarios.

## Components

### `channel-templates.tsx`
Main component for displaying and managing channel templates.

**Features:**
- Display all available templates (system and custom)
- Template selection with preview
- Create new custom templates (admin only)
- Template management dialog

**Props:**
```typescript
interface ChannelTemplatesProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string) => void;
  isAdmin?: boolean;
}
```

### `template-selector.tsx`
Dropdown menu component for quick template access.

**Features:**
- Quick access to popular templates via dropdown
- Browse all templates button
- Integration with message input

**Props:**
```typescript
interface TemplateSelectorProps {
  channelId: string;
  onSelectTemplate: (content: string) => void;
  isAdmin?: boolean;
  disabled?: boolean;
}
```

### `message-input-with-templates.tsx`
Example integration showing how to combine templates with message input.

**Features:**
- Template preview before sending
- Integration guidance
- Two integration approaches documented

## API Routes

### `GET /api/channels/:channelId/templates`
List all templates for a channel.

**Response:**
```json
{
  "data": [
    {
      "id": "tpl_123",
      "name": "Daily Standup",
      "description": "Standard standup format",
      "content": "**Yesterday:**\n-\n\n**Today:**\n-",
      "icon": "📋",
      "isSystem": true,
      "channelId": "ch_123",
      "createdById": "user_123",
      "createdAt": "2025-12-05T12:00:00Z",
      "updatedAt": "2025-12-05T12:00:00Z"
    }
  ],
  "count": 1
}
```

### `POST /api/channels/:channelId/templates`
Create a new template (admin only).

**Request:**
```json
{
  "name": "My Template",
  "description": "A custom template",
  "content": "Template content with {placeholders}",
  "icon": "📌"
}
```

**Response:**
```json
{
  "data": {
    "id": "tpl_456",
    "name": "My Template",
    ...
  },
  "message": "Template created successfully"
}
```

## Database Schema

### `channelTemplate` Model
```prisma
model channelTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  content     String
  icon        String?
  metadata    Json     @default("{}")
  isSystem    Boolean  @default(false)
  channelId   String
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  channel     channel  @relation(...)
  createdBy   user     @relation(...)

  @@unique([channelId, name])
  @@map("channel_templates")
}
```

## Template Structure

Templates support placeholders that are automatically replaced when selected:

- `{date}` - Current date
- `{time}` - Current time
- `{user}` - Current user's name
- `{channel}` - Channel name

### Example Template
```
**Daily Standup - {date}**

**Yesterday:**
-

**Today:**
-

**Blockers:**
- None
```

### After Processing
```
**Daily Standup - December 5, 2025**

**Yesterday:**
-

**Today:**
-

**Blockers:**
- None
```

## Built-in System Templates

The system includes 8 default templates:

1. **Daily Standup** (📋) - Yesterday, Today, Blockers
2. **Announcement** (📢) - Team announcements
3. **Meeting Notes** (📝) - Agenda and action items
4. **Decision Log** (✅) - Document decisions
5. **Bug Report** (🐛) - Bug tracking format
6. **Feature Request** (💡) - Feature proposals
7. **Retrospective** (🔄) - Sprint retrospectives
8. **Weekly Update** (📊) - Status updates

## Usage Examples

### Basic Template Selection
```tsx
import { TemplateSelector } from '@/components/channels/template-selector';

function MyComponent() {
  const handleTemplateSelect = (content: string) => {
    // Insert content into message input
    console.log('Selected template:', content);
  };

  return (
    <TemplateSelector
      channelId="ch_123"
      onSelectTemplate={handleTemplateSelect}
      isAdmin={true}
    />
  );
}
```

### Full Template Management
```tsx
import { ChannelTemplates } from '@/components/channels/channel-templates';

function MyComponent() {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <>
      <Button onClick={() => setShowTemplates(true)}>
        Browse Templates
      </Button>

      <ChannelTemplates
        channelId="ch_123"
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={(content) => {
          console.log('Selected:', content);
        }}
        isAdmin={true}
      />
    </>
  );
}
```

## Database Migrations

### Setup
```bash
# Run the migration
cd packages/@neolith/database
npx prisma migrate dev --name add_channel_templates

# Generate Prisma client
npx prisma generate

# Seed default templates (optional)
npm run seed:templates
```

### Seed Script
```bash
# Seed templates for all channels
node prisma/seeds/channel-templates.ts
```

## Integration with Message Input

To integrate templates with the existing `MessageInput` component, you have two options:

### Option 1: Controlled Component (Recommended)
Modify `MessageInput` to accept `value` and `onChange` props:

```tsx
interface MessageInputProps {
  // ... existing props
  value?: string;
  onChange?: (value: string) => void;
}
```

### Option 2: Imperative Handle
Use `useImperativeHandle` to expose a method for inserting content:

```tsx
const MessageInput = forwardRef((props, ref) => {
  useImperativeHandle(ref, () => ({
    insertContent: (content: string) => {
      // Insert content into textarea
    },
  }));
});
```

See `message-input-with-templates.tsx` for detailed examples.

## Permissions

- **View Templates**: All channel members
- **Create Templates**: Channel admins and creators only
- **Edit Templates**: Creator of the template (custom templates only)
- **Delete Templates**: Channel admins (custom templates only)

System templates cannot be edited or deleted.

## Future Enhancements

Potential improvements for future iterations:

1. Template categories/tags for better organization
2. Template sharing across channels
3. Template variables with custom values
4. Template usage analytics
5. Import/export templates
6. Rich text template editor
7. Template versioning
8. Workspace-level templates
9. Template permissions (view/use/edit)
10. Template search and filtering

## Testing

### Unit Tests
```bash
# Test template component
npm test channel-templates.test.tsx

# Test API routes
npm test templates/route.test.ts
```

### Integration Tests
```bash
# Test full template workflow
npm test templates.integration.test.ts
```

## Troubleshooting

### Templates not loading
- Check channel membership
- Verify API endpoint is accessible
- Check browser console for errors

### Cannot create templates
- Verify user has admin permissions
- Check for duplicate template names
- Verify all required fields are provided

### Placeholders not replaced
- Check placeholder syntax matches exactly
- Verify `processPlaceholders` function is called
- Check for typos in placeholder names

## Support

For issues or questions about the templates feature:
1. Check this documentation
2. Review the component source code
3. Check API route documentation
4. Consult the integration examples
