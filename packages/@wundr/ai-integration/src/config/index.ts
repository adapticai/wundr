/**
 * Configuration exports
 */

import { AIIntegrationConfig } from '../types';

export const defaultConfig: AIIntegrationConfig = {
  claudeFlow: {
    maxConcurrentAgents: 10,
    defaultTopology: 'mesh',
    hooks: {
      preTask: true,
      postTask: true,
      sessionRestore: true,
      exportMetrics: true
    },
    sparc: {
      enabledPhases: ['specification', 'pseudocode', 'architecture', 'refinement', 'completion'],
      parallelExecution: true,
      autoOptimization: true
    }
  },
  mcpTools: {
    registryPath: './mcp-tools',
    enabledTools: [],
    autoDiscovery: true,
    cacheResults: true,
    timeout: 30000
  },
  neural: {
    modelsPath: './models',
    enabledModels: ['pattern-recognition', 'performance-prediction'],
    trainingInterval: 3600000,
    patternRecognition: true,
    crossSessionLearning: true,
    maxMemorySize: 1000000
  },
  swarm: {
    defaultTopology: 'mesh',
    maxSwarmSize: 50,
    consensusThreshold: 0.66,
    faultTolerance: 'medium',
    adaptiveScaling: true
  },
  memory: {
    persistencePath: './memory',
    maxSessionMemory: 1000,
    compressionEnabled: true,
    crossSessionEnabled: true,
    retentionPolicy: {
      shortTerm: 24,
      longTerm: 30,
      permanent: ['consensus', 'pattern']
    }
  },
  agents: {
    maxConcurrentAgents: 25,
    spawningStrategy: 'adaptive',
    healthCheckInterval: 30000,
    autoRecovery: true,
    loadBalancing: true
  },
  performance: {
    metricsCollection: true,
    bottleneckDetection: true,
    autoOptimization: true,
    alertThresholds: {
      responseTime: 5000,
      errorRate: 0.05,
      memoryUsage: 0.8
    }
  },
  github: {
    autoReview: false,
    swarmReview: false,
    integrationBranches: ['main', 'master', 'develop']
  }
};

export * from '../types';