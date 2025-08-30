/**
 * MCP Workflow Engine
 * Orchestrates complex workflows across multiple MCP tools
 */

import { EventEmitter } from 'events';
import { 
  MCPWorkflow, 
  MCPWorkflowStep, 
  WorkflowExecution,
  AllMCPTools,
  MCPResponse 
} from '../types/mcp-tools';

export interface WorkflowEngineConfig {
  maxConcurrentSteps: number;
  defaultTimeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface WorkflowContext {
  executionId: string;
  variables: Record<string, any>;
  stepResults: Record<string, any>;
  metadata: {
    startedAt: number;
    userId?: string;
    sessionId?: string;
    tags?: string[];
  };
}

export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  retryCount: number;
}

/**
 * Cross-Tool Workflow Patterns
 */
export class WorkflowPatterns {
  
  /**
   * Research & Analysis Pipeline
   * Firecrawl -> Context7 -> Sequential Thinking
   */
  static createResearchPipeline(query: string, sources: string[]): MCPWorkflow {
    return {
      id: `research-${Date.now()}`,
      name: 'Research & Analysis Pipeline',
      description: 'Complete research workflow with data collection and analysis',
      steps: [
        {
          id: 'collect-data',
          tool: 'firecrawl',
          action: 'batchCrawl',
          parameters: {
            requests: sources.map(url => ({
              url,
              options: { 
                formats: ['markdown', 'structured'],
                maxDepth: 3 
              }
            }))
          },
          dependencies: [],
          timeout: 300000 // 5 minutes
        },
        {
          id: 'store-context',
          tool: 'context7',
          action: 'store',
          parameters: {
            data: '${collect-data.result}',
            options: {
              tags: ['research', query],
              category: 'research-data'
            }
          },
          dependencies: ['collect-data']
        },
        {
          id: 'analyze-findings',
          tool: 'sequentialThinking',
          action: 'analyze',
          parameters: {
            data: '${collect-data.result}',
            reasoning_model: 'tree-of-thought',
            validation: true
          },
          dependencies: ['store-context']
        },
        {
          id: 'generate-report',
          tool: 'context7',
          action: 'store',
          parameters: {
            data: {
              query,
              sources,
              analysis: '${analyze-findings.result}',
              generated_at: new Date().toISOString()
            },
            options: {
              tags: ['research-report', query],
              category: 'final-reports'
            }
          },
          dependencies: ['analyze-findings']
        }
      ],
      metadata: {
        createdAt: Date.now(),
        version: '1.0.0',
        tags: ['research', 'analysis', 'pipeline']
      }
    };
  }

  /**
   * Automated Testing Workflow
   * Playwright + Browser MCP validation
   */
  static createTestingWorkflow(testSuite: any): MCPWorkflow {
    return {
      id: `testing-${Date.now()}`,
      name: 'Comprehensive Testing Workflow',
      description: 'Automated testing across multiple browser environments',
      steps: [
        {
          id: 'plan-tests',
          tool: 'sequentialThinking',
          action: 'decomposeTask',
          parameters: {
            task: `Execute test suite: ${testSuite.name}`
          },
          dependencies: []
        },
        {
          id: 'playwright-tests',
          tool: 'playwright',
          action: 'executeTest',
          parameters: {
            instance: { browser: 'chromium', headless: true },
            script: testSuite.playwrightScript
          },
          dependencies: ['plan-tests']
        },
        {
          id: 'browser-mcp-validation',
          tool: 'browserMCP',
          action: 'executeScript',
          parameters: {
            target: { tabId: 'active' },
            code: testSuite.validationScript
          },
          dependencies: ['playwright-tests']
        },
        {
          id: 'store-results',
          tool: 'context7',
          action: 'store',
          parameters: {
            data: {
              test_suite: testSuite.name,
              playwright_results: '${playwright-tests.result}',
              validation_results: '${browser-mcp-validation.result}',
              timestamp: new Date().toISOString()
            },
            options: {
              tags: ['testing', testSuite.name],
              category: 'test-results'
            }
          },
          dependencies: ['browser-mcp-validation']
        },
        {
          id: 'analyze-results',
          tool: 'sequentialThinking',
          action: 'analyze',
          parameters: {
            data: {
              playwright: '${playwright-tests.result}',
              validation: '${browser-mcp-validation.result}'
            },
            reasoning_model: 'step-by-step'
          },
          dependencies: ['store-results']
        }
      ],
      metadata: {
        createdAt: Date.now(),
        version: '1.0.0',
        tags: ['testing', 'automation', 'validation']
      }
    };
  }

  /**
   * Web Monitoring & Alert Workflow
   * Firecrawl + Browser MCP + Context7 + Sequential Thinking
   */
  static createMonitoringWorkflow(urls: string[], alertCriteria: any): MCPWorkflow {
    return {
      id: `monitoring-${Date.now()}`,
      name: 'Web Monitoring & Alert Workflow',
      description: 'Monitor websites for changes and trigger alerts',
      steps: [
        {
          id: 'establish-baselines',
          tool: 'firecrawl',
          action: 'batchCrawl',
          parameters: {
            requests: urls.map(url => ({
              url,
              options: { formats: ['structured', 'text'] }
            }))
          },
          dependencies: []
        },
        {
          id: 'store-baselines',
          tool: 'context7',
          action: 'store',
          parameters: {
            data: '${establish-baselines.result}',
            options: {
              tags: ['baseline', 'monitoring'],
              category: 'monitoring-baselines'
            }
          },
          dependencies: ['establish-baselines']
        },
        {
          id: 'current-scan',
          tool: 'firecrawl',
          action: 'batchCrawl',
          parameters: {
            requests: urls.map(url => ({
              url,
              options: { formats: ['structured', 'text'] }
            }))
          },
          dependencies: ['store-baselines']
        },
        {
          id: 'browser-verification',
          tool: 'browserMCP',
          action: 'captureVisibleTab',
          parameters: {
            format: 'png',
            quality: 90
          },
          dependencies: ['current-scan']
        },
        {
          id: 'compare-changes',
          tool: 'sequentialThinking',
          action: 'analyze',
          parameters: {
            data: {
              baseline: '${establish-baselines.result}',
              current: '${current-scan.result}',
              screenshot: '${browser-verification.result}',
              criteria: alertCriteria
            },
            reasoning_model: 'step-by-step'
          },
          dependencies: ['browser-verification']
        },
        {
          id: 'store-comparison',
          tool: 'context7',
          action: 'store',
          parameters: {
            data: {
              comparison: '${compare-changes.result}',
              timestamp: new Date().toISOString(),
              urls: urls
            },
            options: {
              tags: ['monitoring', 'comparison'],
              category: 'monitoring-results'
            }
          },
          dependencies: ['compare-changes']
        }
      ],
      metadata: {
        createdAt: Date.now(),
        version: '1.0.0',
        tags: ['monitoring', 'alerts', 'change-detection']
      }
    };
  }
}

/**
 * MCP Workflow Engine
 */
export class MCPWorkflowEngine extends EventEmitter {
  private mcpTools: AllMCPTools;
  private config: WorkflowEngineConfig;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionQueue: Array<{ workflow: MCPWorkflow; context: WorkflowContext }> = [];
  private isProcessing = false;

  constructor(mcpTools: AllMCPTools, config: WorkflowEngineConfig) {
    super();
    this.mcpTools = mcpTools;
    this.config = config;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: MCPWorkflow, 
    context?: Partial<WorkflowContext>
  ): Promise<WorkflowExecution> {
    const executionId = `exec-${workflow.id}-${Date.now()}`;
    const fullContext: WorkflowContext = {
      executionId,
      variables: context?.variables || {},
      stepResults: {},
      metadata: {
        startedAt: Date.now(),
        ...context?.metadata
      }
    };

    const execution: WorkflowExecution = {
      workflowId: workflow.id,
      executionId,
      status: 'running',
      startedAt: Date.now(),
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        status: 'pending'
      })),
      results: {},
      errors: []
    };

    this.activeExecutions.set(executionId, execution);
    this.emit('workflow-started', { executionId, workflow });

    try {
      await this.processWorkflowSteps(workflow, execution, fullContext);
      execution.status = 'completed';
      execution.completedAt = Date.now();
      this.emit('workflow-completed', { executionId, execution });
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.emit('workflow-failed', { executionId, execution, error });
    }

    return execution;
  }

  /**
   * Process workflow steps with dependency resolution
   */
  private async processWorkflowSteps(
    workflow: MCPWorkflow,
    execution: WorkflowExecution,
    context: WorkflowContext
  ): Promise<void> {
    const stepMap = new Map(workflow.steps.map(step => [step.id, step]));
    const completedSteps = new Set<string>();
    const runningSteps = new Set<string>();
    const maxConcurrent = this.config.maxConcurrentSteps;

    while (completedSteps.size < workflow.steps.length) {
      // Find steps that can be executed (dependencies satisfied)
      const readySteps = workflow.steps.filter(step => 
        !completedSteps.has(step.id) &&
        !runningSteps.has(step.id) &&
        step.dependencies.every(dep => completedSteps.has(dep)) &&
        runningSteps.size < maxConcurrent
      );

      if (readySteps.length === 0) {
        // Check if we're waiting for running steps or if we're stuck
        if (runningSteps.size === 0) {
          throw new Error('Workflow execution stuck - circular dependencies or unsatisfied dependencies');
        }
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Execute ready steps in parallel
      const stepPromises = readySteps.map(async (step) => {
        runningSteps.add(step.id);
        const stepExecution = execution.steps.find(s => s.stepId === step.id)!;
        stepExecution.status = 'running';
        stepExecution.startedAt = Date.now();

        try {
          const result = await this.executeStep(step, context);
          
          stepExecution.status = 'completed';
          stepExecution.completedAt = Date.now();
          stepExecution.result = result.result;
          
          context.stepResults[step.id] = result;
          execution.results[step.id] = result.result;
          
          completedSteps.add(step.id);
          this.emit('step-completed', { 
            executionId: context.executionId, 
            stepId: step.id, 
            result 
          });
        } catch (error) {
          stepExecution.status = 'failed';
          stepExecution.completedAt = Date.now();
          stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
          
          execution.errors.push(`Step ${step.id}: ${stepExecution.error}`);
          this.emit('step-failed', { 
            executionId: context.executionId, 
            stepId: step.id, 
            error 
          });
          
          throw error; // Propagate error to stop workflow
        } finally {
          runningSteps.delete(step.id);
        }
      });

      await Promise.all(stepPromises);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: MCPWorkflowStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = step.retries || this.config.retryPolicy.maxRetries;

    // Resolve parameters with context variables and step results
    const resolvedParameters = this.resolveParameters(step.parameters, context);

    while (retryCount <= maxRetries) {
      try {
        const result = await this.callMCPTool(step.tool, step.action, resolvedParameters);
        
        return {
          stepId: step.id,
          success: true,
          result: result.data,
          executionTime: Date.now() - startTime,
          retryCount
        };
      } catch (error) {
        retryCount++;
        
        if (retryCount <= maxRetries) {
          const delay = this.config.retryPolicy.initialDelay * 
                       Math.pow(this.config.retryPolicy.backoffMultiplier, retryCount - 1);
          
          this.emit('step-retry', {
            executionId: context.executionId,
            stepId: step.id,
            retryCount,
            delay,
            error
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          return {
            stepId: step.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - startTime,
            retryCount
          };
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Unexpected execution path');
  }

  /**
   * Resolve parameter placeholders with context values
   */
  private resolveParameters(
    parameters: Record<string, any>,
    context: WorkflowContext
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      resolved[key] = this.resolveValue(value, context);
    }

    return resolved;
  }

  /**
   * Resolve a single value with placeholders
   */
  private resolveValue(value: any, context: WorkflowContext): any {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const placeholder = value.slice(2, -1);
      
      // Check if it's a step result reference
      if (placeholder.includes('.')) {
        const [stepId, path] = placeholder.split('.', 2);
        const stepResult = context.stepResults[stepId];
        
        if (stepResult && path === 'result') {
          return stepResult.result;
        }
        
        // Could implement deeper path resolution here if needed
        return this.getNestedValue(stepResult?.result, path.replace('result.', ''));
      }
      
      // Check if it's a context variable
      return context.variables[placeholder] || value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.resolveValue(item, context));
    }
    
    if (typeof value === 'object' && value !== null) {
      const resolved: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolveValue(v, context);
      }
      return resolved;
    }
    
    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Call the appropriate MCP tool
   */
  private async callMCPTool(
    toolName: string,
    action: string,
    parameters: Record<string, any>
  ): Promise<MCPResponse> {
    const timeout = this.config.defaultTimeout;
    
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool ${toolName}.${action} timed out after ${timeout}ms`));
      }, timeout);

      try {
        let result: MCPResponse;

        switch (toolName) {
          case 'firecrawl':
            result = await this.callFirecrawl(action, parameters);
            break;
          case 'context7':
            result = await this.callContext7(action, parameters);
            break;
          case 'playwright':
            result = await this.callPlaywright(action, parameters);
            break;
          case 'browserMCP':
            result = await this.callBrowserMCP(action, parameters);
            break;
          case 'sequentialThinking':
            result = await this.callSequentialThinking(action, parameters);
            break;
          default:
            throw new Error(`Unknown MCP tool: ${toolName}`);
        }

        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * MCP Tool-specific call handlers
   */
  private async callFirecrawl(action: string, params: any): Promise<MCPResponse> {
    switch (action) {
      case 'crawl':
        return this.mcpTools.firecrawl.crawl(params);
      case 'batchCrawl':
        return this.mcpTools.firecrawl.batchCrawl(params.requests);
      case 'mapSite':
        return this.mcpTools.firecrawl.mapSite(params);
      case 'extract':
        return this.mcpTools.firecrawl.extract(params);
      default:
        throw new Error(`Unknown Firecrawl action: ${action}`);
    }
  }

  private async callContext7(action: string, params: any): Promise<MCPResponse> {
    switch (action) {
      case 'store':
        return this.mcpTools.context7.store(params);
      case 'retrieve':
        return this.mcpTools.context7.retrieve(params);
      case 'search':
        return this.mcpTools.context7.search(params);
      case 'buildKnowledgeGraph':
        return this.mcpTools.context7.buildKnowledgeGraph(params);
      default:
        throw new Error(`Unknown Context7 action: ${action}`);
    }
  }

  private async callPlaywright(action: string, params: any): Promise<MCPResponse> {
    switch (action) {
      case 'launch':
        return this.mcpTools.playwright.launch(params);
      case 'executeTest':
        return this.mcpTools.playwright.executeTest(params.instance, params.script);
      case 'captureScreenshot':
        return this.mcpTools.playwright.captureScreenshot(params.instance, params.url, params.options);
      case 'auditPerformance':
        return this.mcpTools.playwright.auditPerformance(params.url, params.metrics);
      default:
        throw new Error(`Unknown Playwright action: ${action}`);
    }
  }

  private async callBrowserMCP(action: string, params: any): Promise<MCPResponse> {
    switch (action) {
      case 'connectToChrome':
        return this.mcpTools.browserMCP.connectToChrome();
      case 'executeScript':
        return this.mcpTools.browserMCP.executeScript(params);
      case 'captureVisibleTab':
        return this.mcpTools.browserMCP.captureVisibleTab(params);
      case 'getAllTabs':
        return this.mcpTools.browserMCP.getAllTabs();
      case 'navigate':
        return this.mcpTools.browserMCP.navigate(params.url, params.tabId);
      default:
        throw new Error(`Unknown Browser MCP action: ${action}`);
    }
  }

  private async callSequentialThinking(action: string, params: any): Promise<MCPResponse> {
    switch (action) {
      case 'startSession':
        return this.mcpTools.sequentialThinking.startSession(params);
      case 'analyze':
        return this.mcpTools.sequentialThinking.analyze(params);
      case 'decomposeTask':
        return this.mcpTools.sequentialThinking.decomposeTask(params.task);
      case 'buildDecisionTree':
        return this.mcpTools.sequentialThinking.buildDecisionTree(params);
      case 'validate':
        return this.mcpTools.sequentialThinking.validate(params);
      default:
        throw new Error(`Unknown Sequential Thinking action: ${action}`);
    }
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * List all active executions
   */
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cancel a workflow execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = Date.now();
      this.emit('workflow-cancelled', { executionId });
    }
  }

  /**
   * Clean up completed executions
   */
  cleanup(olderThan?: number): void {
    const cutoff = olderThan || (Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (execution.status !== 'running' && execution.startedAt < cutoff) {
        this.activeExecutions.delete(id);
      }
    }
  }
}

export default {
  MCPWorkflowEngine,
  WorkflowPatterns
};