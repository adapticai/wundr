/**
 * @wundr/slack-agent - Slack Workflow Capability
 *
 * Enables Orchestrator (Virtual Principal) agents to trigger and interact with Slack workflows
 * just like human users. Supports Workflow Builder webhook triggers, workflow step
 * interactions, and custom workflow automation.
 *
 * ## Important API Limitations
 *
 * Slack's Workflow Builder API has specific constraints:
 *
 * 1. **Workflow Listing**: There is no public API to list workflows programmatically.
 *    Workflows must be discovered through the Slack UI or by storing webhook URLs
 *    when workflows are created.
 *
 * 2. **Webhook Triggers**: Workflows are triggered via webhook URLs that are generated
 *    when creating a workflow with a "Webhook" trigger in Workflow Builder.
 *
 * 3. **Workflow Steps API**: The `workflows.stepCompleted` and `workflows.stepFailed`
 *    APIs are part of the legacy Workflow Steps API, which has been superseded by
 *    the new Slack Automation platform. These APIs still work for legacy integrations.
 *
 * 4. **New Automation Platform**: For advanced workflow automation, consider using
 *    Slack's new Automation platform (Deno-based), which provides more capabilities
 *    but requires a different integration approach.
 *
 * @packageDocumentation
 */

import { WebClient } from '@slack/web-api';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Payload for triggering a workflow via webhook
 */
export interface WorkflowPayload {
  /** Custom key-value pairs to pass to the workflow */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Variables to pass to a workflow trigger
 * All values must be strings as required by Slack's webhook interface
 */
export type WorkflowVariables = Record<string, string>;

/**
 * Payload received when handling a workflow step execution
 */
export interface WorkflowStepPayload {
  /** Type of event (workflow_step_execute) */
  type: 'workflow_step_execute';
  /** Callback ID for this workflow step */
  callbackId: string;
  /** Workflow step execute ID - required for completing the step */
  workflowStepExecuteId: string;
  /** Input values configured for this step */
  inputs: Record<string, {
    value: string | number | boolean;
  }>;
  /** User who triggered the workflow */
  triggeredUser?: {
    id: string;
    username?: string;
    name?: string;
  };
  /** Team/workspace information */
  team?: {
    id: string;
    domain?: string;
  };
  /** Timestamp when the workflow was triggered */
  eventTs?: string;
}

/**
 * Result from handling a workflow step
 */
export interface WorkflowStepResult {
  /** Whether the step was handled successfully */
  success: boolean;
  /** Output values to pass to subsequent workflow steps */
  outputs?: Record<string, string>;
  /** Error message if step failed */
  error?: string;
  /** Additional metadata about the step execution */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for a workflow step definition
 */
export interface WorkflowStepConfig {
  /** Unique callback ID for this step */
  callbackId: string;
  /** Display name for the step in Workflow Builder */
  name: string;
  /** Description of what the step does */
  description?: string;
  /** Input parameters expected by this step */
  inputs?: WorkflowStepInput[];
  /** Output parameters produced by this step */
  outputs?: WorkflowStepOutput[];
}

/**
 * Input definition for a workflow step
 */
export interface WorkflowStepInput {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'text' | 'user' | 'channel' | 'timestamp' | 'rich_text';
  /** Human-readable label */
  label: string;
  /** Whether this input is required */
  required?: boolean;
  /** Default value if not provided */
  defaultValue?: string;
}

/**
 * Output definition for a workflow step
 */
export interface WorkflowStepOutput {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'text' | 'user' | 'channel' | 'timestamp' | 'rich_text';
  /** Human-readable label */
  label: string;
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTriggerConfig {
  /** Webhook URL for the workflow */
  webhookUrl: string;
  /** Display name for this trigger (for reference) */
  name?: string;
  /** Description of what this workflow does */
  description?: string;
  /** Expected variables for this webhook */
  expectedVariables?: string[];
}

/**
 * Response from triggering a webhook
 */
export interface WebhookTriggerResponse {
  /** Whether the trigger was successful */
  ok: boolean;
  /** HTTP status code from the webhook */
  statusCode?: number;
  /** Response body if any */
  body?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration for the WorkflowCapability
 */
export interface WorkflowCapabilityConfig {
  /** Slack bot token (xoxb-*) - required for workflow step APIs */
  botToken?: string;
  /** User token (xoxp-*) - optional, for user-context operations */
  userToken?: string;
  /** Default timeout for webhook requests in milliseconds */
  webhookTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries?: number;
    /** Base delay between retries in ms */
    baseDelay?: number;
    /** Maximum delay between retries in ms */
    maxDelay?: number;
  };
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Error codes for workflow operations
 */
export enum WorkflowErrorCode {
  INVALID_WEBHOOK_URL = 'INVALID_WEBHOOK_URL',
  WEBHOOK_FAILED = 'WEBHOOK_FAILED',
  WEBHOOK_TIMEOUT = 'WEBHOOK_TIMEOUT',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  STEP_NOT_FOUND = 'STEP_NOT_FOUND',
  STEP_ALREADY_COMPLETED = 'STEP_ALREADY_COMPLETED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for workflow operations
 */
export class WorkflowError extends Error {
  constructor(
    public readonly code: WorkflowErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WorkflowError';
    Object.setPrototypeOf(this, WorkflowError.prototype);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validates a webhook URL format
 */
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Slack webhook URLs should be HTTPS and from hooks.slack.com
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.slack.com') ||
        parsed.hostname === 'hooks.slack.com')
    );
  } catch {
    return false;
  }
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

// =============================================================================
// Main Class
// =============================================================================

/**
 * SlackWorkflowCapability enables Orchestrator agents to trigger and interact with
 * Slack workflows programmatically.
 *
 * @example
 * ```typescript
 * import { SlackWorkflowCapability } from '@wundr/slack-agent/capabilities/workflows';
 *
 * const workflow = new SlackWorkflowCapability({
 *   botToken: process.env.SLACK_BOT_TOKEN,
 * });
 *
 * // Trigger a workflow via webhook
 * await workflow.triggerWorkflow('https://hooks.slack.com/workflows/...');
 *
 * // Trigger with variables
 * await workflow.triggerWorkflowWithVariables(
 *   'https://hooks.slack.com/workflows/...',
 *   { user_email: 'user@example.com', request_type: 'access' }
 * );
 *
 * // Complete a workflow step (in a step handler)
 * await workflow.completeWorkflowStep('workflow_step_execute_id', {
 *   result: 'approved',
 *   processed_by: 'orchestrator-agent'
 * });
 * ```
 */
export class SlackWorkflowCapability {
  private readonly client?: WebClient;
  private readonly config: Required<
    Pick<WorkflowCapabilityConfig, 'webhookTimeout' | 'debug'> & {
      retry: Required<NonNullable<WorkflowCapabilityConfig['retry']>>;
    }
  >;

  constructor(config: WorkflowCapabilityConfig = {}) {
    // Initialize Slack client if bot token provided
    if (config.botToken) {
      this.client = new WebClient(config.botToken, {
        retryConfig: { retries: 0 }, // We handle retries ourselves
      });
    }

    // Set configuration defaults
    this.config = {
      webhookTimeout: config.webhookTimeout ?? 30000,
      debug: config.debug ?? false,
      retry: {
        maxRetries: config.retry?.maxRetries ?? 3,
        baseDelay: config.retry?.baseDelay ?? 1000,
        maxDelay: config.retry?.maxDelay ?? 30000,
      },
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Debug logger
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.debug(`[SlackWorkflowCapability] ${message}`, ...args);
    }
  }

  /**
   * Makes an HTTP request to a webhook URL with retry support
   */
  private async makeWebhookRequest(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookTriggerResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retry.maxRetries; attempt++) {
      try {
        this.debug(`Webhook request attempt ${attempt + 1} to ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.webhookTimeout,
        );

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const body = await response.text();

          if (!response.ok) {
            // Check for rate limiting
            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              const delay = retryAfter
                ? parseInt(retryAfter, 10) * 1000
                : calculateBackoffDelay(
                    attempt,
                    this.config.retry.baseDelay,
                    this.config.retry.maxDelay,
                  );

              this.debug(`Rate limited, waiting ${delay}ms`);
              await sleep(delay);
              continue;
            }

            throw new WorkflowError(
              WorkflowErrorCode.WEBHOOK_FAILED,
              `Webhook request failed with status ${response.status}: ${body}`,
              { statusCode: response.status, body },
            );
          }

          return {
            ok: true,
            statusCode: response.status,
            body,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === 'AbortError') {
          throw new WorkflowError(
            WorkflowErrorCode.WEBHOOK_TIMEOUT,
            `Webhook request timed out after ${this.config.webhookTimeout}ms`,
            { url },
          );
        }

        // Non-retryable errors
        if (error instanceof WorkflowError) {
          const nonRetryableCodes = [
            WorkflowErrorCode.INVALID_WEBHOOK_URL,
            WorkflowErrorCode.INVALID_PAYLOAD,
            WorkflowErrorCode.PERMISSION_DENIED,
          ];
          if (nonRetryableCodes.includes(error.code)) {
            throw error;
          }
        }

        // Calculate backoff for next attempt
        if (attempt < this.config.retry.maxRetries) {
          const delay = calculateBackoffDelay(
            attempt,
            this.config.retry.baseDelay,
            this.config.retry.maxDelay,
          );
          this.debug(`Retrying after ${delay}ms due to error:`, error);
          await sleep(delay);
        }
      }
    }

    throw new WorkflowError(
      WorkflowErrorCode.NETWORK_ERROR,
      lastError?.message || 'Failed to trigger webhook after retries',
      { originalError: lastError?.message },
    );
  }

  /**
   * Maps Slack API errors to WorkflowErrorCode
   */
  private mapSlackError(slackError: string): WorkflowErrorCode {
    const errorMap: Record<string, WorkflowErrorCode> = {
      invalid_auth: WorkflowErrorCode.INVALID_TOKEN,
      not_authed: WorkflowErrorCode.INVALID_TOKEN,
      token_revoked: WorkflowErrorCode.INVALID_TOKEN,
      missing_scope: WorkflowErrorCode.PERMISSION_DENIED,
      workflow_step_not_found: WorkflowErrorCode.STEP_NOT_FOUND,
      workflow_step_already_completed: WorkflowErrorCode.STEP_ALREADY_COMPLETED,
      rate_limited: WorkflowErrorCode.RATE_LIMITED,
      ratelimited: WorkflowErrorCode.RATE_LIMITED,
    };

    return errorMap[slackError] || WorkflowErrorCode.UNKNOWN_ERROR;
  }

  // ===========================================================================
  // Public API: Workflow Triggering
  // ===========================================================================

  /**
   * Triggers a workflow via its webhook URL
   *
   * @param webhookUrl - The webhook URL generated by Workflow Builder
   * @param payload - Optional payload to send with the trigger
   * @returns Response from the webhook
   *
   * @example
   * ```typescript
   * // Simple trigger
   * await workflow.triggerWorkflow('https://hooks.slack.com/workflows/...');
   *
   * // With payload
   * await workflow.triggerWorkflow('https://hooks.slack.com/workflows/...', {
   *   event: 'user_signup',
   *   source: 'orchestrator-agent'
   * });
   * ```
   */
  async triggerWorkflow(
    webhookUrl: string,
    payload?: WorkflowPayload,
  ): Promise<void> {
    // Validate webhook URL
    if (!isValidWebhookUrl(webhookUrl)) {
      throw new WorkflowError(
        WorkflowErrorCode.INVALID_WEBHOOK_URL,
        'Invalid webhook URL. Must be an HTTPS URL from Slack.',
        { webhookUrl },
      );
    }

    this.debug(`Triggering workflow: ${webhookUrl}`);

    const response = await this.makeWebhookRequest(webhookUrl, payload || {});

    if (!response.ok) {
      throw new WorkflowError(
        WorkflowErrorCode.WEBHOOK_FAILED,
        `Workflow trigger failed: ${response.error}`,
        { webhookUrl, response },
      );
    }

    this.debug('Workflow triggered successfully');
  }

  /**
   * Triggers a workflow with typed variables
   *
   * Variables are passed as key-value pairs where all values must be strings.
   * These correspond to the variables configured in Workflow Builder.
   *
   * @param webhookUrl - The webhook URL generated by Workflow Builder
   * @param variables - Variables to pass to the workflow
   *
   * @example
   * ```typescript
   * await workflow.triggerWorkflowWithVariables(
   *   'https://hooks.slack.com/workflows/...',
   *   {
   *     user_email: 'john@example.com',
   *     request_type: 'vacation',
   *     start_date: '2024-03-15',
   *     end_date: '2024-03-20'
   *   }
   * );
   * ```
   */
  async triggerWorkflowWithVariables(
    webhookUrl: string,
    variables: WorkflowVariables,
  ): Promise<void> {
    // Validate webhook URL
    if (!isValidWebhookUrl(webhookUrl)) {
      throw new WorkflowError(
        WorkflowErrorCode.INVALID_WEBHOOK_URL,
        'Invalid webhook URL. Must be an HTTPS URL from Slack.',
        { webhookUrl },
      );
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value !== 'string') {
        throw new WorkflowError(
          WorkflowErrorCode.INVALID_PAYLOAD,
          `Variable "${key}" must be a string, got ${typeof value}`,
          { key, value },
        );
      }
    }

    this.debug(`Triggering workflow with ${Object.keys(variables).length} variables`);

    const response = await this.makeWebhookRequest(webhookUrl, variables);

    if (!response.ok) {
      throw new WorkflowError(
        WorkflowErrorCode.WEBHOOK_FAILED,
        `Workflow trigger failed: ${response.error}`,
        { webhookUrl, response },
      );
    }

    this.debug('Workflow triggered with variables successfully');
  }

  // ===========================================================================
  // Public API: Workflow Step Handling
  // ===========================================================================

  /**
   * Handles a workflow step execution request
   *
   * This method processes incoming workflow step payloads and returns a result.
   * It's meant to be used as part of a step handler implementation.
   *
   * @param stepPayload - The workflow step execution payload
   * @returns Result of handling the step
   *
   * @example
   * ```typescript
   * // In your event handler
   * app.event('workflow_step_execute', async ({ event }) => {
   *   const payload: WorkflowStepPayload = {
   *     type: 'workflow_step_execute',
   *     callbackId: event.callback_id,
   *     workflowStepExecuteId: event.workflow_step.workflow_step_execute_id,
   *     inputs: event.workflow_step.inputs,
   *     triggeredUser: { id: event.user_id },
   *   };
   *
   *   const result = await workflow.handleWorkflowStep(payload);
   *
   *   if (result.success) {
   *     await workflow.completeWorkflowStep(
   *       payload.workflowStepExecuteId,
   *       result.outputs
   *     );
   *   } else {
   *     await workflow.failWorkflowStep(
   *       payload.workflowStepExecuteId,
   *       result.error || 'Unknown error'
   *     );
   *   }
   * });
   * ```
   */
  async handleWorkflowStep(
    stepPayload: WorkflowStepPayload,
  ): Promise<WorkflowStepResult> {
    this.debug(`Handling workflow step: ${stepPayload.callbackId}`);

    try {
      // Validate the payload
      if (!stepPayload.workflowStepExecuteId) {
        throw new WorkflowError(
          WorkflowErrorCode.INVALID_PAYLOAD,
          'Missing workflowStepExecuteId in step payload',
          { payload: stepPayload },
        );
      }

      if (!stepPayload.callbackId) {
        throw new WorkflowError(
          WorkflowErrorCode.INVALID_PAYLOAD,
          'Missing callbackId in step payload',
          { payload: stepPayload },
        );
      }

      // Extract input values
      const inputValues: Record<string, string | number | boolean> = {};
      for (const [key, input] of Object.entries(stepPayload.inputs || {})) {
        inputValues[key] = input.value;
      }

      this.debug('Step inputs:', inputValues);

      // Return a successful result with the processed inputs
      // The actual step logic should be implemented by the consumer
      return {
        success: true,
        outputs: {},
        metadata: {
          callbackId: stepPayload.callbackId,
          triggeredBy: stepPayload.triggeredUser?.id,
          processedAt: new Date().toISOString(),
          inputCount: Object.keys(inputValues).length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.debug('Step handling failed:', error);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          callbackId: stepPayload.callbackId,
          failedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Completes a workflow step execution successfully
   *
   * This signals to Slack that the step has completed and provides
   * output values for subsequent steps in the workflow.
   *
   * @param workflowStepExecuteId - The execution ID from the step payload
   * @param outputs - Optional output values for subsequent steps
   *
   * @example
   * ```typescript
   * await workflow.completeWorkflowStep('execution_id_123', {
   *   approval_status: 'approved',
   *   approver: 'U123456',
   *   approved_at: new Date().toISOString()
   * });
   * ```
   */
  async completeWorkflowStep(
    workflowStepExecuteId: string,
    outputs?: Record<string, string>,
  ): Promise<void> {
    if (!this.client) {
      throw new WorkflowError(
        WorkflowErrorCode.INVALID_TOKEN,
        'Bot token required to complete workflow steps',
      );
    }

    this.debug(`Completing workflow step: ${workflowStepExecuteId}`);

    try {
      // Format outputs for Slack API
      const formattedOutputs: Record<string, { value: string }> = {};
      if (outputs) {
        for (const [key, value] of Object.entries(outputs)) {
          formattedOutputs[key] = { value };
        }
      }

      // Use the workflows.stepCompleted API
      // Note: This is part of the legacy Workflow Steps API
      const result = await this.client.apiCall('workflows.stepCompleted', {
        workflow_step_execute_id: workflowStepExecuteId,
        outputs: formattedOutputs,
      });

      if (!result.ok) {
        const errorCode = this.mapSlackError(result.error as string);
        throw new WorkflowError(
          errorCode,
          `Failed to complete workflow step: ${result.error}`,
          { workflowStepExecuteId, response: result },
        );
      }

      this.debug('Workflow step completed successfully');
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }

      throw new WorkflowError(
        WorkflowErrorCode.UNKNOWN_ERROR,
        `Failed to complete workflow step: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { workflowStepExecuteId },
      );
    }
  }

  /**
   * Fails a workflow step execution
   *
   * This signals to Slack that the step has failed, which will typically
   * halt the workflow or trigger error handling.
   *
   * @param workflowStepExecuteId - The execution ID from the step payload
   * @param error - Error message describing what went wrong
   *
   * @example
   * ```typescript
   * await workflow.failWorkflowStep(
   *   'execution_id_123',
   *   'Failed to process request: invalid input data'
   * );
   * ```
   */
  async failWorkflowStep(
    workflowStepExecuteId: string,
    error: string,
  ): Promise<void> {
    if (!this.client) {
      throw new WorkflowError(
        WorkflowErrorCode.INVALID_TOKEN,
        'Bot token required to fail workflow steps',
      );
    }

    this.debug(`Failing workflow step: ${workflowStepExecuteId} - ${error}`);

    try {
      // Use the workflows.stepFailed API
      // Note: This is part of the legacy Workflow Steps API
      const result = await this.client.apiCall('workflows.stepFailed', {
        workflow_step_execute_id: workflowStepExecuteId,
        error: {
          message: error,
        },
      });

      if (!result.ok) {
        const errorCode = this.mapSlackError(result.error as string);
        throw new WorkflowError(
          errorCode,
          `Failed to mark workflow step as failed: ${result.error}`,
          { workflowStepExecuteId, response: result },
        );
      }

      this.debug('Workflow step marked as failed');
    } catch (err) {
      if (err instanceof WorkflowError) {
        throw err;
      }

      throw new WorkflowError(
        WorkflowErrorCode.UNKNOWN_ERROR,
        `Failed to mark workflow step as failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        { workflowStepExecuteId },
      );
    }
  }

  // ===========================================================================
  // Public API: Workflow Registry
  // ===========================================================================

  /**
   * Registry for managing webhook trigger configurations
   *
   * Since Slack doesn't provide a public API to list workflows, this serves
   * as a local registry for storing and retrieving webhook configurations.
   */
  private readonly webhookRegistry: Map<string, WebhookTriggerConfig> = new Map();

  /**
   * Registers a webhook trigger configuration
   *
   * @param id - Unique identifier for this trigger
   * @param config - Webhook configuration
   *
   * @example
   * ```typescript
   * workflow.registerWebhookTrigger('vacation-request', {
   *   webhookUrl: 'https://hooks.slack.com/workflows/...',
   *   name: 'Vacation Request Workflow',
   *   description: 'Submits a vacation request for approval',
   *   expectedVariables: ['user_email', 'start_date', 'end_date']
   * });
   * ```
   */
  registerWebhookTrigger(id: string, config: WebhookTriggerConfig): void {
    if (!isValidWebhookUrl(config.webhookUrl)) {
      throw new WorkflowError(
        WorkflowErrorCode.INVALID_WEBHOOK_URL,
        'Invalid webhook URL in trigger configuration',
        { id, webhookUrl: config.webhookUrl },
      );
    }

    this.webhookRegistry.set(id, config);
    this.debug(`Registered webhook trigger: ${id}`);
  }

  /**
   * Gets a registered webhook trigger configuration
   *
   * @param id - Trigger identifier
   * @returns The webhook configuration or undefined if not found
   */
  getWebhookTrigger(id: string): WebhookTriggerConfig | undefined {
    return this.webhookRegistry.get(id);
  }

  /**
   * Lists all registered webhook triggers
   *
   * @returns Array of [id, config] pairs
   */
  listWebhookTriggers(): Array<[string, WebhookTriggerConfig]> {
    return Array.from(this.webhookRegistry.entries());
  }

  /**
   * Removes a registered webhook trigger
   *
   * @param id - Trigger identifier
   * @returns True if the trigger was removed, false if it didn't exist
   */
  removeWebhookTrigger(id: string): boolean {
    const removed = this.webhookRegistry.delete(id);
    if (removed) {
      this.debug(`Removed webhook trigger: ${id}`);
    }
    return removed;
  }

  /**
   * Triggers a registered workflow by its ID
   *
   * @param triggerId - The registered trigger ID
   * @param variables - Optional variables to pass
   *
   * @example
   * ```typescript
   * // First register the trigger
   * workflow.registerWebhookTrigger('vacation-request', {
   *   webhookUrl: 'https://hooks.slack.com/workflows/...',
   *   expectedVariables: ['user_email', 'start_date', 'end_date']
   * });
   *
   * // Then trigger by ID
   * await workflow.triggerRegisteredWorkflow('vacation-request', {
   *   user_email: 'john@example.com',
   *   start_date: '2024-03-15',
   *   end_date: '2024-03-20'
   * });
   * ```
   */
  async triggerRegisteredWorkflow(
    triggerId: string,
    variables?: WorkflowVariables,
  ): Promise<void> {
    const config = this.webhookRegistry.get(triggerId);

    if (!config) {
      throw new WorkflowError(
        WorkflowErrorCode.STEP_NOT_FOUND,
        `No webhook trigger registered with ID: ${triggerId}`,
        { triggerId },
      );
    }

    // Validate expected variables if defined
    if (config.expectedVariables && variables) {
      const missingVars = config.expectedVariables.filter(
        v => !(v in variables),
      );
      if (missingVars.length > 0) {
        throw new WorkflowError(
          WorkflowErrorCode.INVALID_PAYLOAD,
          `Missing expected variables: ${missingVars.join(', ')}`,
          { triggerId, missingVars, providedVars: Object.keys(variables) },
        );
      }
    }

    if (variables) {
      await this.triggerWorkflowWithVariables(config.webhookUrl, variables);
    } else {
      await this.triggerWorkflow(config.webhookUrl);
    }
  }

  // ===========================================================================
  // Public API: Utility Methods
  // ===========================================================================

  /**
   * Validates a webhook URL without making a request
   *
   * @param webhookUrl - URL to validate
   * @returns True if the URL appears to be a valid Slack webhook URL
   */
  isValidWebhookUrl(webhookUrl: string): boolean {
    return isValidWebhookUrl(webhookUrl);
  }

  /**
   * Tests connectivity to a webhook URL
   *
   * @param webhookUrl - URL to test
   * @returns Test result with success status and any error details
   */
  async testWebhookUrl(webhookUrl: string): Promise<{
    ok: boolean;
    error?: string;
    latencyMs?: number;
  }> {
    if (!isValidWebhookUrl(webhookUrl)) {
      return {
        ok: false,
        error: 'Invalid webhook URL format',
      };
    }

    const startTime = Date.now();

    try {
      // Send an empty payload as a test
      // Note: This may or may not succeed depending on the workflow configuration
      const response = await this.makeWebhookRequest(webhookUrl, {});

      return {
        ok: response.ok,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Checks if a Slack client is configured
   */
  hasSlackClient(): boolean {
    return !!this.client;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SlackWorkflowCapability instance
 *
 * @param config - Configuration options
 * @returns SlackWorkflowCapability instance
 */
export function createWorkflowCapability(
  config: WorkflowCapabilityConfig = {},
): SlackWorkflowCapability {
  return new SlackWorkflowCapability(config);
}

/**
 * Creates a SlackWorkflowCapability from environment variables
 *
 * Looks for:
 * - SLACK_BOT_TOKEN (xoxb-*)
 * - SLACK_USER_TOKEN (xoxp-*)
 *
 * @param options - Additional configuration options
 * @returns SlackWorkflowCapability instance
 */
export function createWorkflowCapabilityFromEnv(
  options: Omit<WorkflowCapabilityConfig, 'botToken' | 'userToken'> = {},
): SlackWorkflowCapability {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const userToken = process.env.SLACK_USER_TOKEN;

  return new SlackWorkflowCapability({
    botToken,
    userToken,
    ...options,
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default SlackWorkflowCapability;
