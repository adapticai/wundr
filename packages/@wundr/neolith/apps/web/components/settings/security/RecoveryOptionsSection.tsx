/**
 * Recovery Options Section Component
 *
 * Allows users to manage account recovery options.
 *
 * @module components/settings/security/RecoveryOptionsSection
 */

'use client';

import { Shield, Mail, Phone, Key, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useRecoveryOptions } from '@/hooks/use-recovery-options';
import { useToast } from '@/hooks/use-toast';

export function RecoveryOptionsSection() {
  const { options, isLoading, refresh } = useRecoveryOptions();
  const { toast } = useToast();
  const [showRecoveryEmailModal, setShowRecoveryEmailModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveRecoveryEmail = async () => {
    if (!recoveryEmail) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a recovery email',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/user/recovery-options', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryEmail }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save recovery email');
      }

      toast({
        title: 'Success',
        description: 'Recovery email saved successfully',
      });

      setShowRecoveryEmailModal(false);
      setRecoveryEmail('');
      await refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save recovery email',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const recoveryMethods = [
    {
      icon: Mail,
      label: 'Recovery Email',
      description: options?.recoveryEmail || 'Not set',
      status: !!options?.recoveryEmail,
      action: () => {
        setRecoveryEmail(options?.recoveryEmail || '');
        setShowRecoveryEmailModal(true);
      },
      actionLabel: options?.recoveryEmail ? 'Update' : 'Set Up',
    },
    {
      icon: Phone,
      label: 'Phone Number',
      description: options?.phoneNumber || 'Not set',
      status: !!options?.phoneNumber,
      action: null, // Handled by PhoneChangeSection
      actionLabel: null,
    },
    {
      icon: Key,
      label: 'Security Questions',
      description: options?.hasSecurityQuestions
        ? 'Configured'
        : 'Not configured',
      status: options?.hasSecurityQuestions || false,
      action: null, // Handled by SecurityQuestionsSection
      actionLabel: null,
    },
    {
      icon: Shield,
      label: 'Backup Codes',
      description: options?.hasBackupCodes ? 'Available' : 'Not generated',
      status: options?.hasBackupCodes || false,
      action: null, // Handled by 2FA section
      actionLabel: null,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            <CardTitle>Account Recovery</CardTitle>
          </div>
          <CardDescription>
            Set up multiple recovery methods to secure your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center p-8'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <div className='space-y-3'>
              {recoveryMethods.map((method, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between rounded-lg border p-4'
                >
                  <div className='flex items-center gap-3'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                      <method.icon className='h-5 w-5' />
                    </div>
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-medium'>{method.label}</p>
                        {method.status && (
                          <CheckCircle2 className='h-4 w-4 text-green-500' />
                        )}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {method.description}
                      </p>
                    </div>
                  </div>
                  {method.action && method.actionLabel && (
                    <Button variant='outline' size='sm' onClick={method.action}>
                      {method.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showRecoveryEmailModal}
        onOpenChange={setShowRecoveryEmailModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recovery Email</DialogTitle>
            <DialogDescription>
              Set an alternative email address for account recovery. This email
              will be used if you lose access to your primary email.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='recoveryEmail'>Recovery Email Address</Label>
              <Input
                type='email'
                id='recoveryEmail'
                value={recoveryEmail}
                onChange={e => setRecoveryEmail(e.target.value)}
                placeholder='recovery@example.com'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowRecoveryEmailModal(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRecoveryEmail} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
