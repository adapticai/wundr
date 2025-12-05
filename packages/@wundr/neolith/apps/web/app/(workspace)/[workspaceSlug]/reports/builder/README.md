# Report Builder

An advanced drag-and-drop report builder with scheduling, data source management, and multiple chart
types.

## Features

### Drag-and-Drop Interface

- Intuitive widget palette with multiple chart types
- Drag widgets onto canvas to create reports
- Resize and reposition widgets freely
- Visual feedback during drag operations

### Multiple Chart Types

- **Line Chart**: Display trends over time with smooth or linear lines
- **Bar Chart**: Compare values across categories (stacked or grouped)
- **Area Chart**: Show cumulative trends with filled areas
- **Pie Chart**: Visualize proportional data
- **Table**: Display data in rows and columns
- **Metric Card**: Highlight key performance indicators
- **Text**: Add formatted text sections
- **Divider**: Separate report sections

### Data Source Management

- Multiple data source types:
  - Analytics
  - Tasks
  - Workflows
  - Agents
  - Custom Query (SQL)
  - API Endpoint
- Connect widgets to data sources
- Reusable data sources across widgets

### Advanced Filtering

- Field-based filters
- Multiple operators:
  - Equals / Not Equals
  - Contains
  - Greater Than / Less Than
  - Between
  - In (list)
- Combine multiple filters per widget

### Report Scheduling

- Schedule automatic report generation
- Frequency options:
  - Daily
  - Weekly (select day of week)
  - Monthly (select day of month)
  - Custom (cron expression)
- Email delivery to multiple recipients
- Export formats: PDF, CSV, Excel

### Widget Configuration

- Customizable titles and descriptions
- Chart-specific settings:
  - Data field selection
  - Axis configuration
  - Legend and grid visibility
  - Stacking and curve options
- Metric card trends and changes
- Text formatting and alignment

## Usage

### Creating a Report

1. **Add Widgets**: Drag widgets from the left palette onto the canvas
2. **Configure Data**: Select a data source from the right panel
3. **Apply Filters**: Add filters to refine the data
4. **Customize**: Adjust widget settings (title, colors, layout)
5. **Save**: Click "Save" to store the report template

### Scheduling Reports

1. Click the "Schedule" button in the toolbar
2. Enable scheduling and select frequency
3. Set the time and day (for weekly/monthly)
4. Add recipient email addresses
5. Choose export format (PDF, CSV, or Excel)
6. Save the schedule

### Managing Data Sources

1. Select a widget on the canvas
2. Click "New" in the Data Source panel
3. Enter data source details:
   - Name and type
   - Endpoint URL (for API sources)
   - Query (for custom queries)
4. Assign the data source to the widget

## Components

- `ReportBuilderCanvas`: Main canvas component with DnD context
- `WidgetPalette`: Draggable widget library
- `WidgetRenderer`: Individual widget rendering and interaction
- `DataSourcePanel`: Data source configuration
- `FilterPanel`: Filter management
- `ScheduleDialog`: Report scheduling configuration
- `SettingsPanel`: Widget-specific settings

## Hooks

- `useReportBuilder`: Main hook for report builder state management

## Types

See `types.ts` for complete type definitions:

- `ReportWidget`: Widget configuration and position
- `DataSource`: Data source configuration
- `FilterConfig`: Filter definition
- `ReportSchedule`: Scheduling configuration
- `ReportTemplate`: Complete report template

## API Integration

The report builder is designed to integrate with backend APIs:

### Endpoints (to be implemented)

```typescript
// Save report template
POST /api/reports/templates
Body: ReportTemplate

// Load report template
GET /api/reports/templates/:id
Response: ReportTemplate

// Execute report
POST /api/reports/execute/:templateId
Body: { filters?, dateRange? }
Response: Report data

// Schedule report
POST /api/reports/schedules
Body: { templateId, schedule: ReportSchedule }
```

## Extending

### Adding New Widget Types

1. Add widget type to `types.ts`:

```typescript
export type WidgetType = '...' | 'custom-widget';
```

2. Add to widget palette in `widget-palette.tsx`
3. Implement rendering in `widget-renderer.tsx`
4. Add settings in `settings-panel.tsx`

### Adding New Data Source Types

1. Add type to `types.ts`:

```typescript
export type DataSourceType = '...' | 'custom-source';
```

2. Update data source panel UI
3. Implement data fetching logic

## Dependencies

- `@dnd-kit/core`: Drag and drop functionality
- `recharts`: Chart rendering
- `react-hook-form`: Form management
- `zod`: Schema validation
- `date-fns`: Date manipulation
- `shadcn/ui`: UI components

## Future Enhancements

- [ ] Template library with predefined reports
- [ ] Real-time data updates
- [ ] Collaborative editing
- [ ] Version history
- [ ] Advanced data transformations
- [ ] Custom widget development API
- [ ] Dashboard embedding
- [ ] Mobile responsive builder
