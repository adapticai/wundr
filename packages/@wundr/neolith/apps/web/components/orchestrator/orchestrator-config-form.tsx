'use client';

import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  PERSONALITY_TRAITS,
  type PersonalityTrait,
  type UpdateOrchestratorInput,
  type Orchestrator,
  type OrchestratorCharter,
} from '@/types/orchestrator';

interface OrchestratorConfigFormProps {
  orchestrator: Orchestrator;
  onSave: (input: UpdateOrchestratorInput) => Promise<void>;
  onReset?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function OrchestratorConfigForm({
  orchestrator,
  onSave,
  onReset,
  isLoading = false,
  className,
}: OrchestratorConfigFormProps) {
  const [systemPrompt, setSystemPrompt] = useState(
    orchestrator.systemPrompt || '',
  );
  const [selectedTraits, setSelectedTraits] = useState<PersonalityTrait[]>(
    (orchestrator.charter?.personality?.traits as PersonalityTrait[]) || [],
  );
  const [expertise, setExpertise] = useState<string[]>([
    ...(orchestrator.charter?.expertise || []),
  ]);
  const [newExpertise, setNewExpertise] = useState('');
  const [communicationTone, setCommunicationTone] = useState<
    'formal' | 'casual' | 'professional' | 'friendly'
  >(orchestrator.charter?.communicationPreferences?.tone || 'professional');
  const [responseLength, setResponseLength] = useState<
    'concise' | 'detailed' | 'balanced'
  >(
    orchestrator.charter?.communicationPreferences?.responseLength || 'balanced',
  );
  const [useEmoji, setUseEmoji] = useState(
    orchestrator.charter?.communicationPreferences?.useEmoji || false,
  );
  const [isDirty, setIsDirty] = useState(false);

  const handleTraitToggle = useCallback((trait: PersonalityTrait) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait],
    );
    setIsDirty(true);
  }, []);

  const handleAddExpertise = useCallback(() => {
    if (newExpertise.trim() && !expertise.includes(newExpertise.trim())) {
      setExpertise(prev => [...prev, newExpertise.trim()]);
      setNewExpertise('');
      setIsDirty(true);
    }
  }, [newExpertise, expertise]);

  const handleRemoveExpertise = useCallback((item: string) => {
    setExpertise(prev => prev.filter(e => e !== item));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    const charter: Partial<OrchestratorCharter> = {
      ...orchestrator.charter,
      personality: {
        ...orchestrator.charter?.personality,
        traits: selectedTraits,
        communicationStyle:
          orchestrator.charter?.personality?.communicationStyle || '',
        decisionMakingStyle:
          orchestrator.charter?.personality?.decisionMakingStyle || '',
        background: orchestrator.charter?.personality?.background || '',
      },
      expertise,
      communicationPreferences: {
        tone: communicationTone as OrchestratorCharter['communicationPreferences']['tone'],
        responseLength:
          responseLength as OrchestratorCharter['communicationPreferences']['responseLength'],
        formality:
          orchestrator.charter?.communicationPreferences?.formality || 'medium',
        useEmoji,
      },
    };

    await onSave({
      systemPrompt,
      charter,
    });

    setIsDirty(false);
  }, [
    orchestrator.charter,
    systemPrompt,
    selectedTraits,
    expertise,
    communicationTone,
    responseLength,
    useEmoji,
    onSave,
  ]);

  const handleReset = useCallback(() => {
    setSystemPrompt(orchestrator.systemPrompt || '');
    setSelectedTraits(
      (orchestrator.charter?.personality?.traits as PersonalityTrait[]) || [],
    );
    setExpertise([...(orchestrator.charter?.expertise || [])]);
    setCommunicationTone(
      orchestrator.charter?.communicationPreferences?.tone || 'professional',
    );
    setResponseLength(
      orchestrator.charter?.communicationPreferences?.responseLength ||
        'balanced',
    );
    setUseEmoji(
      orchestrator.charter?.communicationPreferences?.useEmoji || false,
    );
    setIsDirty(false);
    onReset?.();
  }, [orchestrator, onReset]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* System Prompt */}
      <section>
        <label
          htmlFor='systemPrompt'
          className='mb-2 block text-sm font-medium text-foreground'
        >
          System Prompt
        </label>
        <textarea
          id='systemPrompt'
          value={systemPrompt}
          onChange={e => {
            setSystemPrompt(e.target.value);
            setIsDirty(true);
          }}
          placeholder='Enter the system prompt for this Orchestrator. You can use markdown formatting...'
          className='min-h-[200px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          disabled={isLoading}
        />
        <p className='mt-1 text-xs text-muted-foreground'>
          Supports markdown formatting. This prompt defines how the Orchestrator
          responds and behaves.
        </p>
      </section>

      {/* Personality Traits */}
      <section>
        <h3 className='mb-3 text-sm font-medium text-foreground'>
          Personality Traits
        </h3>
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
                  : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground',
              )}
            >
              {trait}
            </button>
          ))}
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>
          Select traits that define this Orchestrator&apos;s personality. These
          influence communication style.
        </p>
      </section>

      {/* Expertise Tags */}
      <section>
        <h3 className='mb-3 text-sm font-medium text-foreground'>
          Expertise Areas
        </h3>
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
            className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
          >
            Add
          </button>
        </div>
        {expertise.length > 0 && (
          <div className='mt-3 flex flex-wrap gap-2'>
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
                  <XIcon className='h-3 w-3' />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Communication Preferences */}
      <section>
        <h3 className='mb-3 text-sm font-medium text-foreground'>
          Communication Preferences
        </h3>
        <div className='grid gap-4 sm:grid-cols-2'>
          {/* Tone */}
          <div>
            <label
              htmlFor='tone'
              className='mb-1 block text-xs font-medium text-muted-foreground'
            >
              Tone
            </label>
            <select
              id='tone'
              value={communicationTone}
              onChange={e => {
                setCommunicationTone(
                  e.target.value as
                    | 'formal'
                    | 'casual'
                    | 'professional'
                    | 'friendly',
                );
                setIsDirty(true);
              }}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              disabled={isLoading}
            >
              <option value='formal'>Formal</option>
              <option value='professional'>Professional</option>
              <option value='casual'>Casual</option>
              <option value='friendly'>Friendly</option>
            </select>
          </div>

          {/* Response Length */}
          <div>
            <label
              htmlFor='responseLength'
              className='mb-1 block text-xs font-medium text-muted-foreground'
            >
              Response Length
            </label>
            <select
              id='responseLength'
              value={responseLength}
              onChange={e => {
                setResponseLength(
                  e.target.value as 'concise' | 'detailed' | 'balanced',
                );
                setIsDirty(true);
              }}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              disabled={isLoading}
            >
              <option value='concise'>Concise</option>
              <option value='balanced'>Balanced</option>
              <option value='detailed'>Detailed</option>
            </select>
          </div>
        </div>

        {/* Use Emoji */}
        <label className='mt-4 flex cursor-pointer items-center gap-3'>
          <input
            type='checkbox'
            checked={useEmoji}
            onChange={e => {
              setUseEmoji(e.target.checked);
              setIsDirty(true);
            }}
            disabled={isLoading}
            className='h-4 w-4 rounded border-input text-primary focus:ring-primary'
          />
          <span className='text-sm text-foreground'>
            Allow emoji in responses
          </span>
        </label>
      </section>

      {/* Action Buttons */}
      <div className='flex items-center justify-end gap-3 border-t pt-4'>
        <button
          type='button'
          onClick={handleReset}
          disabled={isLoading || !isDirty}
          className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50'
        >
          Reset
        </button>
        <button
          type='button'
          onClick={handleSave}
          disabled={isLoading || !isDirty}
          className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}
