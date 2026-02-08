# Wave 2 Analysis: Agent Teams Integration

**Date**: 2026-02-09
**Module**: `@wundr/orchestrator-daemon/src/teams/`
**Reference**: Claude Code Agent Teams (experimental feature)
**Status**: Design + Implementation

---

## 1. Executive Summary

This document designs Wundr's Agent Teams subsystem, modeled after Claude Code's experimental
Agent Teams feature. Agent Teams enable multiple Claude Code sessions to coordinate as a team
with a shared task list, inter-agent messaging (mailbox), and centralized lifecycle management.

Claude Code Agent Teams differ from subagents in a critical way: each teammate is a fully
independent session with its own context window, capable of direct peer-to-peer communication,
rather than a child process that only reports back to a parent.

### Key Components

| Component | File | Purpose |
|---|---|---|
| Team Coordinator | `team-coordinator.ts` | Team lifecycle, teammate spawning, display mode management |
| Shared Task List | `shared-task-list.ts` | Cross-session task CRUD with dependency resolution and file-locked claiming |
| Mailbox | `mailbox.ts` | Point-to-point and broadcast messaging between teammates |
| Team Hooks | `team-hooks.ts` | `TeammateIdle` and `TaskCompleted` hook handlers with quality gates |

---

## 2. Claude Code Agent Teams Reference Architecture

### 2.1 Feature Summary

Claude Code Agent Teams (enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) provides:

- **Team Lead**: The main Claude Code session that creates the team, spawns teammates, coordinates work
- **Teammates**: Separate Claude Code instances, each with their own context window
- **Shared Task List**: Work items with states (pending/in-progress/completed), dependency tracking, and file-locked claiming
- **Mailbox**: Direct messaging between teammates, automatic idle notifications
- **Display Modes**: In-process (all in one terminal) or split-pane (tmux/iTerm2)
- **Hooks**: `TeammateIdle` (exit code 2 = send feedback, keep working) and `TaskCompleted` (exit code 2 = reject completion)

### 2.2 Storage Layout

```
~/.claude/teams/{team-name}/config.json    # Team config with members array
~/.claude/tasks/{team-name}/               # Task list storage
```

### 2.3 Key Design Decisions from Claude Code

1. **No nested teams**: Teammates cannot spawn their own teams
2. **One team per session**: A lead manages exactly one team at a time
3. **Fixed lead**: The session that creates the team is lead for its lifetime
4. **Permissions inherit**: Teammates start with the lead's permission settings
5. **No session resumption for in-process teammates**: `/resume` does not restore teammates
6. **File locking for task claiming**: Prevents race conditions on concurrent claims

---

## 3. Wundr's Existing Architecture (Integration Points)

### 3.1 Orchestrator Daemon (`orchestrator-daemon.ts`)

The daemon manages sessions through `SessionManager`, communicates via `OrchestratorWebSocketServer`,
and tracks metrics. Agent Teams will extend this with team-aware session coordination.

**Integration point**: Teams become a first-class concept alongside sessions. The daemon gains
`team_*` WebSocket message types and team-level metrics.

### 3.2 Session Manager (`session-manager.ts`)

Currently manages individual sessions with spawn, execute, stop, and cleanup operations.

**Integration point**: Sessions gain an optional `teamId` field. The session manager learns to
query sessions by team and enforce team-level session limits.

### 3.3 Agent Delegation (`@wundr/agent-delegation`)

The `HubCoordinator` implements hub-and-spoke delegation with parallel execution, result synthesis,
model selection, and audit logging.

**Integration point**: Agent Teams complement (not replace) delegation. Delegation is for focused
tasks that report results back; Teams are for collaborative work where participants communicate
directly. The `HubCoordinator` can be used within a team lead to coordinate specific subtasks.

### 3.4 Federation System (`federation/`)

Handles multi-orchestrator coordination with delegation, heartbeats, and context sharing.

**Integration point**: Teams are local to a single orchestrator (matching Claude Code's model).
Cross-orchestrator teams are out of scope for the initial implementation.

### 3.5 Swarm Intelligence (`SwarmIntelligence.ts`)

Provides topology selection, consensus, and collective learning.

**Integration point**: Swarm topology algorithms can inform team composition decisions,
but Agent Teams use a simpler flat coordinator model rather than full swarm topologies.

---

## 4. Detailed Design

### 4.1 Team Coordinator (`team-coordinator.ts`)

The `TeamCoordinator` manages the full lifecycle of an agent team.

#### Type Definitions

```typescript
type TeammateMode = 'in-process' | 'tmux' | 'auto';

type BackendType = 'tmux' | 'iterm2' | 'in-process';

type TeamStatus = 'creating' | 'active' | 'shutting-down' | 'cleaned-up';

type TeammateStatus = 'spawning' | 'active' | 'idle' | 'shutting-down' | 'stopped';

interface TeamConfig {
  id: string;
  name: string;
  leadSessionId: string;
  teammateMode: TeammateMode;
  resolvedBackend: BackendType;
  maxTeammates: number;
  delegateMode: boolean;
  createdAt: Date;
  status: TeamStatus;
  members: TeamMember[];
  metadata?: Record<string, unknown>;
}

interface TeamMember {
  id: string;
  name: string;
  sessionId: string;
  role: string;
  agentType: string;
  status: TeammateStatus;
  assignedTasks: string[];
  spawnPrompt?: string;
  planApprovalRequired: boolean;
  model?: string;
  joinedAt: Date;
}

interface SpawnTeammateOptions {
  name: string;
  role: string;
  prompt: string;
  model?: string;
  planApprovalRequired?: boolean;
  agentType?: string;
}
```

#### Core Operations

```
createTeam(leadSessionId, config) -> TeamConfig
  1. Validate no existing team for this session
  2. Detect backend (tmux/iterm2/in-process)
  3. Create team config and persist to storage
  4. Initialize shared task list and mailbox
  5. Return TeamConfig

spawnTeammate(teamId, options) -> TeamMember
  1. Validate team exists and is active
  2. Check teammate limit
  3. Spawn session via SessionManager
  4. Configure teammate with spawn prompt + project context
  5. Register in team config
  6. Start monitoring teammate lifecycle

sendMessage(teamId, fromId, toId, message) -> void
  Delegates to Mailbox.send()

broadcastMessage(teamId, fromId, message) -> void
  Delegates to Mailbox.broadcast()

requestShutdown(teamId, teammateId) -> boolean
  1. Send shutdown request to teammate
  2. Teammate can approve (exits) or reject (continues with explanation)
  3. Return whether shutdown was accepted

cleanupTeam(teamId) -> void
  1. Verify no active teammates
  2. Clean up task list
  3. Clean up mailbox
  4. Remove team config
  5. Update session manager
```

#### Backend Detection

```
detectBackend(mode: TeammateMode) -> BackendType
  if mode === 'in-process':
    return 'in-process'
  if mode === 'tmux' || mode === 'auto':
    if isRunningInsideTmux():
      return 'tmux'
    if isITerm2WithIt2CLI():
      return 'iterm2'
    return 'in-process'  // fallback
```

### 4.2 Shared Task List (`shared-task-list.ts`)

The shared task list is the central coordination mechanism for teams. All teammates can
read the list, claim tasks, and mark them complete. File locking prevents race conditions.

#### Type Definitions

```typescript
type SharedTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

type SharedTaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface SharedTask {
  id: string;
  teamId: string;
  title: string;
  description: string;
  status: SharedTaskStatus;
  priority: SharedTaskPriority;
  assigneeId?: string;       // teammate member ID
  dependencies: string[];    // task IDs that must complete first
  createdBy: string;         // member ID (usually lead)
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

interface CreateTaskInput {
  title: string;
  description: string;
  priority?: SharedTaskPriority;
  assigneeId?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: SharedTaskStatus;
  priority?: SharedTaskPriority;
  assigneeId?: string;
  metadata?: Record<string, unknown>;
}
```

#### Core Operations

```
createTask(teamId, createdBy, input) -> SharedTask
  1. Generate task ID
  2. Validate dependencies exist
  3. Set initial status: 'pending' if no unresolved deps, 'blocked' otherwise
  4. Persist task
  5. Emit 'task:created' event
  6. Return task

getTask(teamId, taskId) -> SharedTask | undefined

listTasks(teamId, filter?) -> SharedTask[]
  Supports filtering by status, assignee, priority

updateTask(teamId, taskId, input) -> SharedTask
  1. Acquire file lock
  2. Read current state
  3. Apply updates
  4. If status changed to 'completed', check for dependent tasks to unblock
  5. Persist and release lock
  6. Emit 'task:updated' event
  7. Return updated task

claimTask(teamId, taskId, teammateId) -> SharedTask
  1. Acquire file lock (prevents race conditions)
  2. Verify task is 'pending' and not blocked
  3. Verify task is unassigned or assigned to this teammate
  4. Set status to 'in_progress', set assigneeId
  5. Persist and release lock
  6. Emit 'task:claimed' event
  7. Return updated task

completeTask(teamId, taskId, teammateId) -> SharedTask
  1. Run TaskCompleted hook (exit 2 = reject)
  2. If hook rejects, throw with feedback message
  3. Acquire file lock
  4. Set status to 'completed', set completedAt
  5. Resolve dependencies: unblock any tasks whose deps are now all complete
  6. Persist and release lock
  7. Emit 'task:completed' event
  8. Return updated task

getClaimableTasksForTeammate(teamId, teammateId) -> SharedTask[]
  Returns tasks that are 'pending', have no unresolved dependencies,
  and are either unassigned or assigned to the given teammate
```

#### Dependency Resolution

When a task is completed, the system checks all other tasks:
- For each task with `dependencies` containing the completed task ID
- If all dependencies are now completed, change status from `blocked` to `pending`
- Emit `task:unblocked` for each newly unblocked task

#### File Locking Strategy

Uses `proper-lockfile` (or equivalent) for atomic claim operations:
```
/tmp/wundr-teams/{teamId}/tasks.lock
```

### 4.3 Mailbox (`mailbox.ts`)

The mailbox provides async messaging between teammates. Messages are delivered automatically
(pushed, not polled) via WebSocket or in-process EventEmitter.

#### Type Definitions

```typescript
type MessagePriority = 'normal' | 'urgent';

type MessageType =
  | 'direct'          // point-to-point message
  | 'broadcast'       // from one to all
  | 'system'          // system notifications (idle, shutdown, etc.)
  | 'plan_approval'   // plan approval request/response
  | 'task_update';    // task status change notification

interface TeamMessage {
  id: string;
  teamId: string;
  fromId: string;        // sender member ID
  toId: string | null;   // null for broadcasts
  type: MessageType;
  content: string;
  priority: MessagePriority;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: Record<string, unknown>;
}

interface SendMessageInput {
  toId: string;
  content: string;
  type?: MessageType;
  priority?: MessagePriority;
  metadata?: Record<string, unknown>;
}
```

#### Core Operations

```
send(teamId, fromId, input) -> TeamMessage
  1. Validate sender and recipient are team members
  2. Create message record
  3. Deliver to recipient's inbox
  4. Emit 'message:sent' event
  5. Return message

broadcast(teamId, fromId, content, options?) -> TeamMessage[]
  1. Send to all team members except sender
  2. Return array of sent messages

getInbox(teamId, memberId, filter?) -> TeamMessage[]
  Returns messages for the specified member
  Supports filtering by type, read/unread, date range

markRead(teamId, messageId, memberId) -> void
  Marks a message as read

notifyIdle(teamId, memberId) -> void
  1. Run TeammateIdle hook (exit 2 = send feedback, keep working)
  2. If hook returns feedback, send as system message to teammate
  3. Otherwise, send idle notification to lead
  4. Emit 'teammate:idle' event

notifyShutdown(teamId, memberId, reason) -> void
  Send system message to lead about teammate shutdown
```

#### Delivery Mechanism

- **In-process mode**: Direct EventEmitter dispatch to the recipient session
- **tmux/iTerm2 mode**: tmux `send-keys` to the target pane (matches Claude Code's approach)
- **WebSocket mode**: Deliver via WS to connected clients watching the team

### 4.4 Team Hooks (`team-hooks.ts`)

Quality gate hooks that fire on teammate lifecycle events, matching Claude Code's
`TeammateIdle` and `TaskCompleted` hooks.

#### Type Definitions

```typescript
type HookType = 'TeammateIdle' | 'TaskCompleted';

type HookExitCode = 0 | 1 | 2;
// 0 = allow (proceed normally)
// 1 = error (log and proceed)
// 2 = reject with feedback (keep teammate working / reject task completion)

interface HookConfig {
  type: HookType;
  command: string;      // shell command or script path
  timeout: number;      // ms before hook is killed
  enabled: boolean;
}

interface HookResult {
  exitCode: HookExitCode;
  stdout: string;       // feedback message when exitCode === 2
  stderr: string;
  duration: number;
  timedOut: boolean;
}

interface TeammateIdleHookContext {
  teamId: string;
  memberId: string;
  memberName: string;
  completedTaskIds: string[];
  remainingTasks: number;
  idleSince: Date;
}

interface TaskCompletedHookContext {
  teamId: string;
  taskId: string;
  taskTitle: string;
  completedBy: string;
  memberName: string;
  duration: number;
  dependentTaskIds: string[];
}
```

#### Core Operations

```
registerHook(teamId, config) -> void
  Register a hook configuration for a team

executeTeammateIdleHook(context) -> HookResult
  1. Find registered TeammateIdle hooks for the team
  2. Execute hook command with context as env vars
  3. If exit code 2: return feedback to keep teammate working
  4. If exit code 0: allow idle (teammate will be notified as idle)
  5. If exit code 1 or timeout: log warning, allow idle

executeTaskCompletedHook(context) -> HookResult
  1. Find registered TaskCompleted hooks for the team
  2. Execute hook command with context as env vars
  3. If exit code 2: reject completion, return feedback
  4. If exit code 0: allow completion
  5. If exit code 1 or timeout: log warning, allow completion

getRegisteredHooks(teamId) -> HookConfig[]
  List all hooks for a team

removeHook(teamId, hookType) -> boolean
  Remove a hook registration
```

#### Hook Environment Variables

When executing hooks, the following environment variables are set:

**TeammateIdle**:
- `WUNDR_TEAM_ID`
- `WUNDR_MEMBER_ID`
- `WUNDR_MEMBER_NAME`
- `WUNDR_COMPLETED_TASKS` (comma-separated IDs)
- `WUNDR_REMAINING_TASKS` (count)

**TaskCompleted**:
- `WUNDR_TEAM_ID`
- `WUNDR_TASK_ID`
- `WUNDR_TASK_TITLE`
- `WUNDR_COMPLETED_BY`
- `WUNDR_MEMBER_NAME`
- `WUNDR_TASK_DURATION` (ms)
- `WUNDR_DEPENDENT_TASKS` (comma-separated IDs)

---

## 5. WebSocket API Extensions

New message types for team coordination over the existing daemon WebSocket:

```typescript
// Outbound (client -> daemon)
| { type: 'create_team'; payload: CreateTeamPayload }
| { type: 'spawn_teammate'; payload: SpawnTeammatePayload }
| { type: 'team_send_message'; payload: TeamSendMessagePayload }
| { type: 'team_broadcast'; payload: TeamBroadcastPayload }
| { type: 'team_create_task'; payload: TeamCreateTaskPayload }
| { type: 'team_update_task'; payload: TeamUpdateTaskPayload }
| { type: 'team_claim_task'; payload: TeamClaimTaskPayload }
| { type: 'team_complete_task'; payload: TeamCompleteTaskPayload }
| { type: 'team_list_tasks'; payload: { teamId: string } }
| { type: 'team_status'; payload: { teamId: string } }
| { type: 'shutdown_teammate'; payload: { teamId: string; memberId: string } }
| { type: 'cleanup_team'; payload: { teamId: string } }

// Inbound (daemon -> client)
| { type: 'team_created'; team: TeamConfig }
| { type: 'teammate_spawned'; member: TeamMember }
| { type: 'team_message'; message: TeamMessage }
| { type: 'team_task_update'; task: SharedTask }
| { type: 'team_status_update'; team: TeamConfig }
| { type: 'teammate_idle'; memberId: string; teamId: string }
| { type: 'teammate_shutdown'; memberId: string; teamId: string }
| { type: 'team_cleaned_up'; teamId: string }
```

---

## 6. Integration with Existing Systems

### 6.1 Session Manager Extension

Add optional `teamId` to `Session`:

```typescript
interface Session {
  // ...existing fields
  teamId?: string;
  teamRole?: 'lead' | 'teammate';
}
```

### 6.2 Memory Manager Integration

Team-level shared memory:
- Scratchpad entries can be tagged with `teamId` for cross-session visibility
- Episodic memory gains `teamId` filter for team-scoped retrieval
- Task completion summaries auto-added to lead's semantic memory

### 6.3 Daemon Status Extension

```typescript
interface DaemonStatus {
  // ...existing fields
  activeTeams: number;
  teamMetrics: {
    totalTeamsCreated: number;
    totalTeammatesSpawned: number;
    totalTeamTasksCompleted: number;
    totalTeamMessages: number;
  };
}
```

---

## 7. Event Flow Diagrams

### 7.1 Team Creation and Task Execution

```
User -> Lead: "Create a team with 3 reviewers"
Lead -> TeamCoordinator: createTeam()
TeamCoordinator -> SharedTaskList: initialize()
TeamCoordinator -> Mailbox: initialize()
Lead -> TeamCoordinator: spawnTeammate() x3
  TeamCoordinator -> SessionManager: spawnSession() x3
  TeamCoordinator -> Mailbox: notifyTeammateJoined() x3
Lead -> SharedTaskList: createTask() x6
  SharedTaskList -> Teammates (via Mailbox): task:created notifications
Teammate-1 -> SharedTaskList: claimTask(task-1)
Teammate-1 -> (works on task-1)
Teammate-1 -> SharedTaskList: completeTask(task-1)
  SharedTaskList -> TeamHooks: executeTaskCompletedHook()
  SharedTaskList -> (resolve dependencies, unblock task-4)
  SharedTaskList -> Mailbox: task:completed notification -> Lead
Teammate-1 -> SharedTaskList: claimTask(task-4)  // was blocked, now available
...
All tasks complete -> Lead: synthesize results
Lead -> TeamCoordinator: requestShutdown() x3
Lead -> TeamCoordinator: cleanupTeam()
```

### 7.2 TeammateIdle Hook Flow

```
Teammate-2 finishes last assigned task
Teammate-2 -> Mailbox: notifyIdle()
  Mailbox -> TeamHooks: executeTeammateIdleHook()
  Hook returns exit code 2 + feedback: "Check test coverage for task-3"
  Mailbox -> Teammate-2: system message with feedback
  Teammate-2 remains active, works on feedback
```

---

## 8. Differences from Claude Code

| Aspect | Claude Code | Wundr |
|---|---|---|
| Storage | File-based (`~/.claude/teams/`) | In-memory + optional persistence via MemoryManager |
| Communication | tmux `send-keys` / in-process | EventEmitter + WebSocket + optional tmux |
| Task Locking | File locks | In-memory mutex with optional file lock fallback |
| Hooks | Bash scripts via child_process | Configurable executors (bash, node, or in-process functions) |
| Display | Terminal UI (Shift+Up/Down) | WebSocket events for any frontend (CLI, web dashboard) |
| Permissions | Inherits from lead session | Configurable per-teammate via session config |

---

## 9. Error Handling

### 9.1 Teammate Crash Recovery

If a teammate session crashes:
1. `SessionManager` emits `session:failed` with the team session
2. `TeamCoordinator` receives the event, marks member as `stopped`
3. Any tasks `in_progress` by that teammate are set back to `pending`
4. Lead is notified via system message in mailbox
5. Lead can spawn a replacement teammate

### 9.2 Task Claim Conflicts

File locking (or in-memory mutex) ensures only one teammate claims a task.
If a lock acquisition fails (timeout), the claiming teammate gets a `ClaimConflictError`
and should retry with a different task.

### 9.3 Hook Failures

Hook failures (exit code 1 or timeout) are logged but do not block the operation.
Only exit code 2 has semantic meaning (reject and provide feedback).

---

## 10. Testing Strategy

| Layer | Approach |
|---|---|
| Unit | Each module tested in isolation with mocked dependencies |
| Integration | Team lifecycle test: create -> spawn -> tasks -> messages -> cleanup |
| Concurrency | Race condition test: multiple teammates claiming the same task |
| Hooks | Hook execution with various exit codes and timeout scenarios |
| Error | Teammate crash recovery, orphan cleanup, lock timeout |

---

## 11. Future Enhancements

1. **Cross-orchestrator teams**: Leverage federation to allow teammates on different daemons
2. **Plan approval workflow**: Full plan-mode with lead review before teammate implements
3. **Delegate mode**: Restrict lead to coordination-only tools
4. **Team templates**: Pre-configured team compositions for common workflows
5. **Cost tracking**: Per-team token budget with alerts
6. **Session resumption**: Persist team state for resume after restart
7. **Nested teams**: Allow teammates to spawn sub-teams (with depth limits)

---

## 12. Source References

- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Agent Teams Blog (Addy Osmani)](https://addyosmani.com/blog/claude-code-agent-teams/)
- Wundr Orchestrator Daemon: `packages/@wundr/orchestrator-daemon/src/core/`
- Wundr Agent Delegation: `packages/@wundr/agent-delegation/src/`
- Wundr AI Integration: `packages/@wundr/ai-integration/src/core/`
