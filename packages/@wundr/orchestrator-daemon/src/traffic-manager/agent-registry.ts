import EventEmitter from 'eventemitter3';
import type {
  AgentCapabilityProfile,
  AgentSeniority,
  AgentStatus,
} from './types.js';

const SENIORITY_RANK: Record<AgentSeniority, number> = {
  ic: 1,
  manager: 2,
  director: 3,
  vp: 4,
  ceo: 5,
};

interface AgentRegistryEvents {
  'agent:registered': (agent: AgentCapabilityProfile) => void;
  'agent:unregistered': (agentId: string) => void;
  'agent:status-changed': (event: {
    agentId: string;
    oldStatus: AgentStatus;
    newStatus: AgentStatus;
  }) => void;
  'agent:load-changed': (event: {
    agentId: string;
    oldLoad: number;
    newLoad: number;
  }) => void;
}

export class AgentRegistry extends EventEmitter<AgentRegistryEvents> {
  private agents: Map<string, AgentCapabilityProfile> = new Map();

  registerAgent(agent: AgentCapabilityProfile): void {
    this.agents.set(agent.id, agent);
    this.emit('agent:registered', agent);
  }

  unregisterAgent(agentId: string): boolean {
    if (!this.agents.has(agentId)) return false;
    this.agents.delete(agentId);
    this.emit('agent:unregistered', agentId);
    return true;
  }

  getAgent(agentId: string): AgentCapabilityProfile | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): AgentCapabilityProfile[] {
    return Array.from(this.agents.values());
  }

  listAvailable(): AgentCapabilityProfile[] {
    return this.listAgents().filter(a => a.status === 'available');
  }

  findByDiscipline(discipline: string): AgentCapabilityProfile[] {
    return this.listAgents().filter(a => a.discipline === discipline);
  }

  findByCapability(capability: string): AgentCapabilityProfile[] {
    return this.listAgents().filter(a => a.capabilities.includes(capability));
  }

  findBySeniority(minSeniority: AgentSeniority): AgentCapabilityProfile[] {
    const minRank = SENIORITY_RANK[minSeniority];
    return this.listAgents().filter(
      a => SENIORITY_RANK[a.seniority] >= minRank
    );
  }

  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    const oldStatus = agent.status;
    this.agents.set(agentId, { ...agent, status });
    this.emit('agent:status-changed', {
      agentId,
      oldStatus,
      newStatus: status,
    });
  }

  updateLoad(agentId: string, load: number): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    const oldLoad = agent.currentLoad;
    this.agents.set(agentId, { ...agent, currentLoad: load });
    this.emit('agent:load-changed', { agentId, oldLoad, newLoad: load });
  }

  getLowestLoadAgent(filter?: {
    discipline?: string;
    minSeniority?: AgentSeniority;
  }): AgentCapabilityProfile | null {
    let candidates = this.listAvailable();

    if (filter?.discipline) {
      candidates = candidates.filter(a => a.discipline === filter.discipline);
    }

    if (filter?.minSeniority) {
      const minRank = SENIORITY_RANK[filter.minSeniority];
      candidates = candidates.filter(
        a => SENIORITY_RANK[a.seniority] >= minRank
      );
    }

    if (candidates.length === 0) return null;

    return candidates.reduce((lowest, agent) =>
      agent.currentLoad < lowest.currentLoad ? agent : lowest
    );
  }
}

export function createAgentRegistry(): AgentRegistry {
  return new AgentRegistry();
}
