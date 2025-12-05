/**
 * Advanced Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/advanced/page
 *
 * Advanced developer settings for power users including:
 * - Developer mode toggle
 * - Network request logging
 * - Performance metrics
 * - Feature flags
 * - Cache management
 * - Debug information
 * - API configuration
 * - WebSocket status
 * - Experimental features
 */
'use client';

import {
  AlertCircle,
  Bug,
  Code,
  Database,
  FlaskConical,
  Network,
  Rocket,
  Server,
  Settings2,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  SettingsGroup,
  SettingsRow,
  SettingsSection,
} from '@/components/settings/settings-section';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

// Types for settings
interface AdvancedSettings {
  developerMode: boolean;
  networkLogging: boolean;
  performanceMetrics: boolean;
  consoleLogging: boolean;
  apiEndpoint: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  featureFlags: Record<string, boolean>;
  experimentalFeatures: Record<string, boolean>;
}

interface PerformanceMetrics {
  fps: number;
  memory: number;
  renderTime: number;
  apiCalls: number;
  cacheSize: number;
}

interface WebSocketStatus {
  connected: boolean;
  url: string;
  reconnectAttempts: number;
  lastPing: number;
}

export default function AdvancedSettingsPage() {
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  // State management
  const [settings, setSettings] = useState<AdvancedSettings>({
    developerMode: false,
    networkLogging: false,
    performanceMetrics: false,
    consoleLogging: false,
    apiEndpoint: process.env.NEXT_PUBLIC_API_URL || 'https://api.neolith.app',
    logLevel: 'info',
    featureFlags: {
      newUI: false,
      betaFeatures: false,
      advancedSearch: false,
    },
    experimentalFeatures: {
      aiAssistant: false,
      realtimeCollaboration: false,
      offlineMode: false,
      customThemes: false,
    },
  });

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memory: 0,
    renderTime: 0,
    apiCalls: 0,
    cacheSize: 0,
  });

  const [wsStatus, setWsStatus] = useState<WebSocketStatus>({
    connected: false,
    url: '',
    reconnectAttempts: 0,
    lastPing: 0,
  });

  const [clearCacheDialog, setClearCacheDialog] = useState(false);
  const [resetSettingsDialog, setResetSettingsDialog] = useState(false);

  useEffect(() => {
    setPageHeader(
      'Advanced Settings',
      'Developer tools and advanced configuration'
    );

    // Load settings from localStorage
    const savedSettings = localStorage.getItem('advanced-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to load advanced settings:', error);
      }
    }

    // Initialize metrics tracking
    if (settings.performanceMetrics) {
      startMetricsTracking();
    }

    // Check WebSocket status
    checkWebSocketStatus();

    return () => {
      if (metricsInterval) {
        clearInterval(metricsInterval);
      }
    };
  }, [setPageHeader]);

  let metricsInterval: NodeJS.Timeout | null = null;

  // Update settings and save to localStorage
  const updateSettings = (updates: Partial<AdvancedSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    localStorage.setItem('advanced-settings', JSON.stringify(newSettings));

    toast({
      title: 'Settings updated',
      description: 'Advanced settings have been saved.',
    });
  };

  // Start performance metrics tracking
  const startMetricsTracking = () => {
    metricsInterval = setInterval(() => {
      const performance = window.performance;
      const memory = (performance as any).memory;

      setMetrics({
        fps: Math.round(1000 / (performance.now() % 1000)),
        memory: memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0,
        renderTime: Math.round(performance.now() % 100),
        apiCalls: parseInt(localStorage.getItem('api-call-count') || '0'),
        cacheSize: calculateCacheSize(),
      });
    }, 1000);
  };

  // Calculate localStorage cache size
  const calculateCacheSize = (): number => {
    let totalSize = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    return Math.round(totalSize / 1024); // Convert to KB
  };

  // Check WebSocket connection status
  const checkWebSocketStatus = () => {
    // Mock WebSocket status - replace with actual WebSocket implementation
    setWsStatus({
      connected: Math.random() > 0.5,
      url: 'wss://ws.neolith.app',
      reconnectAttempts: Math.floor(Math.random() * 3),
      lastPing: Date.now() - Math.floor(Math.random() * 5000),
    });
  };

  // Clear cache handler
  const handleClearCache = () => {
    const keysToKeep = ['auth-token', 'user-session', 'advanced-settings'];
    const keysToRemove: string[] = [];

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key) && !keysToKeep.includes(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    toast({
      title: 'Cache cleared',
      description: `Removed ${keysToRemove.length} cached items.`,
    });

    setClearCacheDialog(false);
  };

  // Reset all advanced settings
  const handleResetSettings = () => {
    const defaultSettings: AdvancedSettings = {
      developerMode: false,
      networkLogging: false,
      performanceMetrics: false,
      consoleLogging: false,
      apiEndpoint: process.env.NEXT_PUBLIC_API_URL || 'https://api.neolith.app',
      logLevel: 'info',
      featureFlags: {
        newUI: false,
        betaFeatures: false,
        advancedSearch: false,
      },
      experimentalFeatures: {
        aiAssistant: false,
        realtimeCollaboration: false,
        offlineMode: false,
        customThemes: false,
      },
    };

    setSettings(defaultSettings);
    localStorage.setItem('advanced-settings', JSON.stringify(defaultSettings));

    toast({
      title: 'Settings reset',
      description: 'All advanced settings have been reset to defaults.',
    });

    setResetSettingsDialog(false);
  };

  // Copy debug info to clipboard
  const copyDebugInfo = () => {
    const debugInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      cookiesEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      settings,
      metrics,
      wsStatus,
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));

    toast({
      title: 'Debug info copied',
      description: 'Debug information has been copied to clipboard.',
    });
  };

  // Export logs handler
  const exportLogs = () => {
    const logs = localStorage.getItem('app-logs') || '[]';
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neolith-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Logs exported',
      description: 'Application logs have been downloaded.',
    });
  };

  return (
    <div className='space-y-6 max-w-4xl'>
      {/* Warning Alert */}
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertTitle>Advanced Settings</AlertTitle>
        <AlertDescription>
          These settings are intended for developers and advanced users.
          Changing these settings may affect application behavior and
          performance. Proceed with caution.
        </AlertDescription>
      </Alert>

      {/* Developer Mode Section */}
      <SettingsSection
        title='Developer Mode'
        description='Enable advanced debugging and development features'
      >
        <SettingsGroup>
          <SettingsRow
            label='Developer Mode'
            description='Enable developer tools and debugging features'
            htmlFor='developer-mode'
          >
            <Switch
              id='developer-mode'
              checked={settings.developerMode}
              onCheckedChange={checked =>
                updateSettings({ developerMode: checked })
              }
            />
          </SettingsRow>

          <SettingsRow
            label='Console Logging'
            description='Log application events to browser console'
            htmlFor='console-logging'
          >
            <Switch
              id='console-logging'
              checked={settings.consoleLogging}
              onCheckedChange={checked =>
                updateSettings({ consoleLogging: checked })
              }
              disabled={!settings.developerMode}
            />
          </SettingsRow>

          <SettingsRow
            label='Log Level'
            description='Set the minimum log level to display'
            htmlFor='log-level'
          >
            <Select
              value={settings.logLevel}
              onValueChange={(value: any) =>
                updateSettings({ logLevel: value })
              }
              disabled={!settings.developerMode}
            >
              <SelectTrigger id='log-level' className='w-[180px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='debug'>
                  <div className='flex items-center gap-2'>
                    <Bug className='h-4 w-4' />
                    Debug
                  </div>
                </SelectItem>
                <SelectItem value='info'>
                  <div className='flex items-center gap-2'>
                    <Terminal className='h-4 w-4' />
                    Info
                  </div>
                </SelectItem>
                <SelectItem value='warn'>
                  <div className='flex items-center gap-2'>
                    <AlertCircle className='h-4 w-4' />
                    Warning
                  </div>
                </SelectItem>
                <SelectItem value='error'>
                  <div className='flex items-center gap-2'>
                    <AlertCircle className='h-4 w-4 text-destructive' />
                    Error
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {/* Network & Performance Section */}
      <SettingsSection
        title='Network & Performance'
        description='Monitor and configure network and performance settings'
      >
        <SettingsGroup title='Network Monitoring'>
          <SettingsRow
            label='Network Request Logging'
            description='Log all API requests and responses'
            htmlFor='network-logging'
          >
            <Switch
              id='network-logging'
              checked={settings.networkLogging}
              onCheckedChange={checked =>
                updateSettings({ networkLogging: checked })
              }
            />
          </SettingsRow>

          <SettingsRow
            label='Performance Metrics'
            description='Display real-time performance metrics'
            htmlFor='performance-metrics'
          >
            <Switch
              id='performance-metrics'
              checked={settings.performanceMetrics}
              onCheckedChange={checked => {
                updateSettings({ performanceMetrics: checked });
                if (checked) {
                  startMetricsTracking();
                } else if (metricsInterval) {
                  clearInterval(metricsInterval);
                }
              }}
            />
          </SettingsRow>
        </SettingsGroup>

        {/* Performance Metrics Display */}
        {settings.performanceMetrics && (
          <Card className='mt-4 bg-muted/50'>
            <CardHeader>
              <CardTitle className='text-sm flex items-center gap-2'>
                <Zap className='h-4 w-4' />
                Live Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className='grid grid-cols-2 md:grid-cols-5 gap-4'>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>FPS</p>
                <p className='text-2xl font-bold'>{metrics.fps}</p>
              </div>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>Memory (MB)</p>
                <p className='text-2xl font-bold'>{metrics.memory}</p>
              </div>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>Render (ms)</p>
                <p className='text-2xl font-bold'>{metrics.renderTime}</p>
              </div>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>API Calls</p>
                <p className='text-2xl font-bold'>{metrics.apiCalls}</p>
              </div>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>Cache (KB)</p>
                <p className='text-2xl font-bold'>{metrics.cacheSize}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* WebSocket Status */}
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle className='text-sm flex items-center gap-2'>
              {wsStatus.connected ? (
                <Wifi className='h-4 w-4 text-green-600' />
              ) : (
                <WifiOff className='h-4 w-4 text-destructive' />
              )}
              WebSocket Connection
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>Status</span>
              <Badge variant={wsStatus.connected ? 'default' : 'destructive'}>
                {wsStatus.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>URL</span>
              <span className='text-sm font-mono'>{wsStatus.url}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>
                Reconnect Attempts
              </span>
              <span className='text-sm'>{wsStatus.reconnectAttempts}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>Last Ping</span>
              <span className='text-sm'>
                {Math.round((Date.now() - wsStatus.lastPing) / 1000)}s ago
              </span>
            </div>
            <Button
              variant='outline'
              size='sm'
              className='w-full'
              onClick={checkWebSocketStatus}
            >
              <Network className='h-4 w-4 mr-2' />
              Reconnect
            </Button>
          </CardContent>
        </Card>
      </SettingsSection>

      {/* API Configuration Section */}
      <SettingsSection
        title='API Configuration'
        description='Configure API endpoint for self-hosted instances'
      >
        <SettingsGroup>
          <SettingsRow
            label='API Endpoint'
            description='Base URL for API requests (requires app restart)'
            htmlFor='api-endpoint'
          >
            <div className='flex gap-2 w-full max-w-md'>
              <Input
                id='api-endpoint'
                type='url'
                value={settings.apiEndpoint}
                onChange={e => updateSettings({ apiEndpoint: e.target.value })}
                placeholder='https://api.neolith.app'
                className='flex-1'
              />
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  updateSettings({
                    apiEndpoint:
                      process.env.NEXT_PUBLIC_API_URL ||
                      'https://api.neolith.app',
                  })
                }
              >
                Reset
              </Button>
            </div>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {/* Feature Flags Section */}
      <SettingsSection
        title='Feature Flags'
        description='Enable or disable specific features'
      >
        <SettingsGroup>
          {Object.entries(settings.featureFlags).map(([key, value]) => (
            <SettingsRow
              key={key}
              label={key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())}
              description={`Toggle the ${key} feature flag`}
              htmlFor={`flag-${key}`}
            >
              <Switch
                id={`flag-${key}`}
                checked={value}
                onCheckedChange={checked =>
                  updateSettings({
                    featureFlags: {
                      ...settings.featureFlags,
                      [key]: checked,
                    },
                  })
                }
              />
            </SettingsRow>
          ))}
        </SettingsGroup>
      </SettingsSection>

      {/* Experimental Features Section */}
      <SettingsSection
        title='Experimental Features'
        description='Enable experimental features (may be unstable)'
      >
        <Alert className='mb-4'>
          <FlaskConical className='h-4 w-4' />
          <AlertTitle>Experimental</AlertTitle>
          <AlertDescription>
            These features are in active development and may not work as
            expected.
          </AlertDescription>
        </Alert>

        <SettingsGroup>
          {Object.entries(settings.experimentalFeatures).map(([key, value]) => {
            const labelText = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());

            return (
              <div
                key={key}
                className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'
              >
                <div className='flex-1 space-y-1'>
                  <div className='flex items-center gap-2'>
                    <label
                      htmlFor={`experimental-${key}`}
                      className='text-sm font-medium leading-none cursor-pointer'
                    >
                      {labelText}
                    </label>
                    <Badge variant='outline' className='text-xs'>
                      Experimental
                    </Badge>
                  </div>
                  <p className='text-sm text-muted-foreground leading-relaxed'>
                    Enable the experimental {key} feature
                  </p>
                </div>
                <div className='flex items-center sm:flex-shrink-0'>
                  <Switch
                    id={`experimental-${key}`}
                    checked={value}
                    onCheckedChange={checked =>
                      updateSettings({
                        experimentalFeatures: {
                          ...settings.experimentalFeatures,
                          [key]: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </SettingsGroup>
      </SettingsSection>

      {/* Cache & Storage Management */}
      <SettingsSection
        title='Cache & Storage'
        description='Manage local storage and application cache'
      >
        <SettingsGroup>
          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 border rounded-lg'>
              <div className='space-y-1'>
                <h4 className='text-sm font-medium'>Clear Application Cache</h4>
                <p className='text-sm text-muted-foreground'>
                  Remove all cached data except authentication
                </p>
              </div>
              <Button
                variant='destructive'
                size='sm'
                onClick={() => setClearCacheDialog(true)}
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Clear Cache
              </Button>
            </div>

            <div className='flex items-center justify-between p-4 border rounded-lg'>
              <div className='space-y-1'>
                <h4 className='text-sm font-medium'>Cache Size</h4>
                <p className='text-sm text-muted-foreground'>
                  Current localStorage usage
                </p>
              </div>
              <div className='text-right'>
                <p className='text-2xl font-bold'>{metrics.cacheSize} KB</p>
                <p className='text-xs text-muted-foreground'>
                  {Object.keys(localStorage).length} items
                </p>
              </div>
            </div>
          </div>
        </SettingsGroup>
      </SettingsSection>

      {/* Debug Information Section */}
      <SettingsSection
        title='Debug Information'
        description='System and application debug information'
      >
        <SettingsGroup>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm flex items-center gap-2'>
                <Code className='h-4 w-4' />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 text-sm font-mono'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>User Agent:</span>
                <span className='text-right text-xs break-all max-w-xs'>
                  {navigator.userAgent}
                </span>
              </div>
              <Separator />
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Platform:</span>
                <span>{navigator.platform}</span>
              </div>
              <Separator />
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Language:</span>
                <span>{navigator.language}</span>
              </div>
              <Separator />
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Screen:</span>
                <span>
                  {window.screen.width}x{window.screen.height}
                </span>
              </div>
              <Separator />
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Viewport:</span>
                <span>
                  {window.innerWidth}x{window.innerHeight}
                </span>
              </div>
              <Separator />
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Online:</span>
                <Badge variant={navigator.onLine ? 'default' : 'destructive'}>
                  {navigator.onLine ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className='flex gap-2 pt-4'>
            <Button
              variant='outline'
              onClick={copyDebugInfo}
              className='flex-1'
            >
              <Database className='h-4 w-4 mr-2' />
              Copy Debug Info
            </Button>
            <Button variant='outline' onClick={exportLogs} className='flex-1'>
              <Server className='h-4 w-4 mr-2' />
              Export Logs
            </Button>
          </div>
        </SettingsGroup>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title='Danger Zone' description='Irreversible actions'>
        <Alert variant='destructive' className='mb-4'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Actions in this section cannot be undone. Proceed with caution.
          </AlertDescription>
        </Alert>

        <div className='flex items-center justify-between p-4 border border-destructive rounded-lg'>
          <div className='space-y-1'>
            <h4 className='text-sm font-medium'>Reset Advanced Settings</h4>
            <p className='text-sm text-muted-foreground'>
              Reset all advanced settings to default values
            </p>
          </div>
          <Button
            variant='destructive'
            size='sm'
            onClick={() => setResetSettingsDialog(true)}
          >
            <Settings2 className='h-4 w-4 mr-2' />
            Reset Settings
          </Button>
        </div>
      </SettingsSection>

      {/* Clear Cache Confirmation Dialog */}
      <Dialog open={clearCacheDialog} onOpenChange={setClearCacheDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Application Cache?</DialogTitle>
            <DialogDescription>
              This will remove all cached data except your authentication
              session. You may need to reload the page for changes to take
              effect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setClearCacheDialog(false)}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleClearCache}>
              Clear Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Settings Confirmation Dialog */}
      <Dialog open={resetSettingsDialog} onOpenChange={setResetSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Advanced Settings?</DialogTitle>
            <DialogDescription>
              This will reset all advanced settings including feature flags,
              experimental features, and developer options to their default
              values. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setResetSettingsDialog(false)}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleResetSettings}>
              Reset All Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
