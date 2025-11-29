'use client';

import { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';

export interface SecurityConfig {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays: number;
  };
  sessionConfig: {
    timeout: number;
    maxConcurrentSessions: number;
    rememberMeDays: number;
  };
  mfaConfig: {
    required: boolean;
    allowedMethods: ('totp' | 'sms' | 'email')[];
    gracePeriodDays: number;
  };
  domainRestrictions: {
    enabled: boolean;
    allowedDomains: string[];
    mode: 'whitelist' | 'blacklist';
  };
  ipWhitelist: {
    enabled: boolean;
    addresses: string[];
  };
  ssoConfig: {
    enabled: boolean;
    provider?: 'google' | 'azure' | 'okta' | 'saml';
    domain?: string;
    clientId?: string;
    enforced: boolean;
  };
}

/**
 * Props for the SecuritySettings component.
 */
export interface SecuritySettingsProps {
  /** The workspace ID to manage security settings for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

const DEFAULT_CONFIG: SecurityConfig = {
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    expiryDays: 0,
  },
  sessionConfig: {
    timeout: 24,
    maxConcurrentSessions: 5,
    rememberMeDays: 30,
  },
  mfaConfig: {
    required: false,
    allowedMethods: ['totp', 'email'],
    gracePeriodDays: 7,
  },
  domainRestrictions: {
    enabled: false,
    allowedDomains: [],
    mode: 'whitelist',
  },
  ipWhitelist: {
    enabled: false,
    addresses: [],
  },
  ssoConfig: {
    enabled: false,
    enforced: false,
  },
};

export function SecuritySettings({ workspaceId, className }: SecuritySettingsProps) {
  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['password', 'session', 'mfa']),
  );
  const [newDomain, setNewDomain] = useState('');
  const [newIp, setNewIp] = useState('');

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/security`);
      if (!response.ok) {
        throw new Error('Failed to fetch security settings');
      }
      const data = await response.json();
      setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security settings');
      console.error('Failed to fetch security settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save security settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save security settings');
      console.error('Failed to save security settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const addDomain = () => {
    if (newDomain && !config.domainRestrictions.allowedDomains.includes(newDomain)) {
      setConfig((prev) => ({
        ...prev,
        domainRestrictions: {
          ...prev.domainRestrictions,
          allowedDomains: [...prev.domainRestrictions.allowedDomains, newDomain],
        },
      }));
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setConfig((prev) => ({
      ...prev,
      domainRestrictions: {
        ...prev.domainRestrictions,
        allowedDomains: prev.domainRestrictions.allowedDomains.filter((d) => d !== domain),
      },
    }));
  };

  const addIp = () => {
    if (newIp && !config.ipWhitelist.addresses.includes(newIp)) {
      setConfig((prev) => ({
        ...prev,
        ipWhitelist: {
          ...prev.ipWhitelist,
          addresses: [...prev.ipWhitelist.addresses, newIp],
        },
      }));
      setNewIp('');
    }
  };

  const removeIp = (ip: string) => {
    setConfig((prev) => ({
      ...prev,
      ipWhitelist: {
        ...prev.ipWhitelist,
        addresses: prev.ipWhitelist.addresses.filter((i) => i !== ip),
      },
    }));
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" role="status" aria-label="Loading security settings" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive font-medium">Error loading security settings</p>
          <p className="text-sm text-destructive/80 mt-1">{error}</p>
          <button
            onClick={() => fetchConfig()}
            className="mt-3 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-sm font-medium"
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Password Policy */}
      <Section
        title="Password Policy"
        description="Configure password requirements for all members"
        expanded={expandedSections.has('password')}
        onToggle={() => toggleSection('password')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Minimum Length
            </label>
            <input
              type="number"
              value={config.passwordPolicy.minLength}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    minLength: parseInt(e.target.value) || 6,
                  },
                }))
              }
              className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
              min={6}
              max={32}
            />
          </div>

          <div className="space-y-2">
            <Toggle
              label="Require uppercase letters"
              checked={config.passwordPolicy.requireUppercase}
              onChange={(checked) =>
                setConfig((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, requireUppercase: checked },
                }))
              }
            />
            <Toggle
              label="Require lowercase letters"
              checked={config.passwordPolicy.requireLowercase}
              onChange={(checked) =>
                setConfig((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, requireLowercase: checked },
                }))
              }
            />
            <Toggle
              label="Require numbers"
              checked={config.passwordPolicy.requireNumbers}
              onChange={(checked) =>
                setConfig((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, requireNumbers: checked },
                }))
              }
            />
            <Toggle
              label="Require special characters"
              checked={config.passwordPolicy.requireSpecialChars}
              onChange={(checked) =>
                setConfig((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, requireSpecialChars: checked },
                }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Password Expiry (days)
            </label>
            <input
              type="number"
              value={config.passwordPolicy.expiryDays}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    expiryDays: parseInt(e.target.value) || 0,
                  },
                }))
              }
              className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
              min={0}
            />
            <p className="mt-1 text-sm text-muted-foreground">0 = never expires</p>
          </div>
        </div>
      </Section>

      {/* Session Configuration */}
      <Section
        title="Session Configuration"
        description="Control session behavior and limits"
        expanded={expandedSections.has('session')}
        onToggle={() => toggleSection('session')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Session Timeout (hours)
            </label>
            <input
              type="number"
              value={config.sessionConfig.timeout}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sessionConfig: {
                    ...prev.sessionConfig,
                    timeout: parseInt(e.target.value) || 1,
                  },
                }))
              }
              className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
              min={1}
              max={168}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Max Concurrent Sessions
            </label>
            <input
              type="number"
              value={config.sessionConfig.maxConcurrentSessions}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sessionConfig: {
                    ...prev.sessionConfig,
                    maxConcurrentSessions: parseInt(e.target.value) || 1,
                  },
                }))
              }
              className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
              min={1}
              max={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Remember Me Duration (days)
            </label>
            <input
              type="number"
              value={config.sessionConfig.rememberMeDays}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sessionConfig: {
                    ...prev.sessionConfig,
                    rememberMeDays: parseInt(e.target.value) || 1,
                  },
                }))
              }
              className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
              min={1}
              max={90}
            />
          </div>
        </div>
      </Section>

      {/* MFA Configuration */}
      <Section
        title="Multi-Factor Authentication"
        description="Configure MFA requirements and methods"
        expanded={expandedSections.has('mfa')}
        onToggle={() => toggleSection('mfa')}
      >
        <div className="space-y-4">
          <Toggle
            label="Require MFA for all members"
            description="All members must enable MFA to access the workspace"
            checked={config.mfaConfig.required}
            onChange={(checked) =>
              setConfig((prev) => ({
                ...prev,
                mfaConfig: { ...prev.mfaConfig, required: checked },
              }))
            }
          />

          {config.mfaConfig.required && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Allowed Methods
                </label>
                <div className="space-y-2">
                  {(['totp', 'sms', 'email'] as const).map((method) => (
                    <label key={method} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.mfaConfig.allowedMethods.includes(method)}
                        onChange={(e) => {
                          const methods = e.target.checked
                            ? [...config.mfaConfig.allowedMethods, method]
                            : config.mfaConfig.allowedMethods.filter((m) => m !== method);
                          setConfig((prev) => ({
                            ...prev,
                            mfaConfig: { ...prev.mfaConfig, allowedMethods: methods },
                          }));
                        }}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm text-foreground capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Grace Period (days)
                </label>
                <input
                  type="number"
                  value={config.mfaConfig.gracePeriodDays}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      mfaConfig: {
                        ...prev.mfaConfig,
                        gracePeriodDays: parseInt(e.target.value) || 0,
                      },
                    }))
                  }
                  className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                  min={0}
                  max={30}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Days new members have to set up MFA
                </p>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Domain Restrictions */}
      <Section
        title="Domain Restrictions"
        description="Restrict sign-ups to specific email domains"
        expanded={expandedSections.has('domain')}
        onToggle={() => toggleSection('domain')}
      >
        <div className="space-y-4">
          <Toggle
            label="Enable domain restrictions"
            checked={config.domainRestrictions.enabled}
            onChange={(checked) =>
              setConfig((prev) => ({
                ...prev,
                domainRestrictions: { ...prev.domainRestrictions, enabled: checked },
              }))
            }
          />

          {config.domainRestrictions.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mode</label>
                <select
                  value={config.domainRestrictions.mode}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      domainRestrictions: {
                        ...prev.domainRestrictions,
                        mode: e.target.value as 'whitelist' | 'blacklist',
                      },
                    }))
                  }
                  className="w-48 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                >
                  <option value="whitelist">Whitelist (allow only)</option>
                  <option value="blacklist">Blacklist (block)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Domains
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    className="flex-1 max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                    onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <button
                    type="button"
                    onClick={addDomain}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.domainRestrictions.allowedDomains.map((domain) => (
                    <span
                      key={domain}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                    >
                      {domain}
                      <button
                        type="button"
                        onClick={() => removeDomain(domain)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* IP Whitelist */}
      <Section
        title="IP Whitelist"
        description="Restrict access to specific IP addresses"
        expanded={expandedSections.has('ip')}
        onToggle={() => toggleSection('ip')}
      >
        <div className="space-y-4">
          <Toggle
            label="Enable IP whitelist"
            description="Only allow access from specified IP addresses"
            checked={config.ipWhitelist.enabled}
            onChange={(checked) =>
              setConfig((prev) => ({
                ...prev,
                ipWhitelist: { ...prev.ipWhitelist, enabled: checked },
              }))
            }
          />

          {config.ipWhitelist.enabled && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                IP Addresses
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="flex-1 max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                  onKeyDown={(e) => e.key === 'Enter' && addIp()}
                />
                <button
                  type="button"
                  onClick={addIp}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.ipWhitelist.addresses.map((ip) => (
                  <span
                    key={ip}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm font-mono"
                  >
                    {ip}
                    <button
                      type="button"
                      onClick={() => removeIp(ip)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* SSO Configuration */}
      <Section
        title="Single Sign-On (SSO)"
        description="Configure enterprise SSO integration"
        expanded={expandedSections.has('sso')}
        onToggle={() => toggleSection('sso')}
      >
        <div className="space-y-4">
          <Toggle
            label="Enable SSO"
            checked={config.ssoConfig.enabled}
            onChange={(checked) =>
              setConfig((prev) => ({
                ...prev,
                ssoConfig: { ...prev.ssoConfig, enabled: checked },
              }))
            }
          />

          {config.ssoConfig.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Provider
                </label>
                <select
                  value={config.ssoConfig.provider || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      ssoConfig: {
                        ...prev.ssoConfig,
                        provider: e.target.value as SecurityConfig['ssoConfig']['provider'],
                      },
                    }))
                  }
                  className="w-48 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                >
                  <option value="">Select provider</option>
                  <option value="google">Google Workspace</option>
                  <option value="azure">Azure AD</option>
                  <option value="okta">Okta</option>
                  <option value="saml">SAML 2.0</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={config.ssoConfig.domain || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      ssoConfig: { ...prev.ssoConfig, domain: e.target.value },
                    }))
                  }
                  placeholder="example.com"
                  className="w-full max-w-xs px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>

              <Toggle
                label="Enforce SSO"
                description="Require all members to sign in via SSO"
                checked={config.ssoConfig.enforced}
                onChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    ssoConfig: { ...prev.ssoConfig, enforced: checked },
                  }))
                }
              />
            </>
          )}
        </div>
      </Section>

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="button"
          onClick={saveConfig}
          disabled={isSaving}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-medium',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  );
}

/**
 * Props for the Section component
 */
interface SectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description: string;
  /** Whether the section is expanded */
  expanded: boolean;
  /** Callback to toggle expanded state */
  onToggle: () => void;
  /** Section content */
  children: React.ReactNode;
}

/**
 * Collapsible section component for organizing security settings
 */
function Section({ title, description, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="border border-border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronIcon
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform',
            expanded ? '' : '-rotate-90',
          )}
        />
      </button>
      {expanded && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

/**
 * Props for the Toggle component
 */
interface ToggleProps {
  /** Toggle label */
  label: string;
  /** Optional description text */
  description?: string;
  /** Current checked state */
  checked: boolean;
  /** Callback when toggle state changes */
  onChange: (checked: boolean) => void;
}

/**
 * Toggle switch component for boolean settings
 */
function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="block text-sm font-medium text-foreground">{label}</label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted',
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

// Icons
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default SecuritySettings;
