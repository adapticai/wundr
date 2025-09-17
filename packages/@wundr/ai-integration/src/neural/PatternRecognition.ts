/**
 * Pattern Recognition - Neural pattern analysis and learning
 * 
 * Identifies patterns in agent behavior, task execution, and system performance
 * to improve swarm intelligence and coordination effectiveness.
 */

import { EventEmitter } from 'eventemitter3';

import { Agent, Task, OperationResult } from '../types';

export interface Pattern {
  id: string;
  type: PatternType;
  confidence: number;
  frequency: number;
  context: any;
  triggers: string[];
  outcomes: any[];
  learnedAt: Date;
  updatedAt: Date;
}

export type PatternType = 
  | 'task-execution' 
  | 'agent-behavior' 
  | 'performance-trend' 
  | 'error-pattern' 
  | 'coordination-pattern'
  | 'resource-usage';

export interface PatternAnalysis {
  patterns: Pattern[];
  insights: string[];
  recommendations: string[];
  confidence: number;
  timestamp: Date;
}

export class PatternRecognition extends EventEmitter {
  private patterns: Map<string, Pattern> = new Map();
  private executionHistory: Array<{
    task: Task;
    agents: Agent[];
    result: any;
    timestamp: Date;
  }> = [];
  private maxHistorySize = 10000;
  private minConfidenceThreshold = 0.7;

  constructor() {
    super();
  }

  async initialize(): Promise<OperationResult> {
    return {
      success: true,
      message: 'Pattern Recognition initialized successfully'
    };
  }

  /**
   * Analyze execution data to identify patterns
   */
  async analyzeExecution(task: Task, agents: Agent[], result: any): Promise<PatternAnalysis> {
    // Store execution history
    this.executionHistory.push({
      task,
      agents,
      result,
      timestamp: new Date()
    });

    // Maintain history size limit
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }

    // Analyze patterns
    const taskPatterns = this.analyzeTaskPatterns();
    const agentPatterns = this.analyzeAgentBehaviorPatterns();
    const performancePatterns = this.analyzePerformancePatterns();
    const coordinationPatterns = this.analyzeCoordinationPatterns();

    const allPatterns = [
      ...taskPatterns,
      ...agentPatterns,
      ...performancePatterns,
      ...coordinationPatterns
    ];

    // Update pattern registry
    allPatterns.forEach(pattern => {
      if (pattern.confidence >= this.minConfidenceThreshold) {
        this.patterns.set(pattern.id, pattern);
        this.emit('pattern-discovered', pattern);
      }
    });

    const analysis: PatternAnalysis = {
      patterns: allPatterns,
      insights: this.generateInsights(allPatterns),
      recommendations: this.generateRecommendations(allPatterns),
      confidence: this.calculateOverallConfidence(allPatterns),
      timestamp: new Date()
    };

    this.emit('analysis-complete', analysis);
    return analysis;
  }

  private analyzeTaskPatterns(): Pattern[] {
    const patterns: Pattern[] = [];
    const taskGroups = this.groupExecutionsByTaskType();

    Object.entries(taskGroups).forEach(([taskType, executions]) => {
      if (executions.length < 3) return; // Need minimum sample size

      // Success rate pattern
      const successRate = executions.filter(e => e.result.success).length / executions.length;
      if (successRate > 0.8 || successRate < 0.5) {
        patterns.push({
          id: `task-success-${taskType}-${Date.now()}`,
          type: 'task-execution',
          confidence: Math.abs(successRate - 0.5) * 2,
          frequency: executions.length,
          context: { taskType, successRate },
          triggers: ['task-type', taskType],
          outcomes: [successRate > 0.8 ? 'high-success' : 'low-success'],
          learnedAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Execution time pattern
      const avgTime = executions.reduce((sum, e) => sum + (e.result.executionTime || 0), 0) / executions.length;
      if (avgTime > 0) {
        patterns.push({
          id: `task-time-${taskType}-${Date.now()}`,
          type: 'performance-trend',
          confidence: 0.8,
          frequency: executions.length,
          context: { taskType, avgTime },
          triggers: ['task-type', taskType],
          outcomes: [`execution-time-${avgTime}`],
          learnedAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    return patterns;
  }

  private analyzeAgentBehaviorPatterns(): Pattern[] {
    const patterns: Pattern[] = [];
    const agentPerformance = new Map<string, {
      successes: number;
      failures: number;
      avgTime: number;
      tasks: string[];
    }>();

    // Aggregate agent performance data
    this.executionHistory.forEach(execution => {
      execution.agents.forEach(agent => {
        if (!agentPerformance.has(agent.id)) {
          agentPerformance.set(agent.id, {
            successes: 0,
            failures: 0,
            avgTime: 0,
            tasks: []
          });
        }

        const perf = agentPerformance.get(agent.id)!;
        if (execution.result.success) {
          perf.successes++;
        } else {
          perf.failures++;
        }
        perf.tasks.push(execution.task.type);
      });
    });

    // Identify high-performing agents
    agentPerformance.forEach((perf, agentId) => {
      const total = perf.successes + perf.failures;
      if (total >= 5) {
        const successRate = perf.successes / total;
        if (successRate > 0.9) {
          patterns.push({
            id: `agent-performance-${agentId}-${Date.now()}`,
            type: 'agent-behavior',
            confidence: successRate,
            frequency: total,
            context: { agentId, successRate, tasks: perf.tasks },
            triggers: ['agent-id', agentId],
            outcomes: ['high-performance'],
            learnedAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    });

    return patterns;
  }

  private analyzePerformancePatterns(): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Memory usage trends
    const memoryUsages = this.executionHistory
      .map(e => e.result.memoryUsage)
      .filter(m => m !== undefined);

    if (memoryUsages.length > 10) {
      const trend = this.calculateTrend(memoryUsages);
      if (Math.abs(trend) > 0.1) {
        patterns.push({
          id: `memory-trend-${Date.now()}`,
          type: 'performance-trend',
          confidence: 0.8,
          frequency: memoryUsages.length,
          context: { trend, type: 'memory-usage' },
          triggers: ['memory-usage'],
          outcomes: [trend > 0 ? 'increasing-memory' : 'decreasing-memory'],
          learnedAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return patterns;
  }

  private analyzeCoordinationPatterns(): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Agent combination effectiveness
    const combinations = new Map<string, {
      successes: number;
      failures: number;
      combinations: string[];
    }>();

    this.executionHistory.forEach(execution => {
      const agentTypes = execution.agents.map(a => a.type).sort().join('-');
      if (!combinations.has(agentTypes)) {
        combinations.set(agentTypes, {
          successes: 0,
          failures: 0,
          combinations: execution.agents.map(a => a.type)
        });
      }

      const combo = combinations.get(agentTypes)!;
      if (execution.result.success) {
        combo.successes++;
      } else {
        combo.failures++;
      }
    });

    combinations.forEach((combo, key) => {
      const total = combo.successes + combo.failures;
      if (total >= 3) {
        const successRate = combo.successes / total;
        if (successRate > 0.8 || successRate < 0.3) {
          patterns.push({
            id: `coordination-${key}-${Date.now()}`,
            type: 'coordination-pattern',
            confidence: Math.abs(successRate - 0.5) * 2,
            frequency: total,
            context: { agentCombination: combo.combinations, successRate },
            triggers: ['agent-combination', ...combo.combinations],
            outcomes: [successRate > 0.8 ? 'effective-combo' : 'ineffective-combo'],
            learnedAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    });

    return patterns;
  }

  private groupExecutionsByTaskType(): Record<string, typeof this.executionHistory> {
    const groups: Record<string, typeof this.executionHistory> = {};
    
    this.executionHistory.forEach(execution => {
      const taskType = execution.task.type;
      if (!groups[taskType]) {
        groups[taskType] = [];
      }
      groups[taskType].push(execution);
    });

    return groups;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private generateInsights(patterns: Pattern[]): string[] {
    const insights: string[] = [];
    
    const highConfidencePatterns = patterns.filter(p => p.confidence > 0.8);
    if (highConfidencePatterns.length > 0) {
      insights.push(`Identified ${highConfidencePatterns.length} high-confidence patterns`);
    }

    const taskPatterns = patterns.filter(p => p.type === 'task-execution');
    if (taskPatterns.length > 0) {
      insights.push(`Task execution patterns suggest optimization opportunities`);
    }

    const agentPatterns = patterns.filter(p => p.type === 'agent-behavior');
    if (agentPatterns.length > 0) {
      insights.push(`Agent behavior patterns indicate performance variations`);
    }

    return insights;
  }

  private generateRecommendations(patterns: Pattern[]): string[] {
    const recommendations: string[] = [];
    
    // Performance-based recommendations
    const performancePatterns = patterns.filter(p => p.type === 'performance-trend');
    if (performancePatterns.some(p => p.outcomes.includes('increasing-memory'))) {
      recommendations.push('Consider memory optimization strategies');
    }

    // Agent-based recommendations
    const agentPatterns = patterns.filter(p => p.type === 'agent-behavior');
    const highPerformers = agentPatterns.filter(p => p.outcomes.includes('high-performance'));
    if (highPerformers.length > 0) {
      recommendations.push('Prioritize high-performing agents for critical tasks');
    }

    // Coordination recommendations
    const coordPatterns = patterns.filter(p => p.type === 'coordination-pattern');
    const effectiveCombos = coordPatterns.filter(p => p.outcomes.includes('effective-combo'));
    if (effectiveCombos.length > 0) {
      recommendations.push('Use proven agent combinations for similar tasks');
    }

    return recommendations;
  }

  private calculateOverallConfidence(patterns: Pattern[]): number {
    if (patterns.length === 0) return 0;
    return patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
  }

  getPatternById(patternId: string): Pattern | undefined {
    return this.patterns.get(patternId);
  }

  getPatternsByType(type: PatternType): Pattern[] {
    return Array.from(this.patterns.values()).filter(p => p.type === type);
  }

  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  async shutdown(): Promise<OperationResult> {
    this.patterns.clear();
    this.executionHistory.length = 0;
    return {
      success: true,
      message: 'Pattern Recognition shutdown completed'
    };
  }
}