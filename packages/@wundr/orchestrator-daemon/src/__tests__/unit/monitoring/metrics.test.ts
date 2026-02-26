/**
 * Tests for the Metrics module (src/monitoring/metrics.ts).
 *
 * Covers:
 *  - MetricsRegistry (register, collect, reset, clear, getMetric)
 *  - Legacy daemon metrics (counter/gauge/histogram operations)
 *  - Legacy helper functions (recordSessionActive, recordTokensUsed, etc.)
 *  - Enhanced metric families (agent, session, channel, plugin, tool, WS, model)
 *  - Enhanced helper functions (recordAgentSpawned, recordChannelMessageSent, etc.)
 *  - Prometheus-compatible output format
 *  - System metrics collection start/stop
 */

import { Registry } from 'prom-client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// We import a fresh module per test suite via dynamic imports so that
// prom-client's default registry does not accumulate duplicate metrics.
// However, since the module uses top-level registrations, we isolate
// through a custom registry where possible.

import {
  MetricsRegistry,
  daemonMetrics,
  agentMetrics,
  channelMetrics,
  pluginMetrics,
  toolMetrics,
  wsMetrics,
  modelMetrics,
  memoryMetrics,
  systemMetrics,
  requestSummaryMetrics,
  recordSessionActive,
  recordTokensUsed,
  recordMessageLatency,
  recordToolInvocation,
  recordFederationDelegation,
  recordNodeLoad,
  recordError,
  recordBudgetUtilization,
  recordAgentSpawned,
  recordAgentCompleted,
  recordAgentFailed,
  recordModelRequest,
  recordWsConnection,
  recordWsDisconnection,
  recordWsMessageReceived,
  recordWsMessageSent,
  recordToolExecution,
  recordMemoryOperation,
  recordChannelMessageSent,
  recordChannelMessageReceived,
  recordChannelLatency,
  recordChannelError,
  recordPluginExecution,
  recordPluginError,
  recordRequestDuration,
  recordTokenUsageSummary,
  startSystemMetricsCollection,
  stopSystemMetricsCollection,
  metricsRegistry,
} from '../../../monitoring/metrics';

// ---------------------------------------------------------------------------
// MetricsRegistry
// ---------------------------------------------------------------------------

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;
  let promRegistry: Registry;

  beforeEach(() => {
    promRegistry = new Registry();
    registry = new MetricsRegistry(promRegistry);
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register()', () => {
    it('should mark registry as registered', () => {
      registry.register();
      // Calling register twice should be idempotent
      registry.register();
      // No error thrown = success
    });
  });

  describe('collect()', () => {
    it('should return a string in Prometheus text format', async () => {
      const output = await registry.collect();
      expect(typeof output).toBe('string');
    });
  });

  describe('reset()', () => {
    it('should reset all metrics without throwing', () => {
      expect(() => registry.reset()).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('should clear all metrics from the registry', () => {
      registry.register();
      registry.clear();
      // After clear, re-registration should be possible
      registry.register();
    });
  });

  describe('getMetric()', () => {
    it('should return a known legacy metric by name', () => {
      const metric = registry.getMetric('sessionsActive');
      expect(metric).toBeDefined();
      expect(metric).toBe(daemonMetrics.sessionsActive);
    });

    it('should return the tokensUsed counter', () => {
      const metric = registry.getMetric('tokensUsed');
      expect(metric).toBe(daemonMetrics.tokensUsed);
    });

    it('should return the messageLatency histogram', () => {
      const metric = registry.getMetric('messageLatency');
      expect(metric).toBe(daemonMetrics.messageLatency);
    });
  });

  describe('getRegistry()', () => {
    it('should return the underlying Prometheus registry', () => {
      expect(registry.getRegistry()).toBe(promRegistry);
    });
  });
});

// ---------------------------------------------------------------------------
// Default metricsRegistry singleton
// ---------------------------------------------------------------------------

describe('metricsRegistry singleton', () => {
  it('should be an instance of MetricsRegistry', () => {
    expect(metricsRegistry).toBeInstanceOf(MetricsRegistry);
  });
});

// ---------------------------------------------------------------------------
// Legacy Daemon Metrics -- Counter, Gauge, Histogram operations
// ---------------------------------------------------------------------------

describe('legacy daemon metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test to get clean state
    daemonMetrics.sessionsActive.reset();
    daemonMetrics.tokensUsed.reset();
    daemonMetrics.messageLatency.reset();
    daemonMetrics.toolInvocations.reset();
    daemonMetrics.federationDelegations.reset();
    daemonMetrics.nodeLoad.reset();
    daemonMetrics.errorCount.reset();
    daemonMetrics.budgetUtilization.reset();
  });

  describe('Gauge -- sessionsActive', () => {
    it('should set session active count via helper', async () => {
      const labels = { orchestrator_id: 'orch-1', session_type: 'claude-code' };
      recordSessionActive(labels, 5);

      const val = await daemonMetrics.sessionsActive.get();
      const found = val.values.find(v => v.labels.orchestrator_id === 'orch-1');
      expect(found?.value).toBe(5);
    });

    it('should overwrite previous gauge value', async () => {
      const labels = { orchestrator_id: 'orch-1', session_type: 'claude-code' };
      recordSessionActive(labels, 5);
      recordSessionActive(labels, 10);

      const val = await daemonMetrics.sessionsActive.get();
      const found = val.values.find(v => v.labels.orchestrator_id === 'orch-1');
      expect(found?.value).toBe(10);
    });
  });

  describe('Counter -- tokensUsed', () => {
    it('should increment token counter via helper', async () => {
      const labels = { orchestrator_id: 'orch-1', model: 'gpt-4' };
      recordTokensUsed(labels, 100);
      recordTokensUsed(labels, 50);

      const val = await daemonMetrics.tokensUsed.get();
      const found = val.values.find(
        v => v.labels.orchestrator_id === 'orch-1' && v.labels.model === 'gpt-4'
      );
      expect(found?.value).toBe(150);
    });
  });

  describe('Histogram -- messageLatency', () => {
    it('should observe latency values via helper', async () => {
      const labels = { orchestrator_id: 'orch-1' };
      recordMessageLatency(labels, 0.5);
      recordMessageLatency(labels, 1.5);

      const val = await daemonMetrics.messageLatency.get();
      // Histogram has sum and count
      const sumEntry = val.values.find(
        v =>
          v.metricName === 'orchestrator_message_latency_seconds_sum' &&
          v.labels.orchestrator_id === 'orch-1'
      );
      const countEntry = val.values.find(
        v =>
          v.metricName === 'orchestrator_message_latency_seconds_count' &&
          v.labels.orchestrator_id === 'orch-1'
      );
      expect(sumEntry?.value).toBe(2.0);
      expect(countEntry?.value).toBe(2);
    });
  });

  describe('Counter -- toolInvocations', () => {
    it('should count tool invocations via helper', async () => {
      recordToolInvocation({
        orchestrator_id: 'orch-1',
        tool_name: 'search',
        status: 'success',
      });
      recordToolInvocation({
        orchestrator_id: 'orch-1',
        tool_name: 'search',
        status: 'success',
      });

      const val = await daemonMetrics.toolInvocations.get();
      const found = val.values.find(
        v => v.labels.tool_name === 'search' && v.labels.status === 'success'
      );
      expect(found?.value).toBe(2);
    });
  });

  describe('Counter -- federationDelegations', () => {
    it('should count federation delegations via helper', async () => {
      recordFederationDelegation({
        from_orchestrator: 'a',
        to_orchestrator: 'b',
        status: 'success',
      });

      const val = await daemonMetrics.federationDelegations.get();
      const found = val.values.find(
        v =>
          v.labels.from_orchestrator === 'a' && v.labels.to_orchestrator === 'b'
      );
      expect(found?.value).toBe(1);
    });
  });

  describe('Gauge -- nodeLoad', () => {
    it('should set node load via helper', async () => {
      recordNodeLoad({ node_id: 'node-1' }, 0.75);

      const val = await daemonMetrics.nodeLoad.get();
      const found = val.values.find(v => v.labels.node_id === 'node-1');
      expect(found?.value).toBe(0.75);
    });
  });

  describe('Counter -- errorCount', () => {
    it('should increment error count via helper', async () => {
      recordError({ orchestrator_id: 'orch-1', error_type: 'timeout' });
      recordError({ orchestrator_id: 'orch-1', error_type: 'timeout' });
      recordError({ orchestrator_id: 'orch-1', error_type: 'auth' });

      const val = await daemonMetrics.errorCount.get();
      const timeout = val.values.find(v => v.labels.error_type === 'timeout');
      const auth = val.values.find(v => v.labels.error_type === 'auth');
      expect(timeout?.value).toBe(2);
      expect(auth?.value).toBe(1);
    });
  });

  describe('Gauge -- budgetUtilization', () => {
    it('should set budget utilization via helper', async () => {
      recordBudgetUtilization(
        { orchestrator_id: 'orch-1', period: 'daily' },
        0.42
      );

      const val = await daemonMetrics.budgetUtilization.get();
      const found = val.values.find(
        v =>
          v.labels.orchestrator_id === 'orch-1' && v.labels.period === 'daily'
      );
      expect(found?.value).toBe(0.42);
    });
  });
});

// ---------------------------------------------------------------------------
// Enhanced Agent Metrics
// ---------------------------------------------------------------------------

describe('enhanced agent metrics', () => {
  beforeEach(() => {
    agentMetrics.spawned.reset();
    agentMetrics.running.reset();
    agentMetrics.completed.reset();
    agentMetrics.failed.reset();
    agentMetrics.duration.reset();
  });

  it('should record agent spawn and increment running', async () => {
    recordAgentSpawned('orch-1', 'claude-code');

    const spawned = await agentMetrics.spawned.get();
    const running = await agentMetrics.running.get();
    expect(
      spawned.values.find(v => v.labels.orchestrator_id === 'orch-1')?.value
    ).toBe(1);
    expect(
      running.values.find(v => v.labels.orchestrator_id === 'orch-1')?.value
    ).toBe(1);
  });

  it('should record agent completion, decrement running, and observe duration', async () => {
    recordAgentSpawned('orch-1', 'claude-code');
    recordAgentCompleted('orch-1', 'claude-code', 'success', 45.5);

    const completed = await agentMetrics.completed.get();
    const running = await agentMetrics.running.get();
    const duration = await agentMetrics.duration.get();

    expect(
      completed.values.find(v => v.labels.exit_reason === 'success')?.value
    ).toBe(1);
    expect(
      running.values.find(v => v.labels.orchestrator_id === 'orch-1')?.value
    ).toBe(0);

    const durationSum = duration.values.find(
      v => v.metricName === 'wundr_agent_duration_seconds_sum'
    );
    expect(durationSum?.value).toBe(45.5);
  });

  it('should record agent failure and decrement running', async () => {
    recordAgentSpawned('orch-1', 'claude-code');
    recordAgentFailed('orch-1', 'claude-code', 'crash', 10);

    const failed = await agentMetrics.failed.get();
    expect(
      failed.values.find(v => v.labels.error_type === 'crash')?.value
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Channel Metrics
// ---------------------------------------------------------------------------

describe('channel metrics', () => {
  beforeEach(() => {
    channelMetrics.messagesSent.reset();
    channelMetrics.messagesReceived.reset();
    channelMetrics.messageLatency.reset();
    channelMetrics.errors.reset();
  });

  it('should record channel message sent', async () => {
    recordChannelMessageSent('slack', 'text');
    recordChannelMessageSent('slack', 'text');

    const val = await channelMetrics.messagesSent.get();
    const found = val.values.find(
      v => v.labels.channel === 'slack' && v.labels.message_type === 'text'
    );
    expect(found?.value).toBe(2);
  });

  it('should record channel message received', async () => {
    recordChannelMessageReceived('discord', 'command');

    const val = await channelMetrics.messagesReceived.get();
    const found = val.values.find(
      v => v.labels.channel === 'discord' && v.labels.message_type === 'command'
    );
    expect(found?.value).toBe(1);
  });

  it('should record channel latency', async () => {
    recordChannelLatency('telegram', 0.123);

    const val = await channelMetrics.messageLatency.get();
    const sum = val.values.find(
      v =>
        v.metricName === 'wundr_channel_message_latency_seconds_sum' &&
        v.labels.channel === 'telegram'
    );
    expect(sum?.value).toBeCloseTo(0.123);
  });

  it('should record channel error', async () => {
    recordChannelError('webhook', 'connection_refused');

    const val = await channelMetrics.errors.get();
    const found = val.values.find(
      v =>
        v.labels.channel === 'webhook' &&
        v.labels.error_type === 'connection_refused'
    );
    expect(found?.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Plugin Metrics
// ---------------------------------------------------------------------------

describe('plugin metrics', () => {
  beforeEach(() => {
    pluginMetrics.executionTotal.reset();
    pluginMetrics.executionDuration.reset();
    pluginMetrics.errors.reset();
  });

  it('should record plugin execution count and duration', async () => {
    recordPluginExecution('my-plugin', 'onMessage', 'success', 0.5);
    recordPluginExecution('my-plugin', 'onMessage', 'error', 1.2);

    const total = await pluginMetrics.executionTotal.get();
    const success = total.values.find(
      v => v.labels.plugin_name === 'my-plugin' && v.labels.status === 'success'
    );
    const error = total.values.find(
      v => v.labels.plugin_name === 'my-plugin' && v.labels.status === 'error'
    );
    expect(success?.value).toBe(1);
    expect(error?.value).toBe(1);
  });

  it('should record plugin error', async () => {
    recordPluginError('auth-plugin', 'beforeAuth', 'permission_denied');

    const val = await pluginMetrics.errors.get();
    const found = val.values.find(
      v =>
        v.labels.plugin_name === 'auth-plugin' &&
        v.labels.error_type === 'permission_denied'
    );
    expect(found?.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tool Metrics (enhanced)
// ---------------------------------------------------------------------------

describe('enhanced tool metrics', () => {
  beforeEach(() => {
    toolMetrics.executionTotal.reset();
    toolMetrics.executionDuration.reset();
  });

  it('should record tool execution with status and duration', async () => {
    recordToolExecution('bash', 'success', 2.5);
    recordToolExecution('bash', 'timeout', 30);

    const total = await toolMetrics.executionTotal.get();
    const success = total.values.find(
      v => v.labels.tool_name === 'bash' && v.labels.status === 'success'
    );
    const timeout = total.values.find(
      v => v.labels.tool_name === 'bash' && v.labels.status === 'timeout'
    );
    expect(success?.value).toBe(1);
    expect(timeout?.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// WebSocket Metrics
// ---------------------------------------------------------------------------

describe('WebSocket metrics', () => {
  beforeEach(() => {
    wsMetrics.connectionsActive.reset();
    wsMetrics.connectionsTotal.reset();
    wsMetrics.messagesReceived.reset();
    wsMetrics.messagesSent.reset();
    wsMetrics.messageSize.reset();
  });

  it('should track active connections with connect/disconnect', async () => {
    recordWsConnection('jwt');
    recordWsConnection('api-key');

    let val = await wsMetrics.connectionsActive.get();
    expect(val.values[0]?.value).toBe(2);

    recordWsDisconnection();

    val = await wsMetrics.connectionsActive.get();
    expect(val.values[0]?.value).toBe(1);
  });

  it('should record connection total by auth method', async () => {
    recordWsConnection('jwt');
    recordWsConnection('jwt');
    recordWsConnection('api-key');

    const val = await wsMetrics.connectionsTotal.get();
    const jwt = val.values.find(v => v.labels.auth_method === 'jwt');
    const apiKey = val.values.find(v => v.labels.auth_method === 'api-key');
    expect(jwt?.value).toBe(2);
    expect(apiKey?.value).toBe(1);
  });

  it('should record received messages with size', async () => {
    recordWsMessageReceived('subscribe', 256);

    const msgs = await wsMetrics.messagesReceived.get();
    expect(
      msgs.values.find(v => v.labels.message_type === 'subscribe')?.value
    ).toBe(1);

    const size = await wsMetrics.messageSize.get();
    const sum = size.values.find(
      v =>
        v.metricName === 'wundr_ws_message_size_bytes_sum' &&
        v.labels.direction === 'inbound'
    );
    expect(sum?.value).toBe(256);
  });

  it('should record sent messages with size', async () => {
    recordWsMessageSent('response', 1024);

    const msgs = await wsMetrics.messagesSent.get();
    expect(
      msgs.values.find(v => v.labels.message_type === 'response')?.value
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Model Routing Metrics
// ---------------------------------------------------------------------------

describe('model routing metrics', () => {
  beforeEach(() => {
    modelMetrics.requests.reset();
    modelMetrics.requestDuration.reset();
    modelMetrics.requestTokens.reset();
    modelMetrics.cost.reset();
    modelMetrics.errors.reset();
  });

  it('should record a complete model request with tokens and cost', async () => {
    recordModelRequest({
      provider: 'anthropic',
      model: 'claude-3-opus',
      durationSeconds: 5.2,
      promptTokens: 1000,
      completionTokens: 500,
      costDollars: 0.03,
    });

    const requests = await modelMetrics.requests.get();
    expect(
      requests.values.find(
        v =>
          v.labels.provider === 'anthropic' &&
          v.labels.model === 'claude-3-opus'
      )?.value
    ).toBe(1);

    const tokens = await modelMetrics.requestTokens.get();
    const prompt = tokens.values.find(
      v =>
        v.labels.token_type === 'prompt' && v.labels.model === 'claude-3-opus'
    );
    const completion = tokens.values.find(
      v =>
        v.labels.token_type === 'completion' &&
        v.labels.model === 'claude-3-opus'
    );
    expect(prompt?.value).toBe(1000);
    expect(completion?.value).toBe(500);

    const cost = await modelMetrics.cost.get();
    expect(
      cost.values.find(v => v.labels.model === 'claude-3-opus')?.value
    ).toBeCloseTo(0.03);
  });

  it('should record model request errors', async () => {
    recordModelRequest({
      provider: 'openai',
      model: 'gpt-4',
      durationSeconds: 1,
      error: 'rate_limit',
    });

    const errors = await modelMetrics.errors.get();
    const found = errors.values.find(
      v => v.labels.error_type === 'rate_limit' && v.labels.model === 'gpt-4'
    );
    expect(found?.value).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Memory System Metrics
// ---------------------------------------------------------------------------

describe('memory system metrics', () => {
  beforeEach(() => {
    memoryMetrics.searches.reset();
    memoryMetrics.searchLatency.reset();
    memoryMetrics.cacheHits.reset();
    memoryMetrics.cacheMisses.reset();
    memoryMetrics.compactions.reset();
  });

  it('should record search with cache hit', async () => {
    recordMemoryOperation({
      operation: 'search',
      tier: 'semantic',
      orchestratorId: 'orch-1',
      durationSeconds: 0.05,
      cacheHit: true,
    });

    const searches = await memoryMetrics.searches.get();
    expect(searches.values.find(v => v.labels.tier === 'semantic')?.value).toBe(
      1
    );

    const hits = await memoryMetrics.cacheHits.get();
    expect(hits.values.find(v => v.labels.tier === 'semantic')?.value).toBe(1);
  });

  it('should record search with cache miss', async () => {
    recordMemoryOperation({
      operation: 'search',
      tier: 'episodic',
      cacheHit: false,
    });

    const misses = await memoryMetrics.cacheMisses.get();
    expect(misses.values.find(v => v.labels.tier === 'episodic')?.value).toBe(
      1
    );
  });

  it('should record compaction', async () => {
    recordMemoryOperation({
      operation: 'compact',
      tier: 'episodic',
    });

    const compactions = await memoryMetrics.compactions.get();
    expect(
      compactions.values.find(v => v.labels.tier === 'episodic')?.value
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Prometheus Output Format
// ---------------------------------------------------------------------------

describe('Prometheus-compatible output', () => {
  it('should produce text with HELP and TYPE lines', async () => {
    const output = await metricsRegistry.collect();
    // The default registry includes all registered metrics
    expect(output).toContain('# HELP');
    expect(output).toContain('# TYPE');
  });

  it('should include legacy metric names in output', async () => {
    recordSessionActive({ orchestrator_id: 'test', session_type: 'test' }, 1);
    const output = await metricsRegistry.collect();
    expect(output).toContain('orchestrator_sessions_active');
  });

  it('should include enhanced metric names in output', async () => {
    recordAgentSpawned('test', 'test');
    const output = await metricsRegistry.collect();
    expect(output).toContain('wundr_agent_spawned_total');
  });
});

// ---------------------------------------------------------------------------
// System Metrics Collection
// ---------------------------------------------------------------------------

describe('system metrics collection', () => {
  afterEach(() => {
    stopSystemMetricsCollection();
  });

  it('should start and stop without errors', () => {
    expect(() => startSystemMetricsCollection(60000)).not.toThrow();
    expect(() => stopSystemMetricsCollection()).not.toThrow();
  });

  it('should be idempotent on start', () => {
    startSystemMetricsCollection(60000);
    // Second call should be a no-op
    expect(() => startSystemMetricsCollection(60000)).not.toThrow();
    stopSystemMetricsCollection();
  });

  it('should collect system memory metrics on start', async () => {
    startSystemMetricsCollection(60000);

    // Metrics should have been collected immediately on start
    const heap = await systemMetrics.memoryHeap.get();
    expect(heap.values.length).toBeGreaterThan(0);
    expect(heap.values[0].value).toBeGreaterThan(0);

    const rss = await systemMetrics.memoryRss.get();
    expect(rss.values[0].value).toBeGreaterThan(0);
  });

  it('should collect uptime on start', async () => {
    startSystemMetricsCollection(60000);

    const uptime = await systemMetrics.uptime.get();
    expect(uptime.values[0].value).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Request Summary Metrics
// ---------------------------------------------------------------------------

describe('request summary metrics', () => {
  beforeEach(() => {
    requestSummaryMetrics.requestDuration.reset();
    requestSummaryMetrics.tokenUsageSummary.reset();
  });

  it('should observe request duration summary', async () => {
    recordRequestDuration('POST', '/api/sessions', 1.5);
    recordRequestDuration('POST', '/api/sessions', 2.0);

    const val = await requestSummaryMetrics.requestDuration.get();
    const sumEntry = val.values.find(
      v =>
        v.metricName === 'wundr_request_duration_summary_seconds_sum' &&
        v.labels.method === 'POST'
    );
    expect(sumEntry?.value).toBeCloseTo(3.5);
  });

  it('should observe token usage summary', async () => {
    recordTokenUsageSummary('anthropic', 'claude-3-opus', 1500);

    const val = await requestSummaryMetrics.tokenUsageSummary.get();
    const sumEntry = val.values.find(
      v =>
        v.metricName === 'wundr_token_usage_summary_sum' &&
        v.labels.provider === 'anthropic'
    );
    expect(sumEntry?.value).toBe(1500);
  });
});
