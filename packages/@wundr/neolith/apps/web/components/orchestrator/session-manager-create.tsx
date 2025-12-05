'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface SessionManagerCreateProps {
  orchestratorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function SessionManagerCreate({
  orchestratorId,
  open,
  onOpenChange,
  onCreated,
}: SessionManagerCreateProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    charterId: '',
    disciplineId: '',
    isGlobal: false,
    maxConcurrentSubagents: 20,
    tokenBudgetPerHour: 100000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.charterId) {
      toast({
        title: 'Error',
        description: 'Name and Charter ID are required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/session-managers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            charterData: { name: formData.name, version: 1 }, // Basic charter
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to create session manager');
      }

      toast({
        title: 'Success',
        description: 'Session Manager created successfully',
      });

      onOpenChange(false);
      onCreated?.();

      // Reset form
      setFormData({
        name: '',
        description: '',
        charterId: '',
        disciplineId: '',
        isGlobal: false,
        maxConcurrentSubagents: 20,
        tokenBudgetPerHour: 100000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create session manager',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Session Manager</DialogTitle>
            <DialogDescription>
              Session Managers orchestrate Claude Code/Flow sessions with up to
              20 subagents.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='name'>
                Name <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='name'
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder='Engineering Session Manager'
                disabled={loading}
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
                placeholder='Manages engineering tasks and code development'
                rows={2}
                disabled={loading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='charterId'>
                Charter ID <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='charterId'
                value={formData.charterId}
                onChange={e =>
                  setFormData({ ...formData, charterId: e.target.value })
                }
                placeholder='engineering-sm-v1'
                disabled={loading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='disciplineId'>Discipline ID</Label>
              <Input
                id='disciplineId'
                value={formData.disciplineId}
                onChange={e =>
                  setFormData({ ...formData, disciplineId: e.target.value })
                }
                placeholder='engineering'
                disabled={loading}
              />
            </div>

            <div className='flex items-center justify-between'>
              <Label htmlFor='isGlobal'>
                Global (available to all orchestrators)
              </Label>
              <Switch
                id='isGlobal'
                checked={formData.isGlobal}
                onCheckedChange={checked =>
                  setFormData({ ...formData, isGlobal: checked })
                }
                disabled={loading}
              />
            </div>

            <div className='grid gap-2'>
              <Label>
                Max Concurrent Subagents: {formData.maxConcurrentSubagents}
              </Label>
              <Slider
                value={[formData.maxConcurrentSubagents]}
                onValueChange={([value]) =>
                  setFormData({ ...formData, maxConcurrentSubagents: value })
                }
                max={50}
                min={1}
                step={1}
                disabled={loading}
              />
            </div>

            <div className='grid gap-2'>
              <Label>
                Token Budget Per Hour:{' '}
                {formData.tokenBudgetPerHour.toLocaleString()}
              </Label>
              <Slider
                value={[formData.tokenBudgetPerHour]}
                onValueChange={([value]) =>
                  setFormData({ ...formData, tokenBudgetPerHour: value })
                }
                max={500000}
                min={10000}
                step={10000}
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={loading}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Create Session Manager
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SessionManagerCreate;
