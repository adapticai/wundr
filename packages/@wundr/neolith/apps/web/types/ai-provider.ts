/**
 * AI Provider Types
 * Comprehensive type definitions for AI provider management
 */

import type {
  AIProvider,
  AIModel,
  AIModelConfig,
  AIRateLimitInfo,
  AIErrorInfo,
  AITokenUsage,
} from './ai';

/**
 * Provider authentication credentials
 */
export interface AIProviderCredentials {
  /** API key */
  readonly apiKey: string;
  /** Organization ID (if applicable) */
  readonly organizationId?: string;
  /** Project ID (if applicable) */
  readonly projectId?: string;
  /** Additional headers */
  readonly headers?: Record<string, string>;
}

/**
 * Provider configuration
 */
export interface AIProviderConfig {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Provider credentials */
  readonly credentials: AIProviderCredentials;
  /** Base URL (for custom endpoints) */
  readonly baseUrl?: string;
  /** Default model for this provider */
  readonly defaultModel?: string;
  /** Timeout in milliseconds */
  readonly timeout?: number;
  /** Enable automatic retries */
  readonly enableRetries?: boolean;
  /** Maximum retry attempts */
  readonly maxRetries?: number;
  /** Enable rate limiting */
  readonly enableRateLimiting?: boolean;
  /** Custom configuration */
  readonly customConfig?: Record<string, unknown>;
}

/**
 * Provider status
 */
export interface AIProviderStatus {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Whether provider is available */
  readonly isAvailable: boolean;
  /** Whether provider is configured */
  readonly isConfigured: boolean;
  /** Provider health status */
  readonly health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  /** Last health check timestamp */
  readonly lastHealthCheck?: string;
  /** Current rate limit info */
  readonly rateLimitInfo?: AIRateLimitInfo;
  /** Error information if unavailable */
  readonly error?: AIErrorInfo;
  /** Provider metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Provider metrics
 */
export interface AIProviderMetrics {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Total requests */
  readonly totalRequests: number;
  /** Successful requests */
  readonly successfulRequests: number;
  /** Failed requests */
  readonly failedRequests: number;
  /** Average response time in milliseconds */
  readonly averageResponseTime: number;
  /** Total tokens used */
  readonly totalTokens: AITokenUsage;
  /** Total cost in USD */
  readonly totalCost: number;
  /** Requests by model */
  readonly requestsByModel: Record<string, number>;
  /** Time period */
  readonly timePeriod: {
    readonly start: string;
    readonly end: string;
  };
}

/**
 * Provider capability check
 */
export interface AIProviderCapability {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Capability name */
  readonly capability:
    | 'streaming'
    | 'tool_calling'
    | 'vision'
    | 'reasoning'
    | 'json_mode'
    | 'web_search'
    | 'code_execution';
  /** Whether capability is supported */
  readonly supported: boolean;
  /** Models that support this capability */
  readonly supportedModels?: readonly string[];
  /** Additional information */
  readonly notes?: string;
}

/**
 * Provider model listing
 */
export interface AIProviderModelListing {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Available models */
  readonly models: readonly AIModel[];
  /** Total model count */
  readonly totalModels: number;
  /** Recommended models */
  readonly recommendedModels: readonly string[];
  /** Last updated timestamp */
  readonly lastUpdated: string;
}

/**
 * Provider pricing tier
 */
export interface AIProviderPricingTier {
  /** Tier name */
  readonly name: string;
  /** Tier description */
  readonly description: string;
  /** Included tokens per month */
  readonly includedTokens: number;
  /** Price per additional 1M tokens */
  readonly overagePrice: number;
  /** Monthly cost in USD */
  readonly monthlyCost: number;
  /** Available models */
  readonly availableModels: readonly string[];
  /** Features included */
  readonly features: readonly string[];
}

/**
 * Provider comparison
 */
export interface AIProviderComparison {
  /** Provider A */
  readonly providerA: AIProvider;
  /** Provider B */
  readonly providerB: AIProvider;
  /** Comparison metrics */
  readonly comparison: {
    /** Average cost comparison */
    readonly averageCost: {
      readonly providerA: number;
      readonly providerB: number;
      readonly difference: number;
      readonly percentageDifference: number;
    };
    /** Performance comparison */
    readonly performance: {
      readonly providerA: number;
      readonly providerB: number;
      readonly fasterProvider: AIProvider;
    };
    /** Capability comparison */
    readonly capabilities: {
      readonly capability: string;
      readonly providerA: boolean;
      readonly providerB: boolean;
    }[];
    /** Model count comparison */
    readonly modelCount: {
      readonly providerA: number;
      readonly providerB: number;
    };
  };
}

/**
 * Provider fallback configuration
 */
export interface AIProviderFallbackConfig {
  /** Primary provider */
  readonly primaryProvider: AIProvider;
  /** Fallback providers in order */
  readonly fallbackProviders: readonly AIProvider[];
  /** Conditions for fallback */
  readonly fallbackConditions: {
    /** Fallback on rate limit */
    readonly onRateLimit: boolean;
    /** Fallback on error */
    readonly onError: boolean;
    /** Fallback on timeout */
    readonly onTimeout: boolean;
    /** Fallback on unavailable */
    readonly onUnavailable: boolean;
  };
  /** Model mapping between providers */
  readonly modelMapping?: Record<string, Record<AIProvider, string>>;
}

/**
 * Provider usage quota
 */
export interface AIProviderUsageQuota {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Quota type */
  readonly quotaType: 'tokens' | 'requests' | 'cost';
  /** Total quota */
  readonly totalQuota: number;
  /** Used quota */
  readonly usedQuota: number;
  /** Remaining quota */
  readonly remainingQuota: number;
  /** Quota utilization percentage */
  readonly utilizationPercent: number;
  /** Reset timestamp */
  readonly resetsAt: string;
  /** Whether quota is exceeded */
  readonly isExceeded: boolean;
}

/**
 * Provider event types
 */
export type AIProviderEventType =
  | 'request_start'
  | 'request_complete'
  | 'request_error'
  | 'rate_limit_hit'
  | 'quota_exceeded'
  | 'fallback_triggered'
  | 'health_check'
  | 'config_updated';

/**
 * Provider event
 */
export interface AIProviderEvent {
  /** Event ID */
  readonly id: string;
  /** Event type */
  readonly type: AIProviderEventType;
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Event timestamp */
  readonly timestamp: string;
  /** Event data */
  readonly data: Record<string, unknown>;
  /** User ID if applicable */
  readonly userId?: string;
  /** Workspace ID if applicable */
  readonly workspaceId?: string;
}

/**
 * Provider webhook configuration
 */
export interface AIProviderWebhookConfig {
  /** Webhook URL */
  readonly url: string;
  /** Events to subscribe to */
  readonly events: readonly AIProviderEventType[];
  /** Secret for signature verification */
  readonly secret?: string;
  /** Whether webhook is enabled */
  readonly enabled: boolean;
  /** Custom headers */
  readonly headers?: Record<string, string>;
}

/**
 * Provider API version
 */
export interface AIProviderAPIVersion {
  /** Provider identifier */
  readonly provider: AIProvider;
  /** API version */
  readonly version: string;
  /** Is default version */
  readonly isDefault: boolean;
  /** Is deprecated */
  readonly isDeprecated: boolean;
  /** Deprecation date */
  readonly deprecationDate?: string;
  /** Sunset date */
  readonly sunsetDate?: string;
  /** Migration guide URL */
  readonly migrationGuide?: string;
}

/**
 * Provider integration
 */
export interface AIProviderIntegration {
  /** Integration ID */
  readonly id: string;
  /** Provider identifier */
  readonly provider: AIProvider;
  /** Integration name */
  readonly name: string;
  /** Integration type */
  readonly type: 'webhook' | 'plugin' | 'api' | 'sdk';
  /** Whether integration is active */
  readonly isActive: boolean;
  /** Configuration */
  readonly config: Record<string, unknown>;
  /** Created timestamp */
  readonly createdAt: string;
  /** Updated timestamp */
  readonly updatedAt: string;
}

/**
 * Type guard to check if a value is an AIProviderEventType
 */
export function isAIProviderEventType(
  value: unknown
): value is AIProviderEventType {
  const validTypes: AIProviderEventType[] = [
    'request_start',
    'request_complete',
    'request_error',
    'rate_limit_hit',
    'quota_exceeded',
    'fallback_triggered',
    'health_check',
    'config_updated',
  ];
  return (
    typeof value === 'string' &&
    validTypes.includes(value as AIProviderEventType)
  );
}
