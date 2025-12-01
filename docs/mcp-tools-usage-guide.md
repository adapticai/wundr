# MCP Tools Usage Guide

## Overview

This guide demonstrates how to use the five integrated MCP tools with Claude Flow to create powerful
automated workflows.

## Quick Start

### 1. Installation

```bash
# Run the installation script
./scripts/install-mcp-tools.sh

# Validate installation
./scripts/validate-mcp-integration.sh
```

### 2. Environment Setup

```bash
# Copy environment template
cp ~/.claude/.env.mcp-tools ~/.claude/.env

# Edit and add your API keys
nano ~/.claude/.env
```

### 3. Install Browser Extension

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: `~/.claude/browser-mcp-extension`

## Usage Examples

### Example 1: Research & Analysis Pipeline

```typescript
import { MCPWorkflowEngine, WorkflowPatterns } from './src/orchestration/mcp-workflow-engine';

// Create research workflow
const researchWorkflow = WorkflowPatterns.createResearchPipeline('AI in Healthcare 2024', [
  'https://www.nature.com/articles/ai-healthcare',
  'https://www.nejm.org/ai-medicine',
  'https://www.who.int/digital-health',
]);

// Execute workflow
const engine = new MCPWorkflowEngine(mcpTools, config);
const execution = await engine.executeWorkflow(researchWorkflow);

console.log('Research completed:', execution.results);
```

### Example 2: Automated Testing Workflow

```typescript
const testSuite = {
  name: 'E-commerce Checkout Flow',
  playwrightScript: {
    steps: [
      { action: 'navigate', url: 'https://example-shop.com' },
      { action: 'click', selector: '.product-card' },
      { action: 'click', selector: '.add-to-cart' },
      { action: 'navigate', url: 'https://example-shop.com/checkout' },
      { action: 'type', selector: '#email', text: 'test@example.com' },
      { action: 'click', selector: '.checkout-button' },
    ],
  },
  validationScript: `
    // Validate checkout completion
    const orderConfirmation = document.querySelector('.order-confirmation');
    return { 
      success: !!orderConfirmation,
      orderNumber: orderConfirmation?.textContent.match(/Order #(\\d+)/)?.[1]
    };
  `,
};

const testWorkflow = WorkflowPatterns.createTestingWorkflow(testSuite);
const result = await engine.executeWorkflow(testWorkflow);
```

### Example 3: Website Monitoring

```typescript
const monitoringWorkflow = WorkflowPatterns.createMonitoringWorkflow(
  ['https://my-site.com', 'https://my-api.com/status'],
  {
    contentChanges: true,
    responseTimeThreshold: 2000,
    statusCodeCheck: [200, 201, 202],
  }
);

// Schedule monitoring
setInterval(async () => {
  const result = await engine.executeWorkflow(monitoringWorkflow);
  if (result.results['compare-changes'].changesDetected) {
    console.log('Website changes detected!', result);
    // Send alert
  }
}, 300000); // Every 5 minutes
```

### Example 4: Custom Agent Usage

```typescript
import { MCPAgentFactory } from './src/integrations/mcp-agent-patterns';

const factory = new MCPAgentFactory(mcpTools);

// Create specialized agents
const researcher = factory.createAgent('firecrawl-research', 'researcher-1');
const contextManager = factory.createAgent('context-manager', 'context-1');
const reasoner = factory.createAgent('sequential-reasoning', 'reasoner-1');

// Use agents independently
const scrapedData = await researcher.executeTask({
  id: 'research-task-1',
  type: 'research-topic',
  description: 'Research latest AI developments',
  parameters: {
    topic: 'Artificial Intelligence 2024',
    sources: ['https://arxiv.org', 'https://ai.google'],
    depth: 2,
  },
  priority: 'high',
});

// Store results
await contextManager.executeTask({
  id: 'store-task-1',
  type: 'store-context',
  description: 'Store research data',
  parameters: {
    data: scrapedData.data,
    metadata: { category: 'research', topic: 'AI' },
  },
  priority: 'medium',
});

// Analyze findings
const analysis = await reasoner.executeTask({
  id: 'analysis-task-1',
  type: 'analyze-problem',
  description: 'Analyze research findings',
  parameters: {
    problem: {
      description: 'Identify key trends in AI development',
      keywords: ['AI', 'machine learning', 'trends', '2024'],
    },
    reasoningModel: 'tree-of-thought',
  },
  priority: 'high',
});
```

## Agent Types and Capabilities

### 1. Firecrawl Research Agent

- **Type**: `firecrawl-research`
- **Capabilities**:
  - `web-scraping`: Extract content from websites
  - `content-extraction`: Parse and structure web content
  - `site-mapping`: Create comprehensive site maps
  - `pdf-processing`: Extract text from PDF documents

**Tasks**:

- `scrape-website`: Scrape a single website
- `map-site`: Generate a site map
- `extract-content`: Extract specific content elements
- `research-topic`: Multi-source research on a topic

### 2. Context Manager Agent

- **Type**: `context-manager`
- **Capabilities**:
  - `context-storage`: Store data with metadata
  - `context-retrieval`: Retrieve stored contexts
  - `context-search`: Semantic and keyword search
  - `knowledge-graph`: Build relationship graphs

**Tasks**:

- `store-context`: Store data with metadata
- `retrieve-context`: Get stored context by ID
- `search-context`: Search across stored contexts
- `build-knowledge-graph`: Create knowledge graphs
- `analyze-relationships`: Analyze context relationships

### 3. Playwright Automation Agent

- **Type**: `playwright-automation`
- **Capabilities**:
  - `browser-automation`: Automated browser interactions
  - `e2e-testing`: End-to-end test execution
  - `screenshot-capture`: Capture page screenshots
  - `performance-testing`: Performance auditing

**Tasks**:

- `run-test`: Execute test scenarios
- `capture-screenshot`: Take page screenshots
- `automate-workflow`: Run automation workflows
- `performance-audit`: Audit page performance

### 4. Browser Control Agent

- **Type**: `browser-control`
- **Capabilities**:
  - `real-browser-control`: Control actual Chrome browser
  - `extension-bridge`: Communicate with browser extensions
  - `dev-tools-access`: Access Chrome DevTools
  - `live-interaction`: Real-time browser interaction

**Tasks**:

- `control-browser`: Execute browser commands
- `capture-state`: Capture current browser state
- `interact-page`: Interact with page elements
- `monitor-network`: Monitor network activity

### 5. Sequential Reasoning Agent

- **Type**: `sequential-reasoning`
- **Capabilities**:
  - `step-by-step-reasoning`: Structured reasoning process
  - `logical-validation`: Validate reasoning chains
  - `complex-analysis`: Analyze complex problems
  - `decision-trees`: Build decision trees

**Tasks**:

- `analyze-problem`: Structured problem analysis
- `validate-reasoning`: Validate logical reasoning
- `build-decision-tree`: Create decision frameworks
- `solve-complex-task`: Decompose and solve complex tasks

## Configuration

### Tool-Specific Configuration

#### Firecrawl MCP

```json
{
  "server": {
    "env": {
      "FIRECRAWL_API_KEY": "your-api-key",
      "MAX_CONCURRENT_CRAWLS": "5",
      "RATE_LIMIT_DELAY": "1000"
    }
  },
  "capabilities": {
    "web_scraping": {
      "max_depth": 5,
      "respect_robots_txt": true,
      "user_agent": "WundrBot/1.0"
    }
  }
}
```

#### Context7 MCP

```json
{
  "server": {
    "env": {
      "CONTEXT7_DB_PATH": "${HOME}/.claude/context7/db",
      "VECTOR_EMBEDDINGS": "openai",
      "OPENAI_API_KEY": "your-openai-key"
    }
  },
  "storage": {
    "backend": "sqlite",
    "max_size": "2GB",
    "compression": true
  }
}
```

#### Playwright MCP

```json
{
  "browsers": {
    "chromium": {
      "enabled": true,
      "args": ["--no-sandbox", "--disable-dev-shm-usage"]
    }
  },
  "automation": {
    "timeout": 30000,
    "screenshot_on_failure": true
  }
}
```

## Common Workflows

### 1. Content Research Pipeline

1. **Firecrawl** scrapes target websites
2. **Context7** stores and indexes content
3. **Sequential Thinking** analyzes patterns
4. **Context7** stores final analysis

### 2. UI Testing & Validation

1. **Sequential Thinking** plans test scenarios
2. **Playwright** executes automated tests
3. **Browser MCP** validates with real browser
4. **Context7** stores test results

### 3. Competitive Analysis

1. **Firecrawl** monitors competitor sites
2. **Browser MCP** captures screenshots
3. **Context7** tracks changes over time
4. **Sequential Thinking** identifies trends

### 4. Documentation Generation

1. **Firecrawl** extracts API documentation
2. **Sequential Thinking** structures information
3. **Context7** builds knowledge graph
4. **Browser MCP** validates examples

## Advanced Features

### Workflow Variables

```typescript
const workflow: MCPWorkflow = {
  steps: [
    {
      id: 'scrape-data',
      tool: 'firecrawl',
      action: 'crawl',
      parameters: {
        url: '${BASE_URL}/api/docs',
        options: { formats: ['markdown'] },
      },
    },
    {
      id: 'analyze-data',
      tool: 'sequentialThinking',
      action: 'analyze',
      parameters: {
        data: '${scrape-data.result}',
        reasoning_model: 'step-by-step',
      },
    },
  ],
};

// Execute with variables
await engine.executeWorkflow(workflow, {
  variables: { BASE_URL: 'https://api.example.com' },
});
```

### Error Handling & Retries

```typescript
const robustWorkflow: MCPWorkflow = {
  steps: [
    {
      id: 'unreliable-task',
      tool: 'firecrawl',
      action: 'crawl',
      parameters: { url: 'https://sometimes-down.com' },
      retries: 3,
      timeout: 30000,
      onFailure: 'continue-workflow',
    },
  ],
};
```

### Parallel Execution

```typescript
// Steps with no dependencies run in parallel
const parallelWorkflow: MCPWorkflow = {
  steps: [
    {
      id: 'scrape-site-1',
      tool: 'firecrawl',
      action: 'crawl',
      parameters: { url: 'https://site1.com' },
      dependencies: [], // No dependencies
    },
    {
      id: 'scrape-site-2',
      tool: 'firecrawl',
      action: 'crawl',
      parameters: { url: 'https://site2.com' },
      dependencies: [], // No dependencies
    },
    {
      id: 'combine-results',
      tool: 'context7',
      action: 'store',
      parameters: {
        data: {
          site1: '${scrape-site-1.result}',
          site2: '${scrape-site-2.result}',
        },
      },
      dependencies: ['scrape-site-1', 'scrape-site-2'], // Wait for both
    },
  ],
};
```

## Monitoring and Debugging

### Workflow Execution Monitoring

```typescript
const engine = new MCPWorkflowEngine(mcpTools, config);

// Listen to workflow events
engine.on('workflow-started', ({ executionId, workflow }) => {
  console.log(`Workflow ${workflow.name} started: ${executionId}`);
});

engine.on('step-completed', ({ executionId, stepId, result }) => {
  console.log(`Step ${stepId} completed in ${executionId}`);
});

engine.on('step-failed', ({ executionId, stepId, error }) => {
  console.error(`Step ${stepId} failed in ${executionId}:`, error);
});

engine.on('workflow-completed', ({ executionId, execution }) => {
  console.log(`Workflow completed: ${executionId}`);
  console.log('Results:', execution.results);
});
```

### Health Monitoring

```bash
# Check MCP tool health
npx claude-flow mcp health

# Monitor active workflows
npx claude-flow workflow status

# View logs
tail -f ~/.claude/logs/mcp/workflow-engine.log
```

## Troubleshooting

### Common Issues

1. **MCP Server Not Responding**

   ```bash
   # Restart MCP servers
   claude mcp restart firecrawl
   claude mcp restart context7
   ```

2. **Chrome Extension Not Loading**
   - Check extension is enabled in `chrome://extensions/`
   - Verify extension files in `~/.claude/browser-mcp-extension`
   - Restart Chrome

3. **Context7 Database Issues**

   ```bash
   # Reset Context7 database
   rm -rf ~/.claude/context7/context.db
   # Restart Context7 MCP
   ```

4. **Playwright Browser Issues**
   ```bash
   # Reinstall browsers
   npx playwright install
   ```

### Performance Optimization

1. **Limit Concurrent Operations**

   ```typescript
   const config: WorkflowEngineConfig = {
     maxConcurrentSteps: 3, // Reduce if system is slow
     defaultTimeout: 60000, // Increase for slow networks
   };
   ```

2. **Configure Tool-Specific Limits**

   ```json
   {
     "firecrawl": {
       "MAX_CONCURRENT_CRAWLS": "2",
       "RATE_LIMIT_DELAY": "2000"
     }
   }
   ```

3. **Enable Compression**
   ```json
   {
     "context7": {
       "storage": {
         "compression": true
       }
     }
   }
   ```

## Best Practices

### 1. Workflow Design

- Keep workflows focused and modular
- Use meaningful step IDs and descriptions
- Handle errors gracefully with retries
- Store intermediate results for debugging

### 2. Resource Management

- Close browser instances when done
- Clean up temporary files
- Monitor memory usage with large datasets
- Use appropriate timeouts

### 3. Security

- Never hardcode API keys in workflows
- Use environment variables for sensitive data
- Validate input parameters
- Sanitize scraped content

### 4. Performance

- Batch similar operations together
- Use parallel execution where possible
- Cache frequently accessed data
- Monitor and optimize slow steps

This comprehensive integration provides a powerful foundation for automated workflows combining web
scraping, browser automation, context management, and intelligent reasoning.
