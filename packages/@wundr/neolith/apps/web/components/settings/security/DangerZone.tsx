'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface DangerZoneProps {
  onDeleteAccount?: () => Promise<void>;
}

export function DangerZone({ onDeleteAccount }: DangerZoneProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      toast({
        title: 'Confirmation required',
        description: 'Please type DELETE to confirm',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      if (onDeleteAccount) {
        await onDeleteAccount();
      }

      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete account',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setConfirmText('');
    }
  };

  return (
    <>
      <Alert variant='destructive'>
        <AlertTriangle className='h-4 w-4' />
        <AlertTitle>Danger Zone</AlertTitle>
        <AlertDescription>
          These actions are permanent and cannot be undone.
        </AlertDescription>
      </Alert>

      <div className='space-y-4'>
        <div className='flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4'>
          <div>
            <p className='text-sm font-medium'>Delete Account</p>
            <p className='text-xs text-muted-foreground'>
              Permanently delete your account and all associated data
            </p>
          </div>
          <Button
            variant='destructive'
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Account
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='confirm-delete'>
                Type <span className='font-bold'>DELETE</span> to confirm
              </Label>
              <Input
                id='confirm-delete'
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder='DELETE'
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'DELETE' || isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
