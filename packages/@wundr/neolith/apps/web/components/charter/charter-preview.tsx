'use client';

/**
 * Charter Preview Component
 *
 * Displays a read-only preview of an orchestrator charter with:
 * - YAML/JSON format toggle
 * - Basic syntax highlighting
 * - Copy to clipboard functionality
 * - Download as file functionality
 * - Collapsible sections
 * - Validation status indicator
 *
 * @module components/charter/charter-preview
 */

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Copy,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { OrchestratorCharter } from '@/types/orchestrator';
import { toast } from 'sonner';

/**
 * Component props
 */
export interface CharterPreviewProps {
  /** The charter to preview */
  charter: OrchestratorCharter;
  /** Default format to display */
  format?: 'yaml' | 'json';
  /** Custom class name */
  className?: string;
}

/**
 * Validates charter completeness
 */
function validateCharter(charter: OrchestratorCharter): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!charter.mission?.trim()) {
    errors.push('Mission is required');
  }
  if (!charter.vision?.trim()) {
    errors.push('Vision is required');
  }
  if (!charter.values || charter.values.length === 0) {
    errors.push('At least one value is required');
  }
  if (!charter.expertise || charter.expertise.length === 0) {
    errors.push('At least one area of expertise is required');
  }
  if (!charter.personality?.communicationStyle?.trim()) {
    errors.push('Communication style is required');
  }
  if (!charter.personality?.decisionMakingStyle?.trim()) {
    errors.push('Decision-making style is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Converts charter to YAML format
 */
function charterToYAML(charter: OrchestratorCharter): string {
  const yaml: string[] = [];

  yaml.push('# Orchestrator Charter\n');

  // Mission & Vision
  yaml.push('mission: |\n  ' + charter.mission.replace(/\n/g, '\n  '));
  yaml.push('\nvision: |\n  ' + charter.vision.replace(/\n/g, '\n  '));

  // Values
  yaml.push('\nvalues:');
  charter.values.forEach(value => {
    yaml.push(`  - ${value}`);
  });

  // Personality
  yaml.push('\npersonality:');
  yaml.push('  traits:');
  charter.personality.traits.forEach(trait => {
    yaml.push(`    - ${trait}`);
  });
  yaml.push(`  communicationStyle: ${charter.personality.communicationStyle}`);
  yaml.push(
    `  decisionMakingStyle: ${charter.personality.decisionMakingStyle}`
  );
  yaml.push(
    '  background: |\n    ' +
      charter.personality.background.replace(/\n/g, '\n    ')
  );

  // Expertise
  yaml.push('\nexpertise:');
  charter.expertise.forEach(exp => {
    yaml.push(`  - ${exp}`);
  });

  // Communication Preferences
  yaml.push('\ncommunicationPreferences:');
  yaml.push(`  tone: ${charter.communicationPreferences.tone}`);
  yaml.push(
    `  responseLength: ${charter.communicationPreferences.responseLength}`
  );
  yaml.push(`  formality: ${charter.communicationPreferences.formality}`);
  yaml.push(`  useEmoji: ${charter.communicationPreferences.useEmoji}`);

  // Operational Settings
  yaml.push('\noperationalSettings:');
  yaml.push('  workHours:');
  yaml.push(`    start: "${charter.operationalSettings.workHours.start}"`);
  yaml.push(`    end: "${charter.operationalSettings.workHours.end}"`);
  yaml.push(`    timezone: ${charter.operationalSettings.workHours.timezone}`);
  yaml.push(
    `  responseTimeTarget: ${charter.operationalSettings.responseTimeTarget}`
  );
  yaml.push(`  autoEscalation: ${charter.operationalSettings.autoEscalation}`);
  yaml.push(
    `  escalationThreshold: ${charter.operationalSettings.escalationThreshold}`
  );

  return yaml.join('\n');
}

/**
 * Converts charter to formatted JSON
 */
function charterToJSON(charter: OrchestratorCharter): string {
  return JSON.stringify(charter, null, 2);
}

/**
 * Simple syntax highlighter for YAML
 */
function highlightYAML(yaml: string): React.ReactNode {
  const lines = yaml.split('\n');
  return lines.map((line, index) => {
    let className = 'text-foreground';

    if (line.startsWith('#')) {
      className = 'text-muted-foreground italic';
    } else if (line.match(/^[a-zA-Z]+:/)) {
      className = 'text-blue-600 dark:text-blue-400 font-semibold';
    } else if (line.match(/^\s+[a-zA-Z]+:/)) {
      className = 'text-emerald-600 dark:text-emerald-400';
    } else if (line.match(/^\s+-/)) {
      className = 'text-amber-600 dark:text-amber-400';
    } else if (line.match(/:\s*[|>]/)) {
      className = 'text-purple-600 dark:text-purple-400';
    } else if (line.match(/:\s*(true|false)/)) {
      className = 'text-rose-600 dark:text-rose-400';
    } else if (line.match(/:\s*\d+/)) {
      className = 'text-orange-600 dark:text-orange-400';
    } else if (line.match(/:\s*".+"/)) {
      className = 'text-green-600 dark:text-green-400';
    }

    return (
      <div key={index} className={className}>
        {line || '\u00A0'}
      </div>
    );
  });
}

/**
 * Simple syntax highlighter for JSON
 */
function highlightJSON(json: string): React.ReactNode {
  const lines = json.split('\n');
  return lines.map((line, index) => {
    let className = 'text-foreground';

    if (line.match(/^\s*"[^"]+"\s*:/)) {
      className = 'text-blue-600 dark:text-blue-400';
    } else if (line.match(/:\s*"[^"]*"/)) {
      className = 'text-green-600 dark:text-green-400';
    } else if (line.match(/:\s*(true|false)/)) {
      className = 'text-rose-600 dark:text-rose-400';
    } else if (line.match(/:\s*\d+/)) {
      className = 'text-orange-600 dark:text-orange-400';
    } else if (line.match(/[{}\[\]]/)) {
      className = 'text-gray-500 dark:text-gray-400';
    }

    return (
      <div key={index} className={className}>
        {line || '\u00A0'}
      </div>
    );
  });
}

/**
 * Collapsible section component
 */
interface CollapsibleSectionProps {
  title: string;
  content: string;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  content,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className='border rounded-lg'
    >
      <CollapsibleTrigger asChild>
        <Button
          variant='ghost'
          className='w-full justify-between p-4 hover:bg-muted/50'
        >
          <span className='font-semibold text-sm'>{title}</span>
          {isOpen ? (
            <ChevronDown className='h-4 w-4 transition-transform' />
          ) : (
            <ChevronRight className='h-4 w-4 transition-transform' />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='px-4 pb-4'>
        <div className='text-sm text-muted-foreground whitespace-pre-wrap'>
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Charter Preview Component
 */
export function CharterPreview({
  charter,
  format = 'yaml',
  className,
}: CharterPreviewProps) {
  const [activeFormat, setActiveFormat] = React.useState<'yaml' | 'json'>(
    format
  );
  const validation = React.useMemo(() => validateCharter(charter), [charter]);

  const yamlContent = React.useMemo(() => charterToYAML(charter), [charter]);
  const jsonContent = React.useMemo(() => charterToJSON(charter), [charter]);

  /**
   * Copy content to clipboard
   */
  const handleCopy = React.useCallback(() => {
    const content = activeFormat === 'yaml' ? yamlContent : jsonContent;
    navigator.clipboard
      .writeText(content)
      .then(() => {
        toast.success('Copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy to clipboard');
      });
  }, [activeFormat, yamlContent, jsonContent]);

  /**
   * Download content as file
   */
  const handleDownload = React.useCallback(() => {
    const content = activeFormat === 'yaml' ? yamlContent : jsonContent;
    const extension = activeFormat === 'yaml' ? 'yaml' : 'json';
    const filename = `orchestrator-charter.${extension}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded as ${filename}`);
  }, [activeFormat, yamlContent, jsonContent]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <CardTitle>Charter Preview</CardTitle>
            <CardDescription>
              Review and export your orchestrator charter
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            {validation.isValid ? (
              <div className='flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400'>
                <CheckCircle2 className='h-4 w-4' />
                <span>Valid</span>
              </div>
            ) : (
              <div className='flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400'>
                <AlertCircle className='h-4 w-4' />
                <span>
                  {validation.errors.length} issue
                  {validation.errors.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Validation Errors */}
        {!validation.isValid && (
          <div className='rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4'>
            <div className='flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 text-red-600 dark:text-red-400 mt-0.5' />
              <div className='space-y-1 flex-1'>
                <div className='text-sm font-medium text-red-900 dark:text-red-100'>
                  Charter Validation Issues
                </div>
                <ul className='text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-0.5'>
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Sections */}
        <div className='space-y-2'>
          <h3 className='text-sm font-semibold mb-2'>Charter Sections</h3>
          <CollapsibleSection
            title='Mission & Vision'
            content={`Mission:\n${charter.mission}\n\nVision:\n${charter.vision}`}
          />
          <CollapsibleSection
            title='Values'
            content={charter.values.join('\n')}
            defaultOpen={false}
          />
          <CollapsibleSection
            title='Personality'
            content={`Traits: ${charter.personality.traits.join(', ')}\n\nCommunication Style: ${charter.personality.communicationStyle}\n\nDecision Making: ${charter.personality.decisionMakingStyle}\n\nBackground:\n${charter.personality.background}`}
            defaultOpen={false}
          />
          <CollapsibleSection
            title='Expertise'
            content={charter.expertise.join('\n')}
            defaultOpen={false}
          />
          <CollapsibleSection
            title='Communication Preferences'
            content={`Tone: ${charter.communicationPreferences.tone}\nResponse Length: ${charter.communicationPreferences.responseLength}\nFormality: ${charter.communicationPreferences.formality}\nUse Emoji: ${charter.communicationPreferences.useEmoji}`}
            defaultOpen={false}
          />
          <CollapsibleSection
            title='Operational Settings'
            content={`Work Hours: ${charter.operationalSettings.workHours.start} - ${charter.operationalSettings.workHours.end} (${charter.operationalSettings.workHours.timezone})\nResponse Time Target: ${charter.operationalSettings.responseTimeTarget} minutes\nAuto Escalation: ${charter.operationalSettings.autoEscalation}\nEscalation Threshold: ${charter.operationalSettings.escalationThreshold} minutes`}
            defaultOpen={false}
          />
        </div>

        {/* Format Toggle and Code Preview */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold'>Export Format</h3>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleCopy}
                className='gap-2'
              >
                <Copy className='h-4 w-4' />
                Copy
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleDownload}
                className='gap-2'
              >
                <Download className='h-4 w-4' />
                Download
              </Button>
            </div>
          </div>

          <Tabs
            value={activeFormat}
            onValueChange={v => setActiveFormat(v as 'yaml' | 'json')}
          >
            <TabsList className='w-full'>
              <TabsTrigger value='yaml' className='flex-1'>
                YAML
              </TabsTrigger>
              <TabsTrigger value='json' className='flex-1'>
                JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value='yaml' className='mt-2'>
              <div className='rounded-lg border bg-muted/30 p-4 overflow-x-auto max-h-[500px] overflow-y-auto'>
                <pre className='text-xs font-mono leading-relaxed'>
                  <code>{highlightYAML(yamlContent)}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value='json' className='mt-2'>
              <div className='rounded-lg border bg-muted/30 p-4 overflow-x-auto max-h-[500px] overflow-y-auto'>
                <pre className='text-xs font-mono leading-relaxed'>
                  <code>{highlightJSON(jsonContent)}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
