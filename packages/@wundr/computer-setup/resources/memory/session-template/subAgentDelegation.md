# Sub-Agent Delegation - Session {{SESSION_ID}}

## Active Sub-Agents

| Agent ID       | Agent Type       | Task             | Status             | Spawned             | Last Update         | Priority             |
| -------------- | ---------------- | ---------------- | ------------------ | ------------------- | ------------------- | -------------------- |
| {{AGENT_1_ID}} | {{AGENT_1_TYPE}} | {{AGENT_1_TASK}} | {{AGENT_1_STATUS}} | {{AGENT_1_SPAWNED}} | {{AGENT_1_UPDATED}} | {{AGENT_1_PRIORITY}} |
| {{AGENT_2_ID}} | {{AGENT_2_TYPE}} | {{AGENT_2_TASK}} | {{AGENT_2_STATUS}} | {{AGENT_2_SPAWNED}} | {{AGENT_2_UPDATED}} | {{AGENT_2_PRIORITY}} |
| {{AGENT_3_ID}} | {{AGENT_3_TYPE}} | {{AGENT_3_TASK}} | {{AGENT_3_STATUS}} | {{AGENT_3_SPAWNED}} | {{AGENT_3_UPDATED}} | {{AGENT_3_PRIORITY}} |

## Delegation Queue

| Queue Position  | Agent Type       | Task Description | Dependencies     | ETA             |
| --------------- | ---------------- | ---------------- | ---------------- | --------------- |
| {{QUEUE_1_POS}} | {{QUEUE_1_TYPE}} | {{QUEUE_1_TASK}} | {{QUEUE_1_DEPS}} | {{QUEUE_1_ETA}} |
| {{QUEUE_2_POS}} | {{QUEUE_2_TYPE}} | {{QUEUE_2_TASK}} | {{QUEUE_2_DEPS}} | {{QUEUE_2_ETA}} |

## Communication Log

### Recent Messages

- [{{MSG_1_TIME}}] {{MSG_1_FROM}} -> {{MSG_1_TO}}: {{MSG_1_CONTENT}}
- [{{MSG_2_TIME}}] {{MSG_2_FROM}} -> {{MSG_2_TO}}: {{MSG_2_CONTENT}}
- [{{MSG_3_TIME}}] {{MSG_3_FROM}} -> {{MSG_3_TO}}: {{MSG_3_CONTENT}}

## Agent Performance Metrics

| Agent ID      | Tasks Completed      | Avg Duration        | Success Rate        | Token Usage       |
| ------------- | -------------------- | ------------------- | ------------------- | ----------------- |
| {{PERF_1_ID}} | {{PERF_1_COMPLETED}} | {{PERF_1_DURATION}} | {{PERF_1_SUCCESS}}% | {{PERF_1_TOKENS}} |
| {{PERF_2_ID}} | {{PERF_2_COMPLETED}} | {{PERF_2_DURATION}} | {{PERF_2_SUCCESS}}% | {{PERF_2_TOKENS}} |

## Coordination State

- Topology: {{TOPOLOGY}}
- Max concurrent agents: {{MAX_AGENTS}}
- Currently active: {{ACTIVE_AGENTS}}
- Pending spawns: {{PENDING_SPAWNS}}
- Coordination mode: {{COORDINATION_MODE}}

## Handoff Registry

| From Agent    | To Agent    | Handoff Type  | Data Key     | Timestamp     |
| ------------- | ----------- | ------------- | ------------ | ------------- |
| {{HO_1_FROM}} | {{HO_1_TO}} | {{HO_1_TYPE}} | {{HO_1_KEY}} | {{HO_1_TIME}} |
| {{HO_2_FROM}} | {{HO_2_TO}} | {{HO_2_TYPE}} | {{HO_2_KEY}} | {{HO_2_TIME}} |
