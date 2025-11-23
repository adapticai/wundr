# Claude Agent Platform Architecture & Integration Whitepaper

Version 0.1

# **1\. Introduction**

This document defines a target architecture and integration approach for an internal AI assistance
platform built on top of Anthropic’s Claude Agent SDK, Claude Code feature set, and MCP (Model
Context Protocol) integrations.

The primary consumers of this whitepaper are software engineers, SREs, solution architects, security
engineers, and platform teams. The intent is to give enough detail that teams can translate this
into an implementation roadmap, epics, and detailed backlog items without having to re‑discover the
major design decisions.

## **1.1 Scope and non‑goals**

In scope:

\- Architecture and integration patterns for building multi‑agent assistants using the Claude Agent
SDK (TypeScript and Python).  
\- Use of Claude Code’s file‑system conventions (agents, skills, commands, hooks, CLAUDE.md) in a
shared platform context.  
\- Integration with remote and local MCP servers, including Anthropic’s MCP connector in the
Messages API.  
\- Prompting, safety, evaluation, and operational concerns that must be designed in from day one.

Out of scope:

\- Detailed backlog / Jira tickets.  
\- UI/UX design beyond high‑level flows.  
\- Detailed networking / firewall rules for specific environments.

# **2\. Business and technical objectives**

The platform’s purpose is to enable a growing catalogue of task‑specialised AI agents that help
engineers and business users work against our codebases, documentation, and systems in a safe and
governable way.

Representative goals:

\- Increase engineering productivity via coding agents (SRE diagnosis helpers, security review bots,
PR reviewers, on‑call assistants).  
\- Improve business workflows via domain agents (legal contract reviewers, finance analysts, support
troubleshooters, content assistants).  
\- Provide a single, auditable runtime for agents that call internal tools and external MCP servers
without each product team re‑implementing core safety and orchestration logic.  
\- Make it easy for product teams to add new agents via configuration (CLAUDE.md, SKILL.md, agent
definitions) rather than bespoke microservices each time.

## **2.1 Requirements overview**

Functional requirements (high level):

\- Multi‑agent support: platform must support multiple specialised agents with clear routing and
permission boundaries.  
\- Tool‑rich execution: agents can invoke local tools (file operations, search, bash execution,
notebooks) and remote MCP tools (DBs, APIs, ticketing systems, etc.).  
\- Project‑aware context: agents should understand per‑repository/project instructions and
conventions via CLAUDE.md and related settings.  
\- Mixed integration modes: support both direct use of the Claude Agent SDK (for deep IDE/CLI style
experiences) and Messages API \+ MCP connector for HTTP‑only integrations.

Non‑functional requirements (high level):

\- Safety and compliance: strong guardrails, least‑privilege tooling, clear logging and audit
trails.  
\- Performance and latency: responsive interactive experiences, with streaming where appropriate,
and controlled thinking budgets.  
\- Multitenancy and isolation: clear separation between logical tenants (teams, products) for tools,
context, and stored transcripts.  
\- Observability: end‑to‑end tracing of tool calls, token usage, and refusal events.

# **3\. Target solution architecture (high level)**

At a high level, we propose a layered architecture:

\- Interaction channels: IDE extensions, CLI tools, web UI, chat platforms (Slack/Teams), and batch
or GitHub Actions style workflows.  
\- Agent runtime services: services written in TypeScript or Python that embed the Claude Agent SDK
and offer a stable internal API for “run agent X with input Y”. Some integrations may instead call
the Messages API directly with MCP connectors.  
\- Tooling and MCP layer: configuration and infrastructure for local tools (Bash, Read, Write, Grep,
NotebookEdit, WebSearch, etc.) plus a curated catalogue of MCP servers (both SDK‑local and remote
via \`mcp_servers\` in the Messages API).  
\- Data & context layer: repositories, documentation stores, vector search, and project
configuration (CLAUDE.md, .claude directory) that feed context into agents.  
\- Governance & observability: logging, metrics, evaluations, and safety controls glued together via
hooks, permission functions, and external monitoring systems.

## **3.1 Key design choices**

Key architectural decisions:

\- Prefer the TypeScript Agent SDK for Node.js‑based runtimes (CLI, web backends) and Python SDK for
data and ML workflows.  
\- Standardise the \`.claude/\` project structure for repo‑level agents, skills, commands, hooks,
and CLAUDE.md memory, and ensure agent runtimes mount this correctly.  
\- Use SDK options and filesystem settings selectively via the \`settingSources\` option so that we
can deterministically control which settings are loaded in production vs local developer
environments.  
\- Treat MCP as the primary abstraction for connecting to internal services; where possible, wrap
legacy APIs and databases behind MCP servers rather than building bespoke tool glue repeatedly.

# **4\. Claude Agent SDK integration strategy**

The Claude Agent SDK provides the core harness for building production agents. We will standardise
its use as the primary way to run agent sessions in long‑lived services (or CLIs) where we want full
control over context, tools, and permissions.

## **4.1 SDK usage patterns**

For TypeScript runtimes we will:

\- Install \`@anthropic-ai/claude-agent-sdk\` and expose a thin wrapper around the \`query()\`
function.  
\- Default to streaming mode for interactive UIs and single‑mode for background workers.  
\- Surface SDK messages (\`SDKAssistantMessage\`, \`SDKResultMessage\`, etc.) into our logging and
analytics stack so we can observe tool usage and token consumption.

Our wrapper will standardise options such as:

\- \`model\` selection per agent class (e.g. haiku for low‑latency, sonnet for general, opus for
heavy reasoning).  
\- \`settingSources\` for loading project‑level settings when working against repos, and none for
“pure SDK” agents.  
\- \`permissionMode\` default per agent (e.g. \`plan\` for planning‑only agents, \`acceptEdits\` for
low‑risk file edits, \`default\` for interactive, \`bypassPermissions\` for tightly controlled batch
processes).  
\- Hooks (\`hooks\` option) wired into our observability pipeline to receive \`SessionStart\`,
\`SessionEnd\`, \`PreToolUse\`, \`PostToolUse\`, and \`PreCompact\` notifications.

Python runtimes will follow the same conceptual model, but via the Python Agent SDK.

## **4.2 File‑based configuration and reuse of Claude Code features**

We will reuse the same filesystem conventions that power Claude Code so that developers can define
behaviour declaratively:

\- Subagents: stored as Markdown in \`./.claude/agents/\`. Each file describes a specialised agent
(e.g. \`sre_agent.md\`, \`security_reviewer.md\`) that can be launched via the \`Task\` tool.  
\- Skills: \`./.claude/skills/SKILL.md\` files providing reusable instructions or routines (for
example, “company secure coding checklist”).  
\- Commands: Markdown files under \`./.claude/commands/\` that behave like slash commands in the IDE
or CLI environment.  
\- Hooks: JSON configuration in \`.claude/settings.json\` that describes shell commands or HTTP
hooks that should run on certain events (e.g. \`PostToolUse\` triggers metrics shipping).  
\- Memory: \`CLAUDE.md\` at repo or user level providing persistent project context such as
architecture decisions, domain concepts, and local terminology.

Agent runtimes will opt into these settings by providing \`settingSources: \['project'\]\` (and
\`systemPrompt\` with the Claude Code preset where appropriate) so that CLAUDE.md and other project
instructions are honoured.

## **4.3 Authentication and provider routing**

For most platform scenarios we will authenticate directly with the Anthropic API key via environment
variables (\`ANTHROPIC_API_KEY\`) managed by our secrets store.

Where Amazon Bedrock or Google Vertex AI are mandated, we can enable the respective environment
flags (\`CLAUDE_CODE_USE_BEDROCK\`, \`CLAUDE_CODE_USE_VERTEX\`) and rely on their credential chains.
However, we will avoid mixing authentication modes within the same service to keep audit trails
clear.

We will not expose Claude.ai‑style rate limits to third‑party developers; instead we will keep rate
limiting and quotas in our own gateway layer.

# **5\. Agent taxonomy and orchestration**

The platform will adopt a simple, extensible taxonomy of agent types, with each agent represented
either by code‑level \`AgentDefinition\` objects or by file‑based subagent definitions.

## **5.1 Core agent types**

Initial core agent categories:

\- Coding agents  
 \- SRE incident agents that triage logs, metrics, and dashboards and propose runbooks.  
 \- Security review agents that scan code for vulnerabilities and cross‑check against policies.  
 \- On‑call assistants that summarise alerts and past incidents and help build remediation steps.  
 \- Code review agents that read PR diffs and enforce style and best practices.  
\- Business agents  
 \- Legal assistants that highlight risk in contracts and compare against policy baselines.  
 \- Finance analysts that interpret reports and produce structured summaries for FP\&A.  
 \- Support assistants that troubleshoot customer issues across logs, docs, and case history.  
 \- Content assistants that draft and refine marketing copy within brand guidelines.

Each agent provides a stable contract: input (structured task description, optional
attachments/context), tools it may use, and structured outputs where needed (e.g. JSON evaluation of
a PR or risk report).

## **5.2 Subagents and delegation patterns**

We will encourage a “hub‑and‑spoke” pattern where a coordinator agent delegates to subagents using
the \`Task\` tool:

\- The calling agent provides a short description, the detailed prompt, and the subagent type.  
\- The subagent executes a multi‑turn plan using its own tools and configuration.  
\- The \`Task\` tool returns a result payload with usage and cost, which is logged centrally.

This allows, for example, a “PR reviewer” coordinator to call a “security reviewer” subagent and a
“performance reviewer” subagent, then synthesise a final review.

Where possible, subagents will be defined as \`AgentDefinition\` objects with explicit \`tools\`
lists, ensuring clear tool boundaries between responsibilities.

## **5.3 Session and context management**

We will rely on the Agent SDK’s automatic context compaction and session IDs to maintain
conversational continuity while controlling context growth:

\- Each user interaction receives or references a \`session_id\` that maps to our internal
conversation identifier.  
\- The SDK emits \`SDKCompactBoundaryMessage\` events when compaction occurs; we log these to
understand how much history is being preserved.  
\- For long‑running sessions (e.g. incident war rooms), we may periodically snapshot important
context into durable memory (e.g. a runbook file or incident summary) and then allow compaction to
drop low‑value history.

Agent‑level options such as \`maxTurns\`, \`maxThinkingTokens\`, and \`continue\` will be tuned per
agent type to balance quality vs latency and cost.

# **6\. Tools, MCP, and external integrations**

Tools are how agents act on the world. We will standardise on the Claude Agent SDK’s built‑in tools
for local operations and MCP for remote resources and systems.

## **6.1 Built‑in tool usage patterns**

Core built‑in tools we expect to use heavily include:

\- \`Read\`, \`Write\`, \`Edit\`, \`Glob\`, and \`Grep\` for code and file operations.  
\- \`Bash\` / \`BashOutput\` / \`KillBash\` for shell commands during diagnostics or build/test runs
(with strict directory and command restrictions).  
\- \`NotebookEdit\` for Jupyter notebook modifications in data science workflows.  
\- \`WebSearch\` and \`WebFetch\` for carefully constrained external research tasks.  
\- \`TodoWrite\` and \`ExitPlanMode\` to support explicit planning, user approval, and task
tracking.

For each agent, we will configure \`allowedTools\` / \`disallowedTools\` and, where necessary, a
custom \`canUseTool\` function to gate high‑risk tools (e.g. Bash, Write, NotebookEdit) behind
additional logic and explanations.

## **6.2 MCP servers via the Agent SDK**

For services that we want tightly integrated with SDK‑driven agents (e.g. internal code search,
ticketing systems, runbook repositories), we will expose them as MCP servers and connect them
through the SDK’s \`mcpServers\` option.

Patterns:

\- STDIO servers for tools that run alongside the agent runtime (e.g. local code indexer, on‑host
diagnostic tools).  
\- SSE or HTTP servers for remote services (e.g. microservices that wrap proprietary APIs or
databases).  
\- SDK‑embedded MCP servers created via \`createSdkMcpServer()\` for tools implemented directly
within the agent service process.

Each MCP server configuration will specify the available tools and any headers/env required, with
strict separation of concerns per server.

## **6.3 MCP connector via the Messages API**

For integrations where we do not need the full Agent SDK harness (e.g. simple HTTP APIs or stateless
web chat experiences), we will use the Anthropic Messages API and its MCP connector:

\- Each request includes an \`mcp_servers\` array describing one or more remote MCP servers, each
with name, URL, optional tool configuration, and optional OAuth bearer token.  
\- Tools exposed by those servers become available to the model as \`mcp_tool_use\` /
\`mcp_tool_result\` blocks in responses.

This pattern is ideal for lightweight, HTTP‑only services or where we want to minimise SDK
dependencies. For long‑running, tool‑heavy sessions (like coding agents), the Agent SDK remains
preferred.

## **6.4 Permissions and governance for tools and MCP**

Security and governance controls will be implemented at multiple layers:

\- Agent SDK permissions: \`allowedTools\`, \`disallowedTools\`, and \`permissionMode\` govern what
an agent may do by default.  
\- Custom \`canUseTool\` functions: provide dynamic decisions, including explanations, updated
rules, and session‑level or settings‑level permission updates.  
\- Settings destinations: permission updates may target user, project, local, or session scopes,
which we will map onto organisational policies.  
\- Authentication: MCP servers that expose sensitive data will require OAuth tokens or other
credentials obtained via separate flows; these tokens are injected into MCP configuration, not into
prompts.

We will capture permission denials (\`SDKPermissionDenial\`) centrally for audit and as signals for
refining default policies.

# **7\. Prompting, templates, and memory strategy**

Prompting quality is critical to getting reliable, controllable behaviour out of agents. We will
standardise a small set of patterns that we encourage all agents to follow.

## **7.1 System prompts and roles**

Every agent will define a clear role and responsibility via its system prompt, describing:

\- The agent’s domain expertise and authority boundaries.  
\- The target user persona (e.g. senior engineer, paralegal, FP\&A analyst).  
\- The safety and escalation rules (when to stop, when to ask for clarification, when to refuse).

We will keep system prompts primarily in CLAUDE.md files or agent definition files so that they are
version‑controlled and reviewable.

Role prompting will be preferred over trying to encode all behaviour in ad‑hoc user instructions;
the user messages will focus on task‑specific input.

## **7.2 Prompt templates and variables**

For recurring tasks (code review, incident summaries, contract analysis), we will use prompt
templates with explicit variables to separate stable instructions from dynamic content.

Guidelines:

\- Use clear placeholders such as \`{{DIFF}}\`, \`{{LOG\_SNIPPET}}\`, \`{{CONTRACT\_TEXT}}\`.  
\- Wrap variable content in XML or similar tags inside prompts (e.g.
\`\<contract\>{{CONTRACT\_TEXT}}\</contract\>\`) to help the model structurally separate context
from instructions.  
\- Maintain templates in code or configuration, and test them using eval suites (see section 9).

Where we need strict JSON outputs, we will either use structured output features or prefill
responses with \`{\` and detailed format examples to increase reliability, while still validating
outputs downstream.

## **7.3 Examples, chain‑of‑thought, and structured thinking**

Agents will leverage prompt engineering best practices:

\- Provide 3–5 representative examples (multishot) for tasks with complex or domain‑specific
outputs.  
\- Use structured thinking via tags like \`\<thinking\>\` and \`\<answer\>\` in prompts where we
want the model to work step‑by‑step but keep those steps separable from the final answer.  
\- Reserve extended thinking budgets (where we enable the model’s longer internal reasoning) for
high‑impact tasks such as root‑cause analysis, complex code migrations, or strategic
recommendations.

When not using extended thinking, we will still occasionally ask the model to “think step‑by‑step”
or to verify results with small checklists (e.g. verifying calculations or test cases) to reduce
errors.

## **7.4 Long‑context and memory usage**

For long‑context tasks (e.g. large codebases, long contracts, multi‑document analysis):

\- Place large document content near the top of the prompt and questions toward the end, segmented
with XML tags and metadata.  
\- Ask the model first to extract and quote relevant passages inside \`\<quotes\>\` tags, then
reason based only on those quotes.  
\- Use CLAUDE.md and project settings to encode stable, long‑lived knowledge (architecture
decisions, naming conventions) instead of re‑sending them in every prompt.

We will monitor context usage via SDK messages and adjust strategies (e.g. retrieval vs raw context
injection) to keep latency and cost acceptable.

# **8\. Safety, security, and governance**

Safety and governance are first‑class requirements. We will pair Anthropic’s built‑in safety
features with our own guardrails across the entire stack.

## **8.1 Content safety and refusals**

We will rely on the models’ built‑in safety training, complemented by our own filters where
appropriate. For streaming scenarios, we will watch for \`stop_reason \= 'refusal'\` and treat it as
a structured event; our UX will show a friendly refusal message and our services will reset any
unsafe conversation context before continuing.

We will instrument how often refusals occur per agent and task type and use this to refine prompts,
tools, and training for internal users.

## **8.2 Jailbreak and prompt injection mitigation**

To limit jailbreaks and prompt injections:

\- We will treat all user‑supplied text (including tool output and retrieved documents) as untrusted
data. System and developer prompts will clearly state that instructions found in user content must
not override safety rules.  
\- Sensitive secrets and policies will not be embedded directly in prompts when avoidable; instead,
tools and MCP servers enforce access control out‑of‑band.  
\- Input and output screens (potentially LLM‑driven) will detect and block obviously unsafe patterns
before they reach the model or downstream systems.  
\- For high‑risk workflows (e.g. production deployments, destructive operations), we will require
“plan mode” behaviour: the agent produces a plan via \`ExitPlanMode\`, and a human explicitly
approves before any real tools run.

## **8.3 Data protection and prompt leak reduction**

We will reduce the risk of prompt and data leaks by:

\- Avoiding unnecessary inclusion of proprietary formulas, credentials, or internal policies in
prompts. Where needed, we encode them in tools or MCP servers instead.  
\- Using clear instructions that the model should never disclose internal prompts or hidden
configuration and that, if asked, it should respond with generic statements (e.g. “I am following
internal guidelines that I cannot disclose.”).  
\- Post‑processing outputs to detect accidental disclosure of secrets or sensitive patterns using
separate classifiers or rules.

For regulated data (e.g. PHI, PCI, or other sensitive information), we will apply domain‑specific
redaction and logging policies around both prompts and outputs.

# **9\. Evaluation, testing, and observability**

We will treat LLM behaviour as something that must be empirically tested and monitored, not assumed.
This includes offline evaluations, online experiments, and continuous observability.

## **9.1 Success criteria and eval design**

For each agent and major workflow we will define explicit success criteria, for example:

\- PR reviewer: precision/recall against human‑labelled review comments, adherence to style and
security guidelines, latency, and developer satisfaction scores.  
\- SRE diagnostic agent: proportion of incidents where it suggests the final root cause,
time‑to‑first useful hint, and safety (no obviously harmful suggestions).  
\- Legal reviewer: accuracy of risk classifications vs legal team annotations and rate of missed
high‑risk issues.

We will construct test sets (held‑out prompts plus ground truth outputs or scoring rubrics) and use
code‑based or LLM‑based grading (with carefully designed rubrics) to measure performance over time.

## **9.2 Instrumentation and logging**

All SDK sessions will emit structured logs for:

\- Inputs and outputs (with appropriate redaction).  
\- Tool calls and results (including MCP tool invocations).  
\- Token usage and cost estimates from \`SDKResultMessage\` usage fields.  
\- Permission denials, refusals, and errors (e.g. \`error_max_turns\`, \`error_during_execution\`).

We will feed these into central observability (logging and metrics) and build dashboards by agent,
tool, project, and user segment, enabling capacity planning, troubleshooting, and security review.

## **9.3 Continuous improvement loop**

We will operationalise a feedback loop:

\- Collect user thumbs‑up/down and free‑text feedback, tied back to session IDs and prompts.  
\- Periodically sample conversations for manual review by domain experts.  
\- Use failure cases to update prompts, add or refine tools, adjust permission rules, and improve
eval test sets.  
\- When model upgrades occur, run regression evals across our agent catalogue before promotion.

# **10\. Implementation roadmap**

This section outlines a pragmatic multi‑phase approach to implementing the platform. Engineering and
product teams can refine these into concrete epics and backlog items.

## **10.1 Phase 0 – Foundations (2–4 weeks)**

Objectives:

\- Stand up core agent runtime services (TypeScript SDK for general agents, Python SDK for
data‑centric ones).  
\- Implement a minimal security baseline (API key management, environment separation, logging).  
\- Wire up one or two local MCP servers that wrap non‑sensitive internal services (e.g. code search,
documentation search).

Key deliverables:

\- Shared library/wrapper around the Claude Agent SDK with opinionated defaults.  
\- Example “hello world” coding agent that can read and explain code using \`Read\` and \`Grep\`.  
\- Observability hooks for sessions, tool usage, and basic metrics.

## **10.2 Phase 1 – Pilot agents (4–8 weeks)**

Objectives:

\- Implement 2–3 high‑value pilot agents (e.g. PR reviewer, SRE helper, legal contract
summariser).  
\- Standardise project configuration via \`.claude/\` directories and CLAUDE.md for at least one
repo per domain.  
\- Introduce a small catalogue of remote MCP servers via the Messages API where appropriate.

Key deliverables:

\- Production‑ready pilot agents integrated into one or more channels (e.g. GitHub, Slack, internal
web UI).  
\- Initial evaluation suites and baseline metrics for each pilot.  
\- Documented patterns for teams to add new agents.

## **10.3 Phase 2 – Hardening and compliance (4–8 weeks)**

Objectives:

\- Strengthen safety, security, and compliance across the stack.  
\- Expand the tool and MCP catalogue while enforcing least‑privilege and governance controls.

Key deliverables:

\- Custom \`canUseTool\` logic and permission rules per agent category.  
\- Enhanced logging, redaction, and audit reports for safety and security review.  
\- Hardened MCP servers for sensitive systems with proper authentication, scoping, and monitoring.

## **10.4 Phase 3 – Scale‑out and advanced capabilities**

Objectives:

\- Scale the platform across more teams and use cases, with self‑service onboarding for new
agents.  
\- Introduce more advanced capabilities (extended thinking for complex tasks, more sophisticated
evals, and automated prompt optimisation).

Key deliverables:

\- Self‑service documentation and templates for creating new agents, skills, and MCP integrations.  
\- Organisation‑wide evaluation dashboards for tracking agent quality and usage.  
\- Playbooks for model upgrades, incident response for AI‑related issues, and ongoing governance.

# **Appendix A – Example TypeScript agent wrapper**

Below is an illustrative (non‑production) sketch of how a TypeScript service might wrap the Agent
SDK’s \`query()\` function in our platform.

\- Selects a model per agent.  
\- Loads project settings where required.  
\- Applies a default permission mode.  
\- Enables streaming or single mode depending on the caller.

Real implementations should add full error handling, observability, and configuration loading.
