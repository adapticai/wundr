# Organization Genesis UI Components

Complete conversational UI for AI-powered organization creation using `@wundr.io/org-genesis`.

## Overview

The org-genesis UI provides a multi-step wizard that guides users through creating a complete
organizational structure from conversational input. The system generates VPs, disciplines, channels,
and agents based on user descriptions.

## Components

### 1. OrgGenesisWizard

Main wizard component orchestrating the 4-step flow:

**Steps:**

1. **Basic Info** - Organization name and type
2. **Description** - Conversational description and strategy
3. **Configuration** - Target assets, risk tolerance, team size
4. **Preview** - Visual org chart with regenerate/customize options

**Usage:**

```tsx
import { OrgGenesisWizard } from '@/components/org-genesis';

export function CreateOrganization() {
  return <OrgGenesisWizard />;
}
```

**Features:**

- Multi-step form with progress tracking
- Zod validation at each step
- Loading states with skeleton UI
- Error handling with user-friendly messages
- Automatic workspace navigation on completion

### 2. OrgPreview

Preview component showing generated organization:

**Tabs:**

- **Overview** - Mission, vision, values, summary
- **Structure** - Visual org chart
- **Details** - VP/discipline breakdown

**Actions:**

- **Regenerate** - Generate new structure with same inputs
- **Customize** - Edit generated structure (future)
- **Create Organization** - Accept and create workspace

### 3. OrgChartVisualization

Visual hierarchical chart displaying:

- Organization root
- VPs with responsibilities and KPIs
- Disciplines with capabilities
- Agent counts per discipline
- Summary statistics

## API Integration

### Endpoint

```
POST /api/workspaces/generate-org
```

### Request Schema

```typescript
{
  organizationName: string;      // Required, 1-100 chars
  organizationType: string;      // Required, 1-100 chars
  description: string;           // Required, 20-1000 chars
  strategy: string;              // Required, 10-500 chars
  targetAssets: string[];        // Required, 1-10 items
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  teamSize: 'small' | 'medium' | 'large';
  seed?: string;                 // Optional
  includeOptionalDisciplines?: boolean; // Default: false
}
```

### Response

```typescript
{
  data: {
    manifest: OrganizationManifest;
    orchestrators: VPDefinition[];
    disciplines: DisciplineDefinition[];
    agents: AgentDefinition[];
    metadata: GenerationMetadata;
    workspaceId?: string;
  }
}
```

## Validation

Comprehensive Zod schemas in `/lib/validations/org-genesis.ts`:

- `orgBasicInfoSchema` - Step 1 validation
- `orgDescriptionSchema` - Step 2 validation
- `orgConfigSchema` - Step 3 validation
- `generateOrgSchema` - Complete input validation
- `orgGenerationResponseSchema` - API response validation

## Integration with Create Workspace

The `CreateWorkspaceCard` component now offers two modes:

1. **Quick Create** - Simple workspace setup (existing flow)
2. **AI-Powered Organization** - Full org-genesis wizard

```tsx
<CreateWorkspaceCard />
```

## File Structure

```
components/org-genesis/
├── index.ts                          # Exports
├── org-genesis-wizard.tsx            # Main wizard component
├── org-preview.tsx                   # Preview with tabs
├── org-chart-visualization.tsx       # Visual org chart
├── __tests__/
│   └── org-genesis-wizard.test.tsx   # Unit tests
└── README.md                         # This file

lib/validations/
├── org-genesis.ts                    # UI-specific validation
└── workspace-genesis.ts              # API-specific validation

app/api/workspaces/generate-org/
└── route.ts                          # API endpoint
```

## Testing

Run tests:

```bash
npm run test
```

Test coverage includes:

- Step navigation
- Form validation
- Error handling
- Loading states
- API integration
- User interactions

## Features Implemented

- [x] Multi-step wizard UI
- [x] Conversational org description form
- [x] Organization preview with org chart
- [x] Visual org chart visualization
- [x] Regenerate and customize options
- [x] Merged workspace/organization creation
- [x] Form validation with Zod
- [x] Loading states with Skeleton
- [x] Error handling and display
- [x] API integration
- [x] Component tests

## Future Enhancements

- [ ] Customize mode - Edit generated structure before creation
- [ ] Save draft organizations
- [ ] Template library
- [ ] Import/export organization configs
- [ ] Real-time collaboration
- [ ] AI-powered suggestions during input
- [ ] Organization comparison view

## Dependencies

### Required UI Components (shadcn/ui)

- Button
- Card
- Dialog
- Form
- Input
- Textarea
- Progress
- Badge
- Skeleton
- Tabs

### Required Packages

- `react-hook-form` - Form management
- `@hookform/resolvers` - Zod integration
- `zod` - Validation
- `@neolith/org-integration` - Type definitions
- `@wundr.io/org-genesis` - Organization generation engine

### Missing Dependencies (for API endpoint)

The API endpoint requires these dependencies to be added to `@wundr.io/org-genesis`:

```bash
cd packages/@wundr.io/org-genesis
pnpm add handlebars uuid zod
```

## Usage Example

```tsx
'use client';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OrgGenesisWizard } from '@/components/org-genesis';

export function CreateOrganizationButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create AI-Powered Organization</Button>
      </DialogTrigger>
      <DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'>
        <OrgGenesisWizard />
      </DialogContent>
    </Dialog>
  );
}
```

## Styling

Components use Tailwind CSS with design system tokens:

- `primary` - Primary brand color
- `muted` - Secondary backgrounds
- `card` - Card backgrounds
- `border` - Border colors
- Responsive breakpoints (sm, md, lg)

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support
- Color contrast compliance

## Performance

- Lazy loading for heavy components
- Optimistic UI updates
- Debounced API calls
- Skeleton loading states
- Memoized expensive calculations

## Error Handling

Comprehensive error handling:

- Network errors
- Validation errors
- API errors
- Generation failures
- User-friendly error messages
- Automatic error recovery where possible

## Contributing

When adding features:

1. Update validation schemas
2. Add tests
3. Update this README
4. Follow existing patterns
5. Maintain accessibility
6. Add loading states
7. Handle errors gracefully
