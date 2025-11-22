/**
 * Session Slot Manager for VP Daemon
 *
 * Manages session slots with priority-based queuing and preemption support
 * for handling triage requests in a resource-constrained environment.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type SlotState = 'available' | 'occupied' | 'reserved' | 'draining';

export interface TriageRequest {
  id: string;
  senderId: string;
  senderEmail?: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SessionSlot {
  id: string;
  state: SlotState;
  currentRequest: TriageRequest | null;
  priority: Priority | null;
  assignedAt: number | null;
  lastActivityAt: number | null;
}

export interface QueuedRequest {
  request: TriageRequest;
  priority: Priority;
  queuedAt: number;
  position: number;
  notificationSent: boolean;
}

export interface SessionSlotManagerConfig {
  maxSlots: number;
  defaultTimeout: number;
  queueCapacity: number;
  preemptionEnabled: boolean;
  estimatedProcessingTime: number;
  notificationCallback?: (
    request: TriageRequest,
    message: string
  ) => Promise<void>;
}

export interface SlotRequestResult {
  success: boolean;
  slotId?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  message: string;
}

export interface SlotStatusReport {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  drainingSlots: number;
  slots: SessionSlot[];
}

export interface QueueStatusReport {
  totalQueued: number;
  byPriority: Record<Priority, number>;
  oldestRequest: number | null;
  estimatedClearTime: number;
  queue: QueuedRequest[];
}

// ============================================================================
// Priority Utilities
// ============================================================================

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function getPriorityLevel(priority: Priority): number {
  return PRIORITY_ORDER[priority] ?? 0;
}

function comparePriorities(a: Priority, b: Priority): number {
  return getPriorityLevel(b) - getPriorityLevel(a);
}

function isHigherPriority(a: Priority, b: Priority): boolean {
  return getPriorityLevel(a) > getPriorityLevel(b);
}

// ============================================================================
// SessionSlotManager Class
// ============================================================================

export class SessionSlotManager {
  private slots: SessionSlot[] = [];
  private queue: QueuedRequest[] = [];
  private readonly maxSlots: number;
  private readonly config: SessionSlotManagerConfig;

  constructor(config: SessionSlotManagerConfig) {
    this.config = config;
    this.maxSlots = config.maxSlots;
    this.initializeSlots();
  }

  /**
   * Initialize empty slot array based on maxSlots configuration
   */
  initializeSlots(): void {
    this.slots = [];
    for (let i = 0; i < this.maxSlots; i++) {
      this.slots.push({
        id: `slot-${i + 1}`,
        state: 'available',
        currentRequest: null,
        priority: null,
        assignedAt: null,
        lastActivityAt: null,
      });
    }
  }

  /**
   * Request a slot for processing a triage request
   * Returns immediately with slot assignment or queue position
   */
  async requestSlot(
    request: TriageRequest,
    priority: string
  ): Promise<SlotRequestResult> {
    const normalizedPriority = this.normalizePriority(priority);

    // Try to find an available slot
    const availableSlot = this.findAvailableSlot();
    if (availableSlot) {
      await this.assignSlot(availableSlot, request);
      return {
        success: true,
        slotId: availableSlot.id,
        message: `Request assigned to ${availableSlot.id}`,
      };
    }

    // For critical priority, try preemption
    if (normalizedPriority === 'critical' && this.config.preemptionEnabled) {
      const preemptableSlot = this.findPreemptableSlot(normalizedPriority);
      if (preemptableSlot) {
        await this.preemptSlot(preemptableSlot, request);
        return {
          success: true,
          slotId: preemptableSlot.id,
          message: `Critical request preempted ${preemptableSlot.id}`,
        };
      }
    }

    // Check queue capacity
    if (this.queue.length >= this.config.queueCapacity) {
      return {
        success: false,
        message: 'Queue is at capacity. Please try again later.',
      };
    }

    // Add to queue
    const position = this.addToQueue(request, normalizedPriority);
    const estimatedWaitTime = this.estimateWaitTime(position);

    // Notify sender about queue position
    await this.notifySender(request, position);

    return {
      success: false,
      queuePosition: position,
      estimatedWaitTime,
      message: `Request queued at position ${position}. Estimated wait: ${Math.ceil(estimatedWaitTime / 1000)}s`,
    };
  }

  /**
   * Find an available slot for immediate assignment
   */
  findAvailableSlot(): SessionSlot | null {
    return this.slots.find(slot => slot.state === 'available') ?? null;
  }

  /**
   * Find a slot that can be preempted by a higher priority request
   */
  findPreemptableSlot(priority: string): SessionSlot | null {
    const normalizedPriority = this.normalizePriority(priority);

    // Sort occupied slots by priority (lowest first) and then by assignment time (oldest first)
    const occupiedSlots = this.slots
      .filter(slot => slot.state === 'occupied' && slot.priority !== null)
      .sort((a, b) => {
        const priorityDiff = comparePriorities(b.priority!, a.priority!);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return (a.assignedAt ?? 0) - (b.assignedAt ?? 0);
      });

    // Find first slot with lower priority
    for (const slot of occupiedSlots) {
      if (
        slot.priority &&
        isHigherPriority(normalizedPriority, slot.priority)
      ) {
        return slot;
      }
    }

    return null;
  }

  /**
   * Assign a slot to a triage request
   */
  async assignSlot(slot: SessionSlot, request: TriageRequest): Promise<void> {
    const now = Date.now();
    slot.state = 'occupied';
    slot.currentRequest = request;
    slot.priority = 'medium'; // Default priority, could be enhanced
    slot.assignedAt = now;
    slot.lastActivityAt = now;
  }

  /**
   * Assign a slot with specific priority
   */
  async assignSlotWithPriority(
    slot: SessionSlot,
    request: TriageRequest,
    priority: Priority
  ): Promise<void> {
    const now = Date.now();
    slot.state = 'occupied';
    slot.currentRequest = request;
    slot.priority = priority;
    slot.assignedAt = now;
    slot.lastActivityAt = now;
  }

  /**
   * Preempt a slot for a higher priority request
   * The preempted request is re-queued with elevated priority
   */
  async preemptSlot(slot: SessionSlot, request: TriageRequest): Promise<void> {
    const preemptedRequest = slot.currentRequest;
    const preemptedPriority = slot.priority;

    // Re-queue the preempted request with its original priority (will be at front of its priority tier)
    if (preemptedRequest && preemptedPriority) {
      this.addToQueue(preemptedRequest, preemptedPriority);
      await this.notifySender(preemptedRequest, 1);
    }

    // Assign the new critical request
    await this.assignSlotWithPriority(slot, request, 'critical');
  }

  /**
   * Add a request to the priority queue
   * Returns the queue position
   */
  addToQueue(request: TriageRequest, priority: string): number {
    const normalizedPriority = this.normalizePriority(priority);
    const now = Date.now();

    const queuedRequest: QueuedRequest = {
      request,
      priority: normalizedPriority,
      queuedAt: now,
      position: 0, // Will be recalculated
      notificationSent: false,
    };

    // Insert in priority order
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (isHigherPriority(normalizedPriority, this.queue[i].priority)) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queuedRequest);

    // Recalculate positions
    this.recalculateQueuePositions();

    return insertIndex + 1;
  }

  /**
   * Notify sender about their queue position and estimated wait time
   */
  async notifySender(request: TriageRequest, position: number): Promise<void> {
    if (!this.config.notificationCallback) {
      return;
    }

    const estimatedWait = this.estimateWaitTime(position);
    const message = `Your request is queued at position ${position}. Estimated wait time: ${Math.ceil(estimatedWait / 1000)} seconds.`;

    try {
      await this.config.notificationCallback(request, message);

      // Mark notification as sent
      const queuedItem = this.queue.find(q => q.request.id === request.id);
      if (queuedItem) {
        queuedItem.notificationSent = true;
      }
    } catch (error) {
      console.error(
        `Failed to notify sender for request ${request.id}:`,
        error
      );
    }
  }

  /**
   * Estimate wait time based on queue position
   */
  estimateWaitTime(position: number): number {
    // Base estimate on position and estimated processing time per request
    return position * this.config.estimatedProcessingTime;
  }

  /**
   * Called when a slot becomes available
   * Processes the next request from the queue
   */
  async onSlotAvailable(slotId: string): Promise<void> {
    const slot = this.slots.find(s => s.id === slotId);
    if (!slot) {
      console.error(`Slot ${slotId} not found`);
      return;
    }

    // Mark slot as available
    slot.state = 'available';
    slot.currentRequest = null;
    slot.priority = null;
    slot.assignedAt = null;

    // Process next request from queue
    if (this.queue.length > 0) {
      const nextQueued = this.queue.shift();
      if (nextQueued) {
        await this.assignSlotWithPriority(
          slot,
          nextQueued.request,
          nextQueued.priority
        );
        this.recalculateQueuePositions();
      }
    }
  }

  /**
   * Release a slot and process next queued request
   */
  async releaseSlot(slotId: string): Promise<void> {
    await this.onSlotAvailable(slotId);
  }

  /**
   * Get current status of all slots
   */
  getSlotStatus(): SlotStatusReport {
    const available = this.slots.filter(s => s.state === 'available').length;
    const occupied = this.slots.filter(s => s.state === 'occupied').length;
    const reserved = this.slots.filter(s => s.state === 'reserved').length;
    const draining = this.slots.filter(s => s.state === 'draining').length;

    return {
      totalSlots: this.maxSlots,
      availableSlots: available,
      occupiedSlots: occupied,
      reservedSlots: reserved,
      drainingSlots: draining,
      slots: [...this.slots],
    };
  }

  /**
   * Get current status of the queue
   */
  getQueueStatus(): QueueStatusReport {
    const byPriority: Record<Priority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let oldestRequest: number | null = null;

    for (const item of this.queue) {
      byPriority[item.priority]++;
      if (oldestRequest === null || item.queuedAt < oldestRequest) {
        oldestRequest = item.queuedAt;
      }
    }

    const estimatedClearTime =
      this.queue.length * this.config.estimatedProcessingTime;

    return {
      totalQueued: this.queue.length,
      byPriority,
      oldestRequest,
      estimatedClearTime,
      queue: [...this.queue],
    };
  }

  /**
   * Get a specific slot by ID
   */
  getSlot(slotId: string): SessionSlot | null {
    return this.slots.find(s => s.id === slotId) ?? null;
  }

  /**
   * Update last activity timestamp for a slot
   */
  updateSlotActivity(slotId: string): void {
    const slot = this.slots.find(s => s.id === slotId);
    if (slot) {
      slot.lastActivityAt = Date.now();
    }
  }

  /**
   * Check for and release timed-out slots
   */
  async checkTimeouts(): Promise<string[]> {
    const now = Date.now();
    const timedOutSlots: string[] = [];

    for (const slot of this.slots) {
      if (
        slot.state === 'occupied' &&
        slot.lastActivityAt &&
        now - slot.lastActivityAt > this.config.defaultTimeout
      ) {
        timedOutSlots.push(slot.id);
        await this.onSlotAvailable(slot.id);
      }
    }

    return timedOutSlots;
  }

  /**
   * Drain a specific slot (mark for graceful release)
   */
  drainSlot(slotId: string): boolean {
    const slot = this.slots.find(s => s.id === slotId);
    if (slot && slot.state === 'occupied') {
      slot.state = 'draining';
      return true;
    }
    return false;
  }

  /**
   * Reserve a slot for upcoming use
   */
  reserveSlot(): SessionSlot | null {
    const availableSlot = this.findAvailableSlot();
    if (availableSlot) {
      availableSlot.state = 'reserved';
      return availableSlot;
    }
    return null;
  }

  /**
   * Cancel a queue request
   */
  cancelQueuedRequest(requestId: string): boolean {
    const index = this.queue.findIndex(q => q.request.id === requestId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.recalculateQueuePositions();
      return true;
    }
    return false;
  }

  /**
   * Get queue position for a specific request
   */
  getQueuePosition(requestId: string): number | null {
    const item = this.queue.find(q => q.request.id === requestId);
    return item?.position ?? null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private normalizePriority(priority: string): Priority {
    const normalized = priority.toLowerCase() as Priority;
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
      return normalized;
    }
    return 'medium';
  }

  private recalculateQueuePositions(): void {
    this.queue.forEach((item, index) => {
      item.position = index + 1;
    });
  }
}
