# CharterDiff Component

## Overview

The `CharterDiff` component provides a comprehensive visual comparison between two versions of an orchestrator charter. It displays differences in a user-friendly format with color-coded changes, expandable sections, and detailed statistics.

**File Location:** `/Users/maya/wundr/packages/@wundr/neolith/apps/web/components/charter/charter-diff.tsx`

## Features

- **Side-by-side comparison** for modified values
- **Inline diff highlighting** with color coding:
  - Green background for additions
  - Red background for removals
  - Side-by-side view for modifications
- **Grouped by section** for easy navigation
- **Summary statistics** showing total changes
- **Expand/collapse sections** for better organization
- **Array diff support** for values, traits, and expertise
- **Nested object diff** for complex structures

## Props

```typescript
interface CharterDiffProps {
  /** Old version of the charter */
  oldCharter: OrchestratorCharter;

  /** New version of the charter */
  newCharter: OrchestratorCharter;

  /** Optional old version number */
  oldVersion?: number;

  /** Optional new version number */
  newVersion?: number;

  /** Optional className for styling */
  className?: string;
}
```

## Sections Compared

The component compares the following charter sections:

1. **Mission & Vision**
   - Mission statement
   - Vision statement

2. **Values**
   - Core values array with added/removed highlighting

3. **Personality**
   - Personality traits
   - Communication style
   - Decision making style
   - Background

4. **Expertise**
   - Areas of expertise with added/removed highlighting

5. **Communication Preferences**
   - Tone
   - Response length
   - Formality level
   - Emoji usage

6. **Operational Settings**
   - Work hours (start, end, timezone)
   - Response time target
   - Auto-escalation settings
   - Escalation threshold

## Change Types

The component identifies and displays four types of changes:

- **Added**: New values that didn't exist in the old version (green)
- **Removed**: Values that existed in old version but removed (red)
- **Modified**: Values that changed between versions (blue, side-by-side)
- **Unchanged**: Values that are the same (not displayed)

## Usage Examples

### Basic Usage

```tsx
import { CharterDiff } from '@/components/charter';

function CompareCharters() {
  return (
    <CharterDiff
      oldCharter={previousCharter}
      newCharter={currentCharter}
      oldVersion={1}
      newVersion={2}
    />
  );
}
```

### Without Version Numbers

```tsx
<CharterDiff
  oldCharter={baselineCharter}
  newCharter={draftCharter}
/>
```

### With Custom Styling

```tsx
<CharterDiff
  oldCharter={oldCharter}
  newCharter={newCharter}
  className="max-w-4xl mx-auto"
/>
```

## Component Structure

```
CharterDiff (Main Component)
├── Summary Card
│   ├── Version information
│   └── Total change statistics
└── Section Diffs (Scrollable)
    └── SectionDiffCard (for each section with changes)
        ├── Section header with expand/collapse
        ├── Section statistics
        └── DiffChangeItem (for each change)
            ├── Change type badge
            └── Value comparison (side-by-side or single)
```

## Visual Design

### Color Coding

- **Additions**: `bg-green-50` background, `border-green-200` border, `text-green-900` text
- **Removals**: `bg-red-50` background, `border-red-200` border, `text-red-900` text
- **Side-by-side**: Both colors shown in a two-column grid

### Badges

- **Added**: Green badge
- **Removed**: Red destructive badge
- **Modified**: Gray secondary badge
- **Array items**: Individual badges with highlighting for changed items

### Statistics Icons

- **Additions**: TrendingUp icon (green)
- **Removals**: TrendingDown icon (red)
- **Modifications**: Minus icon (blue)

## Performance Considerations

- **Memoized diff computation**: Uses `React.useMemo` to avoid recomputing diffs on every render
- **Memoized statistics**: Total statistics computed once and cached
- **Controlled expansion**: Sections start expanded but can be collapsed to improve performance with large charters
- **Virtualized scrolling**: Main container has max-height with overflow scrolling

## Accessibility

- **Semantic HTML**: Uses appropriate heading levels and structure
- **Interactive elements**: Buttons for expand/collapse with clear icons
- **Color + Icons**: Changes indicated by both color and icons for better accessibility
- **Clear labels**: All change types have text labels in addition to colors

## Edge Cases Handled

1. **No changes**: Displays a "No Changes" card when charters are identical
2. **Empty arrays**: Properly handles empty value/trait/expertise arrays
3. **Null/undefined values**: Treats as empty strings for comparison
4. **Array reordering**: Detects actual additions/removals, not just reordering
5. **Partial charters**: Works with partial charter objects

## Integration with Charter Editor

The CharterDiff component is designed to work seamlessly with the CharterEditor:

```tsx
import { CharterEditor, CharterDiff } from '@/components/charter';

function CharterManagement() {
  const [showDiff, setShowDiff] = useState(false);
  const [originalCharter, setOriginalCharter] = useState<OrchestratorCharter>();
  const [draftCharter, setDraftCharter] = useState<OrchestratorCharter>();

  return (
    <>
      {showDiff && originalCharter && draftCharter ? (
        <CharterDiff
          oldCharter={originalCharter}
          newCharter={draftCharter}
        />
      ) : (
        <CharterEditor
          orchestratorId={orchestratorId}
          initialCharter={draftCharter}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
```

## Future Enhancements

Potential improvements for future versions:

1. **Inline text diff**: Character-level diff for long text fields
2. **Export diff**: Export comparison as PDF or markdown
3. **Diff navigation**: Jump to next/previous change buttons
4. **Filter by change type**: Show only additions, removals, or modifications
5. **Three-way merge**: Compare and merge three versions
6. **Diff annotations**: Add comments/notes to specific changes
7. **History timeline**: Visual timeline of charter evolution
8. **Undo/redo**: Revert to specific versions

## Testing

Example test cases (to be implemented):

```typescript
describe('CharterDiff', () => {
  it('should display no changes when charters are identical');
  it('should detect added values');
  it('should detect removed values');
  it('should detect modified text fields');
  it('should detect array additions and removals');
  it('should handle nested object changes');
  it('should compute correct statistics');
  it('should expand/collapse sections');
  it('should display version numbers when provided');
});
```

## Dependencies

- **React**: Core framework
- **lucide-react**: Icons (ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus)
- **UI Components**: Card, Badge, Button from shadcn/ui
- **Types**: OrchestratorCharter from @/types/orchestrator
- **Utils**: cn() utility for className merging

## Related Components

- **CharterEditor**: Edit charter values
- **CharterCapabilities**: Manage orchestrator capabilities
- **CharterIdentitySection**: Identity and basic info
- **CharterLimits**: Resource and rate limits
- **CharterTools**: Tool configuration

## License

Part of the Wundr Neolith project.
