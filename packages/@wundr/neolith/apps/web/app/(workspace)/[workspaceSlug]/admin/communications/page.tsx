'use client';

import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Webhook,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { AgentCommLogViewer } from '@/components/orchestrator/agent-comm-log-viewer';
import { CommunicationPreferences } from '@/components/settings/communication-preferences';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const INBOUND_WEBHOOK_ENDPOINTS = [
  {
    provider: 'Twilio',
    path: '/api/webhooks/twilio',
    description: 'Receive inbound SMS and WhatsApp messages',
  },
  {
    provider: 'SendGrid',
    path: '/api/webhooks/sendgrid',
    description: 'Parse inbound emails from SendGrid',
  },
  {
    provider: 'Email (SES)',
    path: '/api/webhooks/email',
    description: 'AWS SES delivery and bounce notifications',
  },
];

interface WebhookRowProps {
  provider: string;
  path: string;
  description: string;
}

function WebhookRow({ provider, path, description }: WebhookRowProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(
    null
  );

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      setTestResult(res.ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
      <div className='flex items-start gap-3'>
        <Webhook className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
        <div>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium'>{provider}</p>
            {testResult === 'success' && (
              <Badge
                variant='outline'
                className='border-green-500 text-green-600 text-xs gap-1'
              >
                <CheckCircle2 className='h-3 w-3' />
                Reachable
              </Badge>
            )}
            {testResult === 'error' && (
              <Badge
                variant='outline'
                className='border-destructive text-destructive text-xs gap-1'
              >
                <XCircle className='h-3 w-3' />
                Unreachable
              </Badge>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>{description}</p>
          <p className='mt-0.5 font-mono text-xs text-muted-foreground'>
            {path}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='sm' className='h-8 w-8 p-0' asChild>
          <a
            href={path}
            target='_blank'
            rel='noreferrer'
            aria-label={`Open ${provider} webhook endpoint`}
          >
            <ExternalLink className='h-3.5 w-3.5' />
          </a>
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <>
              <Loader2 className='h-3 w-3 mr-1.5 animate-spin' />
              Testing...
            </>
          ) : (
            'Test'
          )}
        </Button>
      </div>
    </div>
  );
}

export default function CommunicationsPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!workspaceSlug) return;
    fetch(`/api/workspaces/${workspaceSlug}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setWorkspaceId(data.id ?? null))
      .catch(() => {
        setWorkspaceId(null);
        setLoadError(true);
      })
      .finally(() => setIsLoading(false));
  }, [workspaceSlug]);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>
          Communications
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Monitor message logs, configure channel preferences, and manage
          inbound webhook endpoints for this workspace.
        </p>
      </div>

      <Tabs defaultValue='logs'>
        <TabsList>
          <TabsTrigger value='logs'>Message Log</TabsTrigger>
          <TabsTrigger value='preferences'>Preferences</TabsTrigger>
          <TabsTrigger value='webhooks'>Inbound Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value='logs' className='mt-4'>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-24 w-full' />
              <Skeleton className='h-64 w-full' />
            </div>
          ) : workspaceId ? (
            <AgentCommLogViewer workspaceId={workspaceId} />
          ) : (
            <p className='text-sm text-muted-foreground'>
              {loadError
                ? 'Failed to load workspace data. Please refresh and try again.'
                : 'No workspace data available.'}
            </p>
          )}
        </TabsContent>

        <TabsContent value='preferences' className='mt-4'>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-48 w-full' />
            </div>
          ) : workspaceId ? (
            <CommunicationPreferences orchestratorId={workspaceId} />
          ) : (
            <p className='text-sm text-muted-foreground'>
              {loadError
                ? 'Failed to load workspace data. Please refresh and try again.'
                : 'No workspace data available.'}
            </p>
          )}
        </TabsContent>

        <TabsContent value='webhooks' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                Inbound Webhook Endpoints
              </CardTitle>
              <CardDescription>
                These endpoints receive inbound messages from external
                communication providers. Use the Test button to verify each
                endpoint is reachable.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {INBOUND_WEBHOOK_ENDPOINTS.map(endpoint => (
                <WebhookRow key={endpoint.path} {...endpoint} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
