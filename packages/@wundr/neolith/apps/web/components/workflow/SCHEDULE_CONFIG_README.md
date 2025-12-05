# ScheduleConfig Component

A comprehensive workflow scheduling UI component with visual cron expression builder, schedule
preview, calendar view, and timezone support.

## Features

### 1. Visual Cron Expression Builder

- **Preset Schedules**: Quick selection of common patterns (every minute, hourly, daily, weekly,
  monthly)
- **Advanced Mode**: Manual configuration of individual cron fields
- **Real-time Validation**: Immediate feedback on cron expression validity
- **Human-readable Descriptions**: Automatic translation of cron to plain English

### 2. Schedule Preview

- **Next N Runs**: Shows the next 5 scheduled execution times
- **Visual Timeline**: Date cards with formatted dates and times
- **Timezone-aware**: All times displayed in the configured timezone
- **Countdown Indicators**: Shows relative time until next run

### 3. Timezone Selection

- **10+ Timezones**: Common timezones including EST, CST, MST, PST, GMT, CET, JST, CST (China), AEDT
- **Per-schedule Configuration**: Each schedule can have its own timezone
- **Automatic DST Handling**: Built-in daylight saving time adjustments

### 4. Multiple Schedules

- **Per-workflow Schedules**: Support for up to 10 schedules per workflow (configurable)
- **Individual Control**: Enable/disable schedules independently
- **Schedule Metadata**: Name, description, creation date for each schedule

### 5. Schedule Calendar View

- **Visual Calendar**: Month view with highlighted scheduled dates
- **Date Selection**: Click dates to see all schedules for that day
- **Active Schedules Only**: Shows only enabled schedules
- **Run Time Display**: Lists all execution times for selected date

### 6. User Experience

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Mode**: Full support for dark theme
- **Accessible**: Keyboard navigation and screen reader support
- **Toast Notifications**: Feedback for all actions
- **Empty States**: Helpful guidance when no schedules exist

## Installation

The component is already integrated into the workflow component library.

```tsx
import { ScheduleConfig } from '@/components/workflow/schedule-config';
```

## Basic Usage

```tsx
import { ScheduleConfig, Schedule } from '@/components/workflow/schedule-config';
import { useState } from 'react';

function MyWorkflowEditor() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const handleScheduleAdd = (schedule: Omit<Schedule, 'id' | 'createdAt'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: generateId(),
      createdAt: new Date(),
    };
    setSchedules([...schedules, newSchedule]);
  };

  const handleScheduleUpdate = (scheduleId: string, updates: Partial<Schedule>) => {
    setSchedules(schedules.map(s => (s.id === scheduleId ? { ...s, ...updates } : s)));
  };

  const handleScheduleDelete = (scheduleId: string) => {
    setSchedules(schedules.filter(s => s.id !== scheduleId));
  };

  return (
    <ScheduleConfig
      workflowId='my-workflow-id'
      schedules={schedules}
      onScheduleAdd={handleScheduleAdd}
      onScheduleUpdate={handleScheduleUpdate}
      onScheduleDelete={handleScheduleDelete}
      maxSchedules={10}
    />
  );
}
```

## API Reference

### Props

| Prop               | Type                                                       | Required | Default | Description                         |
| ------------------ | ---------------------------------------------------------- | -------- | ------- | ----------------------------------- |
| `workflowId`       | `string`                                                   | Yes      | -       | Unique identifier for the workflow  |
| `schedules`        | `Schedule[]`                                               | No       | `[]`    | Array of existing schedules         |
| `onScheduleAdd`    | `(schedule: Omit<Schedule, 'id' \| 'createdAt'>) => void`  | No       | -       | Callback when a schedule is added   |
| `onScheduleUpdate` | `(scheduleId: string, updates: Partial<Schedule>) => void` | No       | -       | Callback when a schedule is updated |
| `onScheduleDelete` | `(scheduleId: string) => void`                             | No       | -       | Callback when a schedule is deleted |
| `maxSchedules`     | `number`                                                   | No       | `10`    | Maximum number of schedules allowed |

### Types

```typescript
interface Schedule {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  nextRuns: Date[];
  description?: string;
  createdAt: Date;
}

interface CronConfig {
  minute: string; // 0-59 or */n
  hour: string; // 0-23 or */n
  dayOfMonth: string; // 1-31 or */n or ?
  month: string; // 1-12 or */n
  dayOfWeek: string; // 0-6 or */n or ?
}
```

## Cron Expression Format

The component uses standard cron format: `minute hour dayOfMonth month dayOfWeek`

### Special Characters

- `*` - Any value (matches all)
- `*/n` - Every n units (e.g., `*/5` = every 5 minutes)
- `n` - Specific value (e.g., `9` = 9 AM for hour field)
- `?` - No specific value (used for dayOfMonth or dayOfWeek)

### Common Patterns

| Pattern               | Cron Expression | Description                    |
| --------------------- | --------------- | ------------------------------ |
| Every minute          | `* * * * *`     | Runs every minute              |
| Every 5 minutes       | `*/5 * * * *`   | Runs every 5 minutes           |
| Every 15 minutes      | `*/15 * * * *`  | Runs every 15 minutes          |
| Every 30 minutes      | `*/30 * * * *`  | Runs every 30 minutes          |
| Every hour            | `0 * * * *`     | Runs at minute 0 of every hour |
| Every day at midnight | `0 0 * * *`     | Runs at 00:00 every day        |
| Every day at 9 AM     | `0 9 * * *`     | Runs at 09:00 every day        |
| Every Monday at 9 AM  | `0 9 * * 1`     | Runs at 09:00 on Mondays       |
| First day of month    | `0 9 1 * *`     | Runs at 09:00 on the 1st       |

## Timezones

Supported timezones:

- **UTC** - Coordinated Universal Time
- **America/New_York** - Eastern Standard Time (EST)
- **America/Chicago** - Central Standard Time (CST)
- **America/Denver** - Mountain Standard Time (MST)
- **America/Los_Angeles** - Pacific Standard Time (PST)
- **Europe/London** - Greenwich Mean Time (GMT)
- **Europe/Paris** - Central European Time (CET)
- **Asia/Tokyo** - Japan Standard Time (JST)
- **Asia/Shanghai** - China Standard Time (CST)
- **Australia/Sydney** - Australian Eastern Daylight Time (AEDT)

## Components

### CronBuilder

Visual cron expression builder with presets and advanced configuration.

**Features:**

- Preset dropdown for common patterns
- Advanced mode with individual field inputs
- Real-time description updates
- Input validation

### SchedulePreview

Preview of next scheduled runs with formatted dates and times.

**Features:**

- Shows next 5 runs by default
- Visual date cards
- Countdown indicators
- Timezone display

### ScheduleCalendar

Monthly calendar view of scheduled runs.

**Features:**

- Full calendar with date highlighting
- Click to view schedules for date
- Shows all active schedules
- Execution time details

## Advanced Usage

### With API Integration

```tsx
import { ScheduleConfig } from '@/components/workflow/schedule-config';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_WORKFLOW_SCHEDULES,
  CREATE_SCHEDULE,
  UPDATE_SCHEDULE,
  DELETE_SCHEDULE,
} from '@/graphql/workflows';

function WorkflowScheduler({ workflowId }: { workflowId: string }) {
  const { data } = useQuery(GET_WORKFLOW_SCHEDULES, {
    variables: { workflowId },
  });

  const [createSchedule] = useMutation(CREATE_SCHEDULE);
  const [updateSchedule] = useMutation(UPDATE_SCHEDULE);
  const [deleteSchedule] = useMutation(DELETE_SCHEDULE);

  const handleScheduleAdd = async (schedule: Omit<Schedule, 'id' | 'createdAt'>) => {
    await createSchedule({
      variables: {
        workflowId,
        input: schedule,
      },
      refetchQueries: [GET_WORKFLOW_SCHEDULES],
    });
  };

  const handleScheduleUpdate = async (scheduleId: string, updates: Partial<Schedule>) => {
    await updateSchedule({
      variables: {
        scheduleId,
        input: updates,
      },
      refetchQueries: [GET_WORKFLOW_SCHEDULES],
    });
  };

  const handleScheduleDelete = async (scheduleId: string) => {
    await deleteSchedule({
      variables: { scheduleId },
      refetchQueries: [GET_WORKFLOW_SCHEDULES],
    });
  };

  return (
    <ScheduleConfig
      workflowId={workflowId}
      schedules={data?.workflowSchedules || []}
      onScheduleAdd={handleScheduleAdd}
      onScheduleUpdate={handleScheduleUpdate}
      onScheduleDelete={handleScheduleDelete}
    />
  );
}
```

### With Validation

```tsx
import { ScheduleConfig, Schedule } from '@/components/workflow/schedule-config';
import { toast } from 'sonner';

function WorkflowSchedulerWithValidation({ workflowId }: { workflowId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const validateSchedule = (schedule: Omit<Schedule, 'id' | 'createdAt'>) => {
    if (!schedule.name.trim()) {
      toast.error('Schedule name is required');
      return false;
    }

    if (schedule.name.length > 100) {
      toast.error('Schedule name must be less than 100 characters');
      return false;
    }

    // Check for duplicate names
    if (schedules.some(s => s.name === schedule.name)) {
      toast.error('A schedule with this name already exists');
      return false;
    }

    return true;
  };

  const handleScheduleAdd = (schedule: Omit<Schedule, 'id' | 'createdAt'>) => {
    if (!validateSchedule(schedule)) {
      return;
    }

    const newSchedule: Schedule = {
      ...schedule,
      id: generateId(),
      createdAt: new Date(),
    };
    setSchedules([...schedules, newSchedule]);
    toast.success('Schedule created successfully');
  };

  return (
    <ScheduleConfig
      workflowId={workflowId}
      schedules={schedules}
      onScheduleAdd={handleScheduleAdd}
      onScheduleUpdate={(id, updates) => {
        setSchedules(schedules.map(s => (s.id === id ? { ...s, ...updates } : s)));
        toast.success('Schedule updated');
      }}
      onScheduleDelete={id => {
        setSchedules(schedules.filter(s => s.id !== id));
        toast.success('Schedule deleted');
      }}
    />
  );
}
```

## Styling

The component uses Tailwind CSS and shadcn/ui components. It automatically adapts to your theme
configuration including:

- Light/dark mode
- Custom color schemes
- Border radius preferences
- Font family

## Accessibility

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Readers**: ARIA labels and semantic HTML
- **Focus Management**: Clear focus indicators and logical tab order
- **Color Contrast**: WCAG AA compliant color contrast ratios

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Performance

- **Optimized Rendering**: Uses React.memo and useMemo for performance
- **Lazy Loading**: Components are code-split for faster initial load
- **Efficient Updates**: Only re-renders affected components on change

## Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScheduleConfig } from './schedule-config';

describe('ScheduleConfig', () => {
  it('renders without schedules', () => {
    render(<ScheduleConfig workflowId='test' schedules={[]} />);
    expect(screen.getByText('No Schedules Yet')).toBeInTheDocument();
  });

  it('allows adding a schedule', async () => {
    const onScheduleAdd = jest.fn();
    render(<ScheduleConfig workflowId='test' schedules={[]} onScheduleAdd={onScheduleAdd} />);

    fireEvent.click(screen.getByText('Add Schedule'));
    fireEvent.change(screen.getByLabelText('Schedule Name *'), {
      target: { value: 'Test Schedule' },
    });
    fireEvent.click(screen.getByText('Create Schedule'));

    await waitFor(() => {
      expect(onScheduleAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Schedule',
        })
      );
    });
  });

  it('displays existing schedules', () => {
    const schedules = [
      {
        id: '1',
        name: 'Daily Report',
        cron: '0 9 * * *',
        timezone: 'UTC',
        enabled: true,
        nextRuns: [],
        createdAt: new Date(),
      },
    ];

    render(<ScheduleConfig workflowId='test' schedules={schedules} />);
    expect(screen.getByText('Daily Report')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: Schedules not updating

**Solution**: Ensure you're updating the `schedules` prop when the component calls the callbacks.

```tsx
const handleScheduleUpdate = (id: string, updates: Partial<Schedule>) => {
  // Make sure to update state
  setSchedules(schedules.map(s => (s.id === id ? { ...s, ...updates } : s)));
};
```

### Issue: Timezone display incorrect

**Solution**: Verify the timezone string matches the IANA timezone database format.

```tsx
// Correct
timezone: 'America/New_York';

// Incorrect
timezone: 'EST';
```

### Issue: Calendar not showing scheduled dates

**Solution**: Ensure schedules have `enabled: true` and valid `nextRuns` array.

```tsx
const schedule: Schedule = {
  // ... other fields
  enabled: true,
  nextRuns: calculateNextRuns(cron, timezone, 5),
};
```

## Future Enhancements

Planned features for future releases:

1. **Recurring Patterns**: Natural language input (e.g., "every Monday at 9am")
2. **Schedule Conflicts**: Visual warnings for overlapping schedules
3. **Time Window Restrictions**: Blackout periods and execution windows
4. **Execution History**: View past runs with success/failure status
5. **Schedule Templates**: Save and reuse common schedule configurations
6. **Bulk Operations**: Enable/disable multiple schedules at once
7. **Schedule Groups**: Organize schedules into categories
8. **Advanced Cron**: Support for seconds field (6-part cron)
9. **Holiday Handling**: Skip executions on configured holidays
10. **Schedule Dependencies**: Chain schedules with dependencies

## Support

For questions or issues, please:

1. Check the [demo component](./schedule-config-demo.tsx) for usage examples
2. Review the inline code comments
3. Open an issue in the project repository

## License

Part of the Neolith workflow system. See project LICENSE for details.
