/**
 * AI Validation Schemas
 * Comprehensive Zod schemas for AI type validation
 */

import { z } from 'zod';

/**
 * AI Provider schema
 */
export const aiProviderSchema = z.enum(['openai', 'anthropic', 'deepseek']);

/**
 * AI Message Role schema
 */
export const aiMessageRoleSchema = z.enum([
  'user',
  'assistant',
  'system',
  'tool',
]);

/**
 * AI Message Status schema
 */
export const aiMessageStatusSchema = z.enum([
  'pending',
  'streaming',
  'completed',
  'error',
  'cancelled',
  'timeout',
]);

/**
 * AI Conversation Status schema
 */
export const aiConversationStatusSchema = z.enum([
  'active',
  'archived',
  'deleted',
  'error',
]);

/**
 * AI Error Code schema
 */
export const aiErrorCodeSchema = z.enum([
  'invalid_request',
  'authentication_error',
  'permission_denied',
  'not_found',
  'rate_limit_exceeded',
  'quota_exceeded',
  'token_limit_exceeded',
  'context_length_exceeded',
  'invalid_model',
  'model_overloaded',
  'server_error',
  'timeout',
  'network_error',
  'invalid_response',
  'content_filter',
  'unknown_error',
]);

/**
 * AI Stream Event Type schema
 */
export const aiStreamEventTypeSchema = z.enum([
  'start',
  'chunk',
  'tool_call_start',
  'tool_call_chunk',
  'tool_call_end',
  'reasoning_start',
  'reasoning_chunk',
  'reasoning_end',
  'complete',
  'error',
  'abort',
]);

/**
 * AI Tool Call Status schema
 */
export const aiToolCallStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'error',
  'cancelled',
]);

/**
 * AI Content Type schema
 */
export const aiContentTypeSchema = z.enum([
  'text',
  'image',
  'file',
  'code',
  'tool_result',
]);

/**
 * AI Model Capabilities schema
 */
export const aiModelCapabilitiesSchema = z.object({
  vision: z.boolean(),
  functionCalling: z.boolean(),
  streaming: z.boolean(),
  reasoning: z.boolean(),
  json: z.boolean(),
  webSearch: z.boolean(),
  codeExecution: z.boolean(),
  multimodal: z.boolean(),
});

/**
 * AI Model Pricing schema
 */
export const aiModelPricingSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cachedInput: z.number().nonnegative().optional(),
  currency: z.literal('USD'),
});

/**
 * AI Model Limits schema
 */
export const aiModelLimitsSchema = z.object({
  contextLength: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  requestsPerMinute: z.number().int().positive().optional(),
  tokensPerMinute: z.number().int().positive().optional(),
  tokensPerDay: z.number().int().positive().optional(),
});

/**
 * AI Model schema
 */
export const aiModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: aiProviderSchema,
  version: z.string().optional(),
  releaseDate: z.string().optional(),
  description: z.string(),
  capabilities: aiModelCapabilitiesSchema,
  pricing: aiModelPricingSchema,
  limits: aiModelLimitsSchema,
  isRecommended: z.boolean().optional(),
  isDeprecated: z.boolean().optional(),
  deprecatedInFavorOf: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * AI Model Config schema
 */
export const aiModelConfigSchema = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  topP: z.number().min(0).max(1),
  systemPrompt: z.string().optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stopSequences: z.array(z.string()).optional(),
  topK: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
});

/**
 * AI Token Usage schema
 */
export const aiTokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  estimatedCost: z.number().nonnegative().optional(),
});

/**
 * AI Error Info schema
 */
export const aiErrorInfoSchema = z.object({
  code: aiErrorCodeSchema,
  message: z.string().min(1),
  details: z.string().optional(),
  retryable: z.boolean(),
  retryAfter: z.number().int().positive().optional(),
  providerErrorCode: z.string().optional(),
  statusCode: z.number().int().optional(),
});

/**
 * AI Tool Call schema
 */
export const aiToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
  status: aiToolCallStatusSchema,
  error: z.string().optional(),
  executionTime: z.number().int().nonnegative().optional(),
});

/**
 * AI Tool schema
 */
export const aiToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.unknown()),
  requiresConfirmation: z.boolean().optional(),
  category: z.string().optional(),
});

/**
 * AI Reasoning Step schema
 */
export const aiReasoningStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['thought', 'action', 'observation']),
  content: z.string(),
  timestamp: z.string(),
  tokens: z.number().int().nonnegative().optional(),
});

/**
 * AI Content Block schema
 */
export const aiContentBlockSchema = z.object({
  type: aiContentTypeSchema,
  content: z.union([z.string(), z.record(z.unknown())]),
  mimeType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * AI Message Attachment schema
 */
export const aiMessageAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  size: z.number().int().positive(),
  mimeType: z.string().min(1),
  type: z.enum(['image', 'document', 'video', 'audio', 'other']),
  analyzed: z.boolean().optional(),
  analysis: z.record(z.unknown()).optional(),
});

/**
 * AI Message schema
 */
export const aiMessageSchema = z.object({
  id: z.string().min(1),
  role: aiMessageRoleSchema,
  content: z.string(),
  contentBlocks: z.array(aiContentBlockSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  status: aiMessageStatusSchema,
  model: z.string().optional(),
  tokens: aiTokenUsageSchema.optional(),
  toolCalls: z.array(aiToolCallSchema).optional(),
  reasoningSteps: z.array(aiReasoningStepSchema).optional(),
  attachments: z.array(aiMessageAttachmentSchema).optional(),
  parentId: z.string().optional(),
  isStreaming: z.boolean().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Create AI Message Input schema
 */
export const createAIMessageInputSchema = z.object({
  role: aiMessageRoleSchema,
  content: z.string().min(1),
  contentBlocks: z.array(aiContentBlockSchema).optional(),
  parentId: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Update AI Message Input schema
 */
export const updateAIMessageInputSchema = z.object({
  content: z.string().min(1).optional(),
  status: aiMessageStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * AI Message Filters schema
 */
export const aiMessageFiltersSchema = z.object({
  role: aiMessageRoleSchema.optional(),
  status: aiMessageStatusSchema.optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  model: z.string().optional(),
  includeToolCalls: z.boolean().optional(),
  includeReasoningSteps: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

/**
 * AI Retry Options schema
 */
export const aiRetryOptionsSchema = z.object({
  maxRetries: z.number().int().nonnegative().max(10),
  initialDelay: z.number().int().positive(),
  backoffMultiplier: z.number().min(1),
  maxDelay: z.number().int().positive(),
  retryableErrors: z.array(aiErrorCodeSchema).optional(),
});

/**
 * AI Completion Options schema
 */
export const aiCompletionOptionsSchema = z.object({
  config: aiModelConfigSchema,
  tools: z.array(aiToolSchema).optional(),
  enableReasoning: z.boolean().optional(),
  userContext: z.record(z.unknown()).optional(),
  timeout: z.number().int().positive().optional(),
  retry: aiRetryOptionsSchema.optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * AI Context Window schema
 */
export const aiContextWindowSchema = z.object({
  totalTokens: z.number().int().positive(),
  messageTokens: z.number().int().nonnegative(),
  reservedTokens: z.number().int().nonnegative(),
  availableTokens: z.number().int().nonnegative(),
  utilizationPercent: z.number().min(0).max(100),
});

/**
 * AI Rate Limit Info schema
 */
export const aiRateLimitInfoSchema = z.object({
  requestsRemaining: z.number().int().nonnegative(),
  tokensRemaining: z.number().int().nonnegative(),
  resetsAt: z.string(),
  retryAfter: z.number().int().positive().optional(),
});

/**
 * AI Performance Metrics schema
 */
export const aiPerformanceMetricsSchema = z.object({
  timeToFirstToken: z.number().nonnegative().optional(),
  tokensPerSecond: z.number().nonnegative().optional(),
  totalLatency: z.number().nonnegative(),
  networkLatency: z.number().nonnegative().optional(),
  processingTime: z.number().nonnegative().optional(),
});

/**
 * AI Provider Credentials schema
 */
export const aiProviderCredentialsSchema = z.object({
  apiKey: z.string().min(1),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * AI Provider Config schema
 */
export const aiProviderConfigSchema = z.object({
  provider: aiProviderSchema,
  credentials: aiProviderCredentialsSchema,
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  enableRetries: z.boolean().optional(),
  maxRetries: z.number().int().nonnegative().max(10).optional(),
  enableRateLimiting: z.boolean().optional(),
  customConfig: z.record(z.unknown()).optional(),
});

/**
 * AI Provider Status schema
 */
export const aiProviderStatusSchema = z.object({
  provider: aiProviderSchema,
  isAvailable: z.boolean(),
  isConfigured: z.boolean(),
  health: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  lastHealthCheck: z.string().optional(),
  rateLimitInfo: aiRateLimitInfoSchema.optional(),
  error: aiErrorInfoSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * AI Message Export Format schema
 */
export const aiMessageExportFormatSchema = z.enum([
  'json',
  'markdown',
  'text',
  'csv',
]);

/**
 * AI Message Export Options schema
 */
export const aiMessageExportOptionsSchema = z.object({
  format: aiMessageExportFormatSchema,
  includeMetadata: z.boolean().optional(),
  includeToolCalls: z.boolean().optional(),
  includeReasoningSteps: z.boolean().optional(),
  includeTimestamps: z.boolean().optional(),
  includeTokenUsage: z.boolean().optional(),
});

/**
 * AI Stream Event schema
 */
export const aiStreamEventSchema = z.object({
  type: aiStreamEventTypeSchema,
  data: z.unknown(),
  sequence: z.number().int().nonnegative().optional(),
  timestamp: z.string(),
});

/**
 * AI Request Metadata schema
 */
export const aiRequestMetadataSchema = z.object({
  requestId: z.string().min(1),
  model: z.string().min(1),
  provider: aiProviderSchema,
  timestamp: z.string(),
  duration: z.number().int().nonnegative().optional(),
  usage: aiTokenUsageSchema.optional(),
  error: aiErrorInfoSchema.optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  customMetadata: z.record(z.unknown()).optional(),
});

/**
 * Validation helper functions
 */

/**
 * Validate AI provider
 */
export function validateAIProvider(value: unknown) {
  return aiProviderSchema.safeParse(value);
}

/**
 * Validate AI message role
 */
export function validateAIMessageRole(value: unknown) {
  return aiMessageRoleSchema.safeParse(value);
}

/**
 * Validate AI message
 */
export function validateAIMessage(value: unknown) {
  return aiMessageSchema.safeParse(value);
}

/**
 * Validate AI model config
 */
export function validateAIModelConfig(value: unknown) {
  return aiModelConfigSchema.safeParse(value);
}

/**
 * Validate AI completion options
 */
export function validateAICompletionOptions(value: unknown) {
  return aiCompletionOptionsSchema.safeParse(value);
}

/**
 * Validate AI provider config
 */
export function validateAIProviderConfig(value: unknown) {
  return aiProviderConfigSchema.safeParse(value);
}

/**
 * Type exports for inference
 */
export type AIProviderSchema = z.infer<typeof aiProviderSchema>;
export type AIMessageRoleSchema = z.infer<typeof aiMessageRoleSchema>;
export type AIMessageStatusSchema = z.infer<typeof aiMessageStatusSchema>;
export type AIMessageSchema = z.infer<typeof aiMessageSchema>;
export type AIModelConfigSchema = z.infer<typeof aiModelConfigSchema>;
export type AITokenUsageSchema = z.infer<typeof aiTokenUsageSchema>;
export type CreateAIMessageInputSchema = z.infer<
  typeof createAIMessageInputSchema
>;
export type UpdateAIMessageInputSchema = z.infer<
  typeof updateAIMessageInputSchema
>;
export type AICompletionOptionsSchema = z.infer<
  typeof aiCompletionOptionsSchema
>;
export type AIProviderConfigSchema = z.infer<typeof aiProviderConfigSchema>;
