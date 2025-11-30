/**
 * @wundr/ai-integration - AI Integration Hive Queen
 * 
 * Orchestrates Claude Code, Claude Flow, and MCP tools for comprehensive AI integration.
 * Implements neural pattern training, swarm intelligence, and cross-session memory.
 */

export * from './core/AIIntegrationHive';
export * from './core/ClaudeFlowOrchestrator';
export * from './core/MCPToolsRegistry';
export * from './core/NeuralTrainingPipeline';
export * from './core/SwarmIntelligence';
export * from './core/MemoryManager';

export * from './agents/AgentCoordinator';
export * from './agents/AgentSpawner';
export * from './agents/AgentRegistry';

export * from './neural/PatternRecognition';
export * from './neural/NeuralModels';
export * from './neural/TrainingPipeline';

export * from './memory/SessionMemory';
export * from './memory/CrossSessionPersistence';
export * from './memory/MemoryOptimization';

export * from './orchestration/TopologyManager';
export * from './orchestration/WorkflowEngine';
export * from './orchestration/TaskDistribution';

export * from './monitoring/PerformanceAnalyzer';
export * from './monitoring/BottleneckDetection';
export * from './monitoring/MetricsCollector';

export * from './github/GitHubIntegration';
export * from './github/CodeReviewSwarm';
export * from './github/AutomationEngine';

export * from './llm';

// Types and utilities - use named exports
export * as aiIntegrationTypes from './types';
export * as aiIntegrationUtils from './utils';
export * as aiIntegrationConfig from './config';