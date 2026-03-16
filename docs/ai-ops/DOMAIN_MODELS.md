# Domain Models

## Purpose

This document defines the core data models and relationships in the Wundr platform. It prevents AI
agents from inventing incorrect relationships or misunderstanding how entities relate.

## Package Model

Represents a package within the Wundr monorepo.

Attributes:

- name (scoped, e.g. `@wundr/core`)
- version
- dependencies (internal + external)
- build configuration
- test configuration

Relationships:

- Package -> many dependent Packages
- Package -> one Workspace (pnpm workspace)

## Agent Model

Represents an AI agent within the orchestration framework.

Attributes:

- type (researcher, coder, tester, reviewer, planner)
- role description
- tool access
- memory context
- token budget

Relationships:

- Agent -> one Orchestrator
- Agent -> many Tasks
- Agent -> one Memory Store

## Orchestrator Model

Coordinates multiple agents working on a shared objective.

Types:

- CrewOrchestrator (crew-orchestrator)
- LangGraphOrchestrator (langgraph-orchestrator)
- AutoGenOrchestrator (autogen-orchestrator)

Relationships:

- Orchestrator -> many Agents
- Orchestrator -> one Task Graph
- Orchestrator -> one Token Budget

## Workspace (Neolith)

Represents a user's workspace in the Neolith platform.

Attributes:

- name
- slug
- owner
- organization
- settings

Relationships:

- Workspace -> one Organization
- Workspace -> many Members
- Workspace -> many Documents

## Organization (Neolith)

Represents an organizational entity.

Attributes:

- name
- type
- settings
- integration configuration

Relationships:

- Organization -> many Workspaces
- Organization -> many Members
- Organization -> many Integrations

## Governance Rule

Defines a code quality governance rule.

Attributes:

- rule name
- severity (error, warning, info)
- pattern
- enforcement mode

Relationships:

- GovernanceRule -> many Packages (scope)
- GovernanceRule -> one GovernanceReport

## Prompt Template

Defines a reusable prompt template.

Attributes:

- name
- template content (Handlebars)
- variables
- version

Relationships:

- PromptTemplate -> many Agents (consumers)
- PromptTemplate -> one StructuredOutput (optional)

## Structured Output

Defines a Zod schema for structured AI output.

Attributes:

- name
- schema (Zod definition)
- validation rules

Relationships:

- StructuredOutput -> many PromptTemplates
- StructuredOutput -> many Agents

## MCP Tool

Represents a Model Context Protocol tool.

Attributes:

- name
- description
- input schema
- handler

Relationships:

- MCPTool -> one MCPServer
- MCPTool -> one MCPRegistry
