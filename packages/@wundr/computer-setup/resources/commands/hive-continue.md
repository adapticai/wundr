# 🔄 Continue Last Hive Mind Session

Resume your most recent hive mind swarm session with full context restoration.

**Objective:** {{ TASK_DESCRIPTION }}

---

## 🔍 SESSION RESTORATION PROTOCOL

**Step 1: Retrieve Last Session Namespace**

```typescript
// Retrieve the last active hive session
const lastSession =
  (await mcp__claude) -
  flow__memory_usage({
    action: 'retrieve',
    key: 'hive/last-session',
    namespace: 'global',
  });

if (!lastSession) {
  console.error('❌ No previous hive session found. Use /hive-swarm to start a new session.');
  throw new Error('No session to continue');
}

const HIVE_NAMESPACE = lastSession;
console.log(`🔄 Resuming Hive Session: ${HIVE_NAMESPACE}`);
```

**Step 2: Restore Swarm Context (Single Message)**

```typescript
// 1. Retrieve swarm configuration
const swarmConfig =
  (await mcp__claude) -
  flow__memory_usage({
    action: 'retrieve',
    key: 'swarm/config',
    namespace: HIVE_NAMESPACE,
  });

// 2. Retrieve swarm objective
const swarmObjective =
  (await mcp__claude) -
  flow__memory_usage({
    action: 'retrieve',
    key: 'swarm/objective',
    namespace: HIVE_NAMESPACE,
  });

// 3. List all previous discoveries
const discoveries =
  (await mcp__claude) -
  flow__memory_search({
    pattern: 'swarm/discovery/*',
    namespace: HIVE_NAMESPACE,
    limit: 50,
  });

// 4. Get swarm status
const swarmStatus = (await mcp__claude) - flow__swarm_status({});

// 5. Inform user of restored context
console.log(`
📋 Restored Session Context:
- Namespace: ${HIVE_NAMESPACE}
- Original Objective: ${swarmObjective}
- Discoveries: ${discoveries.length} items
- Swarm Status: ${swarmStatus.health}
`);
```

**Step 3: Resume Work (Single Message)**

```typescript
// 1. Re-initialize monitoring
mcp__claude - flow__swarm_monitor({ interval: 5000 });

// 2. Store continuation note
mcp__claude -
  flow__memory_usage({
    action: 'store',
    key: `swarm/continuation/${Date.now()}`,
    value: '{{ TASK_DESCRIPTION }}',
    namespace: HIVE_NAMESPACE,
  });

// 3. Update last session timestamp
mcp__claude -
  flow__memory_usage({
    action: 'store',
    key: 'hive/last-session',
    value: HIVE_NAMESPACE,
    namespace: 'global',
  });

// 4. Spawn agents as needed
Task(
  'Coordinator Agent',
  'Review previous work and coordinate next steps based on: {{ TASK_DESCRIPTION }}',
  'planner'
);
Task('Analyst Agent', 'Analyze previous discoveries and current objective', 'analyst');
```

**Step 4: Batch Task Tracking (Single TodoWrite)**

```typescript
TodoWrite({
  todos: [
    {
      content: 'Restore previous hive session context',
      status: 'in_progress',
      activeForm: 'Restoring session',
    },
    {
      content: 'Review previous discoveries and decisions',
      status: 'pending',
      activeForm: 'Reviewing history',
    },
    { content: 'Continue work on objective', status: 'pending', activeForm: 'Continuing work' },
    { content: 'Update collective memory', status: 'pending', activeForm: 'Updating memory' },
    {
      content: 'Monitor and report progress',
      status: 'pending',
      activeForm: 'Monitoring progress',
    },
  ],
});
```

---

## 💡 CONTINUATION BEST PRACTICES

✅ **DO**:

- Review all previous discoveries before continuing
- Update the swarm objective if requirements changed
- Check swarm health before spawning new agents
- Document what changed since last session

❌ **DON'T**:

- Spawn agents before reviewing context
- Ignore previous decisions and discoveries
- Change namespace (defeats the purpose of continuation)
- Skip memory synchronization

---

## 🔧 ALTERNATIVE: Continue Specific Session

If you want to continue a **specific** session (not the last one), use:

```bash
/hive-swarm "continue hive-auth"
```

This will retrieve and resume the "hive-auth" namespace instead of the last active session.

---

**Ready to continue? The hive remembers everything.** 🐝💭
