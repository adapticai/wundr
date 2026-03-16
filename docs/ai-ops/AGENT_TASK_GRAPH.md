# Agent Task Graph

## Purpose

Describes how work flows through the Wundr system. Claude should understand these chains of
causality to avoid breaking downstream processes when modifying upstream code.

## CLI Command Execution Flow

```
User invokes `wundr <command>`
    |
Commander parses arguments
    |
CLI resolves target package
    |
Package handler executes
    |
Results formatted and displayed
```

## Codebase Analysis Flow

```
User runs `wundr analyze`
    |
Analysis Engine loads project
    |
AST parsing via ts-morph
    |
Pattern detection
    |
Dependency graph construction
    |
Quality metrics calculation
    |
Report generation
    |
Results displayed or written to file
```

## AI Agent Orchestration Flow

```
Task definition received
    |
Orchestrator selected (Crew/LangGraph/AutoGen)
    |
Agent topology determined
    |
Prompt templates resolved
    |
Token budget allocated
    |
Agents spawned with bounded scope
    |
Agents execute (parallel where independent)
    |
Agent memory updated
    |
Results aggregated
    |
Structured output validated (Zod)
    |
Observability metrics recorded
    |
Final output returned
```

## Prompt Security Pipeline

```
User prompt received
    |
Prompt security scan
    |
Injection pattern detection
    |
Sanitization applied
    |
Safe prompt forwarded to AI provider
    |
Response received
    |
Output validation (structured-output)
    |
Safe response returned
```

## Governance Enforcement Flow

```
Code change detected
    |
Governance rules loaded
    |
Drift detection against baseline
    |
Pattern standardization check
    |
Dependency analysis
    |
Test coverage comparison
    |
Governance report generated
    |
Violations flagged
```

## Neolith Workspace Flow

```
User authenticates
    |
Workspace context loaded
    |
Organization resolved
    |
Database queries (Prisma)
    |
UI rendered (Next.js server/client components)
    |
User interactions processed
    |
State persisted to database
```

## Organization Genesis Flow

```
User initiates org creation
    |
Genesis core processes input
    |
AI generates organizational structure
    |
Structure validated
    |
Workspace created
    |
Database records inserted
    |
User redirected to new workspace
```

## MCP Tool Execution Flow

```
MCP client sends tool call
    |
MCP server receives request
    |
Tool registry resolves handler
    |
Handler executes
    |
Result validated
    |
Response returned via MCP protocol
```

## Build Pipeline Flow

```
Developer runs `pnpm build`
    |
Turborepo resolves dependency graph
    |
Packages built in topological order
    |
Cache checked for each package
    |
Only changed packages rebuilt
    |
Build artifacts written to `dist/`
    |
TypeScript declarations generated
```

## Deployment Flow

```
Code pushed to master
    |
GitHub Actions CI triggered
    |
Lint + Typecheck + Test
    |
Build all packages
    |
Platform detects push (Railway/Netlify)
    |
Platform builds and deploys
    |
Health checks verify deployment
    |
Deployment complete
```
