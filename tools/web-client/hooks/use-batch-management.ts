'use client';

import { useState, useEffect, useCallback } from 'react';

export interface BatchJob {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  templateIds: string[];
  consolidationType: 'merge' | 'replace' | 'archive';
  priority: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  actualDuration?: number;
  errors: string[];
  warnings: string[];
  currentStage?: string;
  currentTemplate?: string;
  results?: {
    templatesProcessed: number;
    duplicatesRemoved: number;
    conflictsResolved: number;
    filesCreated: number;
    filesModified: number;
    backupCreated: boolean;
  };
  executionIds: string[];
  config: {
    backupStrategy: 'auto' | 'manual' | 'none';
    conflictResolution: 'interactive' | 'auto' | 'skip';
    maxConcurrentJobs?: number;
    retryAttempts?: number;
    timeoutPerTemplate?: number;
    rollbackOnFailure?: boolean;
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
  templateIds: string[];
  consolidationType: 'merge' | 'replace' | 'archive';
  priority: 'low' | 'medium' | 'high';
  schedule?: string;
  config?: {
    backupStrategy: 'auto' | 'manual' | 'none';
    conflictResolution: 'interactive' | 'auto' | 'skip';
    maxConcurrentJobs?: number;
    retryAttempts?: number;
    timeoutPerTemplate?: number;
    rollbackOnFailure?: boolean;
  };
}

export const useBatchManagement = () => {
  const [activeBatches, setActiveBatches] = useState<BatchJob[]>([]);
  const [batchHistory, setBatchHistory] = useState<BatchJob[]>([]);
  const [schedules, setSchedules] = useState<BatchSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API functions using real backend services
  const fetchActiveBatches = useCallback(async (): Promise<BatchJob[]> => {
    const response = await fetch('/api/batches?type=active');
    if (!response.ok) {
      throw new Error('Failed to fetch active batches');
    }
    const data = await response.json();
    return data.success ? data.data.map(transformBatch) : [];
  }, []);

  const fetchBatchHistory = useCallback(async (): Promise<BatchJob[]> => {
    const response = await fetch('/api/batches?type=history');
    if (!response.ok) {
      throw new Error('Failed to fetch batch history');
    }
    const data = await response.json();
    return data.success ? data.data.map(transformBatch) : [];
  }, []);

  const fetchSchedules = useCallback(async (): Promise<BatchSchedule[]> => {
    // For now, schedules are managed separately - would integrate with job scheduler
    return [];
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

  // Transform function to ensure compatibility
  const transformBatch = useCallback((batch: any): BatchJob => {
    return {
      ...batch,
      createdAt: new Date(batch.createdAt),
      startedAt: batch.startedAt ? new Date(batch.startedAt) : undefined,
      completedAt: batch.completedAt ? new Date(batch.completedAt) : undefined,
      templates: batch.templateIds || batch.templates || [], // Backward compatibility
      config: batch.config || {
        backupStrategy: 'auto',
        conflictResolution: 'interactive'
      }
    };
  }, []);

  // Batch operations
  const createBatch = useCallback(async (request: CreateBatchRequest): Promise<BatchJob> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create batch');
      }
      
      const newBatch = transformBatch(data.data);
      
      // Update local state
      if (newBatch.status === 'running' || newBatch.status === 'pending') {
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
  }, [transformBatch]);

  const pauseBatch = useCallback(async (batchId: string): Promise<void> => {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause' })
    });
    
    if (!response.ok) {
      throw new Error('Failed to pause batch');
    }
    
    const data = await response.json();
    if (data.success) {
      const updatedBatch = transformBatch(data.data);
      setActiveBatches(prev => 
        prev.map(batch => batch.id === batchId ? updatedBatch : batch)
      );
    }
  }, [transformBatch]);

  const resumeBatch = useCallback(async (batchId: string): Promise<void> => {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume' })
    });
    
    if (!response.ok) {
      throw new Error('Failed to resume batch');
    }
    
    const data = await response.json();
    if (data.success) {
      const updatedBatch = transformBatch(data.data);
      setActiveBatches(prev => 
        prev.map(batch => batch.id === batchId ? updatedBatch : batch)
      );
    }
  }, [transformBatch]);

  const stopBatch = useCallback(async (batchId: string): Promise<void> => {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' })
    });
    
    if (!response.ok) {
      throw new Error('Failed to stop batch');
    }
    
    // Refresh data
    const [active, history] = await Promise.all([
      fetchActiveBatches(),
      fetchBatchHistory()
    ]);
    
    setActiveBatches(active);
    setBatchHistory(history);
  }, [fetchActiveBatches, fetchBatchHistory]);

  const retryBatch = useCallback(async (batchId: string): Promise<void> => {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry' })
    });
    
    if (!response.ok) {
      throw new Error('Failed to retry batch');
    }
    
    // Refresh active batches to show the new retry
    const active = await fetchActiveBatches();
    setActiveBatches(active);
  }, [fetchActiveBatches]);

  const rollbackBatch = useCallback(async (batchId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to rollback batch');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBatch = useCallback(async (batchId: string): Promise<void> => {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete batch');
    }
    
    // Remove from local state
    setBatchHistory(prev => prev.filter(batch => batch.id !== batchId));
    setActiveBatches(prev => prev.filter(batch => batch.id !== batchId));
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

  // Real-time progress updates using polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const active = await fetchActiveBatches();
        setActiveBatches(active);
        
        // Check if any batches completed
        const completedBatches = active.filter(batch => batch.status === 'completed');
        if (completedBatches.length > 0) {
          // Refresh history to include completed batches
          const history = await fetchBatchHistory();
          setBatchHistory(history);
        }
      } catch (_error) {
        console.warn('Failed to update batch progress:', error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [fetchActiveBatches, fetchBatchHistory]);

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