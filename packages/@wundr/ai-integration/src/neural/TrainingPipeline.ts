/**
 * Training Pipeline - Automated neural model training and optimization
 *
 * Manages the continuous training pipeline for neural models, handling
 * data preparation, model training, validation, and deployment.
 */

import { EventEmitter } from 'eventemitter3';

import { NeuralModel, ModelType, Agent, Task, OperationResult } from '../types';
import { NeuralModels, TrainingConfig } from './NeuralModels';

export interface TrainingJob {
  id: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: TrainingConfig;
  data: any[];
  startTime?: Date;
  endTime?: Date;
  progress: number;
  metrics?: any;
  error?: string;
}

export interface TrainingSchedule {
  modelId: string;
  interval: number; // milliseconds
  minDataSize: number;
  autoTriggers: string[];
  enabled: boolean;
}

interface ExecutionResult {
  success: boolean;
  executionTime?: number;
  resourceUsage?: Record<string, number>;
  insights?: string[];
}

interface TrainingProgress {
  modelId: string;
  epoch: number;
  totalEpochs: number;
  progress: number;
}

export class TrainingPipeline extends EventEmitter {
  private neuralModels: NeuralModels;
  private trainingQueue: TrainingJob[] = [];
  private activeJobs: Map<string, TrainingJob> = new Map();
  private schedules: Map<string, TrainingSchedule> = new Map();
  private trainingData: Map<string, any[]> = new Map(); // modelType -> data
  private maxConcurrentJobs = 3;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(neuralModels: NeuralModels) {
    super();
    this.neuralModels = neuralModels;
  }

  async initialize(): Promise<OperationResult> {
    this.setupDefaultSchedules();
    this.startProcessing();
    this.setupEventHandlers();

    return {
      success: true,
      message: 'Training Pipeline initialized successfully',
    };
  }

  private setupDefaultSchedules(): void {
    const defaultSchedules: Array<{
      modelType: ModelType;
      interval: number;
      minDataSize: number;
      autoTriggers: string[];
    }> = [
      {
        modelType: 'pattern-recognition',
        interval: 24 * 60 * 60 * 1000, // Daily
        minDataSize: 100,
        autoTriggers: ['pattern-discovered', 'execution-completed'],
      },
      {
        modelType: 'performance-prediction',
        interval: 12 * 60 * 60 * 1000, // Twice daily
        minDataSize: 50,
        autoTriggers: ['performance-data-collected'],
      },
      {
        modelType: 'task-classification',
        interval: 6 * 60 * 60 * 1000, // Every 6 hours
        minDataSize: 30,
        autoTriggers: ['task-completed', 'new-task-type'],
      },
      {
        modelType: 'agent-selection',
        interval: 8 * 60 * 60 * 1000, // Every 8 hours
        minDataSize: 40,
        autoTriggers: ['agent-performance-updated'],
      },
    ];

    defaultSchedules.forEach(schedule => {
      // Find models of this type
      const models = this.neuralModels.getModelsByType(schedule.modelType);
      models.forEach(model => {
        this.schedules.set(model.id, {
          modelId: model.id,
          interval: schedule.interval,
          minDataSize: schedule.minDataSize,
          autoTriggers: schedule.autoTriggers,
          enabled: true,
        });
      });
    });
  }

  private setupEventHandlers(): void {
    this.neuralModels.on(
      'training-started',
      this.handleTrainingStarted.bind(this)
    );
    this.neuralModels.on(
      'training-completed',
      this.handleTrainingCompleted.bind(this)
    );
    this.neuralModels.on(
      'training-progress',
      this.handleTrainingProgress.bind(this)
    );
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processTrainingQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Add training data for a specific model type
   */
  addTrainingData(modelType: ModelType, data: any[]): void {
    if (!this.trainingData.has(modelType)) {
      this.trainingData.set(modelType, []);
    }

    const existing = this.trainingData.get(modelType)!;
    existing.push(...data);

    // Keep only recent data (prevent memory issues)
    const maxSize = 10000;
    if (existing.length > maxSize) {
      existing.splice(0, existing.length - maxSize);
    }

    this.emit('training-data-added', { modelType, dataSize: data.length });

    // Check if auto-training should be triggered
    this.checkAutoTraining(modelType);
  }

  /**
   * Schedule a training job
   */
  async scheduleTraining(
    modelId: string,
    config?: Partial<TrainingConfig>,
    priority: number = 1
  ): Promise<string> {
    const model = this.neuralModels.getModel(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const data = this.trainingData.get(model.type) || [];
    if (data.length === 0) {
      throw new Error(
        `No training data available for model type ${model.type}`
      );
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: TrainingJob = {
      id: jobId,
      modelId,
      status: 'pending',
      config: {
        epochs: 100,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        ...config,
      },
      data: [...data], // Copy data to avoid mutations
      progress: 0,
    };

    // Insert job based on priority - higher priority jobs go first
    // Priority 2+ jobs (like auto-training) should be inserted before priority 1 jobs
    if (priority > 1 && this.trainingQueue.length > 0) {
      // Insert at beginning for high priority jobs
      this.trainingQueue.unshift(job);
    } else {
      // Append to end for normal priority
      this.trainingQueue.push(job);
    }

    this.emit('job-scheduled', job);
    return jobId;
  }

  /**
   * Process the training queue
   */
  private async processTrainingQueue(): Promise<void> {
    if (
      this.activeJobs.size >= this.maxConcurrentJobs ||
      this.trainingQueue.length === 0
    ) {
      return;
    }

    const job = this.trainingQueue.shift()!;
    this.activeJobs.set(job.id, job);
    job.status = 'running';
    job.startTime = new Date();

    this.emit('job-started', job);

    try {
      const result = await this.neuralModels.trainModel(
        job.modelId,
        job.data,
        job.config
      );

      job.status = result.success ? 'completed' : 'failed';
      job.endTime = new Date();
      job.progress = 100;

      if (!result.success) {
        job.error = result.message;
      } else {
        job.metrics = result.data;
      }

      this.emit('job-completed', job);
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = (error as Error).message;

      this.emit('job-failed', job);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Check if automatic training should be triggered
   */
  private checkAutoTraining(modelType: ModelType): void {
    const models = this.neuralModels.getModelsByType(modelType);

    models.forEach(model => {
      const schedule = this.schedules.get(model.id);
      if (!schedule || !schedule.enabled) return;

      const data = this.trainingData.get(modelType) || [];
      if (data.length >= schedule.minDataSize) {
        // Check if enough time has passed since last training
        const lastTraining = this.getLastTrainingTime(model.id);
        const now = new Date().getTime();

        if (
          !lastTraining ||
          now - lastTraining.getTime() >= schedule.interval
        ) {
          this.scheduleTraining(model.id, undefined, 2); // Higher priority for auto-training
          this.emit('auto-training-triggered', {
            modelId: model.id,
            reason: 'scheduled',
          });
        }
      }
    });
  }

  /**
   * Collect execution data for training
   */
  async collectExecutionData(
    task: Task,
    agents: Agent[],
    result: any
  ): Promise<void> {
    // Task classification data
    this.addTrainingData('task-classification', [
      {
        input: {
          description: task.description,
          requiredCapabilities: task.requiredCapabilities,
          priority: task.priority,
          context: task.context,
        },
        output: {
          type: task.type,
          complexity: this.estimateComplexity(task),
          estimatedTime: result.executionTime || 0,
        },
      },
    ]);

    // Agent selection data
    this.addTrainingData('agent-selection', [
      {
        input: {
          taskType: task.type,
          requiredCapabilities: task.requiredCapabilities,
          context: task.context,
        },
        output: {
          selectedAgents: agents.map(a => a.type),
          success: result.success,
          performance: agents.map(a => a.metrics.successRate || 0),
        },
      },
    ]);

    // Performance prediction data
    this.addTrainingData('performance-prediction', [
      {
        input: {
          taskType: task.type,
          agentTypes: agents.map(a => a.type),
          complexity: this.estimateComplexity(task),
        },
        output: {
          executionTime: result.executionTime || 0,
          success: result.success,
          resourceUsage: result.resourceUsage || {},
        },
      },
    ]);

    // Pattern recognition data
    this.addTrainingData('pattern-recognition', [
      {
        input: {
          taskPattern: this.extractTaskPattern(task),
          agentPattern: this.extractAgentPattern(agents),
          contextPattern: this.extractContextPattern(task.context),
        },
        output: {
          outcome: result.success ? 'success' : 'failure',
          efficiency: this.calculateEfficiency(task, result),
          insights: result.insights || [],
        },
      },
    ]);
  }

  private estimateComplexity(task: Task): number {
    // Simple complexity estimation
    let complexity = 0;
    complexity += task.requiredCapabilities.length * 0.2;
    complexity += task.description.length / 100;
    if (task.priority === 'high') complexity += 0.3;
    if (task.priority === 'critical') complexity += 0.5;
    return Math.min(complexity, 1);
  }

  private extractTaskPattern(task: Task): any {
    return {
      type: task.type,
      capabilityCount: task.requiredCapabilities.length,
      descriptionLength: task.description.length,
      priority: task.priority,
    };
  }

  private extractAgentPattern(agents: Agent[]): any {
    return {
      count: agents.length,
      types: agents.map(a => a.type),
      categories: [...new Set(agents.map(a => a.category))],
      avgSuccessRate:
        agents.reduce((sum, a) => sum + (a.metrics.successRate || 0), 0) /
        agents.length,
    };
  }

  private extractContextPattern(context: any): any {
    return {
      hasContext: !!context,
      contextKeys: context ? Object.keys(context).length : 0,
      contextSize: context ? JSON.stringify(context).length : 0,
    };
  }

  private calculateEfficiency(task: Task, result: ExecutionResult): number {
    // Factor in task complexity for efficiency calculation
    const taskComplexity = this.estimateComplexity(task);

    const timeEfficiency = result.executionTime
      ? Math.max(0, 1 - result.executionTime / 3600)
      : 0.5;
    const successEfficiency = result.success ? 1 : 0;

    // Adjust efficiency based on task complexity - more complex tasks that succeed are more efficient
    const complexityBonus = result.success ? taskComplexity * 0.2 : 0;

    return Math.min(1, (timeEfficiency + successEfficiency) / 2 + complexityBonus);
  }

  private getLastTrainingTime(modelId: string): Date | null {
    const model = this.neuralModels.getModel(modelId);
    return model ? model.updatedAt : null;
  }

  /**
   * Get training job status
   */
  getJobStatus(jobId: string): TrainingJob | null {
    return (
      this.activeJobs.get(jobId) ||
      this.trainingQueue.find(job => job.id === jobId) ||
      null
    );
  }

  /**
   * Cancel a training job
   */
  cancelJob(jobId: string): boolean {
    // Remove from queue
    const queueIndex = this.trainingQueue.findIndex(job => job.id === jobId);
    if (queueIndex !== -1) {
      this.trainingQueue.splice(queueIndex, 1);
      this.emit('job-cancelled', { jobId });
      return true;
    }

    // Cannot cancel running jobs in this simplified implementation
    return false;
  }

  /**
   * Update training schedule
   */
  updateSchedule(modelId: string, schedule: Partial<TrainingSchedule>): void {
    const existing = this.schedules.get(modelId);
    if (existing) {
      Object.assign(existing, schedule);
      this.emit('schedule-updated', { modelId, schedule: existing });
    }
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): any {
    return {
      queueLength: this.trainingQueue.length,
      activeJobs: this.activeJobs.size,
      totalSchedules: this.schedules.size,
      enabledSchedules: Array.from(this.schedules.values()).filter(
        s => s.enabled
      ).length,
      trainingDataSizes: Object.fromEntries(
        Array.from(this.trainingData.entries()).map(([type, data]) => [
          type,
          data.length,
        ])
      ),
    };
  }

  private handleTrainingStarted(model: NeuralModel): void {
    // Find corresponding job and update status
    for (const job of this.activeJobs.values()) {
      if (job.modelId === model.id && job.status === 'running') {
        this.emit('job-progress', job);
        break;
      }
    }
  }

  private handleTrainingCompleted(model: NeuralModel): void {
    this.emit('model-training-completed', model);
  }

  private handleTrainingProgress(progress: TrainingProgress): void {
    // Update job progress
    for (const job of this.activeJobs.values()) {
      if (job.modelId === progress.modelId) {
        job.progress = progress.progress;
        this.emit('job-progress', job);
        break;
      }
    }
  }

  async shutdown(): Promise<OperationResult> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Cancel all pending jobs
    this.trainingQueue.length = 0;
    this.activeJobs.clear();
    this.trainingData.clear();

    return {
      success: true,
      message: 'Training Pipeline shutdown completed',
    };
  }
}
