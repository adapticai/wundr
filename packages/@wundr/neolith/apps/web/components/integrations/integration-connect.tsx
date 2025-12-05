'use client';

import { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { INTEGRATION_PROVIDERS } from '@/types/integration';

import type { IntegrationProvider } from '@/types/integration';

/**
 * Props for the IntegrationConnect component
 */
export interface IntegrationConnectProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback fired when connecting an integration */
  onConnect: (
    provider: IntegrationProvider,
    config: ConnectConfig
  ) => Promise<void>;
  /** Array of popular provider IDs to highlight */
  popularProviders?: IntegrationProvider[];
  /** Additional CSS class names */
  className?: string;
}

/**
 * Configuration data for connecting an integration
 */
export interface ConnectConfig {
  /** Custom name for the integration */
  name?: string;
  /** API key for direct authentication */
  apiKey?: string;
  /** Whether to use OAuth flow */
  useOAuth?: boolean;
}

const DEFAULT_POPULAR: IntegrationProvider[] = [
  'slack',
  'github',
  'notion',
  'jira',
  'linear',
];

export function IntegrationConnect({
  isOpen,
  onClose,
  onConnect,
  popularProviders = DEFAULT_POPULAR,
  className,
}: IntegrationConnectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] =
    useState<IntegrationProvider | null>(null);
  const [connectMethod, setConnectMethod] = useState<'oauth' | 'apikey'>(
    'oauth',
  );
  const [apiKey, setApiKey] = useState('');
  const [integrationName, setIntegrationName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allProviders = Object.entries(INTEGRATION_PROVIDERS) as [
    IntegrationProvider,
    (typeof INTEGRATION_PROVIDERS)[IntegrationProvider],
  ][];

  // Filter providers based on search
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProviders;
    }
    const query = searchQuery.toLowerCase();
    return allProviders.filter(
      ([, config]) =>
        config.name.toLowerCase().includes(query) ||
        config.description.toLowerCase().includes(query),
    );
  }, [allProviders, searchQuery]);

  const handleSelectProvider = useCallback((provider: IntegrationProvider) => {
    setSelectedProvider(provider);
    setConnectMethod('oauth');
    setApiKey('');
    setIntegrationName(INTEGRATION_PROVIDERS[provider].name);
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedProvider(null);
    setError(null);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!selectedProvider) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await onConnect(selectedProvider, {
        name: integrationName || INTEGRATION_PROVIDERS[selectedProvider].name,
        apiKey: connectMethod === 'apikey' ? apiKey : undefined,
        useOAuth: connectMethod === 'oauth',
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect integration',
      );
    } finally {
      setIsConnecting(false);
    }
  }, [
    selectedProvider,
    integrationName,
    connectMethod,
    apiKey,
    onConnect,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    setSelectedProvider(null);
    setSearchQuery('');
    setApiKey('');
    setIntegrationName('');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50'
        onClick={handleClose}
        aria-hidden='true'
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-2xl rounded-lg border bg-card shadow-xl',
          className,
        )}
        role='dialog'
        aria-modal='true'
        aria-labelledby='connect-dialog-title'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            {selectedProvider && (
              <button
                type='button'
                onClick={handleBack}
                className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
                aria-label='Back to provider selection'
              >
                <ChevronLeftIcon className='h-5 w-5' />
              </button>
            )}
            <h2
              id='connect-dialog-title'
              className='text-lg font-semibold text-foreground'
            >
              {selectedProvider
                ? `Connect ${INTEGRATION_PROVIDERS[selectedProvider].name}`
                : 'Add Integration'}
            </h2>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
            aria-label='Close'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        {/* Content */}
        <div className='max-h-[60vh] overflow-y-auto p-6'>
          {!selectedProvider ? (
            <>
              {/* Search */}
              <div className='relative mb-6'>
                <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <input
                  type='text'
                  placeholder='Search integrations...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>

              {/* Popular Section */}
              {!searchQuery.trim() && (
                <div className='mb-6'>
                  <h3 className='mb-3 text-sm font-medium text-muted-foreground'>
                    Popular
                  </h3>
                  <div className='grid grid-cols-3 gap-3 sm:grid-cols-5'>
                    {popularProviders.map(provider => (
                      <ProviderButton
                        key={provider}
                        provider={provider}
                        onClick={() => handleSelectProvider(provider)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Providers */}
              <div>
                <h3 className='mb-3 text-sm font-medium text-muted-foreground'>
                  {searchQuery.trim() ? 'Results' : 'All Integrations'}
                </h3>
                {filteredProviders.length === 0 ? (
                  <div className='py-8 text-center text-sm text-muted-foreground'>
                    No integrations found matching your search.
                  </div>
                ) : (
                  <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                    {filteredProviders.map(([provider, config]) => (
                      <button
                        key={provider}
                        type='button'
                        onClick={() => handleSelectProvider(provider)}
                        className='flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent'
                      >
                        <ProviderIcon
                          provider={provider}
                          className='h-10 w-10 shrink-0'
                        />
                        <div className='min-w-0 flex-1'>
                          <p className='truncate font-medium text-foreground'>
                            {config.name}
                          </p>
                          <p className='truncate text-xs text-muted-foreground'>
                            {config.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Provider Configuration */
            <div className='space-y-6'>
              {/* Provider Info */}
              <div className='flex items-center gap-4 rounded-lg bg-muted/50 p-4'>
                <ProviderIcon
                  provider={selectedProvider}
                  className='h-12 w-12'
                />
                <div>
                  <h3 className='font-semibold text-foreground'>
                    {INTEGRATION_PROVIDERS[selectedProvider].name}
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    {INTEGRATION_PROVIDERS[selectedProvider].description}
                  </p>
                </div>
              </div>

              {/* Integration Name */}
              <div>
                <label
                  htmlFor='integration-name'
                  className='block text-sm font-medium text-foreground'
                >
                  Integration Name
                </label>
                <input
                  id='integration-name'
                  type='text'
                  value={integrationName}
                  onChange={e => setIntegrationName(e.target.value)}
                  placeholder='Enter a name for this integration'
                  className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>

              {/* Connection Method */}
              <div>
                <label className='block text-sm font-medium text-foreground'>
                  Connection Method
                </label>
                <div className='mt-2 flex gap-3'>
                  <button
                    type='button'
                    onClick={() => setConnectMethod('oauth')}
                    className={cn(
                      'flex-1 rounded-lg border p-4 text-left transition-colors',
                      connectMethod === 'oauth'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <div className='flex items-center gap-2'>
                      <OAuthIcon className='h-5 w-5 text-primary' />
                      <span className='font-medium text-foreground'>OAuth</span>
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Connect securely with your account
                    </p>
                  </button>
                  <button
                    type='button'
                    onClick={() => setConnectMethod('apikey')}
                    className={cn(
                      'flex-1 rounded-lg border p-4 text-left transition-colors',
                      connectMethod === 'apikey'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <div className='flex items-center gap-2'>
                      <KeyIcon className='h-5 w-5 text-primary' />
                      <span className='font-medium text-foreground'>
                        API Key
                      </span>
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Enter your API key manually
                    </p>
                  </button>
                </div>
              </div>

              {/* API Key Input */}
              {connectMethod === 'apikey' && (
                <div>
                  <label
                    htmlFor='api-key'
                    className='block text-sm font-medium text-foreground'
                  >
                    API Key
                  </label>
                  <input
                    id='api-key'
                    type='password'
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder='Enter your API key'
                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  />
                </div>
              )}

              {/* Permissions Display */}
              <div>
                <h4 className='text-sm font-medium text-foreground'>
                  Requested Permissions
                </h4>
                <div className='mt-2 rounded-lg bg-muted/50 p-3'>
                  <ul className='space-y-2 text-sm text-muted-foreground'>
                    <li className='flex items-center gap-2'>
                      <CheckIcon className='h-4 w-4 text-green-500' />
                      Read workspace data
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckIcon className='h-4 w-4 text-green-500' />
                      Send messages
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckIcon className='h-4 w-4 text-green-500' />
                      Access channels
                    </li>
                  </ul>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className='rounded-md bg-red-500/10 p-3 text-sm text-red-600'>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedProvider && (
          <div className='flex items-center justify-end gap-3 border-t px-6 py-4'>
            <button
              type='button'
              onClick={handleClose}
              disabled={isConnecting}
              className='rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleConnect}
              disabled={
                isConnecting || (connectMethod === 'apikey' && !apiKey.trim())
              }
              className='flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
            >
              {isConnecting ? (
                <>
                  <LoadingSpinner className='h-4 w-4' />
                  Connecting...
                </>
              ) : (
                <>
                  <LinkIcon className='h-4 w-4' />
                  Connect
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProviderButtonProps {
  provider: IntegrationProvider;
  onClick: () => void;
}

function ProviderButton({ provider, onClick }: ProviderButtonProps) {
  const config = INTEGRATION_PROVIDERS[provider];

  return (
    <button
      type='button'
      onClick={onClick}
      className='flex flex-col items-center gap-2 rounded-lg border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-accent'
    >
      <ProviderIcon provider={provider} className='h-10 w-10' />
      <span className='text-xs font-medium text-foreground'>{config.name}</span>
    </button>
  );
}

interface ProviderIconProps {
  provider: IntegrationProvider;
  className?: string;
}

function ProviderIcon({ provider, className }: ProviderIconProps) {
  const config = INTEGRATION_PROVIDERS[provider];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary',
        className,
      )}
    >
      {config.icon}
    </div>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <line x1='18' y1='6' x2='6' y2='18' />
      <line x1='6' y1='6' x2='18' y2='18' />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='m15 18-6-6 6-6' />
    </svg>
  );
}

function OAuthIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10' />
      <path d='m9 12 2 2 4-4' />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='7.5' cy='15.5' r='5.5' />
      <path d='m21 2-9.6 9.6' />
      <path d='m15.5 7.5 3 3L22 7l-3-3' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
      <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
      />
    </svg>
  );
}
