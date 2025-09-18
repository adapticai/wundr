'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Code2,
  Database,
  Shield,
  Globe,
  Zap,
  CheckCircle,
  Download,
} from 'lucide-react';

import { ServiceTemplate, TemplateCustomizations } from '@/types/templates';

interface TemplateCustomizerProps {
  template: ServiceTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (
    template: ServiceTemplate,
    customizations: TemplateCustomizations
  ) => void;
}

export function TemplateCustomizer({
  template,
  open,
  onOpenChange,
  onGenerate,
}: TemplateCustomizerProps) {
  const [customizations, setCustomizations] = useState<TemplateCustomizations>({
    variables: {
      projectName: '',
      packageName: '',
      description: '',
      author: '',
      version: '1.0.0',
    },
    options: {
      outputFormat: 'zip' as const,
      includeDocumentation: true,
      includeTests: true,
      includeExamples: false,
      formatCode: true,
    },
    features: {
      authentication: true,
      database: true,
      validation: true,
      logging: true,
      testing: true,
      docker: false,
      kubernetes: false,
      monitoring: false,
      caching: false,
      ratelimiting: false,
    },
    database: {
      type: 'mongodb',
      host: 'localhost',
      port: '27017',
      name: 'myapp',
    },
    authentication: {
      strategy: 'jwt',
      provider: 'local',
      tokenExpiry: '7d',
    },
    api: {
      version: 'v1',
      prefix: '/api',
      cors: true,
      helmet: true,
    },
    deployment: {
      platform: 'docker',
      registry: 'docker.hub',
      environment: 'development',
    },
  });

  const handleFeatureToggle = (feature: string, enabled: boolean) => {
    setCustomizations(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled,
      },
    }));
  };

  const handleDatabaseChange = (field: string, value: string) => {
    setCustomizations(prev => ({
      ...prev,
      database: {
        ...prev.database,
        [field]: value,
      },
    }));
  };

  const handleAuthChange = (field: string, value: string) => {
    setCustomizations(prev => ({
      ...prev,
      authentication: {
        ...prev.authentication,
        [field]: value,
      },
    }));
  };

  const handleApiChange = (field: string, value: string | boolean) => {
    setCustomizations(prev => ({
      ...prev,
      api: {
        ...prev.api,
        [field]: value,
      },
    }));
  };

  const handleDeploymentChange = (field: string, value: string) => {
    setCustomizations(prev => ({
      ...prev,
      deployment: {
        ...prev.deployment,
        [field]: value,
      },
    }));
  };

  const handleGenerate = () => {
    onGenerate(template, customizations);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-hidden'>
        <DialogHeader>
          <DialogTitle className='flex items-center'>
            <Settings className='h-5 w-5 mr-2' />
            Customize {template.name}
          </DialogTitle>
          <DialogDescription>
            Configure your service template with custom settings and features
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue='general' className='flex-1'>
          <TabsList className='grid w-full grid-cols-5'>
            <TabsTrigger value='general'>General</TabsTrigger>
            <TabsTrigger value='features'>Features</TabsTrigger>
            <TabsTrigger value='database'>Database</TabsTrigger>
            <TabsTrigger value='auth'>Auth</TabsTrigger>
            <TabsTrigger value='deployment'>Deploy</TabsTrigger>
          </TabsList>

          <div className='mt-4 max-h-[60vh] overflow-hidden'>
            <TabsContent value='general' className='space-y-4'>
              <ScrollArea className='h-[50vh]'>
                <div className='space-y-4 pr-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>
                        Project Information
                      </CardTitle>
                      <CardDescription>
                        Basic information about your project
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='projectName'>Project Name</Label>
                          <Input
                            id='projectName'
                            placeholder='my-awesome-service'
                            value={String(
                              customizations.variables.projectName || ''
                            )}
                            onChange={e =>
                              setCustomizations(prev => ({
                                ...prev,
                                variables: {
                                  ...prev.variables,
                                  projectName: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='packageName'>Package Name</Label>
                          <Input
                            id='packageName'
                            placeholder='@myorg/my-awesome-service'
                            value={String(
                              customizations.variables.packageName || ''
                            )}
                            onChange={e =>
                              setCustomizations(prev => ({
                                ...prev,
                                variables: {
                                  ...prev.variables,
                                  packageName: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='description'>Description</Label>
                        <Input
                          id='description'
                          placeholder='A brief description of your service'
                          value={String(
                            customizations.variables.description || ''
                          )}
                          onChange={e =>
                            setCustomizations(prev => ({
                              ...prev,
                              variables: {
                                ...prev.variables,
                                description: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='author'>Author</Label>
                          <Input
                            id='author'
                            placeholder='Your Name'
                            value={String(
                              customizations.variables.author || ''
                            )}
                            onChange={e =>
                              setCustomizations(prev => ({
                                ...prev,
                                variables: {
                                  ...prev.variables,
                                  author: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='version'>Version</Label>
                          <Input
                            id='version'
                            placeholder='1.0.0'
                            value={String(
                              customizations.variables.version || ''
                            )}
                            onChange={e =>
                              setCustomizations(prev => ({
                                ...prev,
                                variables: {
                                  ...prev.variables,
                                  version: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value='features' className='space-y-4'>
              <ScrollArea className='h-[50vh]'>
                <div className='space-y-4 pr-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>Core Features</CardTitle>
                      <CardDescription>
                        Select the features you want to include in your service
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        {Object.entries(customizations.features || {}).map(
                          ([feature, enabled]) => (
                            <div
                              key={feature}
                              className='flex items-center justify-between p-3 border rounded'
                            >
                              <div className='flex items-center space-x-2'>
                                {feature === 'authentication' && (
                                  <Shield className='h-4 w-4 text-blue-500' />
                                )}
                                {feature === 'database' && (
                                  <Database className='h-4 w-4 text-green-500' />
                                )}
                                {feature === 'validation' && (
                                  <CheckCircle className='h-4 w-4 text-purple-500' />
                                )}
                                {feature === 'logging' && (
                                  <Code2 className='h-4 w-4 text-orange-500' />
                                )}
                                {feature === 'testing' && (
                                  <Zap className='h-4 w-4 text-yellow-500' />
                                )}
                                {feature === 'docker' && (
                                  <Globe className='h-4 w-4 text-blue-600' />
                                )}
                                {feature === 'kubernetes' && (
                                  <Globe className='h-4 w-4 text-blue-700' />
                                )}
                                {feature === 'monitoring' && (
                                  <Settings className='h-4 w-4 text-red-500' />
                                )}
                                {feature === 'caching' && (
                                  <Zap className='h-4 w-4 text-green-600' />
                                )}
                                {feature === 'ratelimiting' && (
                                  <Shield className='h-4 w-4 text-red-600' />
                                )}
                                <span className='font-medium capitalize'>
                                  {feature.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={checked =>
                                  handleFeatureToggle(feature, checked)
                                }
                              />
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value='database' className='space-y-4'>
              <ScrollArea className='h-[50vh]'>
                <div className='space-y-4 pr-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>
                        Database Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure your database connection settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='dbType'>Database Type</Label>
                        <Select
                          value={customizations.database?.type || 'mongodb'}
                          onValueChange={value =>
                            handleDatabaseChange('type', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='mongodb'>MongoDB</SelectItem>
                            <SelectItem value='postgresql'>
                              PostgreSQL
                            </SelectItem>
                            <SelectItem value='mysql'>MySQL</SelectItem>
                            <SelectItem value='sqlite'>SQLite</SelectItem>
                            <SelectItem value='redis'>Redis</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='dbHost'>Host</Label>
                          <Input
                            id='dbHost'
                            placeholder='localhost'
                            value={customizations.database?.host || ''}
                            onChange={e =>
                              handleDatabaseChange('host', e.target.value)
                            }
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='dbPort'>Port</Label>
                          <Input
                            id='dbPort'
                            placeholder='27017'
                            value={customizations.database?.port || ''}
                            onChange={e =>
                              handleDatabaseChange('port', e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='dbName'>Database Name</Label>
                        <Input
                          id='dbName'
                          placeholder='myapp'
                          value={customizations.database?.name || ''}
                          onChange={e =>
                            handleDatabaseChange('name', e.target.value)
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value='auth' className='space-y-4'>
              <ScrollArea className='h-[50vh]'>
                <div className='space-y-4 pr-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>
                        Authentication Settings
                      </CardTitle>
                      <CardDescription>
                        Configure authentication and authorization
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='authStrategy'>Strategy</Label>
                        <Select
                          value={
                            customizations.authentication?.strategy || 'jwt'
                          }
                          onValueChange={value =>
                            handleAuthChange('strategy', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='jwt'>JWT</SelectItem>
                            <SelectItem value='session'>Session</SelectItem>
                            <SelectItem value='oauth'>OAuth</SelectItem>
                            <SelectItem value='basic'>Basic Auth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='authProvider'>Provider</Label>
                        <Select
                          value={
                            customizations.authentication?.provider || 'local'
                          }
                          onValueChange={value =>
                            handleAuthChange('provider', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='local'>Local</SelectItem>
                            <SelectItem value='google'>Google</SelectItem>
                            <SelectItem value='github'>GitHub</SelectItem>
                            <SelectItem value='auth0'>Auth0</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='tokenExpiry'>Token Expiry</Label>
                        <Select
                          value={
                            customizations.authentication?.tokenExpiry || '7d'
                          }
                          onValueChange={value =>
                            handleAuthChange('tokenExpiry', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='1h'>1 Hour</SelectItem>
                            <SelectItem value='24h'>24 Hours</SelectItem>
                            <SelectItem value='7d'>7 Days</SelectItem>
                            <SelectItem value='30d'>30 Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value='deployment' className='space-y-4'>
              <ScrollArea className='h-[50vh]'>
                <div className='space-y-4 pr-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>
                        Deployment Configuration
                      </CardTitle>
                      <CardDescription>
                        Set up deployment and environment settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='platform'>Platform</Label>
                        <Select
                          value={
                            customizations.deployment?.platform || 'docker'
                          }
                          onValueChange={value =>
                            handleDeploymentChange('platform', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='docker'>Docker</SelectItem>
                            <SelectItem value='kubernetes'>
                              Kubernetes
                            </SelectItem>
                            <SelectItem value='heroku'>Heroku</SelectItem>
                            <SelectItem value='vercel'>Vercel</SelectItem>
                            <SelectItem value='aws'>AWS</SelectItem>
                            <SelectItem value='gcp'>Google Cloud</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='registry'>Container Registry</Label>
                        <Select
                          value={
                            customizations.deployment?.registry || 'docker.hub'
                          }
                          onValueChange={value =>
                            handleDeploymentChange('registry', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='docker.hub'>
                              Docker Hub
                            </SelectItem>
                            <SelectItem value='ghcr'>
                              GitHub Container Registry
                            </SelectItem>
                            <SelectItem value='ecr'>AWS ECR</SelectItem>
                            <SelectItem value='gcr'>
                              Google Container Registry
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='environment'>Environment</Label>
                        <Select
                          value={
                            customizations.deployment?.environment ||
                            'development'
                          }
                          onValueChange={value =>
                            handleDeploymentChange('environment', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='development'>
                              Development
                            </SelectItem>
                            <SelectItem value='staging'>Staging</SelectItem>
                            <SelectItem value='production'>
                              Production
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <Separator />

        <div className='flex items-center justify-between pt-4'>
          <div className='text-sm text-muted-foreground'>
            Customizing: <Badge variant='outline'>{template.name}</Badge>
          </div>
          <div className='flex items-center space-x-2'>
            <Button variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate}>
              <Download className='h-4 w-4 mr-2' />
              Generate Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
