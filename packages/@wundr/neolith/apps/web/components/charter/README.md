# Charter Components

Components for managing orchestrator charter configuration.

## CharterCapabilities

A comprehensive component for managing orchestrator capabilities with:

- Category-based organization (communication, development, analysis, automation, management)
- Search and filter functionality
- Enable/disable toggles for each capability
- Permission level configuration (none, read, write, admin)
- Rate limiting configuration (per minute, hour, day)
- Accordion-based UI for better organization

### Usage

```tsx
import { CharterCapabilities } from '@/components/charter';

function OrchestratorSettings() {
  const [capabilities, setCapabilities] = useState<OrchestratorCapability[]>([]);

  return (
    <CharterCapabilities
      value={capabilities}
      onChange={setCapabilities}
      availableCapabilities={allCapabilities}
      disabled={false}
      isAdmin={true}
    />
  );
}
```

### Props

| Prop                    | Type                                               | Description                       |
| ----------------------- | -------------------------------------------------- | --------------------------------- |
| `value`                 | `OrchestratorCapability[]`                         | Current enabled capabilities      |
| `onChange`              | `(capabilities: OrchestratorCapability[]) => void` | Callback when capabilities change |
| `availableCapabilities` | `OrchestratorCapability[]`                         | List of available capabilities    |
| `disabled`              | `boolean`                                          | Disable all controls              |
| `isAdmin`               | `boolean`                                          | Show admin permission level       |

### Pre-defined Capabilities

#### Communication

- `send_messages` - Send messages in channels and direct messages
- `manage_channels` - Create, update, and archive channels
- `schedule_meetings` - Schedule and manage meetings and huddles

#### Development

- `code_review` - Review code changes and provide feedback
- `write_code` - Generate and modify code
- `run_tests` - Execute test suites and report results
- `deploy` - Deploy applications and services

#### Analysis

- `data_analysis` - Analyze data sets and generate insights
- `report_generation` - Create and distribute reports
- `trend_analysis` - Identify and analyze trends in data

#### Automation

- `task_scheduling` - Schedule and manage automated tasks
- `workflow_automation` - Create and execute automated workflows
- `notifications` - Send automated notifications and alerts

#### Management

- `resource_allocation` - Allocate and manage resources
- `team_coordination` - Coordinate team activities and tasks
- `project_tracking` - Track project progress and milestones

### Features

1. **Category Grouping**: Capabilities are organized by category with visual badges
2. **Search**: Real-time search across capability names and descriptions
3. **Filter**: Filter by category or view all
4. **Permission Levels**: Configure granular permission levels for each capability
5. **Rate Limiting**: Set usage limits per minute, hour, or day
6. **Responsive Design**: Works on all screen sizes
7. **Accessibility**: Full keyboard navigation and screen reader support

### Implementation Details

- Built with Radix UI primitives for accessibility
- Uses Tailwind CSS for styling
- Type-safe with TypeScript
- Follows existing UI component patterns from the codebase

### Related Files

- `/types/charter-capabilities.ts` - Type definitions and constants
- `/components/charter/charter-capabilities.tsx` - Main component
- `/components/charter/index.ts` - Exports

### Phase Information

Part of Phase 3.1.2 of the Institutional-Grade-Integrated-System-Roadmap
