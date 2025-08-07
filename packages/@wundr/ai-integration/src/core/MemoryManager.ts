/**
 * Memory Manager - Cross-session memory persistence and optimization
 * 
 * Manages agent memories, session data, patterns, and cross-session learning.
 * Implements intelligent memory compression, retention policies, and context restoration.
 */

import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Database } from 'sqlite3';
import { 
  MemoryConfig, 
  MemoryEntry, 
  MemoryType, 
  MemoryContext,
  Agent,
  Task,
  OperationResult 
} from '../types';

export class MemoryManager extends EventEmitter {
  private config: MemoryConfig;
  private database: Database | null = null;
  private memoryCache: Map<string, MemoryEntry> = new Map();
  private compressionQueue: MemoryEntry[] = [];
  private retentionTimer: NodeJS.Timeout | null = null;
  private sessionContexts: Map<string, MemoryContext> = new Map();

  constructor(config: MemoryConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<OperationResult> {
    try {
      // Ensure persistence directory exists
      await fs.ensureDir(this.config.persistencePath);
      
      // Initialize SQLite database for persistent storage
      await this.initializeDatabase();
      
      // Load existing memories into cache
      await this.loadMemoriesIntoCache();
      
      // Setup retention policy enforcement
      this.setupRetentionPolicy();
      
      // Initialize compression if enabled
      if (this.config.compressionEnabled) {
        await this.initializeCompression();
      }

      return {
        success: true,
        message: 'Memory Manager initialized successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Memory Manager initialization failed: ${error.message}`,
        error: error
      };
    }
  }

  private async initializeDatabase(): Promise<void> {
    const dbPath = path.join(this.config.persistencePath, 'memory.db');
    
    return new Promise((resolve, reject) => {
      this.database = new Database(dbPath, (error) => {
        if (error) {
          reject(error);
          return;
        }

        // Create tables if they don't exist
        this.database!.serialize(() => {
          this.database!.run(`
            CREATE TABLE IF NOT EXISTS memories (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              session_id TEXT,
              agent_id TEXT,
              task_id TEXT,
              content TEXT NOT NULL,
              tags TEXT,
              metadata TEXT,
              created_at INTEGER NOT NULL,
              expires_at INTEGER,
              accessed_at INTEGER,
              access_count INTEGER DEFAULT 0,
              compressed BOOLEAN DEFAULT FALSE
            )
          `);

          this.database!.run(`
            CREATE INDEX IF NOT EXISTS idx_memories_session 
            ON memories(session_id)
          `);

          this.database!.run(`
            CREATE INDEX IF NOT EXISTS idx_memories_agent 
            ON memories(agent_id)
          `);

          this.database!.run(`
            CREATE INDEX IF NOT EXISTS idx_memories_type 
            ON memories(type)
          `);

          this.database!.run(`
            CREATE INDEX IF NOT EXISTS idx_memories_expires 
            ON memories(expires_at)
          `);
        });

        resolve();
      });
    });
  }

  private async loadMemoriesIntoCache(): Promise<void> {
    if (!this.database) return;

    // Load recent and frequently accessed memories
    const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM memories 
        WHERE (created_at > ? OR access_count > 5)
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY access_count DESC, created_at DESC
        LIMIT ?
      `;
      
      this.database!.all(
        query, 
        [recentThreshold, Date.now(), this.config.maxSessionMemory],
        (error, rows: any[]) => {
          if (error) {
            reject(error);
            return;
          }

          for (const row of rows) {
            const memoryEntry = this.deserializeMemoryEntry(row);
            this.memoryCache.set(memoryEntry.id, memoryEntry);
          }

          resolve();
        }
      );
    });
  }

  private deserializeMemoryEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      type: row.type as MemoryType,
      content: JSON.parse(row.content),
      sessionId: row.session_id,
      agentId: row.agent_id,
      taskId: row.task_id,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      tags: row.tags ? row.tags.split(',') : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  private setupRetentionPolicy(): void {
    // Run retention policy every hour
    this.retentionTimer = setInterval(async () => {
      await this.enforceRetentionPolicy();
    }, 60 * 60 * 1000);
  }

  private async initializeCompression(): void {
    // Setup compression processing
    setInterval(async () => {
      if (this.compressionQueue.length > 0) {
        await this.processCompressionQueue();
      }
    }, 5 * 60 * 1000); // Process every 5 minutes
  }

  /**
   * Create memory context for task execution
   */
  async createContext(task: Task): Promise<MemoryContext> {
    const contextId = `context-${task.id}-${Date.now()}`;
    
    // Retrieve relevant memories
    const sessionMemory = await this.getMemoriesByType('session');
    const taskMemory = await this.getMemoriesForSimilarTasks(task);
    const patterns = await this.getRelevantPatterns(task);
    
    // Create agent memory maps
    const agentMemory = new Map<string, MemoryEntry[]>();
    for (const agentId of task.assignedAgents) {
      const memories = await this.getMemoriesForAgent(agentId);
      agentMemory.set(agentId, memories);
    }
    
    // Create task memory map
    const taskMemoryMap = new Map<string, MemoryEntry[]>();
    taskMemoryMap.set(task.id, taskMemory);
    
    const context: MemoryContext = {
      sessionMemory,
      agentMemory,
      taskMemory: taskMemoryMap,
      patterns
    };
    
    this.sessionContexts.set(contextId, context);
    this.emit('context-created', { contextId, task: task.id });
    
    return context;
  }

  private async getMemoriesForSimilarTasks(task: Task): Promise<MemoryEntry[]> {
    // Find memories from similar tasks based on type and capabilities
    const similarMemories = Array.from(this.memoryCache.values())
      .filter(memory => 
        memory.type === 'task' &&
        memory.metadata.taskType === task.type &&
        this.hasOverlappingCapabilities(memory.metadata.requiredCapabilities, task.requiredCapabilities)
      )
      .sort((a, b) => this.calculateTaskSimilarity(b, task) - this.calculateTaskSimilarity(a, task))
      .slice(0, 10);

    return similarMemories;
  }

  private hasOverlappingCapabilities(caps1: string[], caps2: string[]): boolean {
    if (!caps1 || !caps2) return false;
    return caps1.some(cap => caps2.includes(cap));
  }

  private calculateTaskSimilarity(memory: MemoryEntry, task: Task): number {
    let similarity = 0;
    
    // Type match
    if (memory.metadata.taskType === task.type) similarity += 0.4;
    
    // Priority match
    if (memory.metadata.priority === task.priority) similarity += 0.2;
    
    // Capability overlap
    const overlappingCaps = memory.metadata.requiredCapabilities?.filter((cap: string) =>
      task.requiredCapabilities.includes(cap)
    ).length || 0;
    
    similarity += (overlappingCaps / task.requiredCapabilities.length) * 0.4;
    
    return similarity;
  }

  private async getRelevantPatterns(task: Task): Promise<any[]> {
    return Array.from(this.memoryCache.values())
      .filter(memory => 
        memory.type === 'pattern' &&
        (memory.metadata.taskType === task.type || memory.tags.includes(task.type))
      )
      .map(memory => memory.content)
      .slice(0, 20);
  }

  /**
   * Store memory entry with intelligent categorization
   */
  async storeMemory(
    type: MemoryType,
    content: any,
    sessionId: string,
    options: {
      agentId?: string;
      taskId?: string;
      tags?: string[];
      metadata?: any;
      expiresAt?: Date;
    } = {}
  ): Promise<string> {
    const memoryId = this.generateMemoryId(type, sessionId);
    
    // Determine expiration based on retention policy
    const expiresAt = this.calculateExpiration(type, options.expiresAt);
    
    const memoryEntry: MemoryEntry = {
      id: memoryId,
      type,
      content: this.prepareContentForStorage(content),
      sessionId,
      agentId: options.agentId,
      taskId: options.taskId,
      createdAt: new Date(),
      expiresAt,
      tags: options.tags || [],
      metadata: {
        ...options.metadata,
        originalSize: JSON.stringify(content).length,
        importance: this.calculateImportance(type, content, options.metadata)
      }
    };

    // Store in cache
    this.memoryCache.set(memoryId, memoryEntry);
    
    // Persist to database
    await this.persistMemoryEntry(memoryEntry);
    
    // Add to compression queue if applicable
    if (this.shouldCompress(memoryEntry)) {
      this.compressionQueue.push(memoryEntry);
    }
    
    // Enforce memory limits
    await this.enforceMemoryLimits();
    
    this.emit('memory-stored', memoryEntry);
    return memoryId;
  }

  private generateMemoryId(type: MemoryType, sessionId: string): string {
    return `${type}-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private calculateExpiration(type: MemoryType, providedExpiration?: Date): Date | undefined {
    if (providedExpiration) return providedExpiration;
    
    const now = Date.now();
    const retentionPolicy = this.config.retentionPolicy;
    
    switch (type) {
      case 'session':
        return new Date(now + retentionPolicy.shortTerm * 60 * 60 * 1000);
      case 'agent':
        return new Date(now + retentionPolicy.longTerm * 24 * 60 * 60 * 1000);
      case 'task':
        return new Date(now + retentionPolicy.longTerm * 24 * 60 * 60 * 1000);
      case 'pattern':
        // Patterns have longer retention
        return new Date(now + retentionPolicy.longTerm * 7 * 24 * 60 * 60 * 1000);
      case 'consensus':
        return new Date(now + retentionPolicy.longTerm * 24 * 60 * 60 * 1000);
      case 'performance':
        return new Date(now + retentionPolicy.longTerm * 24 * 60 * 60 * 1000);
      default:
        return new Date(now + retentionPolicy.shortTerm * 60 * 60 * 1000);
    }
  }

  private prepareContentForStorage(content: any): any {
    // Prepare content for efficient storage
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      // Remove circular references and optimize structure
      return JSON.parse(JSON.stringify(content, this.jsonReplacer));
    }
    return content;
  }

  private jsonReplacer(key: string, value: any): any {
    // Remove potentially circular or unnecessary data
    if (key.startsWith('_') || key === 'constructor') return undefined;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return { message: value.message, stack: value.stack };
    return value;
  }

  private calculateImportance(type: MemoryType, content: any, metadata: any): number {
    let importance = 0.5; // Base importance
    
    // Type-based importance
    const typeWeights = {
      pattern: 0.9,
      consensus: 0.8,
      performance: 0.7,
      task: 0.6,
      agent: 0.5,
      session: 0.4
    };
    
    importance += (typeWeights[type] || 0.5) * 0.3;
    
    // Content-based importance
    if (metadata?.success === true) importance += 0.2;
    if (metadata?.qualityScore > 0.8) importance += 0.15;
    if (metadata?.criticalTask === true) importance += 0.25;
    
    // Size penalty for very large content
    const contentSize = JSON.stringify(content).length;
    if (contentSize > 10000) importance -= 0.1;
    
    return Math.min(Math.max(importance, 0), 1);
  }

  private shouldCompress(memoryEntry: MemoryEntry): boolean {
    if (!this.config.compressionEnabled) return false;
    
    const contentSize = JSON.stringify(memoryEntry.content).length;
    const ageHours = (Date.now() - memoryEntry.createdAt.getTime()) / (1000 * 60 * 60);
    
    // Compress if content is large or old
    return contentSize > 5000 || ageHours > 24;
  }

  private async persistMemoryEntry(memoryEntry: MemoryEntry): Promise<void> {
    if (!this.database) return;

    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO memories 
        (id, type, session_id, agent_id, task_id, content, tags, metadata, 
         created_at, expires_at, accessed_at, access_count, compressed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        memoryEntry.id,
        memoryEntry.type,
        memoryEntry.sessionId,
        memoryEntry.agentId || null,
        memoryEntry.taskId || null,
        JSON.stringify(memoryEntry.content),
        memoryEntry.tags.join(','),
        JSON.stringify(memoryEntry.metadata),
        memoryEntry.createdAt.getTime(),
        memoryEntry.expiresAt?.getTime() || null,
        Date.now(), // accessed_at
        1, // access_count
        false // compressed
      ];

      this.database!.run(query, values, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Retrieve memories with intelligent caching
   */
  async getMemory(memoryId: string): Promise<MemoryEntry | null> {
    // Check cache first
    let memory = this.memoryCache.get(memoryId);
    
    if (memory) {
      // Update access information
      await this.updateAccessInfo(memoryId);
      return memory;
    }

    // Load from database
    memory = await this.loadMemoryFromDatabase(memoryId);
    
    if (memory) {
      // Add to cache
      this.memoryCache.set(memoryId, memory);
      await this.updateAccessInfo(memoryId);
    }

    return memory;
  }

  private async loadMemoryFromDatabase(memoryId: string): Promise<MemoryEntry | null> {
    if (!this.database) return null;

    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM memories WHERE id = ?';
      
      this.database!.get(query, [memoryId], (error, row: any) => {
        if (error) {
          reject(error);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        const memoryEntry = this.deserializeMemoryEntry(row);
        resolve(memoryEntry);
      });
    });
  }

  private async updateAccessInfo(memoryId: string): Promise<void> {
    if (!this.database) return;

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE memories 
        SET accessed_at = ?, access_count = access_count + 1 
        WHERE id = ?
      `;
      
      this.database!.run(query, [Date.now(), memoryId], (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get memories by various criteria
   */
  async getMemoriesByType(type: MemoryType, limit: number = 50): Promise<MemoryEntry[]> {
    const cached = Array.from(this.memoryCache.values())
      .filter(memory => memory.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    if (cached.length >= limit) {
      return cached;
    }

    // Load additional from database
    const additional = await this.loadMemoriesFromDatabase({ type }, limit - cached.length);
    return [...cached, ...additional];
  }

  async getMemoriesForAgent(agentId: string, limit: number = 20): Promise<MemoryEntry[]> {
    return this.loadMemoriesFromDatabase({ agentId }, limit);
  }

  async getMemoriesForSession(sessionId: string, limit: number = 100): Promise<MemoryEntry[]> {
    return this.loadMemoriesFromDatabase({ sessionId }, limit);
  }

  private async loadMemoriesFromDatabase(criteria: any, limit: number = 50): Promise<MemoryEntry[]> {
    if (!this.database) return [];

    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM memories WHERE 1=1';
      const params: any[] = [];

      if (criteria.type) {
        query += ' AND type = ?';
        params.push(criteria.type);
      }

      if (criteria.sessionId) {
        query += ' AND session_id = ?';
        params.push(criteria.sessionId);
      }

      if (criteria.agentId) {
        query += ' AND agent_id = ?';
        params.push(criteria.agentId);
      }

      if (criteria.taskId) {
        query += ' AND task_id = ?';
        params.push(criteria.taskId);
      }

      // Only get non-expired memories
      query += ' AND (expires_at IS NULL OR expires_at > ?)';
      params.push(Date.now());

      query += ' ORDER BY access_count DESC, created_at DESC LIMIT ?';
      params.push(limit);

      this.database!.all(query, params, (error, rows: any[]) => {
        if (error) {
          reject(error);
          return;
        }

        const memories = rows.map(row => this.deserializeMemoryEntry(row));
        resolve(memories);
      });
    });
  }

  /**
   * Update memory with new information
   */
  async updateMemory(memoryId: string, updates: Partial<MemoryEntry>): Promise<void> {
    const memory = await this.getMemory(memoryId);
    if (!memory) return;

    // Apply updates
    Object.assign(memory, updates);
    memory.metadata.updatedAt = new Date().toISOString();

    // Update cache
    this.memoryCache.set(memoryId, memory);
    
    // Update database
    await this.persistMemoryEntry(memory);
    
    this.emit('memory-updated', memory);
  }

  /**
   * Track agent activity for learning
   */
  async trackAgent(agent: Agent): Promise<void> {
    await this.storeMemory('agent', {
      agentType: agent.type,
      capabilities: agent.capabilities,
      status: agent.status,
      metrics: agent.metrics,
      topology: agent.topology
    }, agent.sessionId, {
      agentId: agent.id,
      tags: ['agent-tracking', agent.type, agent.category],
      metadata: {
        trackingStarted: new Date().toISOString(),
        agentCategory: agent.category
      }
    });
  }

  /**
   * Store consensus decisions
   */
  async storeConsensus(decision: any): Promise<void> {
    await this.storeMemory('consensus', decision, decision.sessionId || 'global', {
      tags: ['consensus', 'decision'],
      metadata: {
        agreement: decision.agreement,
        confidence: decision.confidence,
        participatingAgents: decision.participatingAgents
      }
    });
  }

  /**
   * Track GitHub activity
   */
  async trackGitHubActivity(activity: any): Promise<void> {
    await this.storeMemory('performance', activity, activity.sessionId || 'github', {
      tags: ['github', 'integration', activity.type],
      metadata: {
        repository: activity.repository,
        action: activity.action,
        impact: activity.impact
      }
    });
  }

  /**
   * Process compression queue
   */
  private async processCompressionQueue(): Promise<void> {
    const batch = this.compressionQueue.splice(0, 10); // Process 10 at a time
    
    for (const memory of batch) {
      try {
        const compressed = await this.compressMemory(memory);
        memory.content = compressed;
        memory.metadata.compressed = true;
        memory.metadata.compressionRatio = compressed.length / memory.metadata.originalSize;
        
        // Update in cache and database
        this.memoryCache.set(memory.id, memory);
        await this.persistMemoryEntry(memory);
        
        this.emit('memory-compressed', { memoryId: memory.id, ratio: memory.metadata.compressionRatio });
      } catch (error) {
        console.warn(`Failed to compress memory ${memory.id}:`, error);
      }
    }
  }

  private async compressMemory(memory: MemoryEntry): Promise<any> {
    // Simple compression by removing redundant information
    const content = memory.content;
    
    if (typeof content === 'object') {
      // Remove verbose fields and compress structure
      const compressed = {
        ...content,
        _compressed: true,
        _timestamp: memory.createdAt.toISOString()
      };
      
      // Remove large arrays beyond certain size
      for (const [key, value] of Object.entries(compressed)) {
        if (Array.isArray(value) && value.length > 100) {
          compressed[key] = {
            _truncated: true,
            _originalLength: value.length,
            _sample: value.slice(0, 10)
          };
        }
      }
      
      return compressed;
    }
    
    return content;
  }

  /**
   * Enforce retention policies
   */
  private async enforceRetentionPolicy(): Promise<void> {
    if (!this.database) return;

    const now = Date.now();
    
    // Remove expired memories
    await this.removeExpiredMemories(now);
    
    // Enforce memory limits
    await this.enforceMemoryLimits();
    
    this.emit('retention-policy-enforced');
  }

  private async removeExpiredMemories(currentTime: number): Promise<void> {
    if (!this.database) return;

    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?';
      
      this.database!.run(query, [currentTime], function(error) {
        if (error) {
          reject(error);
        } else {
          // Also remove from cache
          for (const [id, memory] of this.memoryCache.entries()) {
            if (memory.expiresAt && memory.expiresAt.getTime() < currentTime) {
              this.memoryCache.delete(id);
            }
          }
          resolve();
        }
      });
    });
  }

  private async enforceMemoryLimits(): Promise<void> {
    const currentSize = this.memoryCache.size;
    
    if (currentSize > this.config.maxSessionMemory) {
      // Remove least important/oldest memories
      const sortedMemories = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => {
          const importanceA = a.metadata.importance || 0.5;
          const importanceB = b.metadata.importance || 0.5;
          
          if (importanceA !== importanceB) {
            return importanceA - importanceB; // Lower importance first
          }
          
          return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
        });

      const toRemove = sortedMemories.slice(0, currentSize - this.config.maxSessionMemory);
      
      for (const [memoryId] of toRemove) {
        this.memoryCache.delete(memoryId);
      }
      
      this.emit('memory-limits-enforced', { removed: toRemove.length });
    }
  }

  async getMetrics(): Promise<any> {
    const memoryTypes = new Map<MemoryType, number>();
    let compressedCount = 0;
    let totalSize = 0;

    for (const memory of this.memoryCache.values()) {
      memoryTypes.set(memory.type, (memoryTypes.get(memory.type) || 0) + 1);
      if (memory.metadata.compressed) compressedCount++;
      totalSize += memory.metadata.originalSize || 0;
    }

    return {
      cacheSize: this.memoryCache.size,
      maxMemory: this.config.maxSessionMemory,
      memoryByType: Object.fromEntries(memoryTypes),
      compressionEnabled: this.config.compressionEnabled,
      compressedEntries: compressedCount,
      totalMemorySize: totalSize,
      compressionQueue: this.compressionQueue.length,
      activeContexts: this.sessionContexts.size,
      crossSessionEnabled: this.config.crossSessionEnabled
    };
  }

  async shutdown(): Promise<OperationResult> {
    try {
      // Clear retention timer
      if (this.retentionTimer) {
        clearInterval(this.retentionTimer);
        this.retentionTimer = null;
      }

      // Process remaining compression queue
      if (this.compressionQueue.length > 0) {
        await this.processCompressionQueue();
      }

      // Close database connection
      if (this.database) {
        await new Promise<void>((resolve, reject) => {
          this.database!.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        this.database = null;
      }

      // Clear caches
      this.memoryCache.clear();
      this.sessionContexts.clear();
      this.compressionQueue.length = 0;

      return {
        success: true,
        message: 'Memory Manager shutdown completed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Shutdown failed: ${error.message}`,
        error: error
      };
    }
  }
}