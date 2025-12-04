'use client';

import { AlertCircle, Monitor, Smartphone, Tablet } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface Session {
  id: string;
  device: string;
  browser?: string;
  os?: string;
  location: string;
  lastActive: string;
  current: boolean;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

interface SessionsListProps {
  sessions: Session[];
  onRevokeSession: (sessionId: string) => void;
  onRevokeAllSessions: () => void;
  isLoading?: boolean;
}

function getDeviceIcon(deviceType?: string) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className='h-5 w-5' />;
    case 'tablet':
      return <Tablet className='h-5 w-5' />;
    default:
      return <Monitor className='h-5 w-5' />;
  }
}

export function SessionsList({
  sessions,
  onRevokeSession,
  onRevokeAllSessions,
  isLoading = false,
}: SessionsListProps) {
  const otherSessions = sessions.filter(s => !s.current);
  const currentSession = sessions.find(s => s.current);

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold'>Active Sessions</h3>
          <p className='text-sm text-muted-foreground'>
            Manage devices where you're currently signed in
          </p>
        </div>
        {otherSessions.length > 0 && (
          <Button
            variant='destructive'
            size='sm'
            onClick={onRevokeAllSessions}
            disabled={isLoading}
          >
            Sign Out All Other Sessions
          </Button>
        )}
      </div>

      {currentSession && (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            You're currently signed in on this device
          </AlertDescription>
        </Alert>
      )}

      <div className='space-y-3'>
        {sessions.map(session => (
          <div
            key={session.id}
            className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
              session.current
                ? 'border-primary/50 bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                {getDeviceIcon(session.deviceType)}
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <p className='text-sm font-medium'>{session.device}</p>
                  {session.current && (
                    <Badge variant='default' className='text-xs'>
                      Current Session
                    </Badge>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  {session.location} · {session.lastActive}
                </p>
              </div>
            </div>
            {!session.current && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onRevokeSession(session.id)}
                disabled={isLoading}
                className='text-destructive hover:text-destructive hover:bg-destructive/10'
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
