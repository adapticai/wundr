'use client';

import { X, Check } from 'lucide-react';
import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  type CreateOrchestratorInput,
  ORCHESTRATOR_DISCIPLINES,
  type OrchestratorCharter,
  PERSONALITY_TRAITS,
  type PersonalityTrait,
} from '@/types/orchestrator';

interface CreateOrchestratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateOrchestratorInput) => Promise<void>;
  isLoading?: boolean;
}

// Alias for backward compatibility
export type CreateVPDialogProps = CreateOrchestratorDialogProps;

type Step = 'basic' | 'charter' | 'operational' | 'review';

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: 'basic', title: 'Basic Info', description: 'Name and discipline' },
  { id: 'charter', title: 'Charter', description: 'Personality and expertise' },
  {
    id: 'operational',
    title: 'Operations',
    description: 'Work hours and settings',
  },
  { id: 'review', title: 'Review', description: 'Confirm and create' },
];

export function CreateOrchestratorDialog({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CreateOrchestratorDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>('basic');

  // Basic info
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [description, setDescription] = useState('');

  // Charter
  const [selectedTraits, setSelectedTraits] = useState<PersonalityTrait[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [newExpertise, setNewExpertise] = useState('');
  const [communicationStyle, setCommunicationStyle] = useState('');
  const [background, setBackground] = useState('');

  // Operational
  const [workHoursStart, setWorkHoursStart] = useState('09:00');
  const [workHoursEnd, setWorkHoursEnd] = useState('17:00');
  const [timezone, setTimezone] = useState('UTC');
  const [responseTimeTarget, setResponseTimeTarget] = useState(30);

  const resetForm = useCallback(() => {
    setCurrentStep('basic');
    setTitle('');
    setDiscipline('');
    setDescription('');
    setSelectedTraits([]);
    setExpertise([]);
    setNewExpertise('');
    setCommunicationStyle('');
    setBackground('');
    setWorkHoursStart('09:00');
    setWorkHoursEnd('17:00');
    setTimezone('UTC');
    setResponseTimeTarget(30);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleTraitToggle = useCallback((trait: PersonalityTrait) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
    );
  }, []);

  const handleAddExpertise = useCallback(() => {
    if (newExpertise.trim() && !expertise.includes(newExpertise.trim())) {
      setExpertise(prev => [...prev, newExpertise.trim()]);
      setNewExpertise('');
    }
  }, [newExpertise, expertise]);

  const handleRemoveExpertise = useCallback((item: string) => {
    setExpertise(prev => prev.filter(e => e !== item));
  }, []);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 'basic':
        return title.trim().length > 0 && discipline.length > 0;
      case 'charter':
        return selectedTraits.length > 0;
      case 'operational':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, title, discipline, selectedTraits]);

  const handleNext = useCallback(() => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  }, [currentStep]);

  const handleCreate = useCallback(async () => {
    const charter: Partial<OrchestratorCharter> = {
      personality: {
        traits: selectedTraits,
        communicationStyle,
        decisionMakingStyle: '',
        background,
      },
      expertise,
      operationalSettings: {
        workHours: {
          start: workHoursStart,
          end: workHoursEnd,
          timezone,
        },
        responseTimeTarget,
        autoEscalation: false,
        escalationThreshold: 60,
      },
    };

    await onCreate({
      title,
      discipline,
      description: description || undefined,
      charter,
    });

    handleClose();
  }, [
    title,
    discipline,
    description,
    selectedTraits,
    communicationStyle,
    background,
    expertise,
    workHoursStart,
    workHoursEnd,
    timezone,
    responseTimeTarget,
    onCreate,
    handleClose,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={handleClose}
      role='dialog'
      aria-modal='true'
      aria-labelledby='create-orchestrator-title'
    >
      <div
        className='w-full max-w-2xl rounded-lg bg-card shadow-lg'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <h2
              id='create-orchestrator-title'
              className='text-lg font-semibold text-foreground'
            >
              Create New Orchestrator
            </h2>
            <button
              type='button'
              onClick={handleClose}
              className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
              aria-label='Close dialog'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          {/* Step Indicators */}
          <div className='mt-4 flex gap-2'>
            {STEPS.map((step, index) => {
              const currentIndex = STEPS.findIndex(s => s.id === currentStep);
              const isComplete = index < currentIndex;
              const isCurrent = step.id === currentStep;

              return (
                <div
                  key={step.id}
                  className='flex flex-1 flex-col items-center'
                >
                  <div className='mb-1 flex w-full items-center'>
                    <div
                      className={cn(
                        'h-0.5 flex-1',
                        index === 0 ? 'invisible' : '',
                        isComplete || isCurrent ? 'bg-primary' : 'bg-border'
                      )}
                    />
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                        isComplete
                          ? 'bg-primary text-primary-foreground'
                          : isCurrent
                            ? 'border-2 border-primary bg-background text-primary'
                            : 'border border-border bg-background text-muted-foreground'
                      )}
                    >
                      {isComplete ? <Check className='h-4 w-4' /> : index + 1}
                    </div>
                    <div
                      className={cn(
                        'h-0.5 flex-1',
                        index === STEPS.length - 1 ? 'invisible' : '',
                        isComplete ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      isCurrent
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className='max-h-[60vh] overflow-y-auto px-6 py-6'>
          {/* Step 1: Basic Info */}
          {currentStep === 'basic' && (
            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='orchestrator-title'
                  className='mb-1 block text-sm font-medium text-foreground'
                >
                  OrchestratorName <span className='text-red-500'>*</span>
                </label>
                <input
                  id='orchestrator-title'
                  type='text'
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder='e.g., Orchestrator of Engineering'
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor='orchestrator-discipline'
                  className='mb-1 block text-sm font-medium text-foreground'
                >
                  Discipline <span className='text-red-500'>*</span>
                </label>
                <select
                  id='orchestrator-discipline'
                  value={discipline}
                  onChange={e => setDiscipline(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={isLoading}
                >
                  <option value=''>Select discipline...</option>
                  {ORCHESTRATOR_DISCIPLINES.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor='orchestrator-description'
                  className='mb-1 block text-sm font-medium text-foreground'
                >
                  Description
                </label>
                <textarea
                  id='orchestrator-description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of this Orchestrator's purpose and responsibilities..."
                  rows={3}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Step 2: Charter Configuration */}
          {currentStep === 'charter' && (
            <div className='space-y-6'>
              <div>
                <label className='mb-2 block text-sm font-medium text-foreground'>
                  Personality Traits <span className='text-red-500'>*</span>
                </label>
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
                <p className='mt-1 text-xs text-muted-foreground'>
                  Select at least one trait that defines this
                  Orchestrator&apos;s personality.
                </p>
              </div>

              <div>
                <label className='mb-2 block text-sm font-medium text-foreground'>
                  Expertise Areas
                </label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={newExpertise}
                    onChange={e => setNewExpertise(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExpertise();
                      }
                    }}
                    placeholder='Add expertise area...'
                    className='flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    disabled={isLoading}
                  />
                  <button
                    type='button'
                    onClick={handleAddExpertise}
                    disabled={isLoading || !newExpertise.trim()}
                    className='rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50'
                  >
                    Add
                  </button>
                </div>
                {expertise.length > 0 && (
                  <div className='mt-2 flex flex-wrap gap-2'>
                    {expertise.map(item => (
                      <span
                        key={item}
                        className='inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground'
                      >
                        {item}
                        <button
                          type='button'
                          onClick={() => handleRemoveExpertise(item)}
                          disabled={isLoading}
                          className='ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/10'
                          aria-label={`Remove ${item}`}
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor='communication-style'
                  className='mb-1 block text-sm font-medium text-foreground'
                >
                  Communication Style
                </label>
                <textarea
                  id='communication-style'
                  value={communicationStyle}
                  onChange={e => setCommunicationStyle(e.target.value)}
                  placeholder='Describe how this Orchestrator should communicate...'
                  rows={2}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor='background'
                  className='mb-1 block text-sm font-medium text-foreground'
                >
                  Background
                </label>
                <textarea
                  id='background'
                  value={background}
                  onChange={e => setBackground(e.target.value)}
                  placeholder='Professional background and experience...'
                  rows={2}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Step 3: Operational Settings */}
          {currentStep === 'operational' && (
            <div className='space-y-6'>
              <div>
                <h3 className='mb-3 text-sm font-medium text-foreground'>
                  Work Hours
                </h3>
                <div className='grid gap-4 sm:grid-cols-3'>
                  <div>
                    <label
                      htmlFor='work-start'
                      className='mb-1 block text-xs font-medium text-muted-foreground'
                    >
                      Start Time
                    </label>
                    <input
                      id='work-start'
                      type='time'
                      value={workHoursStart}
                      onChange={e => setWorkHoursStart(e.target.value)}
                      className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor='work-end'
                      className='mb-1 block text-xs font-medium text-muted-foreground'
                    >
                      End Time
                    </label>
                    <input
                      id='work-end'
                      type='time'
                      value={workHoursEnd}
                      onChange={e => setWorkHoursEnd(e.target.value)}
                      className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor='timezone'
                      className='mb-1 block text-xs font-medium text-muted-foreground'
                    >
                      Timezone
                    </label>
                    <select
                      id='timezone'
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                      disabled={isLoading}
                    >
                      <option value='UTC'>UTC</option>
                      <option value='America/New_York'>Eastern Time</option>
                      <option value='America/Chicago'>Central Time</option>
                      <option value='America/Denver'>Mountain Time</option>
                      <option value='America/Los_Angeles'>Pacific Time</option>
                      <option value='Europe/London'>London</option>
                      <option value='Europe/Paris'>Paris</option>
                      <option value='Asia/Tokyo'>Tokyo</option>
                      <option value='Asia/Shanghai'>Shanghai</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor='response-time'
                  className='mb-1 block text-sm font-medium text-foreground'
                >
                  Target Response Time (minutes)
                </label>
                <input
                  id='response-time'
                  type='number'
                  min={1}
                  max={1440}
                  value={responseTimeTarget}
                  onChange={e =>
                    setResponseTimeTarget(parseInt(e.target.value, 10) || 30)
                  }
                  className='w-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={isLoading}
                />
                <p className='mt-1 text-xs text-muted-foreground'>
                  The expected time for this Orchestrator to respond to
                  messages.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className='space-y-6'>
              <h3 className='text-sm font-medium text-foreground'>
                Review Your OrchestratorConfiguration
              </h3>

              <div className='space-y-4 rounded-lg border bg-background p-4'>
                <div>
                  <span className='text-xs font-medium text-muted-foreground'>
                    Name
                  </span>
                  <p className='text-sm font-medium text-foreground'>{title}</p>
                </div>

                <div>
                  <span className='text-xs font-medium text-muted-foreground'>
                    Discipline
                  </span>
                  <p className='text-sm text-foreground'>{discipline}</p>
                </div>

                {description && (
                  <div>
                    <span className='text-xs font-medium text-muted-foreground'>
                      Description
                    </span>
                    <p className='text-sm text-foreground'>{description}</p>
                  </div>
                )}

                <div>
                  <span className='text-xs font-medium text-muted-foreground'>
                    Personality Traits
                  </span>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {selectedTraits.map(trait => (
                      <span
                        key={trait}
                        className='rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground'
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                {expertise.length > 0 && (
                  <div>
                    <span className='text-xs font-medium text-muted-foreground'>
                      Expertise
                    </span>
                    <p className='text-sm text-foreground'>
                      {expertise.join(', ')}
                    </p>
                  </div>
                )}

                <div>
                  <span className='text-xs font-medium text-muted-foreground'>
                    Work Hours
                  </span>
                  <p className='text-sm text-foreground'>
                    {workHoursStart} - {workHoursEnd} ({timezone})
                  </p>
                </div>

                <div>
                  <span className='text-xs font-medium text-muted-foreground'>
                    Response Target
                  </span>
                  <p className='text-sm text-foreground'>
                    {responseTimeTarget} minutes
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex items-center justify-between border-t px-6 py-4'>
          <button
            type='button'
            onClick={handleBack}
            disabled={currentStep === 'basic' || isLoading}
            className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:invisible'
          >
            Back
          </button>

          <div className='flex gap-2'>
            <button
              type='button'
              onClick={handleClose}
              disabled={isLoading}
              className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
            >
              Cancel
            </button>

            {currentStep === 'review' ? (
              <button
                type='button'
                onClick={handleCreate}
                disabled={isLoading}
                className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
              >
                {isLoading ? 'Creating...' : 'Create Orchestrator'}
              </button>
            ) : (
              <button
                type='button'
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
                className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
