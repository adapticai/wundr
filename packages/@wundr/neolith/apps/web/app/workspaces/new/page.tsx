'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { OrgPreview } from '@/components/org-genesis/org-preview';
import { GenerationProgress } from '@/components/wizard/generation-progress';
import { useOrgGenerator } from '@/hooks/use-org-generator';
import type { OrgGenerationResponse } from '@/lib/validations/org-genesis';
import type { GenerateOrgInput } from '@/lib/validations/workspace-genesis';

/**
 * Conversational Workspace Creation Wizard
 *
 * This page guides users through creating a workspace using a conversational approach:
 * 1. Initial greeting and conversation to gather requirements
 * 2. Extract structured data from conversation
 * 3. Review and edit extracted information
 * 4. Generate organization structure
 * 5. Preview and accept/regenerate
 * 6. Create workspace with full org structure
 */

// Conversation message type
interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

// Wizard phases
type WizardPhase = 'conversation' | 'review' | 'generating' | 'preview' | 'creating';

// Extracted workspace data schema
const workspaceDataSchema = z.object({
  workspaceName: z.string().min(1, 'Workspace name is required'),
  workspaceSlug: z.string().min(1, 'Workspace slug is required'),
  organizationName: z.string().min(1, 'Organization name is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  organizationType: z.string().min(1, 'Organization type is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  strategy: z.string().min(10, 'Strategy must be at least 10 characters'),
  targetAssets: z.array(z.string()).min(1, 'At least one target asset required'),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']),
  teamSize: z.enum(['small', 'medium', 'large']),
});

type WorkspaceData = z.infer<typeof workspaceDataSchema>;

export default function NewWorkspacePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<WizardPhase>('conversation');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm here to help you create a new workspace. Let's have a conversation about what you're building.

To get started, tell me:
- What is this workspace for?
- What kind of organization or team will be working in it?
- What are your main goals or objectives?

Feel free to describe it in your own words - I'll help extract the details we need.`,
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<WorkspaceData>>({});
  const [generatedOrg, setGeneratedOrg] = useState<OrgGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the org generator hook
  const {
    isGenerating,
    currentState: generationState,
    progress: generationProgress,
    error: generationError,
    result: generationResult,
    warnings: generationWarnings,
    generateOrg,
    reset: resetGenerator,
    retry: retryGeneration,
    getCurrentStep,
    getAllSteps,
  } = useOrgGenerator();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);

    try {
      // Simulate AI conversation processing
      // In a real implementation, this would call /api/wizard/chat
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock AI response that extracts information
      const conversationHistory = [...messages, userMessage]
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n');

      const aiResponse = generateAIResponse(conversationHistory, extractedData);
      const newExtractedData = extractInformationFromConversation(conversationHistory);

      setExtractedData(newExtractedData);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If we have enough information, suggest moving to review
      if (isDataComplete(newExtractedData)) {
        const suggestionMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `Great! I think I have all the information I need. Would you like to review what we've gathered and generate your organization structure?`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, suggestionMessage]);
      }
    } catch (err) {
      console.error('Error processing message:', err);
      setError('Failed to process your message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewData = () => {
    if (!isDataComplete(extractedData)) {
      setError('Please provide more information in the conversation first.');
      return;
    }
    setPhase('review');
  };

  const handleGenerateOrg = async (data: WorkspaceData) => {
    setPhase('generating');
    setError(null);
    resetGenerator();

    try {
      // Add default organizationId for now (in real app, get from session)
      const input: GenerateOrgInput = {
        organizationName: data.organizationName,
        organizationId: data.organizationId || 'org_default',
        workspaceName: data.workspaceName,
        workspaceSlug: data.workspaceSlug,
        organizationType: data.organizationType as any,
        description: data.description,
        strategy: data.strategy,
        targetAssets: data.targetAssets,
        riskTolerance: data.riskTolerance,
        teamSize: data.teamSize,
        verbose: false,
        dryRun: false,
        includeOptionalDisciplines: false,
      };

      const result = await generateOrg(input);

      setGeneratedOrg(result.data as any);
      setPhase('preview');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setPhase('review');
      console.error('Failed to generate organization:', err);
    }
  };

  const handleRegenerate = async () => {
    if (extractedData && isDataComplete(extractedData)) {
      setPhase('generating');
      resetGenerator();
      await handleGenerateOrg(extractedData as WorkspaceData);
    }
  };

  const handleRetryGeneration = async () => {
    try {
      await retryGeneration();
      setError(null);
      if (generationResult) {
        setGeneratedOrg(generationResult.data as any);
        setPhase('preview');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Retry failed';
      setError(errorMessage);
    }
  };

  const handleAccept = () => {
    if (!generatedOrg) return;

    // The workspace was already created by generate-org endpoint
    const workspaceId = 'id' in generatedOrg ? generatedOrg.id : generatedOrg.workspaceId;
    if (workspaceId) {
      router.push(`/${workspaceId}/dashboard`);
    } else {
      // Fallback - navigate to workspaces list
      router.push('/dashboard');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Create New Workspace</h1>
        <p className="text-muted-foreground">
          Let's have a conversation about your workspace and I'll help you set it up
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {phase === 'conversation' && 'Gathering Information'}
            {phase === 'review' && 'Review Details'}
            {phase === 'generating' && 'Generating Organization'}
            {phase === 'preview' && 'Preview & Confirm'}
            {phase === 'creating' && 'Creating Workspace'}
          </span>
          <Badge variant="outline">
            {phase === 'conversation' && 'Step 1 of 4'}
            {phase === 'review' && 'Step 2 of 4'}
            {phase === 'generating' && 'Step 3 of 4'}
            {phase === 'preview' && 'Step 4 of 4'}
            {phase === 'creating' && 'Finalizing...'}
          </Badge>
        </div>
        <Progress
          value={
            phase === 'conversation' ? 25 :
            phase === 'review' ? 50 :
            phase === 'generating' ? 75 :
            100
          }
          className="h-2"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Phase: Conversation */}
      {phase === 'conversation' && (
        <div className="space-y-4">
          <Card className="h-[500px] flex flex-col">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                Tell me about your workspace in natural language
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg bg-muted px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse delay-75" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse delay-150" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message... (Shift+Enter for new line)"
                    className="min-h-[60px] resize-none"
                    disabled={isProcessing}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isProcessing}
                    className="self-end"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Information Preview */}
          {Object.keys(extractedData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Information Gathered</CardTitle>
                <CardDescription>
                  Here's what I've understood so far
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {extractedData.workspaceName && (
                    <div>
                      <span className="font-medium">Workspace Name:</span>{' '}
                      <span className="text-muted-foreground">{extractedData.workspaceName}</span>
                    </div>
                  )}
                  {extractedData.organizationType && (
                    <div>
                      <span className="font-medium">Type:</span>{' '}
                      <span className="text-muted-foreground">{extractedData.organizationType}</span>
                    </div>
                  )}
                  {extractedData.riskTolerance && (
                    <div>
                      <span className="font-medium">Risk Tolerance:</span>{' '}
                      <span className="text-muted-foreground capitalize">{extractedData.riskTolerance}</span>
                    </div>
                  )}
                  {extractedData.teamSize && (
                    <div>
                      <span className="font-medium">Team Size:</span>{' '}
                      <span className="text-muted-foreground capitalize">{extractedData.teamSize}</span>
                    </div>
                  )}
                  {extractedData.targetAssets && extractedData.targetAssets.length > 0 && (
                    <div className="col-span-2">
                      <span className="font-medium">Target Assets:</span>{' '}
                      <span className="text-muted-foreground">
                        {extractedData.targetAssets.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleReviewData}
                    disabled={!isDataComplete(extractedData)}
                  >
                    Review & Generate Organization
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Phase: Review */}
      {phase === 'review' && (
        <ReviewForm
          initialData={extractedData as WorkspaceData}
          onSubmit={handleGenerateOrg}
          onBack={() => setPhase('conversation')}
        />
      )}

      {/* Phase: Generating */}
      {phase === 'generating' && (
        <GenerationProgress
          state={generationState}
          progress={generationProgress}
          error={generationError}
          warnings={generationWarnings}
          steps={getAllSteps()}
          currentStep={getCurrentStep()}
          onRetry={handleRetryGeneration}
          onCancel={() => setPhase('review')}
          isRetrying={isGenerating}
        />
      )}

      {/* Phase: Preview */}
      {phase === 'preview' && generatedOrg && (
        <OrgPreview
          orgData={generatedOrg}
          onRegenerate={handleRegenerate}
          onCustomize={() => setPhase('review')}
          onAccept={handleAccept}
          isRegenerating={isGenerating}
        />
      )}
    </div>
  );
}

/**
 * Review Form Component
 */
function ReviewForm({
  initialData,
  onSubmit,
  onBack,
}: {
  initialData: WorkspaceData;
  onSubmit: (data: WorkspaceData) => void;
  onBack: () => void;
}) {
  const form = useForm<WorkspaceData>({
    resolver: zodResolver(workspaceDataSchema),
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
      assets.filter((a) => a !== asset),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Edit Details</CardTitle>
        <CardDescription>
          Verify and modify the extracted information before generating your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace Name</Label>
              <Input
                id="workspaceName"
                {...form.register('workspaceName')}
                placeholder="e.g., Engineering Team"
              />
              {form.formState.errors.workspaceName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.workspaceName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceSlug">Workspace Slug</Label>
              <Input
                id="workspaceSlug"
                {...form.register('workspaceSlug')}
                placeholder="e.g., engineering-team"
              />
              {form.formState.errors.workspaceSlug && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.workspaceSlug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                {...form.register('organizationName')}
                placeholder="e.g., Acme Corp"
              />
              {form.formState.errors.organizationName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.organizationName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationType">Organization Type</Label>
              <Input
                id="organizationType"
                {...form.register('organizationType')}
                placeholder="e.g., Technology, Finance"
              />
              {form.formState.errors.organizationType && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.organizationType.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Describe your organization's purpose and focus..."
              rows={4}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Textarea
              id="strategy"
              {...form.register('strategy')}
              placeholder="Describe your business strategy..."
              rows={3}
            />
            {form.formState.errors.strategy && (
              <p className="text-sm text-destructive">
                {form.formState.errors.strategy.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Target Assets / Markets</Label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., US Equities, Crypto"
                  value={assetInput}
                  onChange={(e) => setAssetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAsset();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddAsset}>
                  Add
                </Button>
              </div>

              {assets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {assets.map((asset) => (
                    <Badge key={asset} variant="secondary" className="gap-1">
                      {asset}
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset(asset)}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {form.formState.errors.targetAssets && (
              <p className="text-sm text-destructive">
                {form.formState.errors.targetAssets.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Risk Tolerance</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['conservative', 'moderate', 'aggressive'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => form.setValue('riskTolerance', level)}
                    className={`rounded-lg border-2 p-3 text-center transition-all text-sm ${
                      form.watch('riskTolerance') === level
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-medium capitalize">{level}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Team Size</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => form.setValue('teamSize', size)}
                    className={`rounded-lg border-2 p-3 text-center transition-all text-sm ${
                      form.watch('teamSize') === size
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-medium capitalize">{size}</div>
                    <div className="text-xs text-muted-foreground">
                      {size === 'small' && '1-10'}
                      {size === 'medium' && '10-50'}
                      {size === 'large' && '50+'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={onBack}>
              Back to Conversation
            </Button>
            <Button type="submit">
              Generate Organization
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


/**
 * Helper Functions
 */

// Mock AI response generator
function generateAIResponse(_conversationHistory: string, currentData: Partial<WorkspaceData>): string {
  const missingFields: string[] = [];

  if (!currentData.workspaceName) missingFields.push('workspace name');
  if (!currentData.organizationType) missingFields.push('organization type');
  if (!currentData.description) missingFields.push('detailed description');
  if (!currentData.strategy) missingFields.push('strategy');
  if (!currentData.targetAssets || currentData.targetAssets.length === 0)
    missingFields.push('target assets or markets');
  if (!currentData.riskTolerance) missingFields.push('risk tolerance');
  if (!currentData.teamSize) missingFields.push('expected team size');

  if (missingFields.length === 0) {
    return `Perfect! I have all the information I need. I've gathered:
- Workspace: ${currentData.workspaceName}
- Type: ${currentData.organizationType}
- Risk Tolerance: ${currentData.riskTolerance}
- Team Size: ${currentData.teamSize}
- Target Assets: ${currentData.targetAssets?.join(', ')}

Ready to generate your organization structure!`;
  }

  const nextField = missingFields[0];
  const questions: Record<string, string> = {
    'workspace name': 'What would you like to name this workspace?',
    'organization type':
      'What type of organization is this? (e.g., hedge fund, startup, enterprise)',
    'detailed description': 'Can you tell me more about what this organization does?',
    strategy: 'What is your business or investment strategy?',
    'target assets or markets':
      'What markets or asset classes will you focus on? (e.g., crypto, equities, bonds)',
    'risk tolerance':
      'What is your risk tolerance? (conservative, moderate, or aggressive)',
    'expected team size': 'How large do you expect your team to be? (small, medium, or large)',
  };

  return `Thanks for sharing that! ${questions[nextField] || `Can you tell me about ${nextField}?`}`;
}

// Extract information from conversation
function extractInformationFromConversation(
  conversationHistory: string,
): Partial<WorkspaceData> {
  const data: Partial<WorkspaceData> = {};
  const lower = conversationHistory.toLowerCase();

  // Extract workspace name (look for "workspace" or "called" or "named")
  const nameMatch = conversationHistory.match(
    /(?:workspace|called|named)\s+(?:is\s+)?["']?([A-Za-z0-9\s-]+)["']?/i,
  );
  if (nameMatch) {
    const name = nameMatch[1].trim();
    data.workspaceName = name;
    data.workspaceSlug = name.toLowerCase().replace(/\s+/g, '-');
    data.organizationName = name;
    data.organizationId = 'org_' + name.toLowerCase().replace(/\s+/g, '_');
  }

  // Extract organization type
  const types = [
    'hedge fund',
    'startup',
    'enterprise',
    'technology',
    'finance',
    'trading',
    'investment',
  ];
  for (const type of types) {
    if (lower.includes(type)) {
      data.organizationType = type;
      break;
    }
  }

  // Extract description and strategy from conversation
  if (conversationHistory.length > 50) {
    data.description = conversationHistory.slice(0, 200);
    data.strategy = conversationHistory.slice(0, 150);
  }

  // Extract target assets
  const assets: string[] = [];
  const assetKeywords = [
    'crypto',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'equities',
    'stocks',
    'bonds',
    'commodities',
    'forex',
    'derivatives',
  ];
  for (const asset of assetKeywords) {
    if (lower.includes(asset)) {
      assets.push(asset.charAt(0).toUpperCase() + asset.slice(1));
    }
  }
  if (assets.length > 0) {
    data.targetAssets = [...new Set(assets)]; // Remove duplicates
  }

  // Extract risk tolerance
  if (lower.includes('conservative')) data.riskTolerance = 'conservative';
  else if (lower.includes('aggressive')) data.riskTolerance = 'aggressive';
  else if (lower.includes('moderate')) data.riskTolerance = 'moderate';

  // Extract team size
  if (lower.includes('small') || lower.match(/\b[1-9]\b/)) data.teamSize = 'small';
  else if (lower.includes('large') || lower.match(/\b(50|100)\b/)) data.teamSize = 'large';
  else if (lower.includes('medium') || lower.match(/\b(10|20|30)\b/))
    data.teamSize = 'medium';

  return data;
}

// Check if data is complete
function isDataComplete(data: Partial<WorkspaceData>): boolean {
  return !!(
    data.workspaceName &&
    data.workspaceSlug &&
    data.organizationName &&
    data.organizationId &&
    data.organizationType &&
    data.description &&
    data.strategy &&
    data.targetAssets &&
    data.targetAssets.length > 0 &&
    data.riskTolerance &&
    data.teamSize
  );
}
