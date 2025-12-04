import type { EntityType } from './types';

export const ENTITY_GREETINGS: Record<EntityType, string> = {
  workspace: `Hi! I'm here to help you create a new workspace. Let's start with the basics.

What would you like to name your workspace? And can you tell me a bit about what it's for?`,

  orchestrator: `Hi! Let's create a new Orchestrator (AI agent) for your workspace.

Orchestrators are autonomous agents that handle specific roles. For example:
- **Customer Support Lead** - Handles inquiries and manages support tickets
- **Research Analyst** - Gathers and analyzes information
- **Project Manager** - Coordinates tasks and team communication

What kind of agent would you like to create?`,

  'session-manager': `Hi! Let's create a new Session Manager for your workspace.

Session Managers handle specific contexts or channels, monitoring conversations and coordinating responses. They typically:
- **Monitor** specific channels (Slack, email, support tickets)
- **Handle** conversations within their domain
- **Escalate** complex issues to Orchestrators

What kind of conversations should this Session Manager handle?`,

  workflow: `Hi! Let's create a new Workflow for your workspace.

Workflows automate repetitive tasks and processes. Tell me:
- What should trigger this workflow?
- What actions should it perform?

What would you like to automate?`,

  channel: `Hi! Let's create a new Channel.

Channels are communication spaces where conversations happen. What kind of channel do you need? (e.g., public, private, team-specific)`,

  subagent: `Hi! Let's create a new Subagent.

Subagents are specialized workers that handle specific tasks for Orchestrators. What capability should this subagent provide?`,
};

export function getGreeting(entityType: EntityType, context?: string): string {
  if (context) {
    return `${ENTITY_GREETINGS[entityType]}\n\n${context}`;
  }
  return ENTITY_GREETINGS[entityType];
}
