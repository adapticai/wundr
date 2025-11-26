# VP-Daemon Memory System - Integration Checklist

## Pre-Integration Steps

### 1. Build Dependencies

```bash
# Build @wundr.io/agent-memory package
cd /Users/iroselli/wundr
pnpm --filter @wundr.io/agent-memory build

# Verify build
ls packages/@wundr/agent-memory/dist/
```

**Expected output**:
```
index.js
index.d.ts
episodic-store.js
episodic-store.d.ts
...
```

### 2. Run Tests

```bash
# Run memory system tests
npm test scripts/vp-daemon/__tests__/memory-system.test.ts

# Expected: All tests passing
```

### 3. Try Examples

```bash
# Run example usage
npx tsx scripts/vp-daemon/examples/memory-usage.ts

# Expected: All 8 examples complete successfully
```

## Integration Steps

### Step 1: Update VP-Daemon Index

Edit `scripts/vp-daemon/index.ts`:

```typescript
// Add memory imports
import { createMemoryAPI, type MemoryAPI } from './memory-api.js';

// Add to VPDaemonConfig
export interface VPDaemonConfig {
  // ... existing config ...
  subsystems?: {
    // ... existing subsystems ...
    memory?: Partial<VPMemoryConfig>;
  };
}

// Add to VPDaemon class
export class VPDaemon extends EventEmitter {
  // ... existing properties ...
  private memoryAPI: MemoryAPI | null = null;

  // In initializeSubsystems():
  async initializeSubsystems(): Promise<void> {
    // ... existing initialization ...

    // Memory API - for persistent memory
    this.log('debug', 'Starting Memory API...');
    this.memoryAPI = await createMemoryAPI({
      basePath: process.env['VP_MEMORY_PATH'] || './.vp-daemon/memory',
      persistToDisk: true,
      autoSaveIntervalMs: 60000,
      ...this.config.subsystems.memory,
    });
    this.log('info', 'Memory API initialized');

    // ... rest of initialization ...
  }

  // In performShutdown():
  async performShutdown(): Promise<void> {
    // ... existing shutdown ...

    this.log('debug', 'Stopping Memory API...');
    if (this.memoryAPI) {
      await this.memoryAPI.save();
      await this.memoryAPI.shutdown();
    }
    this.memoryAPI = null;

    // ... rest of shutdown ...
  }

  // Add getter for subsystems
  getSubsystems() {
    return {
      // ... existing subsystems ...
      memory: this.memoryAPI,
    };
  }
}
```

### Step 2: Update Session Manager

Edit `scripts/vp-daemon/session-manager.ts`:

```typescript
import type { MemoryAPI } from './memory-api.js';

export class SessionSlotManager {
  // Add memory API reference
  private memoryAPI?: MemoryAPI;

  // Add setter
  setMemoryAPI(memory: MemoryAPI): void {
    this.memoryAPI = memory;
  }

  // Update requestSlot to record in memory
  async requestSlot(
    request: TriageRequest,
    priority: string
  ): Promise<SlotRequestResult> {
    const result = await this.requestSlotOriginal(request, priority);

    // Record in memory
    if (this.memoryAPI && result.success && result.slotId) {
      await this.memoryAPI.createTask({
        taskId: request.id,
        description: request.content,
        priority: this.priorityToNumber(priority),
        assignedSlot: result.slotId,
        metadata: {
          sender: request.sender,
          source: 'triage',
        },
      });
    }

    return result;
  }

  // Add helper
  private priorityToNumber(priority: string): number {
    const map: Record<string, number> = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 3,
    };
    return map[priority] || 5;
  }
}
```

### Step 3: Update Triage Engine

Edit `scripts/vp-daemon/triage-engine.ts`:

```typescript
import type { MemoryAPI } from './memory-api.js';

export class TriageEngine {
  // Add memory API reference
  private memoryAPI?: MemoryAPI;

  // Add setter
  setMemoryAPI(memory: MemoryAPI): void {
    this.memoryAPI = memory;
  }

  // Update triage to use memory
  async triage(request: TriageRequest): Promise<TriageResult> {
    const result = await this.triageOriginal(request);

    // Store in memory
    if (this.memoryAPI) {
      await this.memoryAPI.storeTriage({
        request,
        result,
        processingTimeMs: Date.now() - request.timestamp,
        timestamp: new Date(),
      });
    }

    return result;
  }
}
```

### Step 4: Update Telemetry Collector

Edit `scripts/vp-daemon/telemetry-collector.ts`:

```typescript
import type { MemoryAPI } from './memory-api.js';
import type { DecisionTelemetry } from './types.js';

export class TelemetryCollector {
  // Add memory API reference
  private memoryAPI?: MemoryAPI;

  // Add setter
  setMemoryAPI(memory: MemoryAPI): void {
    this.memoryAPI = memory;
  }

  // Update recordDecision
  async recordDecision(decision: DecisionTelemetry): Promise<void> {
    await this.recordDecisionOriginal(decision);

    // Store in memory
    if (this.memoryAPI) {
      await this.memoryAPI.recordDecision({
        timestamp: decision.timestamp,
        sessionId: decision.sessionId,
        agentId: decision.agentId,
        action: decision.action,
        rationale: decision.rationale,
        rewardScores: decision.rewardScores,
        policyChecks: decision.policyChecks,
        escalationTriggers: decision.escalationTriggers,
        outcome: this.determineOutcome(decision),
        context: this.buildContext(decision),
      });
    }
  }

  private determineOutcome(decision: DecisionTelemetry): 'approved' | 'rejected' | 'escalated' {
    if (decision.escalationTriggers.length > 0) return 'escalated';
    const failedChecks = Object.values(decision.policyChecks).filter(v => !v).length;
    return failedChecks > 0 ? 'rejected' : 'approved';
  }

  private buildContext(decision: DecisionTelemetry): string {
    return `${decision.action} in session ${decision.sessionId}`;
  }
}
```

### Step 5: Wire Up Memory API

In `scripts/vp-daemon/index.ts`, after initialization:

```typescript
async initializeSubsystems(): Promise<void> {
  // ... all subsystem initialization ...

  // Wire up memory API to subsystems
  if (this.memoryAPI && this.sessionManager) {
    this.sessionManager.setMemoryAPI(this.memoryAPI);
  }
  if (this.memoryAPI && this.triageEngine) {
    this.triageEngine.setMemoryAPI(this.memoryAPI);
  }
  if (this.memoryAPI && this.telemetryCollector) {
    this.telemetryCollector.setMemoryAPI(this.memoryAPI);
  }

  this.log('success', 'All subsystems initialized and wired');
}
```

## Verification Steps

### 1. Start VP-Daemon

```bash
cd /Users/iroselli/wundr
npx tsx scripts/vp-daemon/index.ts start --verbose
```

**Expected**:
```
[INFO] Starting Identity Manager...
[INFO] Starting Resource Allocator...
[INFO] Starting Session Manager...
[INFO] Starting Telemetry Collector...
[INFO] Starting Memory API...
[INFO] Memory API initialized
[INFO] Starting Triage Engine...
[INFO] Starting PTY Controller...
[INFO] Starting Intervention Engine...
[SUCCESS] All subsystems initialized successfully
```

### 2. Check Memory Directory

```bash
ls -la ~/.vp-daemon/memory/
```

**Expected**:
```
drwxr-xr-x  scratchpad/
drwxr-xr-x  episodic/
drwxr-xr-x  semantic/
drwxr-xr-x  archives/
-rw-r--r--  state.json
-rw-r--r--  caches.json
```

### 3. Create a Test Task

```typescript
// Using the memory API
const daemon = new VPDaemon();
await daemon.start();

const memory = daemon.getSubsystems().memory;
await memory.createTask({
  taskId: 'test-1',
  description: 'Integration test task',
  priority: 5,
});

console.log('Task created:', memory.getTask('test-1'));
```

### 4. Check Memory Stats

```typescript
const stats = memory.getStats();
console.log('Memory stats:', {
  totalMemories: stats.totalMemories,
  scratchpad: stats.tiers.scratchpad.memoryCount,
  episodic: stats.tiers.episodic.memoryCount,
  semantic: stats.tiers.semantic.memoryCount,
});
```

**Expected**:
```javascript
{
  totalMemories: 1,
  scratchpad: 1,
  episodic: 0,
  semantic: 0
}
```

### 5. Test Persistence

```bash
# Stop daemon
# Ctrl+C

# Restart daemon
npx tsx scripts/vp-daemon/index.ts start

# Check if task still exists
# Should load from ~/.vp-daemon/memory/state.json
```

## Post-Integration Tasks

### 1. Add Memory CLI Commands

Edit `scripts/vp-daemon/index.ts`:

```typescript
program
  .command('memory:stats')
  .description('Show memory statistics')
  .action(async () => {
    const daemon = new VPDaemon();
    await daemon.start();
    const memory = daemon.getSubsystems().memory;
    const stats = memory.getStats();
    console.log(JSON.stringify(stats, null, 2));
    await daemon.stop();
  });

program
  .command('memory:consolidate')
  .description('Run memory consolidation')
  .action(async () => {
    const daemon = new VPDaemon();
    await daemon.start();
    const memory = daemon.getSubsystems().memory;
    await memory.consolidate();
    console.log('Consolidation complete');
    await daemon.stop();
  });

program
  .command('memory:archive')
  .option('--days <number>', 'Archive older than N days', '90')
  .description('Archive old memories')
  .action(async (options) => {
    const daemon = new VPDaemon();
    await daemon.start();
    const memory = daemon.getSubsystems().memory;
    const result = await memory.archiveOldMemories(parseInt(options.days));
    console.log(`Archived ${result.archived} memories to ${result.archivePath}`);
    await daemon.stop();
  });
```

### 2. Add Memory Dashboard Endpoint

If VP-Daemon has a web API, add endpoints:

```typescript
// GET /api/memory/stats
app.get('/api/memory/stats', async (req, res) => {
  const memory = daemon.getSubsystems().memory;
  const stats = memory.getStats();
  res.json(stats);
});

// GET /api/memory/tasks
app.get('/api/memory/tasks', async (req, res) => {
  const memory = daemon.getSubsystems().memory;
  const tasks = memory.getActiveTasks();
  res.json(tasks);
});

// POST /api/memory/search
app.post('/api/memory/search', async (req, res) => {
  const memory = daemon.getSubsystems().memory;
  const { query, types, limit } = req.body;
  const results = await memory.search(
    memory.query()
      .withQuery(query)
      .withTypes(...(types || []))
      .limit(limit || 50)
      .build()
  );
  res.json(results);
});
```

### 3. Add Scheduled Maintenance

In `scripts/vp-daemon/index.ts`:

```typescript
export class VPDaemon extends EventEmitter {
  private maintenanceInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    // ... existing start code ...

    // Start daily maintenance at 2 AM
    this.scheduleMaintenanceTasks();
  }

  private scheduleMaintenanceTasks(): void {
    // Run every hour
    this.maintenanceInterval = setInterval(async () => {
      const hour = new Date().getHours();

      // Daily at 2 AM
      if (hour === 2) {
        await this.runDailyMaintenance();
      }
    }, 60 * 60 * 1000); // Every hour
  }

  private async runDailyMaintenance(): Promise<void> {
    this.log('info', 'Running daily maintenance...');

    if (this.memoryAPI) {
      const health = this.memoryAPI.needsMaintenance();

      if (health.needsConsolidation) {
        this.log('info', 'Running memory consolidation...');
        await this.memoryAPI.consolidate();
      }

      if (health.needsCompaction) {
        this.log('info', 'Running memory compaction...');
        await this.memoryAPI.compact();
      }

      // Prune old scratchpad
      this.log('info', 'Pruning old memories...');
      const result = await this.memoryAPI.pruneOldMemories({
        scratchpadMaxAgeDays: 1,
        episodicMaxAgeDays: 30,
      });
      this.log('info', `Pruned ${result.pruned} memories`);

      // Weekly archive on Sundays
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0) {
        this.log('info', 'Running weekly archive...');
        const archive = await this.memoryAPI.archiveOldMemories(90);
        this.log('info', `Archived ${archive.archived} memories`);
      }

      await this.memoryAPI.save();
      this.log('success', 'Daily maintenance complete');
    }
  }

  async stop(): Promise<void> {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    // ... existing stop code ...
  }
}
```

## Testing Checklist

- [ ] Build @wundr.io/agent-memory package
- [ ] Run memory-system.test.ts (all tests pass)
- [ ] Run memory-usage.ts examples (all complete)
- [ ] Start VP-Daemon with memory enabled
- [ ] Create test task via memory API
- [ ] Check memory directory created
- [ ] Check state.json persisted
- [ ] Restart daemon and verify task loaded
- [ ] Test memory search
- [ ] Test memory consolidation
- [ ] Test memory compaction
- [ ] Test memory pruning
- [ ] Test memory archival
- [ ] Test memory CLI commands
- [ ] Test scheduled maintenance
- [ ] Check memory stats via API

## Troubleshooting

### Issue: Module not found '@wundr.io/agent-memory'

**Solution**:
```bash
cd /Users/iroselli/wundr
pnpm --filter @wundr.io/agent-memory build
```

### Issue: Memory directory not created

**Solution**:
Check permissions and ensure basePath is writable:
```bash
mkdir -p ~/.vp-daemon/memory
chmod 755 ~/.vp-daemon/memory
```

### Issue: State not persisting

**Solution**:
Check auto-save interval and ensure graceful shutdown:
```typescript
const memory = await createMemoryAPI({
  autoSaveIntervalMs: 60000, // 1 minute
  persistToDisk: true,
});

// Always shutdown gracefully
await memory.save();
await memory.shutdown();
```

### Issue: High memory usage

**Solution**:
Run maintenance more frequently:
```typescript
const health = memory.needsMaintenance();
if (health.needsCompaction) {
  await memory.compact();
}
await memory.pruneOldMemories();
```

## Success Criteria

✅ Memory system integrated into VP-Daemon
✅ All subsystems using memory API
✅ Tasks, decisions, policies stored in memory
✅ Memory persists across restarts
✅ Automatic consolidation and compaction working
✅ CLI commands functional
✅ Scheduled maintenance running
✅ All tests passing

## Next Steps

After successful integration:

1. Monitor memory usage in production
2. Tune consolidation/compaction intervals
3. Add memory analytics dashboard
4. Implement semantic search (embeddings)
5. Add memory clustering
6. Create memory debugging tools

---

**Last Updated**: November 26, 2025
**Status**: Ready for Integration
