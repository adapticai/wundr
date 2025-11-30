'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type OrchestratorCharter } from '@/types/orchestrator';

/**
 * Props for CharterDiff component
 */
export interface CharterDiffProps {
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

/**
 * Diff change type
 */
type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

/**
 * Represents a single diff change
 */
interface DiffChange {
  type: ChangeType;
  oldValue?: string | string[];
  newValue?: string | string[];
  path: string;
  label: string;
}

/**
 * Section diff summary
 */
interface SectionDiff {
  section: string;
  changes: DiffChange[];
  stats: {
    added: number;
    removed: number;
    modified: number;
  };
}

/**
 * Compute differences between two values
 */
function computeDiff(
  oldValue: unknown,
  newValue: unknown,
  path: string,
  label: string
): DiffChange | null {
  // Handle arrays
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const oldSet = new Set(oldValue);
    const newSet = new Set(newValue);

    const added = newValue.filter(v => !oldSet.has(v));
    const removed = oldValue.filter(v => !newSet.has(v));

    if (added.length > 0 || removed.length > 0) {
      return {
        type: 'modified',
        oldValue: oldValue as string[],
        newValue: newValue as string[],
        path,
        label,
      };
    }
    return null;
  }

  // Handle primitive values
  if (oldValue !== newValue) {
    if (oldValue === undefined || oldValue === null || oldValue === '') {
      return {
        type: 'added',
        newValue: String(newValue),
        path,
        label,
      };
    }
    if (newValue === undefined || newValue === null || newValue === '') {
      return {
        type: 'removed',
        oldValue: String(oldValue),
        path,
        label,
      };
    }
    return {
      type: 'modified',
      oldValue: String(oldValue),
      newValue: String(newValue),
      path,
      label,
    };
  }

  return null;
}

/**
 * Compute all differences between two charters
 */
function computeCharterDiff(
  oldCharter: OrchestratorCharter,
  newCharter: OrchestratorCharter
): SectionDiff[] {
  const sections: SectionDiff[] = [];

  // Mission & Vision section
  const missionVisionChanges: DiffChange[] = [];
  const missionDiff = computeDiff(oldCharter.mission, newCharter.mission, 'mission', 'Mission');
  const visionDiff = computeDiff(oldCharter.vision, newCharter.vision, 'vision', 'Vision');

  if (missionDiff) missionVisionChanges.push(missionDiff);
  if (visionDiff) missionVisionChanges.push(visionDiff);

  if (missionVisionChanges.length > 0) {
    sections.push({
      section: 'Mission & Vision',
      changes: missionVisionChanges,
      stats: computeStats(missionVisionChanges),
    });
  }

  // Values section
  const valuesDiff = computeDiff(oldCharter.values, newCharter.values, 'values', 'Values');
  if (valuesDiff) {
    sections.push({
      section: 'Values',
      changes: [valuesDiff],
      stats: computeStats([valuesDiff]),
    });
  }

  // Personality section
  const personalityChanges: DiffChange[] = [];
  const traitsDiff = computeDiff(
    oldCharter.personality.traits,
    newCharter.personality.traits,
    'personality.traits',
    'Personality Traits'
  );
  const commStyleDiff = computeDiff(
    oldCharter.personality.communicationStyle,
    newCharter.personality.communicationStyle,
    'personality.communicationStyle',
    'Communication Style'
  );
  const decisionStyleDiff = computeDiff(
    oldCharter.personality.decisionMakingStyle,
    newCharter.personality.decisionMakingStyle,
    'personality.decisionMakingStyle',
    'Decision Making Style'
  );
  const backgroundDiff = computeDiff(
    oldCharter.personality.background,
    newCharter.personality.background,
    'personality.background',
    'Background'
  );

  if (traitsDiff) personalityChanges.push(traitsDiff);
  if (commStyleDiff) personalityChanges.push(commStyleDiff);
  if (decisionStyleDiff) personalityChanges.push(decisionStyleDiff);
  if (backgroundDiff) personalityChanges.push(backgroundDiff);

  if (personalityChanges.length > 0) {
    sections.push({
      section: 'Personality',
      changes: personalityChanges,
      stats: computeStats(personalityChanges),
    });
  }

  // Expertise section
  const expertiseDiff = computeDiff(
    oldCharter.expertise,
    newCharter.expertise,
    'expertise',
    'Expertise'
  );
  if (expertiseDiff) {
    sections.push({
      section: 'Expertise',
      changes: [expertiseDiff],
      stats: computeStats([expertiseDiff]),
    });
  }

  // Communication Preferences section
  const commPrefChanges: DiffChange[] = [];
  const toneDiff = computeDiff(
    oldCharter.communicationPreferences.tone,
    newCharter.communicationPreferences.tone,
    'communicationPreferences.tone',
    'Tone'
  );
  const lengthDiff = computeDiff(
    oldCharter.communicationPreferences.responseLength,
    newCharter.communicationPreferences.responseLength,
    'communicationPreferences.responseLength',
    'Response Length'
  );
  const formalityDiff = computeDiff(
    oldCharter.communicationPreferences.formality,
    newCharter.communicationPreferences.formality,
    'communicationPreferences.formality',
    'Formality'
  );
  const emojiDiff = computeDiff(
    oldCharter.communicationPreferences.useEmoji,
    newCharter.communicationPreferences.useEmoji,
    'communicationPreferences.useEmoji',
    'Use Emoji'
  );

  if (toneDiff) commPrefChanges.push(toneDiff);
  if (lengthDiff) commPrefChanges.push(lengthDiff);
  if (formalityDiff) commPrefChanges.push(formalityDiff);
  if (emojiDiff) commPrefChanges.push(emojiDiff);

  if (commPrefChanges.length > 0) {
    sections.push({
      section: 'Communication Preferences',
      changes: commPrefChanges,
      stats: computeStats(commPrefChanges),
    });
  }

  // Operational Settings section
  const opSettingsChanges: DiffChange[] = [];
  const workHoursStartDiff = computeDiff(
    oldCharter.operationalSettings.workHours.start,
    newCharter.operationalSettings.workHours.start,
    'operationalSettings.workHours.start',
    'Work Hours Start'
  );
  const workHoursEndDiff = computeDiff(
    oldCharter.operationalSettings.workHours.end,
    newCharter.operationalSettings.workHours.end,
    'operationalSettings.workHours.end',
    'Work Hours End'
  );
  const timezoneDiff = computeDiff(
    oldCharter.operationalSettings.workHours.timezone,
    newCharter.operationalSettings.workHours.timezone,
    'operationalSettings.workHours.timezone',
    'Timezone'
  );
  const responseTargetDiff = computeDiff(
    oldCharter.operationalSettings.responseTimeTarget,
    newCharter.operationalSettings.responseTimeTarget,
    'operationalSettings.responseTimeTarget',
    'Response Time Target'
  );
  const autoEscalationDiff = computeDiff(
    oldCharter.operationalSettings.autoEscalation,
    newCharter.operationalSettings.autoEscalation,
    'operationalSettings.autoEscalation',
    'Auto Escalation'
  );
  const escalationThresholdDiff = computeDiff(
    oldCharter.operationalSettings.escalationThreshold,
    newCharter.operationalSettings.escalationThreshold,
    'operationalSettings.escalationThreshold',
    'Escalation Threshold'
  );

  if (workHoursStartDiff) opSettingsChanges.push(workHoursStartDiff);
  if (workHoursEndDiff) opSettingsChanges.push(workHoursEndDiff);
  if (timezoneDiff) opSettingsChanges.push(timezoneDiff);
  if (responseTargetDiff) opSettingsChanges.push(responseTargetDiff);
  if (autoEscalationDiff) opSettingsChanges.push(autoEscalationDiff);
  if (escalationThresholdDiff) opSettingsChanges.push(escalationThresholdDiff);

  if (opSettingsChanges.length > 0) {
    sections.push({
      section: 'Operational Settings',
      changes: opSettingsChanges,
      stats: computeStats(opSettingsChanges),
    });
  }

  return sections;
}

/**
 * Compute statistics for a set of changes
 */
function computeStats(changes: DiffChange[]): { added: number; removed: number; modified: number } {
  return changes.reduce(
    (acc, change) => {
      if (change.type === 'added') acc.added++;
      else if (change.type === 'removed') acc.removed++;
      else if (change.type === 'modified') acc.modified++;
      return acc;
    },
    { added: 0, removed: 0, modified: 0 }
  );
}

/**
 * Component to render a single diff change
 */
function DiffChangeItem({ change }: { change: DiffChange }) {
  const renderValue = (value: string | string[] | undefined, type: 'old' | 'new') => {
    if (!value) return null;

    const isOld = type === 'old';
    const bgColor = isOld ? 'bg-red-50' : 'bg-green-50';
    const textColor = isOld ? 'text-red-900' : 'text-green-900';
    const borderColor = isOld ? 'border-red-200' : 'border-green-200';

    if (Array.isArray(value)) {
      const otherValue = isOld ? change.newValue : change.oldValue;
      const otherSet = new Set(Array.isArray(otherValue) ? otherValue : []);

      return (
        <div className={cn('rounded-md border p-3', bgColor, borderColor)}>
          <div className="flex flex-wrap gap-1.5">
            {value.map((item, idx) => {
              const isChanged = !otherSet.has(item);
              return (
                <Badge
                  key={idx}
                  variant={isChanged ? (isOld ? 'destructive' : 'default') : 'secondary'}
                  className={cn(!isChanged && 'opacity-60')}
                >
                  {item}
                </Badge>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className={cn('rounded-md border p-3', bgColor, borderColor)}>
        <p className={cn('text-sm', textColor)}>{value}</p>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{change.label}</span>
        {change.type === 'added' && <Badge variant="default" className="bg-green-600">Added</Badge>}
        {change.type === 'removed' && <Badge variant="destructive">Removed</Badge>}
        {change.type === 'modified' && <Badge variant="secondary">Modified</Badge>}
      </div>

      {change.type === 'modified' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Old Value</p>
            {renderValue(change.oldValue, 'old')}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">New Value</p>
            {renderValue(change.newValue, 'new')}
          </div>
        </div>
      )}

      {change.type === 'added' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">New Value</p>
          {renderValue(change.newValue, 'new')}
        </div>
      )}

      {change.type === 'removed' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">Old Value</p>
          {renderValue(change.oldValue, 'old')}
        </div>
      )}
    </div>
  );
}

/**
 * Component to render a section diff
 */
function SectionDiffCard({ sectionDiff, defaultExpanded = true }: { sectionDiff: SectionDiff; defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div>
              <CardTitle className="text-lg">{sectionDiff.section}</CardTitle>
              <CardDescription>
                {sectionDiff.changes.length} {sectionDiff.changes.length === 1 ? 'change' : 'changes'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sectionDiff.stats.added > 0 && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>{sectionDiff.stats.added}</span>
              </div>
            )}
            {sectionDiff.stats.removed > 0 && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <TrendingDown className="h-4 w-4" />
                <span>{sectionDiff.stats.removed}</span>
              </div>
            )}
            {sectionDiff.stats.modified > 0 && (
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Minus className="h-4 w-4" />
                <span>{sectionDiff.stats.modified}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {sectionDiff.changes.map((change, idx) => (
            <DiffChangeItem key={idx} change={change} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * CharterDiff - Charter version comparison component
 *
 * Displays differences between two charter versions with:
 * - Side-by-side comparison for modified values
 * - Inline diff highlighting (additions green, removals red)
 * - Grouped by section
 * - Summary of changes
 * - Expand/collapse sections
 * - Change statistics
 *
 * Features:
 * - Visual diff with color coding
 * - Array diff support (values, traits, expertise)
 * - Nested object diff (personality, communication preferences, operational settings)
 * - Change navigation
 * - Comprehensive change statistics
 */
export function CharterDiff({
  oldCharter,
  newCharter,
  oldVersion,
  newVersion,
  className,
}: CharterDiffProps) {
  const sectionDiffs = React.useMemo(
    () => computeCharterDiff(oldCharter, newCharter),
    [oldCharter, newCharter]
  );

  const totalStats = React.useMemo(() => {
    return sectionDiffs.reduce(
      (acc, section) => ({
        added: acc.added + section.stats.added,
        removed: acc.removed + section.stats.removed,
        modified: acc.modified + section.stats.modified,
      }),
      { added: 0, removed: 0, modified: 0 }
    );
  }, [sectionDiffs]);

  const totalChanges = totalStats.added + totalStats.removed + totalStats.modified;

  if (sectionDiffs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>No Changes</CardTitle>
          <CardDescription>
            The charters are identical
            {oldVersion !== undefined && newVersion !== undefined &&
              ` (v${oldVersion} vs v${newVersion})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            There are no differences between the selected charter versions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Charter Comparison</CardTitle>
          <CardDescription>
            {oldVersion !== undefined && newVersion !== undefined
              ? `Comparing v${oldVersion} with v${newVersion}`
              : 'Charter version comparison'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Total Changes:</span>
              <Badge variant="outline" className="font-semibold">
                {totalChanges}
              </Badge>
            </div>
            {totalStats.added > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">
                  {totalStats.added} {totalStats.added === 1 ? 'addition' : 'additions'}
                </span>
              </div>
            )}
            {totalStats.removed > 0 && (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600">
                  {totalStats.removed} {totalStats.removed === 1 ? 'removal' : 'removals'}
                </span>
              </div>
            )}
            {totalStats.modified > 0 && (
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600">
                  {totalStats.modified} {totalStats.modified === 1 ? 'modification' : 'modifications'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section Diffs */}
      <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
        {sectionDiffs.map((sectionDiff, idx) => (
          <SectionDiffCard key={idx} sectionDiff={sectionDiff} />
        ))}
      </div>
    </div>
  );
}
