'use client';

/**
 * Integration Selector Component
 *
 * A comprehensive UI for selecting and configuring workflow integrations:
 * - Browse all available integrations
 * - Filter by type and search
 * - Configure integration connections
 * - OAuth flow management
 * - Connection testing and validation
 * - Action selection within integrations
 */

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Search,
  Plus,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
  ChevronRight,
  Settings,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ALL_INTEGRATIONS,
  getIntegrationById,
  getOAuthUrl,
  validateIntegrationConnection,
  type BaseIntegration,
  type IntegrationAction,
  type IntegrationConnection,
  type IntegrationType,
} from '@/lib/workflow/integrations';

// ============================================================================
// Types
// ============================================================================

interface IntegrationSelectorProps {
  onSelect: (integration: BaseIntegration, action: IntegrationAction) => void;
  existingConnections?: IntegrationConnection[];
  onConnectionCreated?: (connection: IntegrationConnection) => void;
  onConnectionDeleted?: (connectionId: string) => void;
}

interface ConnectionFormData {
  name: string;
  [key: string]: unknown;
}

// ============================================================================
// Main Component
// ============================================================================

export function IntegrationSelector({
  onSelect,
  existingConnections = [],
  onConnectionCreated,
  onConnectionDeleted,
}: IntegrationSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<IntegrationType | 'all'>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<BaseIntegration | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Filter integrations based on search and type
  const filteredIntegrations = useMemo(() => {
    let results = ALL_INTEGRATIONS;

    if (selectedType !== 'all') {
      results = results.filter(i => i.type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        i =>
          i.name.toLowerCase().includes(query) ||
          i.description.toLowerCase().includes(query) ||
          i.actions.some(a => a.name.toLowerCase().includes(query)),
      );
    }

    return results;
  }, [searchQuery, selectedType]);

  // Get connections for an integration
  const getConnectionsForIntegration = useCallback(
    (integrationId: string) => {
      return existingConnections.filter(c => c.integrationId === integrationId);
    },
    [existingConnections],
  );

  // Handle integration selection
  const handleIntegrationClick = useCallback((integration: BaseIntegration) => {
    setSelectedIntegration(integration);
    setConnectionError(null);
  }, []);

  // Handle action selection
  const handleActionSelect = useCallback(
    (action: IntegrationAction) => {
      if (!selectedIntegration) {
return;
}

      // Check if integration requires connection
      if (selectedIntegration.requiresConnection) {
        const connections = getConnectionsForIntegration(selectedIntegration.id);
        if (connections.length === 0) {
          setShowConnectionDialog(true);
          return;
        }
      }

      onSelect(selectedIntegration, action);
      setSelectedIntegration(null);
    },
    [selectedIntegration, onSelect, getConnectionsForIntegration],
  );

  // Handle new connection
  const handleNewConnection = useCallback(() => {
    setShowConnectionDialog(true);
  }, []);

  return (
    <div className='flex h-full flex-col gap-4'>
      {/* Search and Filter Header */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search integrations...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-9'
          />
        </div>

        <Select value={selectedType} onValueChange={(v: IntegrationType | 'all') => setSelectedType(v)}>
          <SelectTrigger>
            <SelectValue placeholder='All integrations' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Integrations</SelectItem>
            <SelectItem value='http'>HTTP/REST</SelectItem>
            <SelectItem value='email'>Email</SelectItem>
            <SelectItem value='slack'>Slack</SelectItem>
            <SelectItem value='github'>GitHub</SelectItem>
            <SelectItem value='calendar'>Calendar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Integration List */}
      <ScrollArea className='flex-1'>
        <div className='grid gap-3'>
          {filteredIntegrations.map(integration => {
            const Icon = integration.icon;
            const connections = getConnectionsForIntegration(integration.id);
            const isConnected = connections.length > 0;

            return (
              <Card
                key={integration.id}
                className={`cursor-pointer transition-all hover:border-primary ${
                  selectedIntegration?.id === integration.id ? 'border-primary bg-accent' : ''
                }`}
                onClick={() => handleIntegrationClick(integration)}
              >
                <CardHeader className='p-4'>
                  <div className='flex items-start justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className={`rounded-lg bg-background p-2 ${integration.color}`}>
                        <Icon className='h-5 w-5' />
                      </div>
                      <div>
                        <CardTitle className='text-sm'>{integration.name}</CardTitle>
                        <CardDescription className='text-xs'>
                          {integration.description}
                        </CardDescription>
                      </div>
                    </div>
                    {isConnected ? (
                      <Badge variant='secondary' className='gap-1'>
                        <Check className='h-3 w-3' />
                        Connected
                      </Badge>
                    ) : integration.requiresConnection ? (
                      <Badge variant='outline'>Setup Required</Badge>
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            );
          })}

          {filteredIntegrations.length === 0 && (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <AlertCircle className='mb-2 h-8 w-8 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>No integrations found</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Integration Details Dialog */}
      <Dialog
        open={!!selectedIntegration}
        onOpenChange={open => !open && setSelectedIntegration(null)}
      >
        <DialogContent className='max-w-2xl'>
          {selectedIntegration && (
            <>
              <DialogHeader>
                <div className='flex items-center gap-3'>
                  <div
                    className={`rounded-lg bg-background p-2 ${selectedIntegration.color}`}
                  >
                    {<selectedIntegration.icon className='h-6 w-6' />}
                  </div>
                  <div>
                    <DialogTitle>{selectedIntegration.name}</DialogTitle>
                    <DialogDescription>{selectedIntegration.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue='actions' className='mt-4'>
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='actions'>Actions</TabsTrigger>
                  <TabsTrigger value='connections'>
                    Connections
                    {getConnectionsForIntegration(selectedIntegration.id).length > 0 && (
                      <Badge variant='secondary' className='ml-2'>
                        {getConnectionsForIntegration(selectedIntegration.id).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value='actions' className='space-y-3'>
                  <ScrollArea className='h-[400px]'>
                    {selectedIntegration.actions.map(action => {
                      const ActionIcon = action.icon;
                      return (
                        <Card
                          key={action.id}
                          className='mb-3 cursor-pointer transition-colors hover:bg-accent'
                          onClick={() => handleActionSelect(action)}
                        >
                          <CardHeader className='p-4'>
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center gap-3'>
                                <ActionIcon className='h-4 w-4 text-muted-foreground' />
                                <div>
                                  <CardTitle className='text-sm'>{action.name}</CardTitle>
                                  <CardDescription className='text-xs'>
                                    {action.description}
                                  </CardDescription>
                                </div>
                              </div>
                              <ChevronRight className='h-4 w-4 text-muted-foreground' />
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value='connections' className='space-y-3'>
                  <ConnectionManager
                    integration={selectedIntegration}
                    connections={getConnectionsForIntegration(selectedIntegration.id)}
                    onConnectionCreated={connection => {
                      onConnectionCreated?.(connection);
                      setShowConnectionDialog(false);
                    }}
                    onConnectionDeleted={onConnectionDeleted}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Connection Setup Dialog */}
      {selectedIntegration && (
        <ConnectionDialog
          open={showConnectionDialog}
          onOpenChange={setShowConnectionDialog}
          integration={selectedIntegration}
          onConnectionCreated={connection => {
            onConnectionCreated?.(connection);
            setShowConnectionDialog(false);
            setConnectionError(null);
          }}
          error={connectionError}
          onError={setConnectionError}
        />
      )}
    </div>
  );
}

// ============================================================================
// Connection Manager Component
// ============================================================================

interface ConnectionManagerProps {
  integration: BaseIntegration;
  connections: IntegrationConnection[];
  onConnectionCreated?: (connection: IntegrationConnection) => void;
  onConnectionDeleted?: (connectionId: string) => void;
}

function ConnectionManager({
  integration,
  connections,
  onConnectionCreated,
  onConnectionDeleted,
}: ConnectionManagerProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (connectionId: string) => {
    setDeletingId(connectionId);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      onConnectionDeleted?.(connectionId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {connections.length === 0
            ? 'No connections configured'
            : `${connections.length} connection${connections.length === 1 ? '' : 's'} configured`}
        </p>
        <Button size='sm' onClick={() => setShowNewDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          New Connection
        </Button>
      </div>

      <ScrollArea className='h-[320px]'>
        {connections.map(connection => (
          <Card key={connection.id} className='mb-3'>
            <CardContent className='flex items-center justify-between p-4'>
              <div className='space-y-1'>
                <h4 className='text-sm font-medium'>{connection.name}</h4>
                <p className='text-xs text-muted-foreground'>
                  Created {new Date(connection.createdAt).toLocaleDateString()}
                </p>
                {connection.expiresAt && (
                  <Badge variant='outline' className='text-xs'>
                    Expires {new Date(connection.expiresAt).toLocaleDateString()}
                  </Badge>
                )}
              </div>
              <div className='flex gap-2'>
                <Button variant='ghost' size='sm'>
                  <Settings className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleDelete(connection.id)}
                  disabled={deletingId === connection.id}
                >
                  {deletingId === connection.id ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Trash2 className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </ScrollArea>

      <ConnectionDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        integration={integration}
        onConnectionCreated={connection => {
          onConnectionCreated?.(connection);
          setShowNewDialog(false);
        }}
      />
    </div>
  );
}

// ============================================================================
// Connection Dialog Component
// ============================================================================

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: BaseIntegration;
  onConnectionCreated: (connection: IntegrationConnection) => void;
  error?: string | null;
  onError?: (error: string | null) => void;
}

function ConnectionDialog({
  open,
  onOpenChange,
  integration,
  onConnectionCreated,
  error,
  onError,
}: ConnectionDialogProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(
    null,
  );

  // Create dynamic form schema based on integration
  const formSchema = useMemo(() => {
    return z.object({
      name: z.string().min(1, 'Connection name is required'),
    }).and(integration.configSchema);
  }, [integration]);

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: `${integration.name} Connection`,
    },
  });

  // Handle OAuth flow
  const handleOAuthConnect = useCallback(() => {
    // Generate state parameter for CSRF protection
    const state = Math.random().toString(36).substring(7);
    const redirectUri = `${window.location.origin}/api/integrations/oauth/callback`;
    const clientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || 'YOUR_CLIENT_ID';

    try {
      const oauthUrl = getOAuthUrl(integration.id, clientId, redirectUri, state);
      // Store state in session storage
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_integration', integration.id);
      // Redirect to OAuth provider
      window.location.href = oauthUrl;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to start OAuth flow');
    }
  }, [integration, onError]);

  // Handle form submission
  const onSubmit = async (data: ConnectionFormData) => {
    setIsConnecting(true);
    onError?.(null);
    setValidationResult(null);

    try {
      // Validate connection
      const validation = await validateIntegrationConnection(integration, data);
      setValidationResult(validation);

      if (!validation.valid) {
        onError?.(validation.error || 'Invalid connection configuration');
        return;
      }

      // Simulate API call to create connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newConnection: IntegrationConnection = {
        id: Math.random().toString(36).substring(7),
        integrationId: integration.id,
        name: data.name,
        authType: integration.authType,
        credentials: data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      onConnectionCreated(newConnection);
      form.reset();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to create connection');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Connect {integration.name}</DialogTitle>
          <DialogDescription>
            {integration.authType === 'oauth2'
              ? 'Authorize access to your account'
              : 'Enter your connection details'}
          </DialogDescription>
        </DialogHeader>

        {integration.authType === 'oauth2' ? (
          <div className='space-y-4 py-4'>
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                You will be redirected to {integration.name} to authorize access. Make sure to grant
                all requested permissions.
              </AlertDescription>
            </Alert>

            <Button onClick={handleOAuthConnect} className='w-full' size='lg'>
              <ExternalLink className='mr-2 h-4 w-4' />
              Connect with {integration.name}
            </Button>

            {error && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Name</FormLabel>
                    <FormControl>
                      <Input placeholder='My Connection' {...field} />
                    </FormControl>
                    <FormDescription>
                      A friendly name to identify this connection
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Render integration-specific fields */}
              <IntegrationFields integration={integration} form={form} />

              {error && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {validationResult && !validationResult.valid && (
                <Alert variant='destructive'>
                  <X className='h-4 w-4' />
                  <AlertDescription>{validationResult.error}</AlertDescription>
                </Alert>
              )}

              {validationResult && validationResult.valid && (
                <Alert>
                  <Check className='h-4 w-4' />
                  <AlertDescription>Connection validated successfully!</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}
                  disabled={isConnecting}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={isConnecting}>
                  {isConnecting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Integration-Specific Form Fields
// ============================================================================

interface IntegrationFieldsProps {
  integration: BaseIntegration;
  form: ReturnType<typeof useForm<ConnectionFormData>>;
}

function IntegrationFields({ integration, form }: IntegrationFieldsProps) {
  switch (integration.id) {
    case 'email':
      return <EmailFields form={form} />;
    case 'slack':
      return <SlackFields form={form} />;
    case 'github':
      return <GitHubFields form={form} />;
    case 'calendar':
      return <CalendarFields form={form} />;
    default:
      return null;
  }
}

function EmailFields({ form }: { form: ReturnType<typeof useForm<ConnectionFormData>> }) {
  return (
    <>
      <FormField
        control={form.control}
        name='provider'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email Provider</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select provider' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='smtp'>SMTP</SelectItem>
                <SelectItem value='gmail'>Gmail</SelectItem>
                <SelectItem value='outlook'>Outlook</SelectItem>
                <SelectItem value='sendgrid'>SendGrid</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='fromEmail'
        render={({ field }) => (
          <FormItem>
            <FormLabel>From Email</FormLabel>
            <FormControl>
              <Input type='email' placeholder='noreply@example.com' {...field} value={field.value as string} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='smtpHost'
        render={({ field }) => (
          <FormItem>
            <FormLabel>SMTP Host</FormLabel>
            <FormControl>
              <Input placeholder='smtp.gmail.com' {...field} value={field.value as string} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='username'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl>
              <Input placeholder='user@example.com' {...field} value={field.value as string} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='password'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input type='password' placeholder='••••••••' {...field} value={field.value as string} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function SlackFields({ form }: { form: ReturnType<typeof useForm<ConnectionFormData>> }) {
  return (
    <>
      <FormField
        control={form.control}
        name='botToken'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bot Token</FormLabel>
            <FormControl>
              <Input placeholder='xoxb-...' type='password' {...field} value={field.value as string} />
            </FormControl>
            <FormDescription>Your Slack bot user OAuth token</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='signingSecret'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Signing Secret</FormLabel>
            <FormControl>
              <Input placeholder='••••••••' type='password' {...field} value={field.value as string} />
            </FormControl>
            <FormDescription>Used to verify webhook requests</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function GitHubFields({ form }: { form: ReturnType<typeof useForm<ConnectionFormData>> }) {
  return (
    <FormField
      control={form.control}
      name='accessToken'
      render={({ field }) => (
        <FormItem>
          <FormLabel>Personal Access Token</FormLabel>
          <FormControl>
            <Input placeholder='ghp_...' type='password' {...field} value={field.value as string} />
          </FormControl>
          <FormDescription>
            Generate a token at{' '}
            <a
              href='https://github.com/settings/tokens'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary underline'
            >
              GitHub Settings
            </a>
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function CalendarFields({ form }: { form: ReturnType<typeof useForm<ConnectionFormData>> }) {
  return (
    <FormField
      control={form.control}
      name='provider'
      render={({ field }) => (
        <FormItem>
          <FormLabel>Calendar Provider</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value as string}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder='Select provider' />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value='google'>Google Calendar</SelectItem>
              <SelectItem value='outlook'>Outlook Calendar</SelectItem>
            </SelectContent>
          </Select>
          <FormDescription>OAuth will be required after selecting provider</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
