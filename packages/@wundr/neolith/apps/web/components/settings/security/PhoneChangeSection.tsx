/**
 * Phone Change Section Component
 *
 * Allows users to change their phone number with SMS verification.
 *
 * @module components/settings/security/PhoneChangeSection
 */

'use client';

import { Phone, Loader2 } from 'lucide-react';
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

interface PhoneChangeSectionProps {
  currentPhone?: string;
}

export function PhoneChangeSection({ currentPhone }: PhoneChangeSectionProps) {
  const { toast } = useToast();
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const handleRequestChange = async () => {
    if (!phoneNumber) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/phone/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request phone change');
      }

      toast({
        title: 'Verification Code Sent',
        description: 'Please check your phone for the verification code',
      });

      setShowChangeModal(false);
      setShowVerifyModal(true);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to change phone',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify phone');
      }

      toast({
        title: 'Success',
        description: 'Phone number updated successfully',
      });

      setShowVerifyModal(false);
      setPhoneNumber('');
      setVerificationCode('');
      // Refresh the page or update the UI
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to verify phone',
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
            <Phone className='h-5 w-5 text-primary' />
          </div>
          <div>
            <p className='text-sm font-medium'>Phone Number</p>
            <p className='text-xs text-muted-foreground'>
              {currentPhone || 'Not set'}
            </p>
          </div>
        </div>
        <Button variant='outline' onClick={() => setShowChangeModal(true)}>
          {currentPhone ? 'Change' : 'Add'} Phone
        </Button>
      </div>

      {/* Request Change Modal */}
      <Dialog open={showChangeModal} onOpenChange={setShowChangeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentPhone ? 'Change' : 'Add'} Phone Number
            </DialogTitle>
            <DialogDescription>
              Enter your phone number. We'll send you a verification code via
              SMS.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='phoneNumber'>Phone Number</Label>
              <Input
                type='tel'
                id='phoneNumber'
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder='+1234567890'
              />
              <p className='text-xs text-muted-foreground'>
                Include country code (e.g., +1 for US)
              </p>
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
            <Button onClick={handleRequestChange} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Sending...
                </>
              ) : (
                'Send Code'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Phone Number</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code we sent to {phoneNumber}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='code'>Verification Code</Label>
              <Input
                id='code'
                value={verificationCode}
                onChange={e =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, '').slice(0, 6),
                  )
                }
                placeholder='000000'
                className='text-center text-2xl tracking-widest font-mono'
                maxLength={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowVerifyModal(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
