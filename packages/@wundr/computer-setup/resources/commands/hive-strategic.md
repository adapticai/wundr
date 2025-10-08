# Strategic Hive Mind - Enterprise Scale

Initialize a strategic hive mind swarm with Byzantine fault-tolerant consensus.

**Configuration:**

- 👑 Queen Type: Strategic (high-level planning & delegation)
- 🐝 Max Workers: 20 agents
- 🤝 Consensus: Byzantine fault-tolerant (67% threshold)
- 💾 Memory Size: 1000MB collective memory
- ⚡ Auto-scaling: Enabled
- 🔒 Encryption: Enabled for sensitive data
- 📊 Monitoring: Real-time dashboard
- 🔍 Verbose: Detailed logging

**Objective:** {{ TASK_DESCRIPTION }}

---

## 🔧 SESSION MANAGEMENT

**CRITICAL**: Determine the hive namespace before initialization:

1. **Check for "continue"** → Retrieve last session
2. **Parse for project name** → Use as `hive-strategic-{name}`
3. **Default** → Generate unique: `hive-strategic-{timestamp}`

**Example usage:**

- `/hive-strategic "Enterprise auth overhaul"` → `hive-strategic-auth`
- `/hive-strategic "continue"` → Resumes last strategic session
- `/hive-strategic "Analysis task"` → `hive-strategic-20251008-143022`

---

## 🚀 INITIALIZATION SEQUENCE

**Step 0: Determine Namespace (FIRST):**

```typescript
// Parse {{ TASK_DESCRIPTION }} for session intent
const isResume = '{{ TASK_DESCRIPTION }}'.toLowerCase().includes('continue');
const projectName = extractProjectName('{{ TASK_DESCRIPTION }}');

// Determine namespace with "strategic" prefix
let HIVE_NAMESPACE;
if (isResume) {
  const lastSession =
    (await mcp__claude) -
    flow__memory_usage({
      action: 'retrieve',
      key: 'hive/last-strategic-session',
      namespace: 'global',
    });
  HIVE_NAMESPACE = lastSession || `hive-strategic-${Date.now()}`;
} else if (projectName) {
  HIVE_NAMESPACE = `hive-strategic-${projectName}`;
} else {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  HIVE_NAMESPACE = `hive-strategic-${timestamp}`;
}

// Store as last strategic session
(await mcp__claude) -
  flow__memory_usage({
    action: 'store',
    key: 'hive/last-strategic-session',
    value: HIVE_NAMESPACE,
    namespace: 'global',
  });

console.log(`🐝 Active Strategic Hive: ${HIVE_NAMESPACE}`);
```

**Step 1: Initialize Swarm (Execute ALL in SINGLE message):**

```typescript
// 1. Initialize Byzantine-tolerant swarm
mcp__claude -
  flow__swarm_init({
    topology: 'hierarchical',
    maxAgents: 20,
    strategy: 'adaptive',
  });

// 2. Configure memory and encryption (use HIVE_NAMESPACE)
mcp__claude -
  flow__memory_usage({
    action: 'store',
    key: 'swarm/config',
    value: JSON.stringify({
      queenType: 'strategic',
      maxWorkers: 20,
      consensusAlgorithm: 'byzantine',
      memorySize: 1000,
      autoScale: true,
      encryption: true,
    }),
    namespace: HIVE_NAMESPACE, // ← Use determined namespace
  });

// 3. Enable monitoring
mcp__claude - flow__swarm_monitor({ interval: 3000 });

// 4. Set up byzantine consensus
mcp__claude -
  flow__daa_consensus({
    agents: [],
    proposal: {
      decision: 'initialization',
      votingMethod: 'byzantine',
      threshold: 0.67,
    },
  });

// 5. Spawn 20 specialized workers
Task('Research Lead', 'Senior researcher coordinating information gathering', 'researcher');
Task('Researcher 1', 'Technical research and documentation specialist', 'researcher');
Task('Researcher 2', 'Competitive analysis specialist', 'researcher');
Task('Researcher 3', 'Requirements gathering specialist', 'researcher');

Task('Engineering Lead', 'Senior architect coordinating development', 'coder');
Task('Backend Team 1', 'API development and database design', 'coder');
Task('Backend Team 2', 'Microservices and distributed systems', 'coder');
Task('Frontend Team 1', 'UI/UX implementation', 'coder');
Task('Frontend Team 2', 'State management and performance', 'coder');
Task('DevOps Engineer', 'CI/CD, infrastructure, deployment', 'coder');

Task('QA Lead', 'Test strategy and quality coordination', 'tester');
Task('QA Engineer 1', 'Unit testing and TDD', 'tester');
Task('QA Engineer 2', 'Integration and E2E testing', 'tester');
Task('QA Engineer 3', 'Performance and load testing', 'tester');
Task('QA Engineer 4', 'Security testing and penetration', 'tester');

Task('Analytics Lead', 'Data analysis and metrics coordination', 'analyst');
Task('Performance Analyst', 'System performance and optimization', 'analyst');
Task('Business Analyst', 'Requirements and ROI analysis', 'analyst');
Task('Data Analyst', 'Metrics, reporting, and insights', 'analyst');

Task('Documentation Lead', 'Technical writing and knowledge management', 'reviewer');

// 6. Initialize task tracking
TodoWrite({
  todos: [
    {
      content: 'Initialize strategic hive mind swarm',
      status: 'in_progress',
      activeForm: 'Initializing strategic swarm',
    },
    {
      content: 'Establish byzantine consensus protocols',
      status: 'pending',
      activeForm: 'Establishing consensus',
    },
    {
      content: 'Deploy 20 specialized worker agents',
      status: 'pending',
      activeForm: 'Deploying workers',
    },
    {
      content: 'Configure encrypted communication channels',
      status: 'pending',
      activeForm: 'Configuring encryption',
    },
    {
      content: 'Set up auto-scaling triggers',
      status: 'pending',
      activeForm: 'Setting up auto-scaling',
    },
    {
      content: 'Enable real-time monitoring dashboard',
      status: 'pending',
      activeForm: 'Enabling monitoring',
    },
    {
      content: 'Distribute tasks across worker teams',
      status: 'pending',
      activeForm: 'Distributing tasks',
    },
    {
      content: 'Monitor collective performance',
      status: 'pending',
      activeForm: 'Monitoring performance',
    },
    {
      content: 'Aggregate and synthesize results',
      status: 'pending',
      activeForm: 'Aggregating results',
    },
    {
      content: 'Generate comprehensive report',
      status: 'pending',
      activeForm: 'Generating report',
    },
  ],
});
```

---

## 🛡️ BYZANTINE FAULT TOLERANCE

The swarm uses Byzantine consensus to handle:

- **Malicious actors**: Detect and isolate compromised agents
- **Network partitions**: Continue operating with majority
- **Conflicting outputs**: Resolve through weighted voting
- **Data integrity**: Cryptographic verification of all decisions

**Consensus requires**: 67% agreement (14 of 20 workers) **Fault tolerance**: Can handle up to 6
Byzantine failures

---

**Begin strategic coordination now. The hive awaits your command.** 🐝👑
