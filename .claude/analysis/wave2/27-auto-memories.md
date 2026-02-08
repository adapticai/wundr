# Wave 2 Analysis 27: Auto-Memories System

## Executive Summary

This document describes an auto-memories system for Wundr, inspired by Claude
Code's persistent learning feature. The system automatically detects learnable
moments during agent sessions (repeated corrections, error patterns, user
preferences, project conventions, tool usage patterns) and persists them as
structured markdown entries in scoped `MEMORY.md` files. Memories are injected
into the system prompt on subsequent sessions, providing continuity across
conversations without manual note-taking.

Unlike Wundr's existing `@wundr/agent-memory` package (which implements
MemGPT-style tiered in-memory storage with forgetting curves) or the Wave 2
Analysis 07 SQLite-backed persistence layer, this system operates at the
**file level** -- reading and writing plain markdown files that users can
inspect, edit, and version-control. This makes it transparent, auditable, and
compatible with the OpenClaw memory model (MEMORY.md + memory/*.md).

---

## 1. Reference Architecture: Claude Code's Persistent Learning

Claude Code stores memories in plain `.md` files at three scope levels:

| Scope    | Path                        | Visibility  |
|----------|-----------------------------|-------------|
| User     | `~/.claude/MEMORY.md`       | All projects for this user |
| Project  | `.claude/MEMORY.md`         | All sessions in this project |
| Local    | `.claude/local/MEMORY.md`   | Only this machine for this project |

Key behaviors:
- Memories are plain markdown, editable by the user
- Injected into the system prompt at conversation start
- Agent can write new memories when it learns something
- No embedding search required -- the file is small enough to inject whole
- A line limit (roughly 200 lines) keeps files manageable
- When a file grows large, it links to topic-specific files in `memory/`

### What OpenClaw Does Differently

OpenClaw's `MemoryIndexManager` treats `MEMORY.md` and `memory/*.md` as
searchable knowledge bases -- they are chunked, embedded, and indexed in
SQLite. The agent searches them via `memory_search` tool calls. This is
appropriate for large memory sets but is not the same as Claude Code's model
where the file content is injected directly into the system prompt.

Wundr's auto-memories system combines both approaches:
1. **Direct injection** of compact MEMORY.md files into the system prompt
   (Claude Code model)
2. **Searchable indexing** of overflow topic files via the existing
   `@wundr/agent-memory` semantic store (OpenClaw model)

---

## 2. Memory Scopes

### 2.1 Scope Hierarchy

```
User Scope (~/.wundr/MEMORY.md)
  |
  +-- Applied to ALL projects for this user
  +-- Contains: global preferences, tool usage patterns, communication style
  +-- Example: "User prefers TypeScript over JavaScript"
  +-- Example: "Always use pnpm, not npm"

Project Scope (<project>/.wundr/MEMORY.md)
  |
  +-- Applied to all sessions in this project
  +-- Contains: project conventions, architecture decisions, team patterns
  +-- Example: "This project uses Vitest, not Jest"
  +-- Example: "API routes follow /api/v1/<resource> convention"
  +-- Committed to version control (shared with team)

Local Scope (<project>/.wundr/local/MEMORY.md)
  |
  +-- Applied only on this machine for this project
  +-- Contains: machine-specific paths, personal dev preferences for this repo
  +-- Example: "Local Postgres runs on port 5433"
  +-- Added to .gitignore (not shared)
```

### 2.2 Resolution Order

When building the system prompt memory context, scopes are merged in order
(lower scopes override higher scopes for conflicting entries):

1. User scope (global baseline)
2. Project scope (project-specific overrides)
3. Local scope (machine-specific overrides)

### 2.3 File Paths

```typescript
interface MemoryScopes {
  user:    string;  // ~/.wundr/MEMORY.md
  project: string;  // <projectRoot>/.wundr/MEMORY.md
  local:   string;  // <projectRoot>/.wundr/local/MEMORY.md
}
```

---

## 3. Memory File Format

### 3.1 Structure

Each `MEMORY.md` file is organized into sections using markdown headers.
Entries are bullet points under their section.

```markdown
# Auto-Memories

## User Preferences
- Prefers concise responses without excessive explanation
- Uses dark mode in all editors
- Timezone: America/Los_Angeles

## Project Conventions
- Use `pnpm` for package management
- All exports from `src/index.ts` barrel files
- Error messages follow: `[module] description (code)`

## Error Patterns
- When TypeScript reports `Cannot find module`, check `tsconfig.json` paths first
- `ECONNREFUSED` on port 5432 means local Postgres is not running

## Tool Usage
- User prefers `git rebase` over `git merge`
- Always run `pnpm lint` before committing

## Architecture Decisions
- API follows REST conventions with `/api/v1/` prefix
- Database migrations in `packages/db/migrations/`
- All dates stored as UTC timestamps

## Corrections
- Do NOT suggest `npm install` -- this project uses pnpm
- The main branch is `main`, not `master`
```

### 3.2 Entry Format

Each entry is a single bullet point. If more detail is needed, sub-bullets
are allowed:

```markdown
- Entry summary
  - Supporting detail or context
  - When this was learned (optional)
```

### 3.3 Sections

| Section | Purpose |
|---------|---------|
| User Preferences | How the user likes to work |
| Project Conventions | Naming, structure, tooling norms |
| Error Patterns | Common errors and their fixes |
| Tool Usage | CLI and tool preferences |
| Architecture Decisions | Design choices and rationale |
| Corrections | Things the agent got wrong and must not repeat |
| Workflow | Build, test, deploy patterns |
| People & Roles | Team members and responsibilities |
| Links | Topic-specific overflow files (see 3.4) |

### 3.4 Topic Overflow

When a MEMORY.md file approaches the line limit (200 lines), entries are
consolidated and offloaded to topic-specific files:

```
.wundr/
  MEMORY.md              # Main file (kept under 200 lines)
  memory/
    typescript.md         # TypeScript-specific patterns
    api-conventions.md    # API design decisions
    deployment.md         # Deployment procedures
```

The main MEMORY.md links to these:

```markdown
## Links
- [TypeScript patterns](memory/typescript.md)
- [API conventions](memory/api-conventions.md)
- [Deployment procedures](memory/deployment.md)
```

Topic files are indexed and searchable via the memory search system but are
NOT injected into the system prompt directly. Only the main MEMORY.md
(across all three scopes) is injected.

---

## 4. Auto-Detection of Learnable Moments

### 4.1 Detection Categories

The `LearningDetector` analyzes conversation turns to identify patterns
that should be persisted as memories.

#### 4.1.1 Repeated Corrections

**Signal**: User corrects the agent on the same topic more than once.

```
User: "No, use pnpm not npm"
Agent: (stores: "Do NOT suggest npm -- this project uses pnpm")
```

Detection algorithm:
1. Track correction-like utterances: "no", "not that", "I said", "wrong",
   "actually", "use X instead", "don't do Y"
2. Extract the correction target and replacement
3. If the same correction appears twice in a session or across sessions,
   promote to persistent memory

#### 4.1.2 Error Patterns and Fixes

**Signal**: Agent encounters an error, user or agent fixes it, and the
fix pattern is generalizable.

```
Error: ECONNREFUSED 127.0.0.1:5432
Fix: "Run `docker compose up -d postgres`"
Memory: "ECONNREFUSED on 5432 -> run `docker compose up -d postgres`"
```

Detection algorithm:
1. Track tool execution errors (non-zero exit codes, exception messages)
2. Track the resolution (successful follow-up command or user guidance)
3. Pair error-resolution into a learnable pattern
4. Store after the pattern resolves successfully

#### 4.1.3 User Preferences

**Signal**: User explicitly states a preference or consistently
demonstrates one.

```
User: "I prefer tabs over spaces"
User: "Always use arrow functions"
User: "Keep responses short"
```

Detection algorithm:
1. Match explicit preference patterns: "I prefer", "always use",
   "don't use", "I like", "please always"
2. Match implicit preferences: consistent choices across turns
   (e.g., user always reformats to a specific style)
3. Classify preference type (formatting, communication, tooling)

#### 4.1.4 Project-Specific Patterns

**Signal**: Information about the project that helps the agent work
more effectively.

```
User: "The tests are in __tests__ directories, not test/"
User: "We use Drizzle ORM, not Prisma"
Agent discovers: package.json has "vitest" not "jest"
```

Detection algorithm:
1. Track project structure corrections
2. Detect tool/framework mentions with correction context
3. Parse package.json, tsconfig.json, etc. for framework detection
4. Store only when the information would change agent behavior

#### 4.1.5 Tool Usage Patterns

**Signal**: User demonstrates specific tool invocations or workflows.

```
User: "Run tests with `pnpm test -- --filter=@wundr/core`"
User: "Deploy with `./scripts/deploy.sh staging`"
```

Detection algorithm:
1. Track explicit tool invocation instructions
2. Track repeated tool usage patterns across turns
3. Identify project-specific aliases and scripts

### 4.2 Detection Confidence Scoring

Each detected learning moment receives a confidence score:

| Score | Meaning | Action |
|-------|---------|--------|
| 0.0-0.3 | Low confidence | Discard |
| 0.3-0.6 | Medium confidence | Store as candidate, confirm on repetition |
| 0.6-0.8 | High confidence | Store automatically |
| 0.8-1.0 | Very high confidence | Store immediately, explicit user statement |

Thresholds:
- Explicit user statements ("I prefer X"): 0.9
- Repeated corrections (2+ times): 0.8
- Error-fix patterns (resolved successfully): 0.7
- Implicit preferences (observed consistency): 0.5
- Single correction: 0.4

### 4.3 Deduplication

Before storing a new memory, the detector checks for duplicates:
1. Exact match: same entry text already exists
2. Semantic overlap: new entry covers the same concept as an existing entry
   (uses simple keyword overlap scoring, not embedding similarity)
3. Contradictions: new entry contradicts an existing entry (replace the old one)

---

## 5. Memory Lifecycle

### 5.1 Creation

```
Conversation Turn
  |
  v
LearningDetector.analyze(turn)
  |
  +-- Extract candidate memories
  +-- Score confidence
  +-- Deduplicate against existing memories
  +-- Determine scope (user vs project vs local)
  |
  v
MemoryFileManager.append(scope, section, entry)
  |
  +-- Read current MEMORY.md for scope
  +-- Find or create section
  +-- Append entry
  +-- Check line count, truncate if needed
  +-- Write back
```

### 5.2 Injection

```
Session Start
  |
  v
AutoMemories.loadAll()
  |
  +-- Read user scope MEMORY.md
  +-- Read project scope MEMORY.md
  +-- Read local scope MEMORY.md
  +-- Merge (local overrides project overrides user)
  +-- Format as system prompt section
  |
  v
Inject into system prompt as "## Persistent Memories" section
```

### 5.3 Consolidation

When a MEMORY.md file exceeds the line limit:

```
MemoryFileManager.consolidate(scope)
  |
  +-- Parse sections and entries
  +-- Group related entries
  +-- Merge duplicate/overlapping entries
  +-- Move large topic clusters to memory/*.md
  +-- Add links in main MEMORY.md
  +-- Trim to under 200 lines
```

### 5.4 Decay

Memories can become outdated. The decay process runs periodically:

```
MemoryFileManager.decayCheck(scope)
  |
  +-- For each entry, check metadata:
  |     +-- Last confirmed date
  |     +-- Contradiction signals from recent sessions
  |     +-- Entry age
  |
  +-- If entry is outdated (>90 days, never re-confirmed):
  |     +-- Mark with `[?]` prefix
  |     +-- On next session, agent may confirm or remove
  |
  +-- If entry was explicitly contradicted:
        +-- Remove or update the entry
```

---

## 6. System Prompt Integration

### 6.1 Memory Section Format

The injected memory section appears in the system prompt after the
standard sections:

```
## Persistent Memories

The following memories have been automatically learned from previous
sessions. Use them to provide more personalized and accurate responses.
If any memory seems outdated, update it.

### User Preferences
- Prefers concise responses
- Timezone: America/Los_Angeles

### Project Conventions
- Use pnpm for package management
- Tests in __tests__/ directories

### Error Patterns
- ECONNREFUSED on 5432 -> run `docker compose up -d postgres`

### Corrections
- Do NOT suggest npm -- this project uses pnpm
```

### 6.2 Token Budget

The memory injection respects a token budget:
- Default: 2000 tokens for memories section
- If combined memories exceed budget, prioritize:
  1. Corrections (highest priority -- avoid repeated mistakes)
  2. User preferences
  3. Project conventions
  4. Error patterns
  5. Tool usage
  6. Architecture decisions
  7. Links (lowest priority)

### 6.3 Relevance Filtering

On each session, the auto-memories system can optionally filter entries
based on the session context:
- If the session is about TypeScript, boost TypeScript-related entries
- If the session involves deployment, boost deployment entries
- Filtering uses simple keyword matching against the initial user message

---

## 7. Memory Search Integration

### 7.1 Main MEMORY.md Files

These are injected directly into the system prompt. No search needed.

### 7.2 Topic Overflow Files (memory/*.md)

These are registered with the `@wundr/agent-memory` semantic store for
search-based retrieval. The agent can use `memory_search` to find
relevant entries from overflow files.

### 7.3 Cross-Session Memory

The auto-memories system bridges the gap between:
- **@wundr/agent-memory** (in-memory tiered storage for single session)
- **MEMORY.md files** (persistent cross-session knowledge)

At session end, the `LearningDetector` promotes high-value episodic
memories from the session to appropriate MEMORY.md files.

---

## 8. Component Specifications

### 8.1 AutoMemories (`auto-memories.ts`)

Central coordinator. Manages the lifecycle of memory detection, storage,
injection, and maintenance.

```typescript
interface AutoMemoriesConfig {
  /** Enable auto-memories system */
  enabled: boolean;
  /** User home directory for user-scope memories */
  userHome: string;
  /** Project root directory for project/local-scope memories */
  projectRoot: string;
  /** Maximum lines per MEMORY.md file */
  maxLinesPerFile: number;        // Default: 200
  /** Token budget for memory injection */
  injectionTokenBudget: number;   // Default: 2000
  /** Minimum confidence to auto-store */
  minConfidence: number;          // Default: 0.6
  /** Enable memory decay checking */
  decayEnabled: boolean;          // Default: true
  /** Days before marking entry as stale */
  decayDays: number;              // Default: 90
  /** Enable topic overflow to memory/*.md */
  overflowEnabled: boolean;       // Default: true
}

class AutoMemories {
  constructor(config: AutoMemoriesConfig);

  /** Load and merge all memory scopes */
  loadAll(): Promise<MergedMemories>;

  /** Format memories for system prompt injection */
  formatForSystemPrompt(memories: MergedMemories): string;

  /** Process a conversation turn for learning */
  processTurn(turn: ConversationTurn): Promise<DetectedMemory[]>;

  /** Store a detected memory */
  storeMemory(memory: DetectedMemory): Promise<void>;

  /** Run consolidation on a scope */
  consolidate(scope: MemoryScope): Promise<ConsolidationResult>;

  /** Run decay check on all scopes */
  decayCheck(): Promise<DecayResult>;

  /** Search topic overflow files */
  searchOverflow(query: string): Promise<MemorySearchResult[]>;
}
```

### 8.2 MemoryFileManager (`memory-file-manager.ts`)

Handles low-level MEMORY.md file operations: reading, writing, parsing,
section management, line counting, and overflow management.

```typescript
interface MemoryFileManagerConfig {
  /** Maximum lines per file */
  maxLines: number;
  /** Directory for topic overflow files */
  overflowDir: string;
}

class MemoryFileManager {
  constructor(config: MemoryFileManagerConfig);

  /** Read and parse a MEMORY.md file */
  read(filePath: string): Promise<ParsedMemoryFile>;

  /** Write a ParsedMemoryFile back to disk */
  write(filePath: string, file: ParsedMemoryFile): Promise<void>;

  /** Append an entry to a section */
  append(filePath: string, section: string, entry: string): Promise<void>;

  /** Remove an entry from a section */
  remove(filePath: string, section: string, entry: string): Promise<void>;

  /** Update an existing entry */
  update(
    filePath: string,
    section: string,
    oldEntry: string,
    newEntry: string
  ): Promise<void>;

  /** Check if file exceeds line limit */
  needsConsolidation(filePath: string): Promise<boolean>;

  /** Consolidate large sections into overflow files */
  consolidate(filePath: string): Promise<ConsolidationResult>;

  /** Count lines in file */
  lineCount(filePath: string): Promise<number>;

  /** Ensure parent directories exist */
  ensureDir(filePath: string): Promise<void>;
}

interface ParsedMemoryFile {
  /** File path */
  path: string;
  /** Raw content */
  raw: string;
  /** Parsed sections */
  sections: MemorySection[];
  /** Total line count */
  lineCount: number;
}

interface MemorySection {
  /** Section header (e.g., "User Preferences") */
  title: string;
  /** Entries in this section */
  entries: MemoryEntry[];
  /** Start line in file */
  startLine: number;
  /** End line in file */
  endLine: number;
}

interface MemoryEntry {
  /** Entry text (the bullet point content) */
  text: string;
  /** Sub-entries (indented bullets) */
  children: string[];
  /** Line number in file */
  line: number;
  /** Optional metadata (date added, confidence, etc.) */
  metadata?: EntryMetadata;
}
```

### 8.3 LearningDetector (`learning-detector.ts`)

Analyzes conversation turns to detect learnable moments.

```typescript
interface LearningDetectorConfig {
  /** Minimum confidence to consider a detection */
  minConfidence: number;
  /** Maximum detections per turn */
  maxDetectionsPerTurn: number;   // Default: 3
  /** Track correction history for repetition detection */
  correctionHistorySize: number;  // Default: 50
}

class LearningDetector {
  constructor(config: LearningDetectorConfig);

  /** Analyze a conversation turn for learnable moments */
  analyze(turn: ConversationTurn): DetectedMemory[];

  /** Detect repeated corrections */
  detectCorrections(turn: ConversationTurn): DetectedMemory[];

  /** Detect error-fix patterns */
  detectErrorPatterns(turn: ConversationTurn): DetectedMemory[];

  /** Detect user preference statements */
  detectPreferences(turn: ConversationTurn): DetectedMemory[];

  /** Detect project-specific patterns */
  detectProjectPatterns(turn: ConversationTurn): DetectedMemory[];

  /** Detect tool usage patterns */
  detectToolPatterns(turn: ConversationTurn): DetectedMemory[];

  /** Score detection confidence */
  scoreConfidence(detection: RawDetection): number;

  /** Deduplicate against existing memories */
  deduplicate(
    detections: DetectedMemory[],
    existing: ParsedMemoryFile
  ): DetectedMemory[];

  /** Reset correction history (e.g., between sessions) */
  resetHistory(): void;
}

interface ConversationTurn {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Tool calls and results in this turn */
  toolCalls?: ToolCallRecord[];
  /** Timestamp */
  timestamp: Date;
  /** Session ID */
  sessionId: string;
}

interface DetectedMemory {
  /** The memory entry text */
  text: string;
  /** Which section this belongs to */
  section: MemorySectionType;
  /** Target scope */
  scope: MemoryScope;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Detection category */
  category: DetectionCategory;
  /** Source turn that triggered detection */
  sourceTurn: ConversationTurn;
  /** Optional sub-entries */
  children?: string[];
}

type MemorySectionType =
  | 'User Preferences'
  | 'Project Conventions'
  | 'Error Patterns'
  | 'Tool Usage'
  | 'Architecture Decisions'
  | 'Corrections'
  | 'Workflow'
  | 'People & Roles'
  | 'Links';

type MemoryScope = 'user' | 'project' | 'local';

type DetectionCategory =
  | 'repeated-correction'
  | 'error-pattern'
  | 'user-preference'
  | 'project-pattern'
  | 'tool-usage';
```

---

## 9. Configuration

```yaml
# wundr.yaml or .wundr/config.yaml
memory:
  auto:
    enabled: true
    minConfidence: 0.6
    maxLinesPerFile: 200
    injectionTokenBudget: 2000
    decay:
      enabled: true
      days: 90
    overflow:
      enabled: true
    scopes:
      user: true
      project: true
      local: true
```

---

## 10. Privacy and Security

### 10.1 Scope Isolation

- User memories are stored in the user's home directory
- Project memories are stored in the project directory (can be .gitignored)
- Local memories are always in `.wundr/local/` which is .gitignored

### 10.2 Sensitive Content

The learning detector does NOT store:
- API keys, tokens, or secrets
- Passwords or credentials
- Personal contact information (unless explicitly requested)
- File contents (only patterns and preferences)

A redaction filter runs on all detected memories before storage.

### 10.3 User Control

- Users can edit MEMORY.md files directly
- Users can disable auto-memories entirely
- Users can disable specific scopes
- Users can set minimum confidence higher to reduce auto-storage
- All memories are transparent (plain markdown)

---

## 11. Interaction with Existing Systems

### 11.1 @wundr/agent-memory (MemGPT Tiers)

The auto-memories system is complementary, not a replacement:

| Feature | agent-memory | auto-memories |
|---------|-------------|---------------|
| Storage | In-memory (volatile) | Markdown files (persistent) |
| Scope | Single session | Cross-session |
| Search | Embedding-based | Direct injection + keyword |
| Content | Raw conversation data | Distilled learnings |
| Decay | Forgetting curve | Time-based staleness |
| User edit | Not possible | Edit markdown directly |

### 11.2 Wave 2 Analysis 07 (SQLite Backend)

The SQLite backend (from Analysis 07) can index MEMORY.md files:
- Main MEMORY.md files are injected directly into the system prompt
- Topic overflow files (`memory/*.md`) are indexed in SQLite
- The existing `memory_search` tool works with both systems

### 11.3 OpenClaw Compatibility

The file layout (MEMORY.md + memory/*.md) is intentionally compatible
with OpenClaw's memory model. Projects that use both Wundr and OpenClaw
can share the same memory files.

---

## 12. Implementation Plan

### Phase 1: Core Infrastructure

Files:
- `memory-file-manager.ts` -- Parse, read, write, append MEMORY.md files
- `auto-memories.ts` -- Scope resolution, merging, system prompt injection

### Phase 2: Learning Detection

Files:
- `learning-detector.ts` -- Analyze turns, detect patterns, score confidence

### Phase 3: Integration

- Wire into session lifecycle (session start -> inject, session end -> detect)
- Wire into orchestrator-daemon's system prompt builder
- Add CLI commands for memory management

### Phase 4: Consolidation and Decay

- Topic overflow to memory/*.md
- Periodic staleness checking
- Entry merging for duplicate reduction

---

## 13. Files Produced

| File | Purpose |
|------|---------|
| `auto-memories.ts` | Central coordinator: scope management, injection, lifecycle |
| `memory-file-manager.ts` | Low-level MEMORY.md file operations |
| `learning-detector.ts` | Conversation analysis for learnable moment detection |
