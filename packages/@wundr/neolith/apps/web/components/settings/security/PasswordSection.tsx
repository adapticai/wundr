'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { KeyRound } from 'lucide-react';

interface PasswordSectionProps {
  onPasswordChange?: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
}

export function PasswordSection({ onPasswordChange }: PasswordSectionProps) {
  const { toast } = useToast();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (passwords.new.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      if (onPasswordChange) {
        await onPasswordChange(passwords.current, passwords.new);
      }

      toast({
        title: 'Success',
        description: 'Password updated successfully',
      });

      setShowPasswordModal(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update password',
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
            <KeyRound className='h-5 w-5 text-primary' />
          </div>
          <div>
            <p className='text-sm font-medium'>Password</p>
            <p className='text-xs text-muted-foreground'>
              Last changed 3 months ago
            </p>
          </div>
        </div>
        <Button variant='outline' onClick={() => setShowPasswordModal(true)}>
          Change Password
        </Button>
      </div>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new secure password.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='currentPassword'>Current password</Label>
              <Input
                type='password'
                id='currentPassword'
                value={passwords.current}
                onChange={e =>
                  setPasswords({ ...passwords, current: e.target.value })
                }
                placeholder='Enter current password'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='newPassword'>New password</Label>
              <Input
                type='password'
                id='newPassword'
                value={passwords.new}
                onChange={e =>
                  setPasswords({ ...passwords, new: e.target.value })
                }
                placeholder='Enter new password (min. 8 characters)'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>Confirm new password</Label>
              <Input
                type='password'
                id='confirmPassword'
                value={passwords.confirm}
                onChange={e =>
                  setPasswords({ ...passwords, confirm: e.target.value })
                }
                placeholder='Confirm new password'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowPasswordModal(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
