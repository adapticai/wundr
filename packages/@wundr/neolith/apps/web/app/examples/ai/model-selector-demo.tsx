/**
 * Model Selector Demo
 * Comprehensive example of AI model selection and configuration components
 */

'use client';

import {
  ModelComparison,
  ModelConfigPanel,
  ModelSelector,
  ModelSelectorCompact,
  ProviderBadge,
  ProviderComparison,
} from '@/components/ai';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateModelCost, formatCost, getModelById } from '@/lib/ai/models';
import { GitCompare, Settings, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { ModelConfig } from '@/lib/ai/models';

export function ModelSelectorDemo() {
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [config, setConfig] = useState<ModelConfig>({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  });

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setConfig(prev => ({ ...prev, model: modelId }));
    toast.success(`Switched to ${getModelById(modelId)?.name}`);
  };

  const handleConfigChange = (newConfig: ModelConfig) => {
    setConfig(newConfig);
  };

  const handleSaveConfig = (savedConfig: ModelConfig) => {
    console.log('Saving config:', savedConfig);
    toast.success('Configuration saved to workspace settings');
  };

  // Calculate example cost
  const exampleInputTokens = 1000;
  const exampleOutputTokens = 500;
  const estimatedCost = calculateModelCost(
    selectedModel,
    exampleInputTokens,
    exampleOutputTokens
  );

  return (
    <div className='container mx-auto py-8 space-y-8 max-w-7xl'>
      {/* Header */}
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold flex items-center gap-2'>
          <Sparkles className='h-8 w-8' />
          AI Model Selector Demo
        </h1>
        <p className='text-muted-foreground'>
          Comprehensive model selection and configuration interface
        </p>
      </div>

      <Separator />

      <Tabs defaultValue='selector' className='space-y-6'>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='selector'>Model Selector</TabsTrigger>
          <TabsTrigger value='config'>Configuration</TabsTrigger>
          <TabsTrigger value='comparison'>Comparison</TabsTrigger>
          <TabsTrigger value='providers'>Providers</TabsTrigger>
        </TabsList>

        {/* Model Selector Tab */}
        <TabsContent value='selector' className='space-y-6'>
          <div className='grid gap-6 lg:grid-cols-2'>
            {/* Full Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Full Model Selector</CardTitle>
                <CardDescription>
                  Complete selector with model details and capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <ModelSelector
                  value={selectedModel}
                  onChange={handleModelChange}
                  showDetails={true}
                />

                {selectedModel && (
                  <div className='space-y-2 pt-4 border-t'>
                    <h4 className='font-medium'>Selected Model Details</h4>
                    <div className='space-y-1 text-sm'>
                      <div className='flex justify-between'>
                        <span className='text-muted-foreground'>Model ID:</span>
                        <code className='text-xs bg-muted px-2 py-1 rounded'>
                          {selectedModel}
                        </code>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-muted-foreground'>Provider:</span>
                        <ProviderBadge
                          provider={getModelById(selectedModel)!.provider}
                          size='sm'
                        />
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-muted-foreground'>
                          Cost (1K/500 tokens):
                        </span>
                        <span className='font-mono'>
                          {formatCost(estimatedCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compact Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Compact Selector</CardTitle>
                <CardDescription>
                  Minimal selector for toolbar or constrained spaces
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center gap-4'>
                  <span className='text-sm text-muted-foreground'>Model:</span>
                  <ModelSelectorCompact
                    value={selectedModel}
                    onChange={handleModelChange}
                  />
                </div>

                <div className='space-y-2 pt-4 border-t'>
                  <h4 className='font-medium text-sm'>Provider Badges</h4>
                  <div className='flex flex-wrap gap-2'>
                    <ProviderBadge provider='openai' size='sm' />
                    <ProviderBadge provider='anthropic' size='sm' />
                    <ProviderBadge provider='deepseek' size='sm' />
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <ProviderBadge provider='openai' size='md' />
                    <ProviderBadge provider='anthropic' size='md' />
                    <ProviderBadge provider='deepseek' size='md' />
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <ProviderBadge provider='openai' size='lg' />
                    <ProviderBadge provider='anthropic' size='lg' />
                    <ProviderBadge provider='deepseek' size='lg' />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Provider Filtering */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Filtering</CardTitle>
              <CardDescription>
                Restrict model selection to specific providers
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>OpenAI Only</h4>
                  <ModelSelector
                    value={selectedModel}
                    onChange={handleModelChange}
                    providers={['openai']}
                    showDetails={false}
                  />
                </div>
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>Anthropic Only</h4>
                  <ModelSelector
                    value={selectedModel}
                    onChange={handleModelChange}
                    providers={['anthropic']}
                    showDetails={false}
                  />
                </div>
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium'>DeepSeek Only</h4>
                  <ModelSelector
                    value={selectedModel}
                    onChange={handleModelChange}
                    providers={['deepseek']}
                    showDetails={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value='config' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Settings className='h-5 w-5' />
                Model Configuration
              </CardTitle>
              <CardDescription>
                Fine-tune model parameters for your specific use case
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelConfigPanel
                config={config}
                onChange={handleConfigChange}
                onSave={handleSaveConfig}
                showSaveButton={true}
              />
            </CardContent>
          </Card>

          {/* Configuration Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
              <CardDescription>
                JSON representation of model settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className='bg-muted p-4 rounded-lg overflow-x-auto text-sm'>
                <code>{JSON.stringify(config, null, 2)}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value='comparison' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <GitCompare className='h-5 w-5' />
                Model Comparison
              </CardTitle>
              <CardDescription>
                Compare capabilities, pricing, and features across models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelComparison />
            </CardContent>
          </Card>

          {/* Custom Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Comparison</CardTitle>
              <CardDescription>
                Compare specific models side by side
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelComparison
                selectedModels={[
                  'gpt-4o',
                  'claude-sonnet-4-5-20250929',
                  'deepseek-reasoner',
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value='providers' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Provider Overview</CardTitle>
              <CardDescription>
                Browse all available models organized by provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProviderComparison />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Example */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Example</CardTitle>
          <CardDescription>
            How to use these components in your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className='bg-muted p-4 rounded-lg overflow-x-auto text-xs'>
            <code>{`import { ModelSelector, ModelConfigPanel } from '@/components/ai';
import { getModelById } from '@/lib/ai/models';

function MyComponent() {
  const [config, setConfig] = useState({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  });

  const handleSave = async (newConfig) => {
    await fetch('/api/workspaces/[id]/ai-config', {
      method: 'PATCH',
      body: JSON.stringify(newConfig),
    });
  };

  return (
    <div>
      <ModelSelector
        value={config.model}
        onChange={(id) => setConfig({ ...config, model: id })}
      />
      <ModelConfigPanel
        config={config}
        onChange={setConfig}
        onSave={handleSave}
      />
    </div>
  );
}`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export default ModelSelectorDemo;
