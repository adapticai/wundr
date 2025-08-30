/**
 * Type definitions for MCP Tools Integration
 * Provides comprehensive typing for all five MCP tools
 */

// Common MCP interfaces
export interface MCPToolConfig {
  name: string;
  version: string;
  server: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
  capabilities?: Record<string, any>;
  integration?: {
    claude_flow?: Record<string, any>;
  };
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: number;
    executionTime: number;
    tokensUsed?: number;
  };
}

// Firecrawl MCP Types
export namespace FirecrawlMCP {
  export interface CrawlOptions {
    formats?: Array<'text' | 'markdown' | 'json' | 'structured' | 'html'>;
    onlyMainContent?: boolean;
    includePDFs?: boolean;
    maxDepth?: number;
    excludePatterns?: string[];
    followRedirects?: boolean;
    timeout?: number;
    headers?: Record<string, string>;
    userAgent?: string;
    respectRobotsTxt?: boolean;
    delay?: number;
  }

  export interface CrawlRequest {
    url: string;
    options?: CrawlOptions;
  }

  export interface CrawlResult {
    url: string;
    title: string;
    content: string;
    markdown?: string;
    structured?: any;
    metadata: {
      timestamp: number;
      contentLength: number;
      responseTime: number;
      statusCode: number;
      links: string[];
      images: string[];
    };
  }

  export interface SiteMapOptions {
    maxDepth?: number;
    respectRobotsTxt?: boolean;
    excludePatterns?: string[];
    includePaths?: string[];
  }

  export interface SiteMapRequest {
    url: string;
    options?: SiteMapOptions;
  }

  export interface SiteMapResult {
    baseUrl: string;
    totalPages: number;
    pages: Array<{
      url: string;
      title: string;
      depth: number;
      lastModified?: string;
    }>;
    metadata: {
      crawlDuration: number;
      timestamp: number;
    };
  }

  export interface ExtractRequest {
    url: string;
    selector?: string;
    format?: 'text' | 'html' | 'markdown';
    waitFor?: string | number;
  }

  export interface ExtractResult {
    url: string;
    content: string;
    selector?: string;
    metadata: {
      extractedAt: number;
      contentLength: number;
    };
  }

  export interface FirecrawlClient {
    crawl(request: CrawlRequest): Promise<MCPResponse<CrawlResult>>;
    mapSite(request: SiteMapRequest): Promise<MCPResponse<SiteMapResult>>;
    extract(request: ExtractRequest): Promise<MCPResponse<ExtractResult>>;
    batchCrawl(requests: CrawlRequest[]): Promise<MCPResponse<CrawlResult[]>>;
  }
}

// Context7 MCP Types
export namespace Context7MCP {
  export interface StorageOptions {
    tags?: string[];
    category?: string;
    metadata?: Record<string, any>;
    relationships?: Relationship[];
    ttl?: number;
  }

  export interface StoreRequest {
    data: any;
    options?: StorageOptions;
  }

  export interface StoreResult {
    contextId: string;
    indexed: boolean;
    relationships: number;
    metadata: {
      storedAt: number;
      size: number;
      chunks: number;
    };
  }

  export interface SearchOptions {
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
    searchType?: 'semantic' | 'keyword' | 'hybrid';
    minScore?: number;
    includeMetadata?: boolean;
  }

  export interface SearchRequest {
    query: string;
    options?: SearchOptions;
  }

  export interface SearchResult {
    contextId: string;
    content: any;
    score: number;
    metadata: Record<string, any>;
    relationships?: Relationship[];
  }

  export interface RetrieveRequest {
    contextId: string;
    includeRelationships?: boolean;
    includeMetadata?: boolean;
  }

  export interface RetrieveResult {
    contextId: string;
    content: any;
    metadata: Record<string, any>;
    relationships?: Relationship[];
    storedAt: number;
    lastAccessed: number;
  }

  export interface Relationship {
    type: 'references' | 'contains' | 'similar_to' | 'derived_from' | 'part_of';
    targetId: string;
    strength: number;
    metadata?: Record<string, any>;
  }

  export interface KnowledgeGraphOptions {
    scope?: string;
    maxNodes?: number;
    maxDepth?: number;
    includeMetadata?: boolean;
    relationshipTypes?: string[];
  }

  export interface KnowledgeGraphRequest {
    options?: KnowledgeGraphOptions;
  }

  export interface GraphNode {
    id: string;
    content: any;
    metadata: Record<string, any>;
    relationships: Relationship[];
  }

  export interface KnowledgeGraph {
    nodes: GraphNode[];
    edges: Array<{
      source: string;
      target: string;
      type: string;
      strength: number;
    }>;
    metadata: {
      nodeCount: number;
      edgeCount: number;
      generatedAt: number;
    };
  }

  export interface Context7Client {
    store(request: StoreRequest): Promise<MCPResponse<StoreResult>>;
    retrieve(request: RetrieveRequest): Promise<MCPResponse<RetrieveResult>>;
    search(request: SearchRequest): Promise<MCPResponse<SearchResult[]>>;
    buildKnowledgeGraph(request: KnowledgeGraphRequest): Promise<MCPResponse<KnowledgeGraph>>;
    storeRelationships(contextId: string, relationships: Relationship[]): Promise<MCPResponse<void>>;
    getRelationships(contextId: string): Promise<MCPResponse<Relationship[]>>;
    analyzeRelationships(request: { contextIds: string[]; analysisType: string }): Promise<MCPResponse<any>>;
  }
}

// Playwright MCP Types
export namespace PlaywrightMCP {
  export interface LaunchOptions {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    timeout?: number;
    args?: string[];
    env?: Record<string, string>;
  }

  export interface BrowserInstance {
    id: string;
    browser: string;
    headless: boolean;
    createdAt: number;
  }

  export interface TestStep {
    action: 'navigate' | 'click' | 'type' | 'wait' | 'screenshot' | 'evaluate' | 'select';
    selector?: string;
    url?: string;
    text?: string;
    value?: string;
    duration?: number;
    script?: string;
    path?: string;
    options?: Record<string, any>;
  }

  export interface TestScript {
    name: string;
    description?: string;
    steps: TestStep[];
    expectations?: Array<{
      selector: string;
      property: string;
      value: any;
    }>;
  }

  export interface TestResult {
    scriptName: string;
    success: boolean;
    duration: number;
    steps: Array<{
      step: TestStep;
      success: boolean;
      duration: number;
      error?: string;
      screenshot?: string;
    }>;
    screenshots: string[];
    errors: string[];
    metadata: {
      browser: string;
      viewport: { width: number; height: number };
      timestamp: number;
    };
  }

  export interface ScreenshotOptions {
    selector?: string;
    fullPage?: boolean;
    quality?: number;
    format?: 'png' | 'jpeg';
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  export interface PerformanceMetrics {
    url: string;
    metrics: {
      firstContentfulPaint: number;
      largestContentfulPaint: number;
      cumulativeLayoutShift: number;
      firstInputDelay: number;
      totalBlockingTime: number;
    };
    lighthouse?: {
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
    };
    networkRequests: Array<{
      url: string;
      method: string;
      status: number;
      size: number;
      duration: number;
    }>;
    timestamp: number;
  }

  export interface PlaywrightClient {
    launch(options: LaunchOptions): Promise<MCPResponse<BrowserInstance>>;
    executeTest(instance: BrowserInstance, script: TestScript): Promise<MCPResponse<TestResult>>;
    captureScreenshot(instance: BrowserInstance, url: string, options?: ScreenshotOptions): Promise<MCPResponse<{ screenshot: string }>>;
    auditPerformance(url: string, metrics: string[]): Promise<MCPResponse<PerformanceMetrics>>;
    close(instanceId: string): Promise<MCPResponse<void>>;
  }
}

// Browser MCP Types
export namespace BrowserMCP {
  export interface ChromeConnection {
    id: string;
    port: number;
    profile: string;
    extensions: string[];
    connectedAt: number;
  }

  export interface TabInfo {
    id: number;
    url: string;
    title: string;
    active: boolean;
    status: 'loading' | 'complete';
    favIconUrl?: string;
  }

  export interface ScriptExecutionRequest {
    target: {
      tabId?: number;
      allFrames?: boolean;
    };
    function?: string;
    code?: string;
    args?: any[];
  }

  export interface ScriptExecutionResult {
    results: Array<{
      result: any;
      frameId: number;
      error?: string;
    }>;
    injectedAt: number;
  }

  export interface ScreenshotRequest {
    format?: 'png' | 'jpeg';
    quality?: number;
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  export interface DOMSnapshot {
    html: string;
    text: string;
    elements: Array<{
      tagName: string;
      attributes: Record<string, string>;
      textContent: string;
      bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
    capturedAt: number;
  }

  export interface NetworkLogEntry {
    requestId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    status: number;
    responseSize: number;
    timing: {
      requestTime: number;
      responseTime: number;
      duration: number;
    };
  }

  export interface ExtensionMessage {
    type: string;
    data: any;
    timestamp: number;
    tabId?: number;
  }

  export interface BrowserMCPClient {
    connectToChrome(): Promise<MCPResponse<ChromeConnection>>;
    getAllTabs(): Promise<MCPResponse<TabInfo[]>>;
    navigate(url: string, tabId?: number): Promise<MCPResponse<void>>;
    executeScript(request: ScriptExecutionRequest): Promise<MCPResponse<ScriptExecutionResult>>;
    captureVisibleTab(options?: ScreenshotRequest): Promise<MCPResponse<{ screenshot: string }>>;
    getDOMSnapshot(tabId?: number): Promise<MCPResponse<DOMSnapshot>>;
    getNetworkLog(tabId?: number): Promise<MCPResponse<NetworkLogEntry[]>>;
    monitorNetwork(duration: number, filters?: string[]): Promise<MCPResponse<NetworkLogEntry[]>>;
    sendExtensionMessage(message: ExtensionMessage): Promise<MCPResponse<any>>;
    click(selector: string, tabId?: number): Promise<MCPResponse<void>>;
    type(selector: string, text: string, tabId?: number): Promise<MCPResponse<void>>;
    scroll(x: number, y: number, tabId?: number): Promise<MCPResponse<void>>;
  }
}

// Sequential Thinking MCP Types
export namespace SequentialThinkingMCP {
  export interface ReasoningModel {
    type: 'step-by-step' | 'tree-of-thought' | 'chain-of-thought' | 'debate';
    parameters: {
      maxSteps?: number;
      maxBranches?: number;
      validationRequired?: boolean;
      backtrackingEnabled?: boolean;
      pruningThreshold?: number;
    };
  }

  export interface ReasoningSession {
    id: string;
    task: string;
    model: ReasoningModel;
    context: any;
    startedAt: number;
    maxSteps: number;
    currentStep: number;
    completed: boolean;
  }

  export interface ReasoningStep {
    stepNumber: number;
    reasoning: string;
    conclusion: string;
    evidence: any[];
    confidence: number;
    alternatives?: Array<{
      reasoning: string;
      conclusion: string;
      confidence: number;
    }>;
    metadata: {
      stepType: 'analysis' | 'synthesis' | 'evaluation' | 'decision';
      processingTime: number;
      timestamp: number;
    };
  }

  export interface StepValidation {
    isValid: boolean;
    confidence: number;
    issues: Array<{
      type: 'logical' | 'factual' | 'consistency' | 'premise';
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    suggestions: string[];
  }

  export interface SessionStartRequest {
    task: string;
    context?: any;
    reasoning_model?: string;
    max_steps?: number;
    validation_level?: 'none' | 'basic' | 'strict';
  }

  export interface ValidationRequest {
    reasoning: string;
    validation_type?: 'logical' | 'factual' | 'consistency';
    check_consistency?: boolean;
    check_premises?: boolean;
  }

  export interface DecisionCriterion {
    name: string;
    weight: number;
    type: 'quantitative' | 'qualitative';
    values: any[];
  }

  export interface Alternative {
    name: string;
    description: string;
    scores: Record<string, number>;
  }

  export interface DecisionTreeRequest {
    decision: string;
    criteria: DecisionCriterion[];
    alternatives: Alternative[];
    max_branches?: number;
  }

  export interface DecisionNode {
    id: string;
    type: 'decision' | 'outcome' | 'branch';
    content: string;
    children: DecisionNode[];
    probability?: number;
    value?: number;
    metadata: Record<string, any>;
  }

  export interface DecisionTree {
    rootNode: DecisionNode;
    totalNodes: number;
    maxDepth: number;
    recommendedPath: string[];
    metadata: {
      generatedAt: number;
      criteria: DecisionCriterion[];
      alternatives: Alternative[];
    };
  }

  export interface TaskDecomposition {
    originalTask: string;
    subtasks: Array<{
      id: string;
      description: string;
      priority: number;
      dependencies: string[];
      estimatedComplexity: number;
    }>;
    relationships: Array<{
      source: string;
      target: string;
      type: 'depends_on' | 'enables' | 'conflicts_with';
    }>;
  }

  export interface ResultSynthesis {
    originalTask: string;
    subtaskResults: any[];
    synthesizedResult: any;
    confidence: number;
    overallConfidence: number;
    validationStatus: 'passed' | 'failed' | 'partial';
    issues: string[];
    metadata: {
      synthesizedAt: number;
      totalSubtasks: number;
      successfulSubtasks: number;
    };
  }

  export interface SequentialThinkingClient {
    startSession(request: SessionStartRequest): Promise<MCPResponse<ReasoningSession>>;
    nextStep(sessionId: string): Promise<MCPResponse<ReasoningStep>>;
    validateStep(sessionId: string, step: ReasoningStep): Promise<MCPResponse<StepValidation>>;
    backtrack(sessionId: string): Promise<MCPResponse<void>>;
    getFinalResult(sessionId: string): Promise<MCPResponse<any>>;
    validate(request: ValidationRequest): Promise<MCPResponse<StepValidation>>;
    buildDecisionTree(request: DecisionTreeRequest): Promise<MCPResponse<DecisionTree>>;
    decomposeTask(task: string): Promise<MCPResponse<TaskDecomposition>>;
    synthesizeResults(request: {
      subtaskResults: any[];
      originalTask: string;
      requireValidation?: boolean;
    }): Promise<MCPResponse<ResultSynthesis>>;
    analyze(request: {
      data: any;
      reasoning_model?: string;
      validation?: boolean;
    }): Promise<MCPResponse<any>>;
  }
}

// Combined MCP Tools Interface
export interface AllMCPTools {
  firecrawl: FirecrawlMCP.FirecrawlClient;
  context7: Context7MCP.Context7Client;
  playwright: PlaywrightMCP.PlaywrightClient;
  browserMCP: BrowserMCP.BrowserMCPClient;
  sequentialThinking: SequentialThinkingMCP.SequentialThinkingClient;
}

// MCP Tool Status and Health
export interface MCPToolStatus {
  name: string;
  connected: boolean;
  version: string;
  uptime: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };
  lastHealthCheck: number;
  capabilities: string[];
}

export interface MCPToolHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  tools: Record<string, MCPToolStatus>;
  lastChecked: number;
  issues: Array<{
    tool: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

// Workflow and Orchestration Types
export interface MCPWorkflowStep {
  id: string;
  tool: string;
  action: string;
  parameters: Record<string, any>;
  dependencies: string[];
  timeout?: number;
  retries?: number;
  onSuccess?: string;
  onFailure?: string;
}

export interface MCPWorkflow {
  id: string;
  name: string;
  description: string;
  steps: MCPWorkflowStep[];
  metadata: {
    createdAt: number;
    version: string;
    tags: string[];
  };
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  steps: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: number;
    completedAt?: number;
    result?: any;
    error?: string;
  }>;
  results: Record<string, any>;
  errors: string[];
}

// Export all type namespaces
export {
  FirecrawlMCP,
  Context7MCP,
  PlaywrightMCP,
  BrowserMCP,
  SequentialThinkingMCP
};