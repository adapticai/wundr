'use client';

import { useState, type KeyboardEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface CharterStepData {
  mission?: string;
  vision?: string;
  values?: string[];
  principles?: string[];
  governanceStyle?: string;
  communicationStyle?: string;
}

interface CharterStepProps {
  data: CharterStepData;
  onChange: (data: CharterStepData) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ValidationErrors {
  mission?: string;
  values?: string;
}

export function CharterStep({
  data,
  onChange,
  onNext,
  onBack,
}: CharterStepProps) {
  const [valueInput, setValueInput] = useState('');
  const [principleInput, setPrincipleInput] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  const values = data.values ?? [];
  const principles = data.principles ?? [];

  const handleMissionChange = (mission: string) => {
    onChange({ ...data, mission });
    if (errors.mission) {
      setErrors(prev => ({ ...prev, mission: undefined }));
    }
  };

  const handleAddTag = (
    input: string,
    field: 'values' | 'principles',
    setInput: (v: string) => void
  ) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const current = data[field] ?? [];
    if (current.includes(trimmed)) {
      setInput('');
      return;
    }
    onChange({ ...data, [field]: [...current, trimmed] });
    setInput('');
    if (field === 'values' && errors.values) {
      setErrors(prev => ({ ...prev, values: undefined }));
    }
  };

  const handleRemoveTag = (tag: string, field: 'values' | 'principles') => {
    const current = data[field] ?? [];
    onChange({ ...data, [field]: current.filter(t => t !== tag) });
  };

  const handleTagKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    input: string,
    field: 'values' | 'principles',
    setInput: (v: string) => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(input, field, setInput);
    }
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!data.mission || data.mission.trim().length < 10) {
      newErrors.mission =
        'Mission statement must be at least 10 characters long.';
    } else if (data.mission.trim().length > 2000) {
      newErrors.mission =
        'Mission statement must be no more than 2000 characters.';
    }

    if (values.length === 0) {
      newErrors.values = 'Please add at least one core value.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      onNext();
    }
  };

  const missionLength = data.mission?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Define Your Charter</CardTitle>
        <CardDescription>
          Establish the guiding principles and identity of your organization
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Mission Statement */}
        <div className='space-y-2'>
          <Label htmlFor='mission'>
            Mission Statement{' '}
            <span className='text-destructive' aria-hidden='true'>
              *
            </span>
          </Label>
          <p className='text-sm text-muted-foreground'>
            A concise statement of your organization&apos;s core purpose and
            reason for existing
          </p>
          <Textarea
            id='mission'
            placeholder="Define your organization's core purpose..."
            rows={4}
            value={data.mission ?? ''}
            onChange={e => handleMissionChange(e.target.value)}
            aria-describedby='mission-count mission-error'
            className={errors.mission ? 'border-destructive' : ''}
          />
          <div className='flex items-center justify-between'>
            <p
              id='mission-error'
              className='text-sm text-destructive'
              role='alert'
              aria-live='polite'
            >
              {errors.mission ?? ''}
            </p>
            <p
              id='mission-count'
              className={`text-xs ${missionLength > 2000 ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {missionLength} / 2000
            </p>
          </div>
        </div>

        {/* Vision */}
        <div className='space-y-2'>
          <Label htmlFor='vision'>Vision</Label>
          <p className='text-sm text-muted-foreground'>
            Optional — describe what success looks like for your organization
          </p>
          <Textarea
            id='vision'
            placeholder='What does success look like?'
            rows={3}
            value={data.vision ?? ''}
            onChange={e => onChange({ ...data, vision: e.target.value })}
          />
        </div>

        {/* Core Values */}
        <div className='space-y-2'>
          <Label>
            Core Values{' '}
            <span className='text-destructive' aria-hidden='true'>
              *
            </span>
          </Label>
          <p className='text-sm text-muted-foreground'>
            The fundamental beliefs that guide your organization&apos;s
            behaviour and decisions. Type a value and press Enter to add it.
          </p>
          <div className='flex gap-2'>
            <Input
              placeholder='e.g., Integrity, Innovation, Accountability'
              value={valueInput}
              onChange={e => setValueInput(e.target.value)}
              onKeyDown={e =>
                handleTagKeyDown(e, valueInput, 'values', setValueInput)
              }
              aria-label='Add core value'
            />
            <Button
              type='button'
              variant='outline'
              onClick={() => handleAddTag(valueInput, 'values', setValueInput)}
            >
              Add
            </Button>
          </div>

          {values.length > 0 && (
            <div className='flex flex-wrap gap-2 pt-1'>
              {values.map(value => (
                <Badge key={value} variant='secondary' className='gap-1'>
                  {value}
                  <button
                    type='button'
                    onClick={() => handleRemoveTag(value, 'values')}
                    className='ml-1 rounded-full hover:bg-muted-foreground/20'
                    aria-label={`Remove ${value}`}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {errors.values && (
            <p className='text-sm text-destructive' role='alert' aria-live='polite'>
              {errors.values}
            </p>
          )}
        </div>

        {/* Principles */}
        <div className='space-y-2'>
          <Label>Principles</Label>
          <p className='text-sm text-muted-foreground'>
            Optional — operational guidelines that put your values into
            practice. Type a principle and press Enter to add it.
          </p>
          <div className='flex gap-2'>
            <Input
              placeholder='e.g., Customer first, Data-driven decisions'
              value={principleInput}
              onChange={e => setPrincipleInput(e.target.value)}
              onKeyDown={e =>
                handleTagKeyDown(
                  e,
                  principleInput,
                  'principles',
                  setPrincipleInput
                )
              }
              aria-label='Add principle'
            />
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                handleAddTag(principleInput, 'principles', setPrincipleInput)
              }
            >
              Add
            </Button>
          </div>

          {principles.length > 0 && (
            <div className='flex flex-wrap gap-2 pt-1'>
              {principles.map(principle => (
                <Badge key={principle} variant='secondary' className='gap-1'>
                  {principle}
                  <button
                    type='button'
                    onClick={() => handleRemoveTag(principle, 'principles')}
                    className='ml-1 rounded-full hover:bg-muted-foreground/20'
                    aria-label={`Remove ${principle}`}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Governance Style */}
        <div className='space-y-2'>
          <Label htmlFor='governance-style'>Governance Style</Label>
          <p className='text-sm text-muted-foreground'>
            How decisions are made within your organization
          </p>
          <Select
            value={data.governanceStyle ?? ''}
            onValueChange={value =>
              onChange({ ...data, governanceStyle: value })
            }
          >
            <SelectTrigger id='governance-style'>
              <SelectValue placeholder='Select governance style' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='democratic'>Democratic</SelectItem>
              <SelectItem value='hierarchical'>Hierarchical</SelectItem>
              <SelectItem value='consensus'>Consensus</SelectItem>
              <SelectItem value='delegated'>Delegated</SelectItem>
              <SelectItem value='hybrid'>Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Communication Style */}
        <div className='space-y-2'>
          <Label htmlFor='communication-style'>Communication Style</Label>
          <p className='text-sm text-muted-foreground'>
            The tone and approach your organization uses to communicate
          </p>
          <Select
            value={data.communicationStyle ?? ''}
            onValueChange={value =>
              onChange({ ...data, communicationStyle: value })
            }
          >
            <SelectTrigger id='communication-style'>
              <SelectValue placeholder='Select communication style' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='formal'>Formal</SelectItem>
              <SelectItem value='casual'>Casual</SelectItem>
              <SelectItem value='balanced'>Balanced</SelectItem>
              <SelectItem value='technical'>Technical</SelectItem>
              <SelectItem value='creative'>Creative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        <div className='flex justify-between'>
          <Button type='button' variant='outline' onClick={onBack}>
            Back
          </Button>
          <Button type='button' onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
