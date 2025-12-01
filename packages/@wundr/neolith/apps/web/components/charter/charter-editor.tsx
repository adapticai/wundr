'use client';

import * as React from 'react';
import { Save, X, AlertCircle, Loader2, Lightbulb } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  type OrchestratorCharter,
  type PersonalityTrait,
  type CommunicationTone,
  type ResponseLength,
  type FormalityLevel,
  PERSONALITY_TRAITS,
} from '@/types/orchestrator';

/**
 * Props for CharterEditor component
 */
export interface CharterEditorProps {
  /** ID of the orchestrator being edited */
  orchestratorId: string;
  /** Optional initial charter data for editing */
  initialCharter?: Partial<OrchestratorCharter>;
  /** Callback when charter is saved */
  onSave: (charter: OrchestratorCharter) => Promise<void>;
  /** Callback when editing is cancelled */
  onCancel: () => void;
  /** Optional loading state override */
  isLoading?: boolean;
  /** Optional className for styling */
  className?: string;
}

/**
 * Validation errors type
 */
interface ValidationErrors {
  mission?: string;
  vision?: string;
  values?: string;
  personality?: string;
  expertise?: string;
  communicationPreferences?: string;
  operationalSettings?: string;
}

/**
 * CharterEditor - Main charter editing component
 *
 * Provides a tabbed interface for editing all aspects of an orchestrator's charter:
 * - Mission & Vision
 * - Values & Personality
 * - Expertise
 * - Communication Preferences
 * - Operational Settings
 *
 * Features:
 * - Auto-save drafts to localStorage
 * - Real-time validation
 * - Tab-based organization
 * - Loading states
 * - Error feedback
 */
export function CharterEditor({
  orchestratorId,
  initialCharter,
  onSave,
  onCancel,
  isLoading: externalLoading = false,
  className,
}: CharterEditorProps) {
  const [activeTab, setActiveTab] = React.useState('mission');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<ValidationErrors>({});
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  // Mission & Vision
  const [mission, setMission] = React.useState(initialCharter?.mission || '');
  const [vision, setVision] = React.useState(initialCharter?.vision || '');

  // Values
  const [values, setValues] = React.useState<string[]>(
    initialCharter?.values ? [...initialCharter.values] : []
  );
  const [newValue, setNewValue] = React.useState('');

  // Personality
  const [selectedTraits, setSelectedTraits] = React.useState<
    PersonalityTrait[]
  >(
    initialCharter?.personality?.traits
      ? [...(initialCharter.personality.traits as PersonalityTrait[])]
      : []
  );
  const [communicationStyle, setCommunicationStyle] = React.useState(
    initialCharter?.personality?.communicationStyle || ''
  );
  const [decisionMakingStyle, setDecisionMakingStyle] = React.useState(
    initialCharter?.personality?.decisionMakingStyle || ''
  );
  const [background, setBackground] = React.useState(
    initialCharter?.personality?.background || ''
  );

  // Expertise
  const [expertise, setExpertise] = React.useState<string[]>(
    initialCharter?.expertise ? [...initialCharter.expertise] : []
  );
  const [newExpertise, setNewExpertise] = React.useState('');

  // Communication Preferences
  const [tone, setTone] = React.useState<CommunicationTone>(
    initialCharter?.communicationPreferences?.tone || 'professional'
  );
  const [responseLength, setResponseLength] = React.useState<ResponseLength>(
    initialCharter?.communicationPreferences?.responseLength || 'balanced'
  );
  const [formality, setFormality] = React.useState<FormalityLevel>(
    initialCharter?.communicationPreferences?.formality || 'medium'
  );
  const [useEmoji, setUseEmoji] = React.useState(
    initialCharter?.communicationPreferences?.useEmoji || false
  );

  // Operational Settings
  const [workHoursStart, setWorkHoursStart] = React.useState(
    initialCharter?.operationalSettings?.workHours?.start || '09:00'
  );
  const [workHoursEnd, setWorkHoursEnd] = React.useState(
    initialCharter?.operationalSettings?.workHours?.end || '17:00'
  );
  const [timezone, setTimezone] = React.useState(
    initialCharter?.operationalSettings?.workHours?.timezone ||
      'America/New_York'
  );
  const [responseTimeTarget, setResponseTimeTarget] = React.useState(
    initialCharter?.operationalSettings?.responseTimeTarget || 30
  );
  const [autoEscalation, setAutoEscalation] = React.useState(
    initialCharter?.operationalSettings?.autoEscalation || false
  );
  const [escalationThreshold, setEscalationThreshold] = React.useState(
    initialCharter?.operationalSettings?.escalationThreshold || 60
  );

  const isLoading = externalLoading || isSaving;

  // Auto-save draft to localStorage
  React.useEffect(() => {
    if (!isDirty) return;

    const draft = {
      mission,
      vision,
      values,
      personality: {
        traits: selectedTraits,
        communicationStyle,
        decisionMakingStyle,
        background,
      },
      expertise,
      communicationPreferences: {
        tone,
        responseLength,
        formality,
        useEmoji,
      },
      operationalSettings: {
        workHours: {
          start: workHoursStart,
          end: workHoursEnd,
          timezone,
        },
        responseTimeTarget,
        autoEscalation,
        escalationThreshold,
      },
    };

    localStorage.setItem(
      `charter-draft-${orchestratorId}`,
      JSON.stringify(draft)
    );
    setLastSaved(new Date());
  }, [
    orchestratorId,
    isDirty,
    mission,
    vision,
    values,
    selectedTraits,
    communicationStyle,
    decisionMakingStyle,
    background,
    expertise,
    tone,
    responseLength,
    formality,
    useEmoji,
    workHoursStart,
    workHoursEnd,
    timezone,
    responseTimeTarget,
    autoEscalation,
    escalationThreshold,
  ]);

  // Load draft from localStorage on mount
  React.useEffect(() => {
    const savedDraft = localStorage.getItem(`charter-draft-${orchestratorId}`);
    if (savedDraft && !initialCharter) {
      try {
        const draft = JSON.parse(savedDraft);
        setMission(draft.mission || '');
        setVision(draft.vision || '');
        setValues(draft.values || []);
        setSelectedTraits(draft.personality?.traits || []);
        setCommunicationStyle(draft.personality?.communicationStyle || '');
        setDecisionMakingStyle(draft.personality?.decisionMakingStyle || '');
        setBackground(draft.personality?.background || '');
        setExpertise(draft.expertise || []);
        setTone(draft.communicationPreferences?.tone || 'professional');
        setResponseLength(
          draft.communicationPreferences?.responseLength || 'balanced'
        );
        setFormality(draft.communicationPreferences?.formality || 'medium');
        setUseEmoji(draft.communicationPreferences?.useEmoji || false);
        setWorkHoursStart(
          draft.operationalSettings?.workHours?.start || '09:00'
        );
        setWorkHoursEnd(draft.operationalSettings?.workHours?.end || '17:00');
        setTimezone(
          draft.operationalSettings?.workHours?.timezone || 'America/New_York'
        );
        setResponseTimeTarget(
          draft.operationalSettings?.responseTimeTarget || 30
        );
        setAutoEscalation(draft.operationalSettings?.autoEscalation || false);
        setEscalationThreshold(
          draft.operationalSettings?.escalationThreshold || 60
        );
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [orchestratorId, initialCharter]);

  /**
   * Handle adding a new value
   */
  const handleAddValue = React.useCallback(() => {
    if (newValue.trim() && !values.includes(newValue.trim())) {
      setValues(prev => [...prev, newValue.trim()]);
      setNewValue('');
      setIsDirty(true);
    }
  }, [newValue, values]);

  /**
   * Handle removing a value
   */
  const handleRemoveValue = React.useCallback((value: string) => {
    setValues(prev => prev.filter(v => v !== value));
    setIsDirty(true);
  }, []);

  /**
   * Handle toggling a personality trait
   */
  const handleTraitToggle = React.useCallback((trait: PersonalityTrait) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
    );
    setIsDirty(true);
  }, []);

  /**
   * Handle adding expertise
   */
  const handleAddExpertise = React.useCallback(() => {
    if (newExpertise.trim() && !expertise.includes(newExpertise.trim())) {
      setExpertise(prev => [...prev, newExpertise.trim()]);
      setNewExpertise('');
      setIsDirty(true);
    }
  }, [newExpertise, expertise]);

  /**
   * Handle removing expertise
   */
  const handleRemoveExpertise = React.useCallback((item: string) => {
    setExpertise(prev => prev.filter(e => e !== item));
    setIsDirty(true);
  }, []);

  /**
   * Validate charter data
   */
  const validateCharter = React.useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!mission.trim()) {
      newErrors.mission = 'Mission statement is required';
    }

    if (!vision.trim()) {
      newErrors.vision = 'Vision statement is required';
    }

    if (values.length === 0) {
      newErrors.values = 'At least one core value is required';
    }

    if (selectedTraits.length === 0) {
      newErrors.personality = 'At least one personality trait is required';
    }

    if (!communicationStyle.trim()) {
      newErrors.personality = 'Communication style is required';
    }

    if (!decisionMakingStyle.trim()) {
      newErrors.personality = newErrors.personality
        ? `${newErrors.personality}; Decision making style is required`
        : 'Decision making style is required';
    }

    if (expertise.length === 0) {
      newErrors.expertise = 'At least one area of expertise is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    mission,
    vision,
    values,
    selectedTraits,
    communicationStyle,
    decisionMakingStyle,
    expertise,
  ]);

  /**
   * Handle save
   */
  const handleSave = React.useCallback(async () => {
    if (!validateCharter()) {
      return;
    }

    setIsSaving(true);

    const charter: OrchestratorCharter = {
      mission,
      vision,
      values,
      personality: {
        traits: selectedTraits,
        communicationStyle,
        decisionMakingStyle,
        background,
      },
      expertise,
      communicationPreferences: {
        tone,
        responseLength,
        formality,
        useEmoji,
      },
      operationalSettings: {
        workHours: {
          start: workHoursStart,
          end: workHoursEnd,
          timezone,
        },
        responseTimeTarget,
        autoEscalation,
        escalationThreshold,
      },
    };

    try {
      await onSave(charter);
      // Clear draft from localStorage on successful save
      localStorage.removeItem(`charter-draft-${orchestratorId}`);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save charter:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    validateCharter,
    orchestratorId,
    mission,
    vision,
    values,
    selectedTraits,
    communicationStyle,
    decisionMakingStyle,
    background,
    expertise,
    tone,
    responseLength,
    formality,
    useEmoji,
    workHoursStart,
    workHoursEnd,
    timezone,
    responseTimeTarget,
    autoEscalation,
    escalationThreshold,
    onSave,
  ]);

  /**
   * Handle cancel
   */
  const handleCancel = React.useCallback(() => {
    if (isDirty) {
      const confirmCancel = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmCancel) return;
    }
    onCancel();
  }, [isDirty, onCancel]);

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CardHeader className='border-b'>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle>Charter Editor</CardTitle>
            <CardDescription>
              Define the mission, values, and operational parameters for this
              orchestrator
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            {lastSaved && (
              <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                <Save className='h-3 w-3' />
                <span>Draft saved {lastSaved.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='flex flex-1 flex-col overflow-hidden'
      >
        <div className='border-b px-6'>
          <TabsList className='h-12'>
            <TabsTrigger value='mission'>Mission & Vision</TabsTrigger>
            <TabsTrigger value='values'>Values & Personality</TabsTrigger>
            <TabsTrigger value='expertise'>Expertise</TabsTrigger>
            <TabsTrigger value='communication'>Communication</TabsTrigger>
            <TabsTrigger value='operations'>Operations</TabsTrigger>
          </TabsList>
        </div>

        <CardContent className='flex-1 overflow-y-auto p-6'>
          {/* Mission & Vision Tab */}
          <TabsContent value='mission' className='m-0 space-y-6'>
            <div className='space-y-4'>
              <Alert>
                <Lightbulb className='h-4 w-4' />
                <AlertDescription>
                  Define the core purpose and long-term aspirations of this
                  orchestrator.
                </AlertDescription>
              </Alert>

              <div className='space-y-2'>
                <Label htmlFor='mission' className='required'>
                  Mission Statement
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <Textarea
                  id='mission'
                  value={mission}
                  onChange={e => {
                    setMission(e.target.value);
                    setIsDirty(true);
                    if (errors.mission) {
                      setErrors(prev => ({ ...prev, mission: undefined }));
                    }
                  }}
                  placeholder='What is the primary purpose of this orchestrator?'
                  className={cn(errors.mission && 'border-destructive')}
                  rows={4}
                  disabled={isLoading}
                />
                {errors.mission && (
                  <p className='flex items-center gap-1 text-xs text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.mission}
                  </p>
                )}
                <p className='text-xs text-muted-foreground'>
                  A clear statement of what this orchestrator aims to accomplish
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='vision' className='required'>
                  Vision Statement
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <Textarea
                  id='vision'
                  value={vision}
                  onChange={e => {
                    setVision(e.target.value);
                    setIsDirty(true);
                    if (errors.vision) {
                      setErrors(prev => ({ ...prev, vision: undefined }));
                    }
                  }}
                  placeholder='What is the long-term vision for this orchestrator?'
                  className={cn(errors.vision && 'border-destructive')}
                  rows={4}
                  disabled={isLoading}
                />
                {errors.vision && (
                  <p className='flex items-center gap-1 text-xs text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.vision}
                  </p>
                )}
                <p className='text-xs text-muted-foreground'>
                  The aspirational future state this orchestrator works towards
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Values & Personality Tab */}
          <TabsContent value='values' className='m-0 space-y-6'>
            <div className='space-y-4'>
              <Alert>
                <Lightbulb className='h-4 w-4' />
                <AlertDescription>
                  Define the core values and personality traits that guide this
                  orchestrator's behavior.
                </AlertDescription>
              </Alert>

              {/* Core Values */}
              <div className='space-y-2'>
                <Label htmlFor='newValue' className='required'>
                  Core Values
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <div className='flex gap-2'>
                  <Input
                    id='newValue'
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddValue();
                      }
                    }}
                    placeholder='Add a core value...'
                    disabled={isLoading}
                  />
                  <Button
                    type='button'
                    onClick={handleAddValue}
                    disabled={isLoading || !newValue.trim()}
                  >
                    Add
                  </Button>
                </div>
                {errors.values && (
                  <p className='flex items-center gap-1 text-xs text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.values}
                  </p>
                )}
                {values.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {values.map(value => (
                      <span
                        key={value}
                        className='inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm'
                      >
                        {value}
                        <button
                          type='button'
                          onClick={() => handleRemoveValue(value)}
                          disabled={isLoading}
                          className='ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/10'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Personality Traits */}
              <div className='space-y-2'>
                <Label className='required'>
                  Personality Traits
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <div className='flex flex-wrap gap-2'>
                  {PERSONALITY_TRAITS.map(trait => (
                    <button
                      key={trait}
                      type='button'
                      onClick={() => handleTraitToggle(trait)}
                      disabled={isLoading}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        selectedTraits.includes(trait)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground'
                      )}
                    >
                      {trait}
                    </button>
                  ))}
                </div>
                {errors.personality && (
                  <p className='flex items-center gap-1 text-xs text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.personality}
                  </p>
                )}
              </div>

              {/* Communication Style */}
              <div className='space-y-2'>
                <Label htmlFor='communicationStyle' className='required'>
                  Communication Style
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <Input
                  id='communicationStyle'
                  value={communicationStyle}
                  onChange={e => {
                    setCommunicationStyle(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder='e.g., Direct and concise, Collaborative and inclusive'
                  disabled={isLoading}
                />
                <p className='text-xs text-muted-foreground'>
                  How this orchestrator prefers to communicate
                </p>
              </div>

              {/* Decision Making Style */}
              <div className='space-y-2'>
                <Label htmlFor='decisionMakingStyle' className='required'>
                  Decision Making Style
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <Input
                  id='decisionMakingStyle'
                  value={decisionMakingStyle}
                  onChange={e => {
                    setDecisionMakingStyle(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder='e.g., Data-driven, Consensus-based, Intuitive'
                  disabled={isLoading}
                />
                <p className='text-xs text-muted-foreground'>
                  How this orchestrator approaches decision making
                </p>
              </div>

              {/* Background */}
              <div className='space-y-2'>
                <Label htmlFor='background'>Background Context</Label>
                <Textarea
                  id='background'
                  value={background}
                  onChange={e => {
                    setBackground(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder='Provide any relevant background or context...'
                  rows={3}
                  disabled={isLoading}
                />
                <p className='text-xs text-muted-foreground'>
                  Optional contextual information
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Expertise Tab */}
          <TabsContent value='expertise' className='m-0 space-y-6'>
            <div className='space-y-4'>
              <Alert>
                <Lightbulb className='h-4 w-4' />
                <AlertDescription>
                  Define the areas of expertise and specialization for this
                  orchestrator.
                </AlertDescription>
              </Alert>

              <div className='space-y-2'>
                <Label htmlFor='newExpertise' className='required'>
                  Areas of Expertise
                  <span className='ml-1 text-destructive'>*</span>
                </Label>
                <div className='flex gap-2'>
                  <Input
                    id='newExpertise'
                    value={newExpertise}
                    onChange={e => setNewExpertise(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExpertise();
                      }
                    }}
                    placeholder='Add an area of expertise...'
                    disabled={isLoading}
                  />
                  <Button
                    type='button'
                    onClick={handleAddExpertise}
                    disabled={isLoading || !newExpertise.trim()}
                  >
                    Add
                  </Button>
                </div>
                {errors.expertise && (
                  <p className='flex items-center gap-1 text-xs text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.expertise}
                  </p>
                )}
                {expertise.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {expertise.map(item => (
                      <span
                        key={item}
                        className='inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm'
                      >
                        {item}
                        <button
                          type='button'
                          onClick={() => handleRemoveExpertise(item)}
                          disabled={isLoading}
                          className='ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/10'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className='text-xs text-muted-foreground'>
                  Technical skills, domain knowledge, and specialized
                  capabilities
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Communication Preferences Tab */}
          <TabsContent value='communication' className='m-0 space-y-6'>
            <div className='space-y-4'>
              <Alert>
                <Lightbulb className='h-4 w-4' />
                <AlertDescription>
                  Configure how this orchestrator communicates with users and
                  other systems.
                </AlertDescription>
              </Alert>

              <div className='grid gap-4 sm:grid-cols-2'>
                {/* Tone */}
                <div className='space-y-2'>
                  <Label htmlFor='tone'>Communication Tone</Label>
                  <select
                    id='tone'
                    value={tone}
                    onChange={e => {
                      setTone(e.target.value as CommunicationTone);
                      setIsDirty(true);
                    }}
                    className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                    disabled={isLoading}
                  >
                    <option value='formal'>Formal</option>
                    <option value='professional'>Professional</option>
                    <option value='casual'>Casual</option>
                    <option value='friendly'>Friendly</option>
                  </select>
                </div>

                {/* Response Length */}
                <div className='space-y-2'>
                  <Label htmlFor='responseLength'>Response Length</Label>
                  <select
                    id='responseLength'
                    value={responseLength}
                    onChange={e => {
                      setResponseLength(e.target.value as ResponseLength);
                      setIsDirty(true);
                    }}
                    className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                    disabled={isLoading}
                  >
                    <option value='concise'>Concise</option>
                    <option value='balanced'>Balanced</option>
                    <option value='detailed'>Detailed</option>
                  </select>
                </div>

                {/* Formality */}
                <div className='space-y-2'>
                  <Label htmlFor='formality'>Formality Level</Label>
                  <select
                    id='formality'
                    value={formality}
                    onChange={e => {
                      setFormality(e.target.value as FormalityLevel);
                      setIsDirty(true);
                    }}
                    className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                    disabled={isLoading}
                  >
                    <option value='high'>High</option>
                    <option value='medium'>Medium</option>
                    <option value='low'>Low</option>
                  </select>
                </div>
              </div>

              {/* Use Emoji */}
              <label className='flex cursor-pointer items-center gap-3'>
                <input
                  type='checkbox'
                  checked={useEmoji}
                  onChange={e => {
                    setUseEmoji(e.target.checked);
                    setIsDirty(true);
                  }}
                  disabled={isLoading}
                  className='h-4 w-4 rounded border-input text-primary'
                />
                <span className='text-sm'>Allow emoji in responses</span>
              </label>
            </div>
          </TabsContent>

          {/* Operational Settings Tab */}
          <TabsContent value='operations' className='m-0 space-y-6'>
            <div className='space-y-4'>
              <Alert>
                <Lightbulb className='h-4 w-4' />
                <AlertDescription>
                  Configure operational parameters and escalation rules for this
                  orchestrator.
                </AlertDescription>
              </Alert>

              {/* Work Hours */}
              <div className='space-y-3'>
                <Label>Work Hours</Label>
                <div className='grid gap-4 sm:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='workHoursStart' className='text-xs'>
                      Start Time
                    </Label>
                    <Input
                      id='workHoursStart'
                      type='time'
                      value={workHoursStart}
                      onChange={e => {
                        setWorkHoursStart(e.target.value);
                        setIsDirty(true);
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='workHoursEnd' className='text-xs'>
                      End Time
                    </Label>
                    <Input
                      id='workHoursEnd'
                      type='time'
                      value={workHoursEnd}
                      onChange={e => {
                        setWorkHoursEnd(e.target.value);
                        setIsDirty(true);
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='timezone' className='text-xs'>
                      Timezone
                    </Label>
                    <Input
                      id='timezone'
                      value={timezone}
                      onChange={e => {
                        setTimezone(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder='America/New_York'
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Response Time Target */}
              <div className='space-y-2'>
                <Label htmlFor='responseTimeTarget'>
                  Response Time Target (minutes)
                </Label>
                <Input
                  id='responseTimeTarget'
                  type='number'
                  min='1'
                  value={responseTimeTarget}
                  onChange={e => {
                    setResponseTimeTarget(parseInt(e.target.value) || 30);
                    setIsDirty(true);
                  }}
                  disabled={isLoading}
                />
                <p className='text-xs text-muted-foreground'>
                  Target time to respond to requests
                </p>
              </div>

              {/* Auto Escalation */}
              <label className='flex cursor-pointer items-center gap-3'>
                <input
                  type='checkbox'
                  checked={autoEscalation}
                  onChange={e => {
                    setAutoEscalation(e.target.checked);
                    setIsDirty(true);
                  }}
                  disabled={isLoading}
                  className='h-4 w-4 rounded border-input text-primary'
                />
                <span className='text-sm'>Enable automatic escalation</span>
              </label>

              {/* Escalation Threshold */}
              {autoEscalation && (
                <div className='space-y-2'>
                  <Label htmlFor='escalationThreshold'>
                    Escalation Threshold (minutes)
                  </Label>
                  <Input
                    id='escalationThreshold'
                    type='number'
                    min='1'
                    value={escalationThreshold}
                    onChange={e => {
                      setEscalationThreshold(parseInt(e.target.value) || 60);
                      setIsDirty(true);
                    }}
                    disabled={isLoading}
                  />
                  <p className='text-xs text-muted-foreground'>
                    Time before auto-escalating unresolved issues
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </CardContent>

        {/* Footer Actions */}
        <div className='border-t px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='text-sm text-muted-foreground'>
              {Object.keys(errors).length > 0 && (
                <span className='flex items-center gap-1 text-destructive'>
                  <AlertCircle className='h-4 w-4' />
                  Please fix validation errors before saving
                </span>
              )}
            </div>
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type='button'
                onClick={handleSave}
                disabled={isLoading || !isDirty}
              >
                {isSaving ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Save Charter
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Tabs>
    </Card>
  );
}
