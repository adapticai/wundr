'use client';

import {
  Loader2,
  Upload,
  Palette,
  Globe,
  Mail,
  Bell,
  Code,
  Layout,
  Settings,
  Save,
  X,
  Eye,
  Trash2,
  Plus,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Admin Customization Page
 *
 * Comprehensive workspace customization including:
 * - Workspace branding (logo, colors, favicon)
 * - Custom domain settings
 * - Email template customization
 * - Notification templates
 * - Custom CSS injection
 * - Sidebar customization
 * - Feature toggles
 */

interface CustomizationSettings {
  // Branding
  logo: string;
  logoText: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Custom Domain
  customDomain: string;
  domainVerified: boolean;
  sslEnabled: boolean;

  // Email Templates
  emailFromName: string;
  emailReplyTo: string;
  emailFooter: string;
  welcomeEmailEnabled: boolean;
  welcomeEmailSubject: string;
  welcomeEmailBody: string;

  // Notification Templates
  notificationBrandingEnabled: boolean;
  notificationIcon: string;
  notificationSound: string;

  // Custom CSS
  customCss: string;
  customCssEnabled: boolean;

  // Sidebar
  sidebarPosition: 'left' | 'right';
  sidebarCollapsible: boolean;
  sidebarDefaultCollapsed: boolean;
  sidebarItems: Array<{
    id: string;
    label: string;
    icon: string;
    url: string;
    enabled: boolean;
  }>;

  // Feature Toggles
  features: {
    fileSharing: boolean;
    videoChat: boolean;
    screenSharing: boolean;
    messageReactions: boolean;
    messageThreads: boolean;
    messageEditing: boolean;
    userStatus: boolean;
    richTextEditor: boolean;
    codeSnippets: boolean;
    polls: boolean;
    workflowAutomation: boolean;
    apiAccess: boolean;
  };
}

export default function CustomizationPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<CustomizationSettings>({
    logo: '',
    logoText: '',
    favicon: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    accentColor: '#10b981',
    customDomain: '',
    domainVerified: false,
    sslEnabled: true,
    emailFromName: '',
    emailReplyTo: '',
    emailFooter: '',
    welcomeEmailEnabled: true,
    welcomeEmailSubject: 'Welcome to {{workspace}}!',
    welcomeEmailBody: 'Hi {{name}},\n\nWelcome to {{workspace}}! We\'re excited to have you on board.\n\nBest regards,\nThe Team',
    notificationBrandingEnabled: true,
    notificationIcon: '',
    notificationSound: 'default',
    customCss: '',
    customCssEnabled: false,
    sidebarPosition: 'left',
    sidebarCollapsible: true,
    sidebarDefaultCollapsed: false,
    sidebarItems: [
      { id: '1', label: 'Dashboard', icon: 'Home', url: '/dashboard', enabled: true },
      { id: '2', label: 'Messages', icon: 'MessageSquare', url: '/messages', enabled: true },
      { id: '3', label: 'Channels', icon: 'Hash', url: '/channels', enabled: true },
      { id: '4', label: 'Files', icon: 'Folder', url: '/files', enabled: true },
    ],
    features: {
      fileSharing: true,
      videoChat: true,
      screenSharing: true,
      messageReactions: true,
      messageThreads: true,
      messageEditing: true,
      userStatus: true,
      richTextEditor: true,
      codeSnippets: true,
      polls: false,
      workflowAutomation: false,
      apiAccess: true,
    },
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/customization`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.customization) {
            setSettings(prev => ({ ...prev, ...data.customization }));
          }
        }
      } catch (error) {
        console.error('Failed to load customization settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, [workspaceSlug]);

  const handleLogoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Logo size must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }

      setIsUploadingLogo(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'logo');

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/customization/upload`,
          { method: 'POST', body: formData },
        );

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        setSettings(prev => ({ ...prev, logo: data.url }));

        toast({
          title: 'Success',
          description: 'Logo uploaded successfully',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to upload logo',
          variant: 'destructive',
        });
      } finally {
        setIsUploadingLogo(false);
        if (logoInputRef.current) logoInputRef.current.value = '';
      }
    },
    [workspaceSlug, toast],
  );

  const handleFaviconUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 1 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Favicon size must be less than 1MB',
          variant: 'destructive',
        });
        return;
      }

      setIsUploadingFavicon(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'favicon');

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/customization/upload`,
          { method: 'POST', body: formData },
        );

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        setSettings(prev => ({ ...prev, favicon: data.url }));

        toast({
          title: 'Success',
          description: 'Favicon uploaded successfully',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to upload favicon',
          variant: 'destructive',
        });
      } finally {
        setIsUploadingFavicon(false);
        if (faviconInputRef.current) faviconInputRef.current.value = '';
      }
    },
    [workspaceSlug, toast],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/customization`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: 'Success',
        description: 'Customization settings saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save customization settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, settings, toast]);

  const handleVerifyDomain = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/customization/verify-domain`,
        { method: 'POST' },
      );

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const data = await response.json();
      setSettings(prev => ({ ...prev, domainVerified: data.verified }));

      toast({
        title: data.verified ? 'Success' : 'Pending',
        description: data.verified
          ? 'Domain verified successfully'
          : 'Domain verification in progress. Please check DNS records.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to verify domain',
        variant: 'destructive',
      });
    }
  }, [workspaceSlug, toast]);

  if (isLoading) {
    return <CustomizationSkeleton />;
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Customization</h1>
          <p className='mt-1 text-muted-foreground'>
            Customize your workspace branding, appearance, and features
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Saving...
            </>
          ) : (
            <>
              <Save className='h-4 w-4 mr-2' />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue='branding' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='branding'>
            <Palette className='h-4 w-4 mr-2' />
            Branding
          </TabsTrigger>
          <TabsTrigger value='domain'>
            <Globe className='h-4 w-4 mr-2' />
            Domain
          </TabsTrigger>
          <TabsTrigger value='email'>
            <Mail className='h-4 w-4 mr-2' />
            Email
          </TabsTrigger>
          <TabsTrigger value='notifications'>
            <Bell className='h-4 w-4 mr-2' />
            Notifications
          </TabsTrigger>
          <TabsTrigger value='custom-css'>
            <Code className='h-4 w-4 mr-2' />
            Custom CSS
          </TabsTrigger>
          <TabsTrigger value='sidebar'>
            <Layout className='h-4 w-4 mr-2' />
            Sidebar
          </TabsTrigger>
          <TabsTrigger value='features'>
            <Settings className='h-4 w-4 mr-2' />
            Features
          </TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value='branding' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Workspace Branding</CardTitle>
              <CardDescription>
                Customize your workspace logo, colors, and visual identity
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Logo Upload */}
              <div className='space-y-3'>
                <Label>Workspace Logo</Label>
                <div className='flex items-center gap-4'>
                  <div className='relative h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted'>
                    {settings.logo ? (
                      <img
                        src={settings.logo}
                        alt='Logo'
                        className='h-full w-full object-contain'
                      />
                    ) : (
                      <Upload className='h-8 w-8 text-muted-foreground' />
                    )}
                    {isUploadingLogo && (
                      <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
                        <Loader2 className='h-6 w-6 animate-spin text-white' />
                      </div>
                    )}
                  </div>
                  <div className='flex gap-2'>
                    <label htmlFor='logo-upload'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={isUploadingLogo}
                        asChild
                      >
                        <span>
                          <Upload className='h-4 w-4 mr-2' />
                          {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                        </span>
                      </Button>
                    </label>
                    {settings.logo && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setSettings(prev => ({ ...prev, logo: '' }))
                        }
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    id='logo-upload'
                    type='file'
                    accept='image/png,image/jpeg,image/svg+xml'
                    className='hidden'
                    onChange={handleLogoUpload}
                  />
                </div>
                <p className='text-xs text-muted-foreground'>
                  PNG, JPG, or SVG. Max 5MB. Recommended size: 200x200px
                </p>
              </div>

              {/* Logo Text */}
              <div className='space-y-2'>
                <Label htmlFor='logo-text'>Logo Text (Optional)</Label>
                <Input
                  id='logo-text'
                  value={settings.logoText}
                  onChange={e =>
                    setSettings(prev => ({ ...prev, logoText: e.target.value }))
                  }
                  placeholder='Enter text to display next to logo'
                />
              </div>

              {/* Favicon */}
              <div className='space-y-3'>
                <Label>Favicon</Label>
                <div className='flex items-center gap-4'>
                  <div className='relative h-12 w-12 rounded border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted'>
                    {settings.favicon ? (
                      <img
                        src={settings.favicon}
                        alt='Favicon'
                        className='h-full w-full object-contain'
                      />
                    ) : (
                      <Upload className='h-5 w-5 text-muted-foreground' />
                    )}
                    {isUploadingFavicon && (
                      <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
                        <Loader2 className='h-4 w-4 animate-spin text-white' />
                      </div>
                    )}
                  </div>
                  <div className='flex gap-2'>
                    <label htmlFor='favicon-upload'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={isUploadingFavicon}
                        asChild
                      >
                        <span>
                          <Upload className='h-4 w-4 mr-2' />
                          {isUploadingFavicon
                            ? 'Uploading...'
                            : 'Upload Favicon'}
                        </span>
                      </Button>
                    </label>
                    {settings.favicon && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setSettings(prev => ({ ...prev, favicon: '' }))
                        }
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={faviconInputRef}
                    id='favicon-upload'
                    type='file'
                    accept='image/png,image/x-icon'
                    className='hidden'
                    onChange={handleFaviconUpload}
                  />
                </div>
                <p className='text-xs text-muted-foreground'>
                  PNG or ICO. Max 1MB. Recommended size: 32x32px or 64x64px
                </p>
              </div>

              {/* Color Scheme */}
              <div className='space-y-4 pt-4 border-t'>
                <Label>Color Scheme</Label>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <ColorPicker
                    label='Primary Color'
                    color={settings.primaryColor}
                    onChange={color =>
                      setSettings(prev => ({ ...prev, primaryColor: color }))
                    }
                  />
                  <ColorPicker
                    label='Secondary Color'
                    color={settings.secondaryColor}
                    onChange={color =>
                      setSettings(prev => ({ ...prev, secondaryColor: color }))
                    }
                  />
                  <ColorPicker
                    label='Accent Color'
                    color={settings.accentColor}
                    onChange={color =>
                      setSettings(prev => ({ ...prev, accentColor: color }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value='domain' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>
                Configure a custom domain for your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='custom-domain'>Custom Domain</Label>
                <div className='flex gap-2'>
                  <Input
                    id='custom-domain'
                    value={settings.customDomain}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        customDomain: e.target.value,
                      }))
                    }
                    placeholder='workspace.company.com'
                  />
                  <Button onClick={handleVerifyDomain} variant='outline'>
                    {settings.domainVerified ? (
                      <>
                        <Eye className='h-4 w-4 mr-2' />
                        Verified
                      </>
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
                {settings.domainVerified && (
                  <Badge variant='default'>Domain Verified</Badge>
                )}
              </div>

              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label>SSL/HTTPS</Label>
                  <p className='text-sm text-muted-foreground'>
                    Enable secure HTTPS connection
                  </p>
                </div>
                <Switch
                  checked={settings.sslEnabled}
                  onCheckedChange={checked =>
                    setSettings(prev => ({ ...prev, sslEnabled: checked }))
                  }
                />
              </div>

              <div className='rounded-lg bg-muted p-4 space-y-2'>
                <h4 className='font-medium text-sm'>DNS Configuration</h4>
                <p className='text-sm text-muted-foreground'>
                  Add the following DNS records to your domain:
                </p>
                <div className='font-mono text-xs bg-background rounded p-3 space-y-1'>
                  <div>Type: CNAME</div>
                  <div>Name: workspace (or your subdomain)</div>
                  <div>Value: app.neolith.io</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value='email' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Email Customization</CardTitle>
              <CardDescription>
                Customize email templates and settings
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='email-from-name'>From Name</Label>
                  <Input
                    id='email-from-name'
                    value={settings.emailFromName}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        emailFromName: e.target.value,
                      }))
                    }
                    placeholder='Your Workspace'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='email-reply-to'>Reply-To Email</Label>
                  <Input
                    id='email-reply-to'
                    type='email'
                    value={settings.emailReplyTo}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        emailReplyTo: e.target.value,
                      }))
                    }
                    placeholder='support@company.com'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='email-footer'>Email Footer</Label>
                <Textarea
                  id='email-footer'
                  value={settings.emailFooter}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      emailFooter: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder='Include your company address and unsubscribe link'
                />
              </div>

              <div className='space-y-4 pt-4 border-t'>
                <div className='flex items-center justify-between'>
                  <Label>Welcome Email</Label>
                  <Switch
                    checked={settings.welcomeEmailEnabled}
                    onCheckedChange={checked =>
                      setSettings(prev => ({
                        ...prev,
                        welcomeEmailEnabled: checked,
                      }))
                    }
                  />
                </div>

                {settings.welcomeEmailEnabled && (
                  <>
                    <div className='space-y-2'>
                      <Label htmlFor='welcome-subject'>Subject Line</Label>
                      <Input
                        id='welcome-subject'
                        value={settings.welcomeEmailSubject}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            welcomeEmailSubject: e.target.value,
                          }))
                        }
                        placeholder='Welcome to {{workspace}}!'
                      />
                      <p className='text-xs text-muted-foreground'>
                        Available variables: {'{'}
                        {'{'}name{'}'}
                        {'}'}, {'{'}
                        {'{'}workspace{'}'}
                        {'}'}
                      </p>
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='welcome-body'>Email Body</Label>
                      <Textarea
                        id='welcome-body'
                        value={settings.welcomeEmailBody}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            welcomeEmailBody: e.target.value,
                          }))
                        }
                        rows={8}
                        placeholder='Hi {{name}},&#10;&#10;Welcome to {{workspace}}!'
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value='notifications' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Notification Templates</CardTitle>
              <CardDescription>
                Customize notification appearance and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label>Branded Notifications</Label>
                  <p className='text-sm text-muted-foreground'>
                    Use workspace branding in notifications
                  </p>
                </div>
                <Switch
                  checked={settings.notificationBrandingEnabled}
                  onCheckedChange={checked =>
                    setSettings(prev => ({
                      ...prev,
                      notificationBrandingEnabled: checked,
                    }))
                  }
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='notification-sound'>Notification Sound</Label>
                <Select
                  value={settings.notificationSound}
                  onValueChange={value =>
                    setSettings(prev => ({ ...prev, notificationSound: value }))
                  }
                >
                  <SelectTrigger id='notification-sound'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='default'>Default</SelectItem>
                    <SelectItem value='chime'>Chime</SelectItem>
                    <SelectItem value='ding'>Ding</SelectItem>
                    <SelectItem value='pop'>Pop</SelectItem>
                    <SelectItem value='none'>None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom CSS Tab */}
        <TabsContent value='custom-css' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Custom CSS</CardTitle>
              <CardDescription>
                Add custom CSS to further customize your workspace appearance
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label>Enable Custom CSS</Label>
                  <p className='text-sm text-muted-foreground'>
                    Apply custom styles to your workspace
                  </p>
                </div>
                <Switch
                  checked={settings.customCssEnabled}
                  onCheckedChange={checked =>
                    setSettings(prev => ({ ...prev, customCssEnabled: checked }))
                  }
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='custom-css'>Custom CSS Code</Label>
                <Textarea
                  id='custom-css'
                  value={settings.customCss}
                  onChange={e =>
                    setSettings(prev => ({ ...prev, customCss: e.target.value }))
                  }
                  rows={12}
                  className='font-mono text-sm'
                  placeholder='/* Add your custom CSS here */&#10;.workspace-header {&#10;  background: linear-gradient(to right, #667eea 0%, #764ba2 100%);&#10;}'
                />
                <p className='text-xs text-muted-foreground'>
                  Advanced feature. Improper CSS may break the layout.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sidebar Tab */}
        <TabsContent value='sidebar' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Sidebar Customization</CardTitle>
              <CardDescription>
                Configure sidebar behavior and navigation items
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='sidebar-position'>Sidebar Position</Label>
                <Select
                  value={settings.sidebarPosition}
                  onValueChange={(value: 'left' | 'right') =>
                    setSettings(prev => ({ ...prev, sidebarPosition: value }))
                  }
                >
                  <SelectTrigger id='sidebar-position'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='left'>Left</SelectItem>
                    <SelectItem value='right'>Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label>Collapsible Sidebar</Label>
                  <p className='text-sm text-muted-foreground'>
                    Allow users to collapse the sidebar
                  </p>
                </div>
                <Switch
                  checked={settings.sidebarCollapsible}
                  onCheckedChange={checked =>
                    setSettings(prev => ({ ...prev, sidebarCollapsible: checked }))
                  }
                />
              </div>

              {settings.sidebarCollapsible && (
                <div className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <Label>Default Collapsed</Label>
                    <p className='text-sm text-muted-foreground'>
                      Start with sidebar collapsed
                    </p>
                  </div>
                  <Switch
                    checked={settings.sidebarDefaultCollapsed}
                    onCheckedChange={checked =>
                      setSettings(prev => ({
                        ...prev,
                        sidebarDefaultCollapsed: checked,
                      }))
                    }
                  />
                </div>
              )}

              <div className='space-y-4 pt-4 border-t'>
                <div className='flex items-center justify-between'>
                  <Label>Navigation Items</Label>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const newItem = {
                        id: Date.now().toString(),
                        label: 'New Item',
                        icon: 'Circle',
                        url: '/new',
                        enabled: true,
                      };
                      setSettings(prev => ({
                        ...prev,
                        sidebarItems: [...prev.sidebarItems, newItem],
                      }));
                    }}
                  >
                    <Plus className='h-4 w-4 mr-2' />
                    Add Item
                  </Button>
                </div>

                <div className='space-y-2'>
                  {settings.sidebarItems.map((item, index) => (
                    <div
                      key={item.id}
                      className='flex items-center gap-2 p-3 rounded-lg border'
                    >
                      <Switch
                        checked={item.enabled}
                        onCheckedChange={checked => {
                          const newItems = [...settings.sidebarItems];
                          newItems[index].enabled = checked;
                          setSettings(prev => ({
                            ...prev,
                            sidebarItems: newItems,
                          }));
                        }}
                      />
                      <Input
                        value={item.label}
                        onChange={e => {
                          const newItems = [...settings.sidebarItems];
                          newItems[index].label = e.target.value;
                          setSettings(prev => ({
                            ...prev,
                            sidebarItems: newItems,
                          }));
                        }}
                        className='flex-1'
                        placeholder='Label'
                      />
                      <Input
                        value={item.url}
                        onChange={e => {
                          const newItems = [...settings.sidebarItems];
                          newItems[index].url = e.target.value;
                          setSettings(prev => ({
                            ...prev,
                            sidebarItems: newItems,
                          }));
                        }}
                        className='flex-1'
                        placeholder='URL'
                      />
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                          setSettings(prev => ({
                            ...prev,
                            sidebarItems: prev.sidebarItems.filter(
                              i => i.id !== item.id,
                            ),
                          }));
                        }}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value='features' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>
                Enable or disable workspace features
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {Object.entries(settings.features).map(([key, value]) => (
                <div
                  key={key}
                  className='flex items-center justify-between rounded-lg border p-4'
                >
                  <div className='space-y-0.5'>
                    <Label>
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())}
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      {getFeatureDescription(key)}
                    </p>
                  </div>
                  <Switch
                    checked={value}
                    onCheckedChange={checked =>
                      setSettings(prev => ({
                        ...prev,
                        features: { ...prev.features, [key]: checked },
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ColorPicker({
  label,
  color,
  onChange,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            className='w-full justify-start gap-2'
            onClick={() => setIsOpen(!isOpen)}
          >
            <div
              className='h-6 w-6 rounded border'
              style={{ backgroundColor: color }}
            />
            <span className='font-mono text-sm'>{color}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-3'>
          <HexColorPicker color={color} onChange={onChange} />
          <Input
            value={color}
            onChange={e => onChange(e.target.value)}
            className='mt-3 font-mono text-sm'
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function getFeatureDescription(key: string): string {
  const descriptions: Record<string, string> = {
    fileSharing: 'Allow users to share and upload files',
    videoChat: 'Enable video calling functionality',
    screenSharing: 'Allow screen sharing during calls',
    messageReactions: 'Let users react to messages with emojis',
    messageThreads: 'Enable threaded conversations',
    messageEditing: 'Allow users to edit their messages',
    userStatus: 'Show online/offline/away status',
    richTextEditor: 'Use rich text formatting in messages',
    codeSnippets: 'Support syntax-highlighted code blocks',
    polls: 'Create and vote on polls',
    workflowAutomation: 'Enable workflow automation features',
    apiAccess: 'Allow API access for integrations',
  };
  return descriptions[key] || '';
}

function CustomizationSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      <Card>
        <CardHeader>
          <div className='h-6 w-48 animate-pulse rounded bg-muted' />
          <div className='h-4 w-full animate-pulse rounded bg-muted' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='h-10 w-full animate-pulse rounded bg-muted' />
          <div className='h-10 w-full animate-pulse rounded bg-muted' />
          <div className='h-10 w-full animate-pulse rounded bg-muted' />
        </CardContent>
      </Card>
    </div>
  );
}
