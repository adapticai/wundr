# Workflow Templates System

A comprehensive system for creating, managing, and using pre-built workflow templates in the Genesis
App.

## Overview

The Workflow Templates system provides:

- **Pre-built Templates**: 6+ production-ready workflow templates for common automation scenarios
- **Template Gallery**: Browse, search, and preview templates with a beautiful UI
- **Template Configuration**: Easy-to-use interface for configuring template variables
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Extensible**: Easy to add new templates and customize existing ones

## Architecture

### Components

#### 1. **TemplateGallery** (`components/workflow/template-gallery.tsx`)

The main component for browsing and selecting workflow templates.

**Features:**

- Search functionality
- Category filtering
- Popular templates view
- Template preview
- Responsive grid layout

**Usage:**

```tsx
import { TemplateGallery } from '@/components/workflow';

function MyPage() {
  const handleUseTemplate = (template: WorkflowTemplate) => {
    // Handle template selection
  };

  return <TemplateGallery onUseTemplate={handleUseTemplate} />;
}
```

#### 2. **TemplatePreview** (`components/workflow/template-preview.tsx`)

Displays a detailed preview of a workflow template.

**Features:**

- Trigger visualization
- Action flow diagram
- Variable requirements
- Usage instructions
- Error handling display

**Usage:**

```tsx
import { TemplatePreview } from '@/components/workflow';

function PreviewDialog({ template }) {
  return <TemplatePreview template={template} />;
}
```

#### 3. **TemplateConfigurator** (`components/workflow/template-configurator.tsx`)

Allows users to configure template variables before creating a workflow.

**Features:**

- Type-specific input controls
- Real-time validation
- Default value support
- Error messages
- Workflow naming

**Usage:**

```tsx
import { TemplateConfigurator } from '@/components/workflow';

function ConfigureTemplate({ template, values, onValueChange }) {
  return (
    <TemplateConfigurator
      template={template}
      values={values}
      onValueChange={onValueChange}
      onComplete={workflowName => {
        // Create workflow
      }}
      onCancel={() => {
        // Cancel configuration
      }}
    />
  );
}
```

### Library

#### Template Definitions (`lib/workflow/templates.ts`)

Contains all pre-built workflow templates.

**Available Templates:**

1. **New Member Onboarding** (`new-member-onboarding`)
   - Welcomes new members
   - Assigns roles
   - Invites to channels
   - Sends introduction message

2. **Task Assignment and Escalation** (`task-assignment-escalation`)
   - Detects task mentions
   - Assigns to team members
   - Sets reminders
   - Escalates if not acknowledged

3. **Channel Message Routing** (`channel-message-routing`)
   - Routes messages based on keywords
   - Sends to specialized channels
   - Categorizes automatically

4. **Scheduled Report Generation** (`scheduled-report-generation`)
   - Runs on a schedule
   - Fetches data from API
   - Generates and sends reports

5. **Orchestrator Handoff** (`orchestrator-handoff`)
   - Detects AI assistance requests
   - Hands off to Orchestrator agent
   - Provides fallback messaging

6. **Approval Workflow** (`approval-workflow`)
   - Creates approval channels
   - Sends notifications
   - Tracks approval status
   - Sends reminders

**Helper Functions:**

```typescript
import {
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  getPopularTemplates,
  getTemplatesByCategories,
} from '@/lib/workflow/templates';

// Get a specific template
const template = getTemplateById('new-member-onboarding');

// Get templates by category
const onboardingTemplates = getTemplatesByCategory('onboarding');

// Search templates
const results = searchTemplates('onboarding');

// Get popular templates
const popular = getPopularTemplates(3);

// Get all templates grouped by category
const grouped = getTemplatesByCategories();
```

### Hook

#### `useWorkflowTemplate` (`hooks/use-workflow-template.ts`)

React hook for managing workflow template selection and creation.

**Features:**

- Template selection
- Variable management
- Workflow creation from template
- Navigation to editor
- Error handling

**Usage:**

```tsx
import { useWorkflowTemplate } from '@/hooks/use-workflow-template';

function MyComponent() {
  const {
    selectedTemplate,
    variableValues,
    isCreating,
    selectTemplate,
    updateVariable,
    createAndEdit,
    hasAllRequiredVariables,
  } = useWorkflowTemplate({
    onWorkflowCreated: (workflowId) => {
      console.log('Workflow created:', workflowId);
    },
    onError: (error) => {
      console.error('Error:', error);
    },
  });

  const handleCreate = async () => {
    await createAndEdit('My Workflow');
  };

  return (
    // Your component JSX
  );
}
```

## Template Structure

### WorkflowTemplate Type

```typescript
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowTemplateCategory;
  trigger: TriggerConfig;
  actions: readonly Omit<ActionConfig, 'id'>[];
  variables?: readonly Omit<WorkflowVariable, 'source'>[];
  usageCount: number;
  tags: readonly string[];
}
```

### Creating a New Template

1. Define your template in `lib/workflow/templates.ts`:

```typescript
export const MY_CUSTOM_TEMPLATE: WorkflowTemplate = {
  id: 'my-custom-template',
  name: 'My Custom Template',
  description: 'Description of what this template does',
  category: 'automation',
  trigger: {
    type: 'message',
    message: {
      channelIds: ['{{channel.id}}'],
    },
  },
  actions: [
    {
      type: 'send_message',
      order: 1,
      config: {
        channelId: '{{channel.id}}',
        message: 'Hello {{user.name}}!',
      },
    },
  ],
  variables: [
    {
      name: 'channel.id',
      type: 'string',
      description: 'Channel to monitor',
    },
    {
      name: 'user.name',
      type: 'string',
      description: 'User name to greet',
    },
  ],
  usageCount: 0,
  tags: ['messaging', 'automation'],
};
```

2. Add to the `WORKFLOW_TEMPLATES` array:

```typescript
export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  // ... existing templates
  MY_CUSTOM_TEMPLATE,
] as const;
```

## Variable Substitution

Templates use a variable substitution syntax: `{{variable.name}}`

### How It Works

1. Variables are defined in the template's `variables` array
2. Variables are referenced in trigger/action configs using `{{variable.name}}`
3. When creating a workflow, users provide values for these variables
4. The system substitutes `{{variable.name}}` with actual values

### Example

**Template Definition:**

```typescript
variables: [
  {
    name: 'user.id',
    type: 'string',
    description: 'User ID to notify',
  }
],
actions: [
  {
    type: 'send_dm',
    config: {
      userId: '{{user.id}}',
      message: 'Hello!'
    }
  }
]
```

**User Configuration:**

```typescript
variableValues = {
  'user.id': 'user-123',
};
```

**Result:**

```typescript
{
  type: 'send_dm',
  config: {
    userId: 'user-123',
    message: 'Hello!'
  }
}
```

## Categories

Templates are organized into categories:

- `onboarding` - Welcome and onboard new users
- `notifications` - Send alerts and notifications
- `automation` - Automate repetitive tasks
- `integration` - Connect with external services
- `moderation` - Moderate content and users
- `scheduling` - Time-based workflows
- `custom` - Custom templates

Each category has metadata defined in `types/workflow.ts`:

```typescript
export const TEMPLATE_CATEGORY_CONFIG = {
  onboarding: {
    label: 'Onboarding',
    description: 'Welcome and onboard new users',
    icon: 'user-plus',
  },
  // ...
} as const;
```

## Best Practices

### Template Design

1. **Clear Naming**: Use descriptive names that explain what the template does
2. **Good Descriptions**: Provide detailed descriptions of template functionality
3. **Sensible Defaults**: Include default values for variables when possible
4. **Error Handling**: Add error handling to critical actions
5. **Documentation**: Add comments explaining complex logic

### Variable Design

1. **Descriptive Names**: Use dot notation for organization (e.g., `channel.general`)
2. **Type Safety**: Use the correct variable type
3. **Descriptions**: Always include descriptions for variables
4. **Defaults**: Provide defaults when appropriate

### Action Design

1. **Logical Order**: Number actions in execution order
2. **Error Handling**: Add retry logic for network calls
3. **Conditions**: Use condition actions for branching logic
4. **Wait Times**: Use reasonable wait durations

## Testing

### Testing Templates

1. **Manual Testing**: Create a workflow from each template and verify it works
2. **Variable Validation**: Test with different variable values
3. **Error Cases**: Test error handling and retry logic
4. **Edge Cases**: Test with missing optional fields

### Example Test

```typescript
import { getTemplateById } from '@/lib/workflow/templates';

describe('Workflow Templates', () => {
  it('should have all required fields', () => {
    const template = getTemplateById('new-member-onboarding');
    expect(template).toBeDefined();
    expect(template.name).toBeTruthy();
    expect(template.trigger).toBeDefined();
    expect(template.actions.length).toBeGreaterThan(0);
  });
});
```

## API Integration

Templates integrate with the workflows API:

```typescript
// Create workflow from template
const response = await fetch('/api/workflows', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: workflowName,
    description: template.description,
    trigger: template.trigger,
    actions: template.actions.map(action => ({
      ...action,
      config: substituteVariables(action.config, variableValues),
    })),
    variables: template.variables,
  }),
});
```

## Future Enhancements

Potential improvements to the template system:

1. **Template Marketplace**: Allow users to share and publish templates
2. **Template Versioning**: Track template versions and changes
3. **Template Analytics**: Track template usage and success rates
4. **Smart Suggestions**: Recommend templates based on workspace activity
5. **Template Validation**: Validate templates before allowing usage
6. **Template Testing**: Built-in testing tools for templates
7. **Template Import/Export**: Allow importing/exporting custom templates
8. **Template Cloning**: Clone and modify existing templates
9. **Template Ratings**: User ratings and reviews for templates
10. **Template Categories**: More granular categorization

## Troubleshooting

### Common Issues

**Issue: Template not showing in gallery**

- Verify template is added to `WORKFLOW_TEMPLATES` array
- Check category is valid
- Ensure template ID is unique

**Issue: Variables not substituting**

- Check variable name matches exactly (case-sensitive)
- Verify variable is defined in template
- Ensure substitution syntax is correct: `{{variable.name}}`

**Issue: Workflow creation fails**

- Verify all required variables have values
- Check API endpoint is accessible
- Review error messages in console

## Support

For questions or issues:

1. Check this documentation
2. Review template source code in `lib/workflow/templates.ts`
3. Check component source code in `components/workflow/`
4. Open an issue in the project repository

---

**Last Updated:** 2025-12-05 **Version:** 1.0.0
