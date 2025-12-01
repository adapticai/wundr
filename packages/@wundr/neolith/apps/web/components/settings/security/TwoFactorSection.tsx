'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Copy, Download } from 'lucide-react';

interface TwoFactorSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TwoFactorSection({ enabled, onToggle }: TwoFactorSectionProps) {
  const { toast } = useToast();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify'>('qr');
  const [verificationCode, setVerificationCode] = useState('');

  // Mock QR code and backup codes - replace with real implementation
  const qrCodeUrl =
    'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Wundr:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Wundr';
  const secretKey = 'JBSWY3DPEHPK3PXP';
  const backupCodes = [
    '1234-5678-9012',
    '3456-7890-1234',
    '5678-9012-3456',
    '7890-1234-5678',
    '9012-3456-7890',
    '1234-5678-9012',
    '3456-7890-1234',
    '5678-9012-3456',
  ];

  const handleEnable2FA = () => {
    setShowSetupModal(true);
    setSetupStep('qr');
  };

  const handleVerify2FA = () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    // Mock verification - replace with real API call
    onToggle(true);
    setShowSetupModal(false);
    setShowBackupCodes(true);
    setVerificationCode('');

    toast({
      title: 'Two-factor authentication enabled',
      description: 'Your account is now more secure',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wundr-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='space-y-0.5'>
            <Label htmlFor='two-factor'>Two-Factor Authentication</Label>
            <p className='text-sm text-muted-foreground'>
              Add an extra layer of security with authenticator app
            </p>
          </div>
          <Switch
            id='two-factor'
            checked={enabled}
            onCheckedChange={checked => {
              if (checked) {
                handleEnable2FA();
              } else {
                onToggle(false);
              }
            }}
          />
        </div>

        {enabled && (
          <Alert>
            <ShieldCheck className='h-4 w-4' />
            <AlertTitle>Two-factor authentication is enabled</AlertTitle>
            <AlertDescription>
              Your account is protected with an authenticator app.
              <div className='mt-3 flex gap-3'>
                <Button
                  variant='link'
                  size='sm'
                  className='h-auto p-0 text-xs'
                  onClick={() => setShowBackupCodes(true)}
                >
                  View backup codes
                </Button>
                <span className='text-muted-foreground'>·</span>
                <Button
                  variant='link'
                  size='sm'
                  className='h-auto p-0 text-xs'
                  onClick={handleEnable2FA}
                >
                  Reconfigure
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Setup 2FA Modal */}
      <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'qr'
                ? 'Set up two-factor authentication'
                : 'Verify your code'}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'qr'
                ? 'Scan this QR code with your authenticator app'
                : 'Enter the 6-digit code from your authenticator app'}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'qr' ? (
            <div className='space-y-4 py-4'>
              <div className='flex justify-center'>
                <div className='rounded-lg border p-4 bg-white'>
                  <img src={qrCodeUrl} alt='QR Code' className='h-48 w-48' />
                </div>
              </div>
              <div className='space-y-2'>
                <Label>Or enter this code manually</Label>
                <div className='flex gap-2'>
                  <Input value={secretKey} readOnly className='font-mono' />
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => copyToClipboard(secretKey)}
                  >
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='verification-code'>Verification code</Label>
                <Input
                  id='verification-code'
                  value={verificationCode}
                  onChange={e =>
                    setVerificationCode(
                      e.target.value.replace(/\D/g, '').slice(0, 6)
                    )
                  }
                  placeholder='000000'
                  className='text-center text-2xl tracking-widest font-mono'
                  maxLength={6}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {setupStep === 'qr' ? (
              <>
                <Button
                  variant='outline'
                  onClick={() => setShowSetupModal(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setSetupStep('verify')}>Continue</Button>
              </>
            ) : (
              <>
                <Button variant='outline' onClick={() => setSetupStep('qr')}>
                  Back
                </Button>
                <Button onClick={handleVerify2FA}>Verify & Enable</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Modal */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup Codes</DialogTitle>
            <DialogDescription>
              Save these codes in a secure place. Each code can only be used
              once.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-2'>
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className='rounded-lg border bg-muted p-3 text-center font-mono text-sm'
                >
                  {code}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={downloadBackupCodes}>
              <Download className='mr-2 h-4 w-4' />
              Download
            </Button>
            <Button onClick={() => setShowBackupCodes(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
