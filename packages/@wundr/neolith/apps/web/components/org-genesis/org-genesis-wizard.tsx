'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  type WizardStep,
  type OrgBasicInfo,
  type OrgDescription,
  type OrgConfig,
  type GenerateOrgInput,
  type OrgGenerationResponse,
  orgBasicInfoSchema,
  orgDescriptionSchema,
  orgConfigSchema,
} from '@/lib/validations/org-genesis';

import { OrgPreview } from './org-preview';

/**
 * Multi-Step Organization Genesis Wizard
 *
 * Guides users through creating an organization from conversational input:
 * 1. Basic Info - Name and type
 * 2. Description - Conversational org description and strategy
 * 3. Configuration - Assets, risk, team size
 * 4. Preview - Generated org chart with regenerate/customize
 */
export function OrgGenesisWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [wizardData, setWizardData] = useState<{
    basicInfo: Partial<OrgBasicInfo>;
    description: Partial<OrgDescription>;
    config: Partial<OrgConfig>;
  }>({
    basicInfo: {},
    description: {},
    config: {},
  });
  const [generatedOrg, setGeneratedOrg] =
    useState<OrgGenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepProgress: Record<WizardStep, number> = {
    basic: 25,
    description: 50,
    config: 75,
    preview: 100,
    customize: 100,
  };

  const handleBasicInfoSubmit = (data: OrgBasicInfo) => {
    setWizardData(prev => ({ ...prev, basicInfo: data }));
    setCurrentStep('description');
  };

  const handleDescriptionSubmit = (data: OrgDescription) => {
    setWizardData(prev => ({ ...prev, description: data }));
    setCurrentStep('config');
  };

  const handleConfigSubmit = async (data: OrgConfig) => {
    setWizardData(prev => ({ ...prev, config: data }));

    // Generate organization
    const fullInput: GenerateOrgInput = {
      ...wizardData.basicInfo,
      ...wizardData.description,
      ...data,
    } as GenerateOrgInput;

    await generateOrganization(fullInput);
  };

  const generateOrganization = async (input: GenerateOrgInput) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces/generate-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate organization');
      }

      setGeneratedOrg(result.data);
      setCurrentStep('preview');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to generate organization:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    const fullInput: GenerateOrgInput = {
      ...wizardData.basicInfo,
      ...wizardData.description,
      ...wizardData.config,
    } as GenerateOrgInput;

    await generateOrganization(fullInput);
  };

  const handleCustomize = () => {
    setCurrentStep('customize');
  };

  const handleAccept = async () => {
    if (!generatedOrg) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Workspace was already created by the generate-org endpoint
      // Just navigate to it
      if (generatedOrg.workspaceId) {
        router.push(`/workspace/${generatedOrg.workspaceId}`);
      } else {
        throw new Error('No workspace ID returned from generation');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to navigate to workspace';
      setError(errorMessage);
      console.error('Failed to navigate to workspace:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      {/* Progress Header */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold'>Create Organization</h2>
          <Badge variant='outline'>
            Step{' '}
            {['basic', 'description', 'config', 'preview'].indexOf(
              currentStep
            ) + 1}{' '}
            of 4
          </Badge>
        </div>
        <Progress value={stepProgress[currentStep]} className='h-2' />
      </div>

      {/* Error Display */}
      {error && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Step Content */}
      {currentStep === 'basic' && (
        <BasicInfoStep
          initialData={wizardData.basicInfo}
          onSubmit={handleBasicInfoSubmit}
        />
      )}

      {currentStep === 'description' && (
        <DescriptionStep
          initialData={wizardData.description}
          onSubmit={handleDescriptionSubmit}
          onBack={() => setCurrentStep('basic')}
        />
      )}

      {currentStep === 'config' && (
        <ConfigStep
          initialData={wizardData.config}
          onSubmit={handleConfigSubmit}
          onBack={() => setCurrentStep('description')}
          isSubmitting={isGenerating}
        />
      )}

      {currentStep === 'preview' && generatedOrg && (
        <OrgPreview
          orgData={generatedOrg}
          onRegenerate={handleRegenerate}
          onCustomize={handleCustomize}
          onAccept={handleAccept}
          isRegenerating={isGenerating}
        />
      )}

      {isGenerating && currentStep === 'config' && <GeneratingState />}
    </div>
  );
}

/**
 * Step 1: Basic Info
 */
function BasicInfoStep({
  initialData,
  onSubmit,
}: {
  initialData: Partial<OrgBasicInfo>;
  onSubmit: (data: OrgBasicInfo) => void;
}) {
  const form = useForm<OrgBasicInfo>({
    resolver: zodResolver(orgBasicInfoSchema),
    defaultValues: initialData,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Let&apos;s start with the fundamentals of your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='organizationName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Adaptive Investments LLC'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The legal or primary name of your organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='organizationType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Hedge Fund, VC Firm, Startup'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    What industry or sector does your organization operate in?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end'>
              <Button type='submit'>Next Step</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/**
 * Step 2: Conversational Description
 */
function DescriptionStep({
  initialData,
  onSubmit,
  onBack,
}: {
  initialData: Partial<OrgDescription>;
  onSubmit: (data: OrgDescription) => void;
  onBack: () => void;
}) {
  const form = useForm<OrgDescription>({
    resolver: zodResolver(orgDescriptionSchema),
    defaultValues: initialData,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Describe Your Organization</CardTitle>
        <CardDescription>
          Tell us about your organization&apos;s purpose and strategy. Be as
          detailed as you like - we&apos;ll use this to generate a tailored
          structure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='e.g., We are a quantitative hedge fund specializing in algorithmic trading strategies across global equity markets. We focus on high-frequency trading and machine learning-driven investment decisions...'
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    What does your organization do? What makes it unique?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='strategy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Strategy & Focus</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='e.g., Our strategy combines momentum trading with mean reversion across multiple timeframes. We target mid-cap stocks with strong liquidity...'
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    What is your business strategy or investment approach?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-between'>
              <Button type='button' variant='outline' onClick={onBack}>
                Back
              </Button>
              <Button type='submit'>Next Step</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/**
 * Step 3: Configuration
 */
function ConfigStep({
  initialData,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  initialData: Partial<OrgConfig>;
  onSubmit: (data: OrgConfig) => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const form = useForm<OrgConfig>({
    resolver: zodResolver(orgConfigSchema),
    defaultValues: initialData,
  });

  const [assetInput, setAssetInput] = useState('');
  const assets = form.watch('targetAssets') || [];

  const handleAddAsset = () => {
    if (assetInput.trim() && !assets.includes(assetInput.trim())) {
      form.setValue('targetAssets', [...assets, assetInput.trim()]);
      setAssetInput('');
    }
  };

  const handleRemoveAsset = (asset: string) => {
    form.setValue(
      'targetAssets',
      assets.filter(a => a !== asset)
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Your Organization</CardTitle>
        <CardDescription>
          Define your target markets and organizational preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='targetAssets'
              render={() => (
                <FormItem>
                  <FormLabel>Target Assets / Markets</FormLabel>
                  <div className='space-y-3'>
                    <div className='flex gap-2'>
                      <Input
                        placeholder='e.g., US Equities, Crypto, Commodities'
                        value={assetInput}
                        onChange={e => setAssetInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAsset();
                          }
                        }}
                      />
                      <Button
                        type='button'
                        variant='outline'
                        onClick={handleAddAsset}
                      >
                        Add
                      </Button>
                    </div>

                    {assets.length > 0 && (
                      <div className='flex flex-wrap gap-2'>
                        {assets.map(asset => (
                          <Badge
                            key={asset}
                            variant='secondary'
                            className='gap-1'
                          >
                            {asset}
                            <button
                              type='button'
                              onClick={() => handleRemoveAsset(asset)}
                              className='ml-1 rounded-full hover:bg-muted-foreground/20'
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormDescription>
                    What markets or asset classes do you focus on?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='riskTolerance'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Tolerance</FormLabel>
                  <FormControl>
                    <div className='grid grid-cols-3 gap-3'>
                      {(
                        ['conservative', 'moderate', 'aggressive'] as const
                      ).map(level => (
                        <button
                          key={level}
                          type='button'
                          onClick={() => field.onChange(level)}
                          className={`rounded-lg border-2 p-4 text-center transition-all ${
                            field.value === level
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className='font-medium capitalize'>{level}</div>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormDescription>
                    What is your organization&apos;s approach to risk?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='teamSize'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Size</FormLabel>
                  <FormControl>
                    <div className='grid grid-cols-3 gap-3'>
                      {(['small', 'medium', 'large'] as const).map(size => (
                        <button
                          key={size}
                          type='button'
                          onClick={() => field.onChange(size)}
                          className={`rounded-lg border-2 p-4 text-center transition-all ${
                            field.value === size
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className='font-medium capitalize'>{size}</div>
                          <div className='text-xs text-muted-foreground'>
                            {size === 'small' && '1-10'}
                            {size === 'medium' && '10-50'}
                            {size === 'large' && '50+'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Expected team size for your organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-between'>
              <Button type='button' variant='outline' onClick={onBack}>
                Back
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting
                  ? 'Generating Organization...'
                  : 'Generate Organization'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/**
 * Generating State with Skeleton Loaders
 */
function GeneratingState() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-8 w-3/4' />
        <Skeleton className='h-4 w-1/2' />
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-3'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
          <Skeleton className='h-4 w-4/6' />
        </div>

        <div className='grid grid-cols-3 gap-4'>
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
        </div>

        <div className='space-y-4'>
          {[1, 2, 3].map(i => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-6 w-1/3' />
              <Skeleton className='h-20 w-full' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
