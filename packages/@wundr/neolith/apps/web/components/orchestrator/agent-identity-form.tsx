'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Phone, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const COMMUNICATION_CHANNELS = [
  { id: 'email', label: 'Email', description: 'Send and receive emails' },
  { id: 'sms', label: 'SMS', description: 'Text message notifications' },
  { id: 'voice', label: 'Voice', description: 'Phone call capabilities' },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'WhatsApp messaging',
  },
  { id: 'slack', label: 'Slack', description: 'Slack workspace integration' },
] as const;

type ChannelId = (typeof COMMUNICATION_CHANNELS)[number]['id'];

const EMAIL_DOMAINS = [
  'adaptic.ai',
  'wundr.io',
  'company.com',
] as const;

type ProvisioningStatus = 'none' | 'pending' | 'active' | 'failed';

const agentIdentitySchema = z.object({
  emailUsername: z
    .string()
    .min(1, 'Email username is required')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Only letters, numbers, dots, hyphens and underscores are allowed'
    ),
  emailDomain: z.string().min(1, 'Domain is required'),
  communicationChannels: z.array(z.string()),
});

type AgentIdentityFormValues = z.infer<typeof agentIdentitySchema>;

export interface AgentIdentityFormProps {
  orchestratorId: string;
  userId: string;
  initialData?: {
    corporateEmail?: string;
    phoneNumber?: string;
    communicationChannels?: string[];
    provisioningStatus?: string;
  };
  emailDomain?: string;
  onSave?: (data: {
    corporateEmail: string;
    phoneNumber: string | null;
    communicationChannels: string[];
    provisioningStatus: ProvisioningStatus;
  }) => void;
}

function parseEmailParts(email: string, fallbackDomain: string) {
  if (!email) {
    return { username: '', domain: fallbackDomain };
  }
  const [username, domain] = email.split('@');
  return { username: username ?? '', domain: domain ?? fallbackDomain };
}

function ProvisioningStatusBadge({ status }: { status: ProvisioningStatus }) {
  if (status === 'none') {
    return (
      <Badge variant='outline' className='text-muted-foreground'>
        Not provisioned
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant='outline' className='border-yellow-500 text-yellow-600'>
        Pending
      </Badge>
    );
  }
  if (status === 'active') {
    return (
      <Badge variant='outline' className='border-green-500 text-green-600'>
        Active
      </Badge>
    );
  }
  return (
    <Badge variant='destructive'>
      Failed
    </Badge>
  );
}

export function AgentIdentityForm({
  orchestratorId,
  userId,
  initialData,
  emailDomain,
  onSave,
}: AgentIdentityFormProps) {
  const defaultDomain = emailDomain ?? EMAIL_DOMAINS[0];
  const { username: initialUsername, domain: initialDomain } = parseEmailParts(
    initialData?.corporateEmail ?? '',
    defaultDomain
  );

  const [phoneNumber, setPhoneNumber] = useState<string | null>(
    initialData?.phoneNumber ?? null
  );
  const [phoneProvisioningStatus, setPhoneProvisioningStatus] =
    useState<ProvisioningStatus>(
      (initialData?.provisioningStatus as ProvisioningStatus | undefined) ??
        (initialData?.phoneNumber ? 'active' : 'none')
    );
  const [isProvisioningPhone, setIsProvisioningPhone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<AgentIdentityFormValues>({
    resolver: zodResolver(agentIdentitySchema),
    defaultValues: {
      emailUsername: initialUsername,
      emailDomain: initialDomain,
      communicationChannels: initialData?.communicationChannels ?? [],
    },
  });

  const communicationChannels = form.watch('communicationChannels');

  const toggleChannel = (channelId: ChannelId) => {
    const current = form.getValues('communicationChannels');
    const updated = current.includes(channelId)
      ? current.filter(c => c !== channelId)
      : [...current, channelId];
    form.setValue('communicationChannels', updated, { shouldDirty: true });
  };

  const handleProvisionPhone = async () => {
    setIsProvisioningPhone(true);
    setPhoneProvisioningStatus('pending');
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/provision-phone`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ?? result.error ?? 'Failed to provision phone number'
        );
      }

      setPhoneNumber(result.phoneNumber ?? null);
      setPhoneProvisioningStatus('active');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setSaveError(message);
      setPhoneProvisioningStatus('failed');
    } finally {
      setIsProvisioningPhone(false);
    }
  };

  const handleSubmit = async (data: AgentIdentityFormValues) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const corporateEmail = `${data.emailUsername}@${data.emailDomain}`;

    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/identity`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            corporateEmail,
            phoneNumber,
            communicationChannels: data.communicationChannels,
            provisioningStatus: phoneProvisioningStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ?? result.error ?? 'Failed to save identity'
        );
      }

      setSaveSuccess(true);
      form.reset(data);
      onSave?.({
        corporateEmail,
        phoneNumber,
        communicationChannels: data.communicationChannels,
        provisioningStatus: phoneProvisioningStatus,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='space-y-6'>
      {saveError && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className='rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-600'>
          Identity saved successfully.
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
          {/* Corporate Email Section */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Corporate Email</CardTitle>
              <CardDescription>
                Assign a corporate email address to this agent
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex gap-2'>
                <FormField
                  control={form.control}
                  name='emailUsername'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='agent.name'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='emailDomain'
                  render={({ field }) => (
                    <FormItem className='w-48'>
                      <FormLabel>Domain</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select domain' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EMAIL_DOMAINS.map(domain => (
                            <SelectItem key={domain} value={domain}>
                              @{domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch('emailUsername') && form.watch('emailDomain') && (
                <p className='text-sm text-muted-foreground'>
                  Full address:{' '}
                  <span className='font-medium text-foreground'>
                    {form.watch('emailUsername')}@{form.watch('emailDomain')}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Phone Provisioning Section */}
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-base'>Phone Number</CardTitle>
                  <CardDescription>
                    Provision a phone number via Twilio for this agent
                  </CardDescription>
                </div>
                <ProvisioningStatusBadge status={phoneProvisioningStatus} />
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {phoneNumber && (
                <div className='rounded-md border bg-muted/50 px-3 py-2'>
                  <p className='text-sm font-medium'>{phoneNumber}</p>
                </div>
              )}

              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleProvisionPhone}
                  disabled={
                    isProvisioningPhone ||
                    phoneProvisioningStatus === 'pending'
                  }
                  className='gap-2'
                >
                  {isProvisioningPhone ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : phoneNumber ? (
                    <RefreshCw className='h-4 w-4' />
                  ) : (
                    <Phone className='h-4 w-4' />
                  )}
                  {isProvisioningPhone
                    ? 'Provisioning...'
                    : phoneNumber
                      ? 'Reprovision Number'
                      : 'Provision Phone Number'}
                </Button>
              </div>

              {phoneProvisioningStatus === 'failed' && (
                <p className='text-sm text-destructive'>
                  Provisioning failed. Please try again or contact support.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Communication Channels Section */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Communication Channels</CardTitle>
              <CardDescription>
                Enable the channels this agent can use to communicate
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-1'>
              {COMMUNICATION_CHANNELS.map((channel, index) => {
                const isEnabled = communicationChannels.includes(channel.id);
                return (
                  <div key={channel.id}>
                    <FormField
                      control={form.control}
                      name='communicationChannels'
                      render={() => (
                        <FormItem className='flex items-center justify-between rounded-lg px-1 py-3'>
                          <div className='space-y-0.5'>
                            <FormLabel className='text-sm font-medium leading-none'>
                              {channel.label}
                            </FormLabel>
                            <FormDescription className='text-xs'>
                              {channel.description}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() =>
                                toggleChannel(channel.id)
                              }
                              aria-label={`Toggle ${channel.label}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {index < COMMUNICATION_CHANNELS.length - 1 && (
                      <Separator />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className='flex justify-end'>
            <Button
              type='submit'
              disabled={isSaving || !form.formState.isDirty}
              className='min-w-32 gap-2'
            >
              {isSaving && <Loader2 className='h-4 w-4 animate-spin' />}
              {isSaving ? 'Saving...' : 'Save Identity'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
