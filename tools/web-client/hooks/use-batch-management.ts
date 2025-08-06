'use client';

import { useState, useEffect, useCallback } from 'react';

export interface BatchJob {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  templates: string[];
  consolidationType: 'merge' | 'replace' | 'archive';
  priority: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  actualDuration?: number;
  errors: string[];
  warnings: string[];
  results?: {
    templatesProcessed: number;
    duplicatesRemoved: number;
    conflictsResolved: number;
    filesModified: number;
  };
}

export interface BatchSchedule {
  id: string;
  name: string;
  batchId: string;
  cronExpression: string;
  nextRun: Date;
  enabled: boolean;
  lastRun?: Date;
  lastStatus?: 'success' | 'failed';
}

export interface CreateBatchRequest {
  name: string;
  description: string;
  templates: string[];
  consolidationType: 'merge' | 'replace' | 'archive';
  priority: 'low' | 'medium' | 'high';
  schedule?: string;
  config?: {
    backupStrategy: 'auto' | 'manual' | 'none';
    conflictResolution: 'interactive' | 'auto' | 'skip';
  };
}

export const useBatchManagement = () => {
  const [activeBatches, setActiveBatches] = useState<BatchJob[]>([]);
  const [batchHistory, setBatchHistory] = useState<BatchJob[]>([]);
  const [schedules, setSchedules] = useState<BatchSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock API functions - replace with actual API calls
  const fetchActiveBatches = useCallback(async (): Promise<BatchJob[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return [
      {
        id: 'batch-001',
        name: 'Template Consolidation - Q4 2024',
        description: 'Consolidating duplicate React components and utilities',
        status: 'running',
        progress: 65,
        createdAt: new Date('2024-01-15T10:00:00'),
        startedAt: new Date('2024-01-15T10:05:00'),
        templates: ['Button', 'Input', 'Modal', 'Card'],
        consolidationType: 'merge',
        priority: 'high',
        estimatedDuration: 120,
        errors: [],
        warnings: ['Potential breaking change in Button component']
      },
      {
        id: 'batch-002',
        name: 'Legacy API Cleanup',
        description: 'Removing deprecated API templates',
        status: 'pending',
        progress: 0,
        createdAt: new Date('2024-01-15T14:30:00'),
        templates: ['AuthAPI', 'UserAPI', 'PaymentAPI'],
        consolidationType: 'archive',
        priority: 'medium',
        estimatedDuration: 90,
        errors: [],
        warnings: []
      }
    ];
  }, []);

  const fetchBatchHistory = useCallback(async (): Promise<BatchJob[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return [
      {
        id: 'batch-h001',
        name: 'Database Schema Templates',
        description: 'Merged redundant database migration templates',
        status: 'completed',
        progress: 100,
        createdAt: new Date('2024-01-10T09:00:00'),
        startedAt: new Date('2024-01-10T09:15:00'),
        completedAt: new Date('2024-01-10T11:30:00'),
        templates: ['Migration', 'Schema', 'Seed'],
        consolidationType: 'merge',
        priority: 'medium',
        estimatedDuration: 150,
        actualDuration: 135,
        errors: [],
        warnings: [],
        results: {
          templatesProcessed: 15,
          duplicatesRemoved: 8,
          conflictsResolved: 3,
          filesModified: 24
        }
      },
      {
        id: 'batch-h002',
        name: 'CSS Framework Migration',
        description: 'Failed due to circular dependencies',
        status: 'failed',
        progress: 45,
        createdAt: new Date('2024-01-08T16:00:00'),
        startedAt: new Date('2024-01-08T16:10:00'),
        completedAt: new Date('2024-01-08T17:45:00'),
        templates: ['Styles', 'Themes', 'Variables'],
        consolidationType: 'replace',
        priority: 'low',
        estimatedDuration: 200,
        actualDuration: 95,
        errors: ['Circular dependency detected in theme system'],
        warnings: ['Multiple theme conflicts found']
      }
    ];
  }, []);

  const fetchSchedules = useCallback(async (): Promise<BatchSchedule[]> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return [
      {
        id: 'sched-001',
        name: 'Weekly Template Cleanup',
        batchId: 'template-weekly',
        cronExpression: '0 2 * * 1',
        nextRun: new Date('2024-01-22T02:00:00'),
        enabled: true,
        lastRun: new Date('2024-01-15T02:00:00'),
        lastStatus: 'success'
      },
      {
        id: 'sched-002',
        name: 'Monthly Archive Job',
        batchId: 'archive-monthly',
        cronExpression: '0 1 1 * *',
        nextRun: new Date('2024-02-01T01:00:00'),
        enabled: false,
        lastRun: new Date('2024-01-01T01:00:00'),
        lastStatus: 'failed'
      }
    ];
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [active, history, scheduled] = await Promise.all([
          fetchActiveBatches(),
          fetchBatchHistory(),
          fetchSchedules()
        ]);
        
        setActiveBatches(active);
        setBatchHistory(history);
        setSchedules(scheduled);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load batch data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchActiveBatches, fetchBatchHistory, fetchSchedules]);

  // Batch operations
  const createBatch = useCallback(async (request: CreateBatchRequest): Promise<BatchJob> => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newBatch: BatchJob = {
        id: `batch-${Date.now()}`,
        name: request.name,
        description: request.description,
        status: request.schedule ? 'pending' : 'running',
        progress: 0,
        createdAt: new Date(),
        templates: request.templates,
        consolidationType: request.consolidationType,
        priority: request.priority,
        estimatedDuration: 60, // Default estimate
        errors: [],
        warnings: []
      };
      
      if (!request.schedule) {
        newBatch.startedAt = new Date();
        setActiveBatches(prev => [...prev, newBatch]);
      }
      
      return newBatch;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create batch';
      setError(error);
      throw new Error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const pauseBatch = useCallback(async (batchId: string): Promise<void> => {
    setActiveBatches(prev => 
      prev.map(batch => 
        batch.id === batchId 
          ? { ...batch, status: 'paused' as const }
          : batch
      )
    );
  }, []);

  const resumeBatch = useCallback(async (batchId: string): Promise<void> => {
    setActiveBatches(prev => 
      prev.map(batch => 
        batch.id === batchId 
          ? { ...batch, status: 'running' as const }
          : batch
      )
    );
  }, []);

  const stopBatch = useCallback(async (batchId: string): Promise<void> => {
    setActiveBatches(prev => 
      prev.filter(batch => batch.id !== batchId)
    );
    
    // Move to history with failed status
    const stoppedBatch = activeBatches.find(b => b.id === batchId);
    if (stoppedBatch) {
      setBatchHistory(prev => [{
        ...stoppedBatch,
        status: 'failed',
        completedAt: new Date(),
        errors: ['Batch stopped by user']
      }, ...prev]);
    }
  }, [activeBatches]);

  const retryBatch = useCallback(async (batchId: string): Promise<void> => {
    const batch = batchHistory.find(b => b.id === batchId);
    if (batch) {
      const retriedBatch: BatchJob = {
        ...batch,
        id: `${batch.id}-retry-${Date.now()}`,
        status: 'running',
        progress: 0,
        startedAt: new Date(),
        completedAt: undefined,
        errors: [],
        warnings: []
      };
      
      setActiveBatches(prev => [...prev, retriedBatch]);
    }
  }, [batchHistory]);

  const rollbackBatch = useCallback(async (batchId: string): Promise<void> => {
    // Simulate rollback operation
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      // In a real implementation, this would restore files from backup
      console.log(`Rolling back batch ${batchId}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBatch = useCallback(async (batchId: string): Promise<void> => {
    setBatchHistory(prev => prev.filter(batch => batch.id !== batchId));
  }, []);

  // Schedule operations
  const createSchedule = useCallback(async (schedule: Omit<BatchSchedule, 'id'>): Promise<BatchSchedule> => {
    const newSchedule: BatchSchedule = {
      ...schedule,
      id: `sched-${Date.now()}`
    };
    
    setSchedules(prev => [...prev, newSchedule]);
    return newSchedule;
  }, []);

  const toggleSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    setSchedules(prev => 
      prev.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, enabled: !schedule.enabled }
          : schedule
      )
    );
  }, []);

  const deleteSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
  }, []);

  // Real-time progress updates (simulate)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBatches(prev => 
        prev.map(batch => {
          if (batch.status === 'running' && batch.progress < 100) {
            const increment = Math.random() * 5;
            const newProgress = Math.min(batch.progress + increment, 100);
            
            if (newProgress >= 100) {
              // Move completed batch to history
              setTimeout(() => {
                setActiveBatches(current => current.filter(b => b.id !== batch.id));
                setBatchHistory(current => [{
                  ...batch,
                  status: 'completed',
                  progress: 100,
                  completedAt: new Date(),
                  actualDuration: batch.estimatedDuration + Math.floor(Math.random() * 30) - 15,
                  results: {
                    templatesProcessed: batch.templates.length * 2,
                    duplicatesRemoved: Math.floor(batch.templates.length * 0.6),
                    conflictsResolved: Math.floor(batch.templates.length * 0.2),
                    filesModified: batch.templates.length * 3
                  }
                }, ...current]);
              }, 1000);
            }
            
            return { ...batch, progress: newProgress };
          }
          return batch;
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return {
    // State
    activeBatches,
    batchHistory,
    schedules,
    loading,
    error,
    
    // Operations
    createBatch,
    pauseBatch,
    resumeBatch,
    stopBatch,
    retryBatch,
    rollbackBatch,
    deleteBatch,
    
    // Schedule operations
    createSchedule,
    toggleSchedule,
    deleteSchedule,
    
    // Refresh data
    refresh: () => {
      fetchActiveBatches().then(setActiveBatches);
      fetchBatchHistory().then(setBatchHistory);
      fetchSchedules().then(setSchedules);
    }
  };
};