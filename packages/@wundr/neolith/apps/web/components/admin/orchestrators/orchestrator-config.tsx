'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { Orchestrator } from '@/types/orchestrator';

interface OrchestratorConfigProps {
  orchestrator: Orchestrator;
  onSave?: (updates: Partial<Orchestrator>) => void;
  isLoading?: boolean;
  className?: string;
}

export function OrchestratorConfig({
  orchestrator,
  onSave,
  isLoading = false,
  className,
}: OrchestratorConfigProps) {
  const [formData, setFormData] = useState({
    title: orchestrator.title,
    description: orchestrator.description || '',
    discipline: orchestrator.discipline || '',
    systemPrompt: orchestrator.systemPrompt || '',
    autoEscalation:
      orchestrator.charter?.operationalSettings?.autoEscalation ?? false,
    responseTimeTarget:
      orchestrator.charter?.operationalSettings?.responseTimeTarget ?? 30,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(formData);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
        <CardDescription>
          Manage orchestrator settings and behavior
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='space-y-4'>
            <div className='grid gap-2'>
              <Label htmlFor='title'>Orchestrator Name</Label>
              <Input
                id='title'
                value={formData.title}
                onChange={e =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder='Enter orchestrator name'
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the orchestrator's role"
                rows={3}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='discipline'>Discipline</Label>
              <Select
                value={formData.discipline}
                onValueChange={value =>
                  setFormData({ ...formData, discipline: value })
                }
              >
                <SelectTrigger id='discipline'>
                  <SelectValue placeholder='Select discipline' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Engineering'>Engineering</SelectItem>
                  <SelectItem value='Product'>Product</SelectItem>
                  <SelectItem value='Design'>Design</SelectItem>
                  <SelectItem value='Marketing'>Marketing</SelectItem>
                  <SelectItem value='Sales'>Sales</SelectItem>
                  <SelectItem value='Operations'>Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='systemPrompt'>System Prompt</Label>
              <Textarea
                id='systemPrompt'
                value={formData.systemPrompt}
                onChange={e =>
                  setFormData({ ...formData, systemPrompt: e.target.value })
                }
                placeholder='Custom system prompt for this orchestrator'
                rows={6}
                className='font-mono text-sm'
              />
            </div>
          </div>

          <Separator />

          <div className='space-y-4'>
            <h4 className='text-sm font-semibold'>Operational Settings</h4>

            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label>Auto Escalation</Label>
                <p className='text-sm text-muted-foreground'>
                  Automatically escalate unresolved issues
                </p>
              </div>
              <Switch
                checked={formData.autoEscalation}
                onCheckedChange={checked =>
                  setFormData({ ...formData, autoEscalation: checked })
                }
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='responseTime'>
                Response Time Target (minutes)
              </Label>
              <Input
                id='responseTime'
                type='number'
                value={formData.responseTimeTarget}
                onChange={e =>
                  setFormData({
                    ...formData,
                    responseTimeTarget: parseInt(e.target.value),
                  })
                }
                min={1}
                max={240}
              />
            </div>
          </div>

          <Separator />

          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' disabled={isLoading}>
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
