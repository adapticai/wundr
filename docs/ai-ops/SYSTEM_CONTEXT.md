# System Context

## Purpose

This document explains what Wundr is, who it serves, and what problems it solves. Without this
context, AI agents constantly misinterpret business logic and make incorrect assumptions about the
purpose of code.

## Product Overview

Wundr is an AI-powered CLI-based coding agents orchestrator built by Adaptic.ai. It transforms
monolithic chaos into architectural elegance with AI-powered refactoring at scale.

The platform provides:

- Multi-agent AI orchestration (CrewAI, LangGraph, AutoGen patterns)
- Codebase analysis and intelligent refactoring
- Code quality governance and drift detection
- Prompt security and token budget management
- MCP (Model Context Protocol) server infrastructure
- Monorepo management tooling
- A web/desktop/mobile platform (Neolith) for organizational structure generation

## Core Capabilities

### CLI Orchestration

- `wundr` CLI for project creation, analysis, and agent management
- Computer setup automation for developer environments
- Project scaffolding from templates

### AI Agent Framework

- Multiple orchestration patterns (CrewAI, LangGraph, AutoGen)
- Agent delegation with bounded scope and memory
- Agent evaluation and observability
- Token budget tracking and optimization

### Code Quality

- Static analysis via ts-morph AST parsing
- Governance rules enforcement
- Code quality drift detection and baselines
- Dependency analysis and circular dependency detection

### Security

- Prompt injection detection and defense
- Secure credential management
- Risk assessment (risk-twin)

### Neolith Platform

- AI-powered organizational structure generation for hedge funds
- Web application (Next.js), desktop (Electron), mobile (React Native)
- Database-backed workspace and organization management
- File processing and document analysis

## Target Users

### Developers / Engineering Teams

Can:

- Use the CLI to analyze and refactor codebases
- Orchestrate AI agents for complex development tasks
- Set up governed development environments
- Manage monorepo dependencies and quality gates

### Platform Users (Neolith)

Can:

- Create and manage workspaces
- Generate organizational structures using AI
- Process and analyze documents
- Collaborate within organizations

### AI Agent Developers

Can:

- Build custom agent orchestration workflows
- Define prompt templates and structured outputs
- Integrate MCP tools into development workflows
- Monitor and evaluate agent performance

## Technology Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js >= 18
- **Package Manager**: pnpm >= 9
- **Build System**: Turborepo
- **Frontend**: Next.js, React, Tailwind CSS
- **Desktop**: Electron
- **Mobile**: React Native
- **Database**: PostgreSQL via Prisma
- **Testing**: Jest, Vitest, Playwright
- **CI/CD**: GitHub Actions
- **Deployment**: Railway (backend), Netlify (frontend)
- **AI Integration**: Claude API, MCP protocol
