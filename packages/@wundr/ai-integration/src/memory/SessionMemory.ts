/**
 * Session Memory - In-session memory management
 * 
 * Manages memory within active sessions, handling real-time data storage,
 * retrieval, and context management for AI Integration operations.
 */

import { EventEmitter } from 'eventemitter3';
import { MemoryEntry, MemoryType, Agent, Task, OperationResult } from '../types';

export interface SessionContext {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  agents: Map<string, Agent>;
  tasks: Map<string, Task>;
  memory: Map<string, MemoryEntry>;
  metadata: any;
}

export class SessionMemory extends EventEmitter {
  private sessions: Map<string, SessionContext> = new Map();
  private currentSessionId: string | null = null;
  private memoryIndex: Map<string, Set<string>> = new Map(); // tag -> entry IDs
  private maxSessionMemory: number;

  constructor(maxSessionMemory: number = 1000) {
    super();
    this.maxSessionMemory = maxSessionMemory;
  }

  async initialize(): Promise<OperationResult> {
    this.setupCleanupInterval();
    return {
      success: true,
      message: 'Session Memory initialized successfully'
    };
  }

  /**
   * Create a new session
   */
  createSession(sessionId?: string, metadata?: any): string {
    const id = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const context: SessionContext = {
      sessionId: id,
      startTime: new Date(),
      lastActivity: new Date(),
      agents: new Map(),
      tasks: new Map(),
      memory: new Map(),
      metadata: metadata || {}
    };

    this.sessions.set(id, context);
    this.currentSessionId = id;
    
    this.emit('session-created', context);
    return id;
  }

  /**
   * Get or create current session
   */
  getCurrentSession(): SessionContext {
    if (!this.currentSessionId || !this.sessions.has(this.currentSessionId)) {
      this.currentSessionId = this.createSession();
    }
    return this.sessions.get(this.currentSessionId)!;
  }

  /**
   * Switch to a different session
   */
  switchSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      return false;
    }
    
    this.currentSessionId = sessionId;
    const context = this.sessions.get(sessionId)!;
    context.lastActivity = new Date();
    
    this.emit('session-switched', context);
    return true;
  }

  /**
   * Store memory entry
   */
  store(
    type: MemoryType,
    content: any,
    options?: {
      sessionId?: string;
      agentId?: string;
      taskId?: string;
      tags?: string[];
      ttl?: number; // Time to live in milliseconds
    }
  ): string {
    const sessionId = options?.sessionId || this.currentSessionId;
    if (!sessionId) {
      throw new Error('No active session');
    }

    const context = this.sessions.get(sessionId);
    if (!context) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entryId = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry: MemoryEntry = {
      id: entryId,
      type,
      content,
      sessionId,
      agentId: options?.agentId,
      taskId: options?.taskId,
      createdAt: new Date(),
      tags: options?.tags || [],
      metadata: {},
      ...(options?.ttl && { expiresAt: new Date(Date.now() + options.ttl) })
    };

    // Check memory limits
    if (context.memory.size >= this.maxSessionMemory) {
      this.evictOldest(context);
    }

    context.memory.set(entryId, entry);
    context.lastActivity = new Date();

    // Update indices
    entry.tags.forEach(tag => {
      if (!this.memoryIndex.has(tag)) {
        this.memoryIndex.set(tag, new Set());
      }
      this.memoryIndex.get(tag)!.add(entryId);
    });

    this.emit('memory-stored', entry);
    return entryId;
  }

  /**
   * Retrieve memory entry by ID
   */
  retrieve(entryId: string, sessionId?: string): MemoryEntry | null {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return null;

    const context = this.sessions.get(targetSessionId);
    if (!context) return null;

    const entry = context.memory.get(entryId);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt && entry.expiresAt <= new Date()) {
      this.delete(entryId, targetSessionId);
      return null;
    }

    return entry;
  }

  /**
   * Search memory entries
   */
  search(criteria: {
    type?: MemoryType;
    agentId?: string;
    taskId?: string;
    tags?: string[];
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): MemoryEntry[] {
    const targetSessionId = criteria.sessionId || this.currentSessionId;
    if (!targetSessionId) return [];

    const context = this.sessions.get(targetSessionId);
    if (!context) return [];

    let entries = Array.from(context.memory.values());

    // Filter by type
    if (criteria.type) {
      entries = entries.filter(e => e.type === criteria.type);
    }

    // Filter by agent
    if (criteria.agentId) {
      entries = entries.filter(e => e.agentId === criteria.agentId);
    }

    // Filter by task
    if (criteria.taskId) {
      entries = entries.filter(e => e.taskId === criteria.taskId);
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      entries = entries.filter(e => 
        criteria.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // Remove expired entries
    entries = entries.filter(e => {
      if (e.expiresAt && e.expiresAt <= new Date()) {
        this.delete(e.id, targetSessionId);
        return false;
      }
      return true;
    });

    // Sort by creation time (newest first)
    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || entries.length;
    return entries.slice(offset, offset + limit);
  }

  /**
   * Update memory entry
   */
  update(
    entryId: string, 
    updates: Partial<MemoryEntry>,
    sessionId?: string
  ): boolean {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return false;

    const context = this.sessions.get(targetSessionId);
    if (!context) return false;

    const entry = context.memory.get(entryId);
    if (!entry) return false;

    // Update tags index if tags changed
    if (updates.tags) {
      // Remove from old tags
      entry.tags.forEach(tag => {
        const tagSet = this.memoryIndex.get(tag);
        if (tagSet) {
          tagSet.delete(entryId);
        }
      });

      // Add to new tags
      updates.tags.forEach(tag => {
        if (!this.memoryIndex.has(tag)) {
          this.memoryIndex.set(tag, new Set());
        }
        this.memoryIndex.get(tag)!.add(entryId);
      });
    }

    Object.assign(entry, updates);
    context.lastActivity = new Date();

    this.emit('memory-updated', entry);
    return true;
  }

  /**
   * Delete memory entry
   */
  delete(entryId: string, sessionId?: string): boolean {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return false;

    const context = this.sessions.get(targetSessionId);
    if (!context) return false;

    const entry = context.memory.get(entryId);
    if (!entry) return false;

    // Remove from indices
    entry.tags.forEach(tag => {
      const tagSet = this.memoryIndex.get(tag);
      if (tagSet) {
        tagSet.delete(entryId);
        if (tagSet.size === 0) {
          this.memoryIndex.delete(tag);
        }
      }
    });

    context.memory.delete(entryId);
    context.lastActivity = new Date();

    this.emit('memory-deleted', { entryId, sessionId: targetSessionId });
    return true;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId?: string): any {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return null;

    const context = this.sessions.get(targetSessionId);
    if (!context) return null;

    const memoryByType = new Map<MemoryType, number>();
    const memoryByAgent = new Map<string, number>();
    const memoryByTask = new Map<string, number>();

    context.memory.forEach(entry => {
      // Count by type
      memoryByType.set(entry.type, (memoryByType.get(entry.type) || 0) + 1);

      // Count by agent
      if (entry.agentId) {
        memoryByAgent.set(entry.agentId, (memoryByAgent.get(entry.agentId) || 0) + 1);
      }

      // Count by task
      if (entry.taskId) {
        memoryByTask.set(entry.taskId, (memoryByTask.get(entry.taskId) || 0) + 1);
      }
    });

    return {
      sessionId: targetSessionId,
      startTime: context.startTime,
      lastActivity: context.lastActivity,
      duration: new Date().getTime() - context.startTime.getTime(),
      totalMemoryEntries: context.memory.size,
      activeAgents: context.agents.size,
      activeTasks: context.tasks.size,
      memoryByType: Object.fromEntries(memoryByType),
      memoryByAgent: Object.fromEntries(memoryByAgent),
      memoryByTask: Object.fromEntries(memoryByTask),
      availableTags: Array.from(this.memoryIndex.keys())
    };
  }

  /**
   * Track agent in session
   */
  trackAgent(agent: Agent, sessionId?: string): void {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return;

    const context = this.sessions.get(targetSessionId);
    if (!context) return;

    context.agents.set(agent.id, agent);
    context.lastActivity = new Date();

    this.emit('agent-tracked', { agent, sessionId: targetSessionId });
  }

  /**
   * Track task in session
   */
  trackTask(task: Task, sessionId?: string): void {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return;

    const context = this.sessions.get(targetSessionId);
    if (!context) return;

    context.tasks.set(task.id, task);
    context.lastActivity = new Date();

    this.emit('task-tracked', { task, sessionId: targetSessionId });
  }

  /**
   * Close session
   */
  closeSession(sessionId: string): boolean {
    const context = this.sessions.get(sessionId);
    if (!context) return false;

    // Clean up indices
    context.memory.forEach(entry => {
      entry.tags.forEach(tag => {
        const tagSet = this.memoryIndex.get(tag);
        if (tagSet) {
          tagSet.delete(entry.id);
          if (tagSet.size === 0) {
            this.memoryIndex.delete(tag);
          }
        }
      });
    });

    this.sessions.delete(sessionId);

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }

    this.emit('session-closed', { sessionId });
    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionContext[] {
    return Array.from(this.sessions.values());
  }

  private evictOldest(context: SessionContext): void {
    const entries = Array.from(context.memory.values());
    if (entries.length === 0) return;

    // Sort by creation time (oldest first)
    entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Remove oldest 10% or at least 1
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toRemove; i++) {
      this.delete(entries[i].id, context.sessionId);
    }

    this.emit('memory-evicted', { sessionId: context.sessionId, count: toRemove });
  }

  private setupCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    let cleanedCount = 0;

    this.sessions.forEach(context => {
      const expiredIds: string[] = [];
      
      context.memory.forEach(entry => {
        if (entry.expiresAt && entry.expiresAt <= now) {
          expiredIds.push(entry.id);
        }
      });

      expiredIds.forEach(id => {
        this.delete(id, context.sessionId);
        cleanedCount++;
      });
    });

    if (cleanedCount > 0) {
      this.emit('cleanup-completed', { cleanedCount });
    }
  }

  async shutdown(): Promise<OperationResult> {
    this.sessions.clear();
    this.memoryIndex.clear();
    this.currentSessionId = null;

    return {
      success: true,
      message: 'Session Memory shutdown completed'
    };
  }
}