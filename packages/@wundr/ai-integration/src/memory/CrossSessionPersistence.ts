/**
 * Cross Session Persistence - Long-term memory storage
 * 
 * Manages persistent memory across sessions, handling data serialization,
 * storage, retrieval, and cross-session pattern learning.
 */

import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MemoryEntry, MemoryType, OperationResult } from '../types';

export interface PersistentMemoryEntry extends MemoryEntry {
  persistedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  importance: number; // 0-1 scale
  crossSessionRelevance: number; // 0-1 scale
}

export interface MemorySnapshot {
  id: string;
  sessionId: string;
  timestamp: Date;
  entries: PersistentMemoryEntry[];
  metadata: any;
}

export interface CrossSessionPattern {
  id: string;
  pattern: string;
  frequency: number;
  sessions: string[];
  confidence: number;
  lastSeen: Date;
  metadata: any;
}

export class CrossSessionPersistence extends EventEmitter {
  private persistencePath: string;
  private memoriesPath: string;
  private patternsPath: string;
  private snapshotsPath: string;
  private memoryCache: Map<string, PersistentMemoryEntry> = new Map();
  private patternCache: Map<string, CrossSessionPattern> = new Map();
  private maxCacheSize = 10000;
  private compressionEnabled: boolean;

  constructor(persistencePath: string, compressionEnabled: boolean = true) {
    super();
    this.persistencePath = persistencePath;
    this.memoriesPath = path.join(persistencePath, 'memories');
    this.patternsPath = path.join(persistencePath, 'patterns');
    this.snapshotsPath = path.join(persistencePath, 'snapshots');
    this.compressionEnabled = compressionEnabled;
  }

  async initialize(): Promise<OperationResult> {
    try {
      // Create directory structure
      await Promise.all([
        fs.ensureDir(this.memoriesPath),
        fs.ensureDir(this.patternsPath),
        fs.ensureDir(this.snapshotsPath)
      ]);

      // Load existing patterns
      await this.loadPatterns();

      // Setup maintenance tasks
      this.setupMaintenanceTasks();

      return {
        success: true,
        message: 'Cross Session Persistence initialized successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Initialization failed: ${(error as Error).message}`,
        error
      };
    }
  }

  /**
   * Persist memory entries from a session
   */
  async persistSession(
    sessionId: string,
    entries: MemoryEntry[],
    importance: number = 0.5
  ): Promise<OperationResult> {
    try {
      const persistentEntries: PersistentMemoryEntry[] = entries.map(entry => ({
        ...entry,
        persistedAt: new Date(),
        accessCount: 0,
        lastAccessed: entry.createdAt,
        importance: this.calculateImportance(entry, importance),
        crossSessionRelevance: this.calculateRelevance(entry)
      }));

      // Store in file system
      const sessionFile = path.join(this.memoriesPath, `${sessionId}.json`);
      await this.writeMemoryFile(sessionFile, persistentEntries);

      // Update cache with high-importance entries
      persistentEntries.forEach(entry => {
        if (entry.importance > 0.7 && this.memoryCache.size < this.maxCacheSize) {
          this.memoryCache.set(entry.id, entry);
        }
      });

      // Analyze and update patterns
      await this.analyzeSessionPatterns(sessionId, persistentEntries);

      this.emit('session-persisted', { sessionId, count: persistentEntries.length });

      return {
        success: true,
        message: `Persisted ${persistentEntries.length} entries from session ${sessionId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Persistence failed: ${(error as Error).message}`,
        error
      };
    }
  }

  /**
   * Retrieve memories relevant to current context
   */
  async retrieveRelevantMemories(
    context: {
      taskType?: string;
      agentTypes?: string[];
      capabilities?: string[];
      tags?: string[];
      sessionPattern?: any;
    },
    limit: number = 50
  ): Promise<PersistentMemoryEntry[]> {
    try {
      const relevantMemories: Array<{ memory: PersistentMemoryEntry; score: number }> = [];

      // Check cache first
      for (const memory of this.memoryCache.values()) {
        const score = this.calculateContextRelevance(memory, context);
        if (score > 0.3) {
          relevantMemories.push({ memory, score });
        }
      }

      // If we need more, search files
      if (relevantMemories.length < limit) {
        const fileMemories = await this.searchMemoryFiles(context, limit - relevantMemories.length);
        relevantMemories.push(...fileMemories);
      }

      // Sort by relevance score and return top results
      relevantMemories.sort((a, b) => b.score - a.score);
      
      const results = relevantMemories.slice(0, limit).map(({ memory }) => {
        // Update access tracking
        memory.accessCount++;
        memory.lastAccessed = new Date();
        return memory;
      });

      this.emit('memories-retrieved', { count: results.length, context });
      return results;
    } catch (error) {
      console.error('Failed to retrieve relevant memories:', error);
      return [];
    }
  }

  /**
   * Search for cross-session patterns
   */
  async findCrossSessionPatterns(
    criteria: {
      pattern?: string;
      minFrequency?: number;
      minConfidence?: number;
      sessionCount?: number;
    }
  ): Promise<CrossSessionPattern[]> {
    const patterns = Array.from(this.patternCache.values());
    
    return patterns.filter(pattern => {
      if (criteria.pattern && !pattern.pattern.includes(criteria.pattern)) return false;
      if (criteria.minFrequency && pattern.frequency < criteria.minFrequency) return false;
      if (criteria.minConfidence && pattern.confidence < criteria.minConfidence) return false;
      if (criteria.sessionCount && pattern.sessions.length < criteria.sessionCount) return false;
      return true;
    });
  }

  /**
   * Create a memory snapshot for backup/analysis
   */
  async createSnapshot(sessionId: string, metadata?: any): Promise<string> {
    try {
      const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Load session memories
      const sessionFile = path.join(this.memoriesPath, `${sessionId}.json`);
      const entries = await this.readMemoryFile(sessionFile);

      const snapshot: MemorySnapshot = {
        id: snapshotId,
        sessionId,
        timestamp: new Date(),
        entries,
        metadata: metadata || {}
      };

      const snapshotFile = path.join(this.snapshotsPath, `${snapshotId}.json`);
      await this.writeMemoryFile(snapshotFile, snapshot);

      this.emit('snapshot-created', snapshot);
      return snapshotId;
    } catch (error) {
      throw new Error(`Snapshot creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshotId: string): Promise<OperationResult> {
    try {
      const snapshotFile = path.join(this.snapshotsPath, `${snapshotId}.json`);
      const snapshot: MemorySnapshot = await this.readMemoryFile(snapshotFile);

      // Restore session memories
      const sessionFile = path.join(this.memoriesPath, `${snapshot.sessionId}.json`);
      await this.writeMemoryFile(sessionFile, snapshot.entries);

      // Update cache
      snapshot.entries.forEach(entry => {
        if (entry.importance > 0.7) {
          this.memoryCache.set(entry.id, entry);
        }
      });

      this.emit('snapshot-restored', snapshot);

      return {
        success: true,
        message: `Restored ${snapshot.entries.length} entries from snapshot ${snapshotId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Restore failed: ${(error as Error).message}`,
        error
      };
    }
  }

  /**
   * Compress and optimize stored memories
   */
  async compressMemories(): Promise<OperationResult> {
    if (!this.compressionEnabled) {
      return { success: true, message: 'Compression disabled' };
    }

    try {
      const memoryFiles = await fs.readdir(this.memoriesPath);
      let totalCompressed = 0;
      let totalRemoved = 0;

      for (const file of memoryFiles) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.memoriesPath, file);
        const entries: PersistentMemoryEntry[] = await this.readMemoryFile(filePath);

        // Remove low-importance, rarely accessed entries
        const filtered = entries.filter(entry => {
          const daysSinceAccess = (Date.now() - entry.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
          return entry.importance > 0.3 || daysSinceAccess < 30 || entry.accessCount > 5;
        });

        totalRemoved += entries.length - filtered.length;

        if (filtered.length !== entries.length) {
          await this.writeMemoryFile(filePath, filtered);
          totalCompressed++;
        }
      }

      this.emit('compression-completed', { filesCompressed: totalCompressed, entriesRemoved: totalRemoved });

      return {
        success: true,
        message: `Compressed ${totalCompressed} files, removed ${totalRemoved} entries`
      };
    } catch (error) {
      return {
        success: false,
        message: `Compression failed: ${(error as Error).message}`,
        error
      };
    }
  }

  private calculateImportance(entry: MemoryEntry, baseImportance: number): number {
    let importance = baseImportance;

    // Boost importance based on entry type
    const typeBoost = {
      'consensus': 0.3,
      'performance': 0.2,
      'pattern': 0.25,
      'session': 0.1,
      'agent': 0.15,
      'task': 0.2
    };
    importance += typeBoost[entry.type] || 0;

    // Boost for tagged entries
    if (entry.tags.length > 0) {
      importance += Math.min(entry.tags.length * 0.05, 0.2);
    }

    // Boost for entries with metadata
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      importance += 0.1;
    }

    return Math.min(importance, 1);
  }

  private calculateRelevance(entry: MemoryEntry): number {
    let relevance = 0.5;

    // Higher relevance for certain types
    if (['consensus', 'pattern', 'performance'].includes(entry.type)) {
      relevance += 0.2;
    }

    // Higher relevance for tagged entries
    if (entry.tags.includes('important') || entry.tags.includes('pattern')) {
      relevance += 0.15;
    }

    // Age factor - newer entries are more relevant
    const ageInDays = (Date.now() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const ageFactor = Math.max(0, 1 - (ageInDays / 30)); // Decay over 30 days
    relevance *= (0.5 + ageFactor * 0.5);

    return Math.min(relevance, 1);
  }

  private calculateContextRelevance(memory: PersistentMemoryEntry, context: any): number {
    let score = memory.crossSessionRelevance * 0.4 + memory.importance * 0.3;

    // Task type matching
    if (context.taskType && memory.taskId) {
      score += 0.2;
    }

    // Agent type matching
    if (context.agentTypes && memory.agentId) {
      score += 0.15;
    }

    // Tag matching
    if (context.tags && memory.tags.some(tag => context.tags.includes(tag))) {
      score += 0.25;
    }

    // Capability matching
    if (context.capabilities && memory.metadata?.capabilities) {
      const matches = context.capabilities.filter(cap => 
        memory.metadata.capabilities.includes(cap)
      ).length;
      score += (matches / context.capabilities.length) * 0.2;
    }

    // Recency boost
    const daysSinceCreation = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 1 - (daysSinceCreation / 90)); // 90 day decay
    score *= (0.7 + recencyFactor * 0.3);

    return score;
  }

  private async searchMemoryFiles(context: any, limit: number): Promise<Array<{ memory: PersistentMemoryEntry; score: number }>> {
    const results: Array<{ memory: PersistentMemoryEntry; score: number }> = [];
    
    try {
      const files = await fs.readdir(this.memoriesPath);
      
      for (const file of files) {
        if (!file.endsWith('.json') || results.length >= limit) continue;
        
        const filePath = path.join(this.memoriesPath, file);
        const memories: PersistentMemoryEntry[] = await this.readMemoryFile(filePath);
        
        for (const memory of memories) {
          const score = this.calculateContextRelevance(memory, context);
          if (score > 0.3) {
            results.push({ memory, score });
          }
        }
      }
    } catch (error) {
      console.error('Error searching memory files:', error);
    }

    return results;
  }

  private async analyzeSessionPatterns(sessionId: string, entries: PersistentMemoryEntry[]): Promise<void> {
    // Extract patterns from the session
    const patterns = this.extractPatterns(entries);
    
    for (const patternData of patterns) {
      const existingPattern = this.patternCache.get(patternData.pattern);
      
      if (existingPattern) {
        // Update existing pattern
        existingPattern.frequency++;
        existingPattern.sessions.push(sessionId);
        existingPattern.lastSeen = new Date();
        existingPattern.confidence = Math.min(existingPattern.confidence + 0.1, 1);
      } else {
        // Create new pattern
        const newPattern: CrossSessionPattern = {
          id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          pattern: patternData.pattern,
          frequency: 1,
          sessions: [sessionId],
          confidence: 0.5,
          lastSeen: new Date(),
          metadata: patternData.metadata
        };
        this.patternCache.set(newPattern.pattern, newPattern);
      }
    }

    // Persist patterns
    await this.savePatterns();
  }

  private extractPatterns(entries: PersistentMemoryEntry[]): Array<{ pattern: string; metadata: any }> {
    const patterns: Array<{ pattern: string; metadata: any }> = [];

    // Agent-task patterns
    const agentTasks = new Map<string, Set<string>>();
    entries.forEach(entry => {
      if (entry.agentId && entry.taskId) {
        if (!agentTasks.has(entry.agentId)) {
          agentTasks.set(entry.agentId, new Set());
        }
        agentTasks.get(entry.agentId)!.add(entry.taskId);
      }
    });

    agentTasks.forEach((tasks, agentId) => {
      if (tasks.size >= 3) {
        patterns.push({
          pattern: `agent-${agentId}-multitask`,
          metadata: { agentId, taskCount: tasks.size, tasks: Array.from(tasks) }
        });
      }
    });

    // Tag combination patterns
    const tagCombinations = new Map<string, number>();
    entries.forEach(entry => {
      if (entry.tags.length >= 2) {
        const sortedTags = entry.tags.sort().join(',');
        tagCombinations.set(sortedTags, (tagCombinations.get(sortedTags) || 0) + 1);
      }
    });

    tagCombinations.forEach((count, tags) => {
      if (count >= 3) {
        patterns.push({
          pattern: `tags-${tags}`,
          metadata: { tags: tags.split(','), frequency: count }
        });
      }
    });

    return patterns;
  }

  private async loadPatterns(): Promise<void> {
    try {
      const patternsFile = path.join(this.patternsPath, 'patterns.json');
      if (await fs.pathExists(patternsFile)) {
        const patterns: CrossSessionPattern[] = await this.readMemoryFile(patternsFile);
        patterns.forEach(pattern => {
          this.patternCache.set(pattern.pattern, pattern);
        });
      }
    } catch (error) {
      console.error('Failed to load patterns:', error);
    }
  }

  private async savePatterns(): Promise<void> {
    try {
      const patternsFile = path.join(this.patternsPath, 'patterns.json');
      const patterns = Array.from(this.patternCache.values());
      await this.writeMemoryFile(patternsFile, patterns);
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }

  private async readMemoryFile(filePath: string): Promise<any> {
    if (this.compressionEnabled) {
      // In a real implementation, you would use actual compression
      const data = await fs.readJson(filePath);
      return data;
    } else {
      return await fs.readJson(filePath);
    }
  }

  private async writeMemoryFile(filePath: string, data: any): Promise<void> {
    if (this.compressionEnabled) {
      // In a real implementation, you would use actual compression
      await fs.writeJson(filePath, data, { spaces: 0 });
    } else {
      await fs.writeJson(filePath, data, { spaces: 2 });
    }
  }

  private setupMaintenanceTasks(): void {
    // Daily compression
    setInterval(() => {
      this.compressMemories();
    }, 24 * 60 * 60 * 1000);

    // Weekly pattern cleanup
    setInterval(() => {
      this.cleanupOldPatterns();
    }, 7 * 24 * 60 * 60 * 1000);
  }

  private cleanupOldPatterns(): void {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    
    for (const [key, pattern] of this.patternCache.entries()) {
      if (pattern.lastSeen < cutoffDate && pattern.frequency < 5) {
        this.patternCache.delete(key);
      }
    }

    this.savePatterns();
  }

  async shutdown(): Promise<OperationResult> {
    await this.savePatterns();
    this.memoryCache.clear();
    this.patternCache.clear();

    return {
      success: true,
      message: 'Cross Session Persistence shutdown completed'
    };
  }
}