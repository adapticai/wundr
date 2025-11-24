/**
 * @fileoverview Tree Formatter for Organization Hierarchy
 *
 * Provides ASCII tree visualization of organization structures, displaying
 * the hierarchical relationship between VPs, disciplines, and agents.
 *
 * @module @wundr/org-genesis/cli/formatters/tree-formatter
 * @version 1.0.0
 */

import type {
  OrganizationManifest,
  VPCharter,
  DisciplinePack,
  AgentDefinition,
} from '../../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Complete organization tree structure for rendering.
 *
 * Represents all components needed to render a full organization tree,
 * including the manifest, VPs, disciplines, and agents.
 *
 * @example
 * ```typescript
 * const orgTree: OrgTree = {
 *   manifest: myOrgManifest,
 *   vps: [engineeringVP, financeVP],
 *   disciplines: [frontendDiscipline, backendDiscipline],
 *   agents: [coderAgent, reviewerAgent],
 * };
 *
 * const treeOutput = formatAsTree(orgTree);
 * console.log(treeOutput);
 * ```
 */
export interface OrgTree {
  /** The organization manifest containing core metadata */
  manifest: OrganizationManifest;

  /** List of all VP charters in the organization */
  vps: VPCharter[];

  /** List of all discipline packs in the organization */
  disciplines: DisciplinePack[];

  /** List of all agent definitions in the organization */
  agents: AgentDefinition[];
}

/**
 * Options for customizing tree output.
 *
 * @property showIds - Whether to display entity IDs alongside names
 * @property showCounts - Whether to display child counts for containers
 * @property maxDepth - Maximum depth to render (undefined = unlimited)
 * @property useColors - Whether to use ANSI color codes (for terminal output)
 */
export interface TreeFormatOptions {
  /** Show entity IDs in parentheses after names */
  showIds?: boolean;

  /** Show child counts for VPs and disciplines */
  showCounts?: boolean;

  /** Maximum tree depth to render (default: unlimited) */
  maxDepth?: number;

  /** Use ANSI color codes for terminal output */
  useColors?: boolean;
}

// ============================================================================
// Tree Drawing Characters
// ============================================================================

/**
 * ASCII characters used for tree rendering.
 */
const TREE_CHARS = {
  /** Vertical line for continuing branches */
  PIPE: '|',
  /** Branch connector for non-last items */
  BRANCH: '|--',
  /** Branch connector for last items */
  LAST_BRANCH: '`--',
  /** Horizontal padding for alignment */
  PADDING: '   ',
  /** Vertical continuation padding */
  VERT_PADDING: '|  ',
} as const;

/**
 * Unicode box-drawing characters for prettier output.
 */
const UNICODE_TREE_CHARS = {
  PIPE: '\u2502',
  BRANCH: '\u251C\u2500\u2500',
  LAST_BRANCH: '\u2514\u2500\u2500',
  PADDING: '   ',
  VERT_PADDING: '\u2502  ',
} as const;

/**
 * Icons for different entity types.
 */
const ICONS = {
  ORG: '[ORG]',
  VP: '[VP]',
  DISCIPLINE: '[DISC]',
  AGENT: '[AGENT]',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncates a string to a maximum length with ellipsis.
 *
 * @param str - The string to truncate
 * @param maxLen - Maximum length including ellipsis
 * @returns Truncated string with ellipsis if needed
 *
 * @internal
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Builds a single tree line with proper indentation.
 *
 * @param prefix - The indentation prefix (pipes and spaces)
 * @param isLast - Whether this is the last item at this level
 * @param content - The content to display
 * @param useUnicode - Whether to use Unicode box characters
 * @returns Formatted tree line
 *
 * @internal
 */
function buildTreeLine(
  prefix: string,
  isLast: boolean,
  content: string,
  useUnicode: boolean = false
): string {
  const chars = useUnicode ? UNICODE_TREE_CHARS : TREE_CHARS;
  const branch = isLast ? chars.LAST_BRANCH : chars.BRANCH;
  return `${prefix}${branch} ${content}`;
}

/**
 * Calculates the next prefix for child items.
 *
 * @param currentPrefix - Current indentation prefix
 * @param isLast - Whether the parent was the last item
 * @param useUnicode - Whether to use Unicode box characters
 * @returns New prefix for child items
 *
 * @internal
 */
function getChildPrefix(
  currentPrefix: string,
  isLast: boolean,
  useUnicode: boolean = false
): string {
  const chars = useUnicode ? UNICODE_TREE_CHARS : TREE_CHARS;
  return currentPrefix + (isLast ? chars.PADDING : chars.VERT_PADDING);
}

/**
 * Formats a VP node for display.
 *
 * @param vp - The VP charter to format
 * @param options - Formatting options
 * @returns Formatted VP string
 *
 * @internal
 */
function formatVPNode(vp: VPCharter, options: TreeFormatOptions): string {
  const name = truncate(vp.identity.name, 40);
  const id = options.showIds ? ` (${vp.id})` : '';
  const count = options.showCounts ? ` [${vp.disciplineIds.length} disciplines]` : '';
  return `${ICONS.VP} ${name}${id}${count}`;
}

/**
 * Formats a discipline node for display.
 *
 * @param discipline - The discipline pack to format
 * @param options - Formatting options
 * @returns Formatted discipline string
 *
 * @internal
 */
function formatDisciplineNode(discipline: DisciplinePack, options: TreeFormatOptions): string {
  const name = truncate(discipline.name, 40);
  const id = options.showIds ? ` (${discipline.id})` : '';
  const count = options.showCounts ? ` [${discipline.agentIds.length} agents]` : '';
  return `${ICONS.DISCIPLINE} ${name}${id}${count}`;
}

/**
 * Formats an agent node for display.
 *
 * @param agent - The agent definition to format
 * @param options - Formatting options
 * @returns Formatted agent string
 *
 * @internal
 */
function formatAgentNode(agent: AgentDefinition, options: TreeFormatOptions): string {
  const name = truncate(agent.name, 40);
  const id = options.showIds ? ` (${agent.id})` : '';
  const model = `[${agent.model}]`;
  return `${ICONS.AGENT} ${name}${id} ${model}`;
}

// ============================================================================
// Main Formatter Functions
// ============================================================================

/**
 * Formats an organization structure as an ASCII tree.
 *
 * Creates a hierarchical ASCII representation of the organization showing:
 * - Organization root with name and industry
 * - VPs (Tier 1) as primary branches
 * - Disciplines (Tier 2) under their parent VPs
 * - Agents (Tier 3) under their parent disciplines
 *
 * @param org - The complete organization tree data
 * @param options - Optional formatting configuration
 * @returns Multi-line string representing the organization tree
 *
 * @example
 * ```typescript
 * const tree = formatAsTree({
 *   manifest: myOrg,
 *   vps: [engineeringVP],
 *   disciplines: [frontendDiscipline],
 *   agents: [reactDev, cssSpecialist],
 * });
 *
 * console.log(tree);
 * // Output:
 * // [ORG] My Organization (technology, medium)
 * // `-- [VP] Engineering VP
 * //     `-- [DISC] Frontend Development [2 agents]
 * //         |-- [AGENT] React Developer [sonnet]
 * //         `-- [AGENT] CSS Specialist [haiku]
 * ```
 */
export function formatAsTree(org: OrgTree, options: TreeFormatOptions = {}): string {
  const lines: string[] = [];
  const { manifest, vps, disciplines, agents } = org;

  // Create lookup maps for efficient access
  const disciplinesByVpId = new Map<string, DisciplinePack[]>();
  const agentsByDisciplineId = new Map<string, AgentDefinition[]>();

  // Group disciplines by parent VP
  for (const discipline of disciplines) {
    if (discipline.parentVpId) {
      const existing = disciplinesByVpId.get(discipline.parentVpId) || [];
      existing.push(discipline);
      disciplinesByVpId.set(discipline.parentVpId, existing);
    }
  }

  // Group agents by discipline (using slug matching since agentIds contains slugs)
  const agentBySlug = new Map<string, AgentDefinition>();
  for (const agent of agents) {
    agentBySlug.set(agent.slug, agent);
    agentBySlug.set(agent.id, agent);
  }

  for (const discipline of disciplines) {
    const disciplineAgents: AgentDefinition[] = [];
    for (const agentId of discipline.agentIds) {
      const agent = agentBySlug.get(agentId);
      if (agent) {
        disciplineAgents.push(agent);
      }
    }
    agentsByDisciplineId.set(discipline.id, disciplineAgents);
  }

  // Root node - Organization
  const orgCount = options.showCounts ? ` [${vps.length} VPs]` : '';
  lines.push(
    `${ICONS.ORG} ${manifest.name} (${manifest.industry}, ${manifest.size})${orgCount}`
  );

  // Check max depth
  if (options.maxDepth !== undefined && options.maxDepth < 1) {
    return lines.join('\n');
  }

  // Render VPs
  for (let vpIdx = 0; vpIdx < vps.length; vpIdx++) {
    const vp = vps[vpIdx];
    const isLastVP = vpIdx === vps.length - 1;
    const vpLine = buildTreeLine('', isLastVP, formatVPNode(vp, options));
    lines.push(vpLine);

    // Check max depth for disciplines
    if (options.maxDepth !== undefined && options.maxDepth < 2) {
      continue;
    }

    // Get disciplines for this VP
    const vpDisciplines = disciplinesByVpId.get(vp.id) || [];
    const vpPrefix = getChildPrefix('', isLastVP);

    for (let discIdx = 0; discIdx < vpDisciplines.length; discIdx++) {
      const discipline = vpDisciplines[discIdx];
      const isLastDiscipline = discIdx === vpDisciplines.length - 1;
      const discLine = buildTreeLine(
        vpPrefix,
        isLastDiscipline,
        formatDisciplineNode(discipline, options)
      );
      lines.push(discLine);

      // Check max depth for agents
      if (options.maxDepth !== undefined && options.maxDepth < 3) {
        continue;
      }

      // Get agents for this discipline
      const discAgents = agentsByDisciplineId.get(discipline.id) || [];
      const discPrefix = getChildPrefix(vpPrefix, isLastDiscipline);

      for (let agentIdx = 0; agentIdx < discAgents.length; agentIdx++) {
        const agent = discAgents[agentIdx];
        const isLastAgent = agentIdx === discAgents.length - 1;
        const agentLine = buildTreeLine(
          discPrefix,
          isLastAgent,
          formatAgentNode(agent, options)
        );
        lines.push(agentLine);
      }
    }
  }

  // Handle orphan disciplines (no parent VP)
  const orphanDisciplines = disciplines.filter((d) => !d.parentVpId);
  if (orphanDisciplines.length > 0 && (options.maxDepth === undefined || options.maxDepth >= 1)) {
    const orphanHeader = buildTreeLine('', true, '(Unassigned Disciplines)');
    lines.push(orphanHeader);

    const orphanPrefix = getChildPrefix('', true);
    for (let discIdx = 0; discIdx < orphanDisciplines.length; discIdx++) {
      const discipline = orphanDisciplines[discIdx];
      const isLastDiscipline = discIdx === orphanDisciplines.length - 1;
      const discLine = buildTreeLine(
        orphanPrefix,
        isLastDiscipline,
        formatDisciplineNode(discipline, options)
      );
      lines.push(discLine);

      // Check max depth for agents
      if (options.maxDepth !== undefined && options.maxDepth < 3) {
        continue;
      }

      const discAgents = agentsByDisciplineId.get(discipline.id) || [];
      const discPrefix = getChildPrefix(orphanPrefix, isLastDiscipline);

      for (let agentIdx = 0; agentIdx < discAgents.length; agentIdx++) {
        const agent = discAgents[agentIdx];
        const isLastAgent = agentIdx === discAgents.length - 1;
        const agentLine = buildTreeLine(
          discPrefix,
          isLastAgent,
          formatAgentNode(agent, options)
        );
        lines.push(agentLine);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Formats a single VP and its descendants as an ASCII tree.
 *
 * Creates a focused tree view starting from a specific VP, showing
 * only the disciplines and agents under that VP.
 *
 * @param vp - The VP charter to display
 * @param disciplines - Disciplines belonging to this VP
 * @param agents - All agents (will be filtered to matching disciplines)
 * @param options - Optional formatting configuration
 * @returns Multi-line string representing the VP tree
 *
 * @example
 * ```typescript
 * const tree = formatVPTree(
 *   engineeringVP,
 *   [frontendDiscipline, backendDiscipline],
 *   allAgents,
 *   { showCounts: true }
 * );
 * console.log(tree);
 * ```
 */
export function formatVPTree(
  vp: VPCharter,
  disciplines: DisciplinePack[],
  agents: AgentDefinition[],
  options: TreeFormatOptions = {}
): string {
  const lines: string[] = [];

  // Build agent lookup
  const agentBySlug = new Map<string, AgentDefinition>();
  for (const agent of agents) {
    agentBySlug.set(agent.slug, agent);
    agentBySlug.set(agent.id, agent);
  }

  // Filter disciplines to those belonging to this VP
  const vpDisciplines = disciplines.filter((d) => d.parentVpId === vp.id);

  // Root node - VP
  const vpCount = options.showCounts ? ` [${vpDisciplines.length} disciplines]` : '';
  lines.push(`${ICONS.VP} ${vp.identity.name}${vpCount}`);

  if (options.maxDepth !== undefined && options.maxDepth < 1) {
    return lines.join('\n');
  }

  for (let discIdx = 0; discIdx < vpDisciplines.length; discIdx++) {
    const discipline = vpDisciplines[discIdx];
    const isLastDiscipline = discIdx === vpDisciplines.length - 1;
    const discLine = buildTreeLine('', isLastDiscipline, formatDisciplineNode(discipline, options));
    lines.push(discLine);

    if (options.maxDepth !== undefined && options.maxDepth < 2) {
      continue;
    }

    // Get agents for this discipline
    const discAgents: AgentDefinition[] = [];
    for (const agentId of discipline.agentIds) {
      const agent = agentBySlug.get(agentId);
      if (agent) {
        discAgents.push(agent);
      }
    }

    const discPrefix = getChildPrefix('', isLastDiscipline);
    for (let agentIdx = 0; agentIdx < discAgents.length; agentIdx++) {
      const agent = discAgents[agentIdx];
      const isLastAgent = agentIdx === discAgents.length - 1;
      const agentLine = buildTreeLine(
        discPrefix,
        isLastAgent,
        formatAgentNode(agent, options)
      );
      lines.push(agentLine);
    }
  }

  return lines.join('\n');
}

/**
 * Formats a single discipline and its agents as an ASCII tree.
 *
 * Creates a focused tree view starting from a specific discipline,
 * showing only the agents under that discipline.
 *
 * @param discipline - The discipline pack to display
 * @param agents - All agents (will be filtered to matching IDs)
 * @param options - Optional formatting configuration
 * @returns Multi-line string representing the discipline tree
 *
 * @example
 * ```typescript
 * const tree = formatDisciplineTree(
 *   frontendDiscipline,
 *   allAgents,
 *   { showIds: true }
 * );
 * console.log(tree);
 * ```
 */
export function formatDisciplineTree(
  discipline: DisciplinePack,
  agents: AgentDefinition[],
  options: TreeFormatOptions = {}
): string {
  const lines: string[] = [];

  // Build agent lookup
  const agentBySlug = new Map<string, AgentDefinition>();
  for (const agent of agents) {
    agentBySlug.set(agent.slug, agent);
    agentBySlug.set(agent.id, agent);
  }

  // Get agents for this discipline
  const discAgents: AgentDefinition[] = [];
  for (const agentId of discipline.agentIds) {
    const agent = agentBySlug.get(agentId);
    if (agent) {
      discAgents.push(agent);
    }
  }

  // Root node - Discipline
  const count = options.showCounts ? ` [${discAgents.length} agents]` : '';
  lines.push(`${ICONS.DISCIPLINE} ${discipline.name}${count}`);

  if (options.maxDepth !== undefined && options.maxDepth < 1) {
    return lines.join('\n');
  }

  for (let agentIdx = 0; agentIdx < discAgents.length; agentIdx++) {
    const agent = discAgents[agentIdx];
    const isLastAgent = agentIdx === discAgents.length - 1;
    const agentLine = buildTreeLine('', isLastAgent, formatAgentNode(agent, options));
    lines.push(agentLine);
  }

  return lines.join('\n');
}

/**
 * Formats a flat list of agents as an ASCII tree.
 *
 * Creates a simple tree view of agents without hierarchy.
 * Useful for displaying search results or filtered agent lists.
 *
 * @param agents - List of agent definitions to display
 * @param title - Optional title for the tree root
 * @param options - Optional formatting configuration
 * @returns Multi-line string representing the agent list tree
 *
 * @example
 * ```typescript
 * const tree = formatAgentListTree(
 *   filteredAgents,
 *   'Search Results',
 *   { showIds: true }
 * );
 * console.log(tree);
 * ```
 */
export function formatAgentListTree(
  agents: AgentDefinition[],
  title: string = 'Agents',
  options: TreeFormatOptions = {}
): string {
  const lines: string[] = [];

  const count = options.showCounts ? ` [${agents.length} agents]` : '';
  lines.push(`${title}${count}`);

  for (let agentIdx = 0; agentIdx < agents.length; agentIdx++) {
    const agent = agents[agentIdx];
    const isLastAgent = agentIdx === agents.length - 1;
    const agentLine = buildTreeLine('', isLastAgent, formatAgentNode(agent, options));
    lines.push(agentLine);
  }

  return lines.join('\n');
}
