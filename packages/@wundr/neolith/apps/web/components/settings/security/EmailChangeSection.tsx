/**
 * Email Change Section Component
 *
 * Allows users to change their email address with verification.
 *
 * @module components/settings/security/EmailChangeSection
 */

'use client';

import { Mail, Loader2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

interface EmailChangeSectionProps {
  currentEmail: string;
}

export function EmailChangeSection({ currentEmail }: EmailChangeSectionProps) {
  const { toast } = useToast();
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    newEmail: '',
    password: '',
  });

  const handleSubmit = async () => {
    if (!formData.newEmail || !formData.password) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/email/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request email change');
      }

      toast({
        title: 'Verification Sent',
        description:
          'Please check your email to verify the change. You will receive emails at both your old and new addresses.',
      });

      setShowChangeModal(false);
      setFormData({ newEmail: '', password: '' });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to change email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary/10'>
            <Mail className='h-5 w-5 text-primary' />
          </div>
          <div>
            <p className='text-sm font-medium'>Email Address</p>
            <p className='text-xs text-muted-foreground'>{currentEmail}</p>
          </div>
        </div>
        <Button variant='outline' onClick={() => setShowChangeModal(true)}>
          Change Email
        </Button>
      </div>

      <Dialog open={showChangeModal} onOpenChange={setShowChangeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              Enter your new email address and current password. We'll send
              verification emails to both addresses.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='currentEmail'>Current Email</Label>
              <Input
                type='email'
                id='currentEmail'
                value={currentEmail}
                disabled
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='newEmail'>New Email</Label>
              <Input
                type='email'
                id='newEmail'
                value={formData.newEmail}
                onChange={e =>
                  setFormData({ ...formData, newEmail: e.target.value })
                }
                placeholder='Enter new email address'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='password'>Confirm Password</Label>
              <Input
                type='password'
                id='password'
                value={formData.password}
                onChange={e =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder='Enter your password'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowChangeModal(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Sending...
                </>
              ) : (
                'Send Verification'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
