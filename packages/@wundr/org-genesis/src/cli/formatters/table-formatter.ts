/* eslint-disable no-console */
/**
 * @fileoverview Table Formatter for Organization Data
 *
 * Provides ASCII table visualization for VPs, disciplines, and agents.
 * Renders data in clean, aligned tables suitable for terminal output.
 *
 * @module @wundr/org-genesis/cli/formatters/table-formatter
 * @version 1.0.0
 */

import type {
  AgentDefinition,
  DisciplinePack,
  OrchestratorCharter,
} from '../../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for customizing table output.
 *
 * @property maxWidth - Maximum total table width (default: 120)
 * @property truncateAt - Column width at which to truncate content (default: 30)
 * @property showBorders - Whether to show table borders (default: true)
 */
export interface TableFormatOptions {
  /** Maximum total width of the table in characters */
  maxWidth?: number;

  /** Maximum width for individual columns before truncation */
  truncateAt?: number;

  /** Whether to render table borders */
  showBorders?: boolean;

  /** Padding character count on each side of cell content */
  cellPadding?: number;
}

/**
 * Column definition for table rendering.
 *
 * @internal
 */
interface ColumnDef {
  /** Column header text */
  header: string;

  /** Column width in characters */
  width: number;

  /** Text alignment */
  align: 'left' | 'right' | 'center';
}

// ============================================================================
// Table Drawing Characters
// ============================================================================

/**
 * ASCII characters for table borders.
 */
const TABLE_CHARS = {
  TOP_LEFT: '+',
  TOP_RIGHT: '+',
  BOTTOM_LEFT: '+',
  BOTTOM_RIGHT: '+',
  HORIZONTAL: '-',
  VERTICAL: '|',
  T_DOWN: '+',
  T_UP: '+',
  T_LEFT: '+',
  T_RIGHT: '+',
  CROSS: '+',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncates a string to fit within a maximum width.
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
  if (maxLen <= 3) {
    return str.substring(0, maxLen);
  }
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Pads a string to a specific width with given alignment.
 *
 * @param str - The string to pad
 * @param width - Target width
 * @param align - Text alignment
 * @returns Padded string
 *
 * @internal
 */
function padString(
  str: string,
  width: number,
  align: 'left' | 'right' | 'center'
): string {
  const truncated = truncate(str, width);
  const padding = width - truncated.length;

  if (padding <= 0) {
    return truncated;
  }

  switch (align) {
    case 'left':
      return truncated + ' '.repeat(padding);
    case 'right':
      return ' '.repeat(padding) + truncated;
    case 'center': {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);
    }
  }
}

/**
 * Builds a horizontal border line.
 *
 * @param columns - Column definitions
 * @param position - Position of the border (top, middle, bottom)
 * @param cellPadding - Padding on each side of cells
 * @returns Border line string
 *
 * @internal
 */
function buildBorderLine(
  columns: ColumnDef[],
  position: 'top' | 'middle' | 'bottom',
  cellPadding: number
): string {
  const leftChar =
    position === 'top'
      ? TABLE_CHARS.TOP_LEFT
      : position === 'bottom'
        ? TABLE_CHARS.BOTTOM_LEFT
        : TABLE_CHARS.T_RIGHT;
  const rightChar =
    position === 'top'
      ? TABLE_CHARS.TOP_RIGHT
      : position === 'bottom'
        ? TABLE_CHARS.BOTTOM_RIGHT
        : TABLE_CHARS.T_LEFT;
  const joinChar =
    position === 'top'
      ? TABLE_CHARS.T_DOWN
      : position === 'bottom'
        ? TABLE_CHARS.T_UP
        : TABLE_CHARS.CROSS;

  const segments = columns.map(col =>
    TABLE_CHARS.HORIZONTAL.repeat(col.width + cellPadding * 2)
  );

  return leftChar + segments.join(joinChar) + rightChar;
}

/**
 * Builds a data row line.
 *
 * @param cells - Cell content strings
 * @param columns - Column definitions
 * @param cellPadding - Padding on each side of cells
 * @param showBorders - Whether to show vertical borders
 * @returns Data row string
 *
 * @internal
 */
function buildDataRow(
  cells: string[],
  columns: ColumnDef[],
  cellPadding: number,
  showBorders: boolean
): string {
  const paddedCells = cells.map((cell, idx) => {
    const col = columns[idx];
    const padded = padString(cell, col.width, col.align);
    return ' '.repeat(cellPadding) + padded + ' '.repeat(cellPadding);
  });

  if (showBorders) {
    return (
      TABLE_CHARS.VERTICAL +
      paddedCells.join(TABLE_CHARS.VERTICAL) +
      TABLE_CHARS.VERTICAL
    );
  }
  return paddedCells.join('  ');
}

/**
 * Calculates column widths based on content.
 *
 * @param headers - Column header strings
 * @param rows - Array of row data
 * @param maxWidth - Maximum total table width
 * @param truncateAt - Maximum individual column width
 * @param cellPadding - Padding on each side of cells
 * @returns Array of calculated widths
 *
 * @internal
 */
function calculateColumnWidths(
  headers: string[],
  rows: string[][],
  maxWidth: number,
  truncateAt: number,
  cellPadding: number
): number[] {
  const widths: number[] = headers.map(h => h.length);

  // Find maximum content width for each column
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      widths[i] = Math.max(widths[i] || 0, row[i].length);
    }
  }

  // Apply truncation limit
  const truncatedWidths = widths.map(w => Math.min(w, truncateAt));

  // Calculate overhead (borders and padding)
  const colCount = headers.length;
  const overhead = colCount + 1 + colCount * cellPadding * 2; // borders + padding

  // Check if we need to shrink columns
  const totalWidth = truncatedWidths.reduce((a, b) => a + b, 0) + overhead;
  if (totalWidth <= maxWidth) {
    return truncatedWidths;
  }

  // Proportionally shrink columns to fit
  const availableWidth = maxWidth - overhead;
  const totalContentWidth = truncatedWidths.reduce((a, b) => a + b, 0);
  const ratio = availableWidth / totalContentWidth;

  return truncatedWidths.map(w => Math.max(Math.floor(w * ratio), 5));
}

/**
 * Renders a complete table.
 *
 * @param headers - Column header strings
 * @param rows - Array of row data
 * @param alignments - Column alignments
 * @param options - Table formatting options
 * @returns Formatted table string
 *
 * @internal
 */
function renderTable(
  headers: string[],
  rows: string[][],
  alignments: Array<'left' | 'right' | 'center'>,
  options: TableFormatOptions
): string {
  const maxWidth = options.maxWidth ?? 120;
  const truncateAt = options.truncateAt ?? 30;
  const showBorders = options.showBorders ?? true;
  const cellPadding = options.cellPadding ?? 1;

  const widths = calculateColumnWidths(
    headers,
    rows,
    maxWidth,
    truncateAt,
    cellPadding
  );

  const columns: ColumnDef[] = headers.map((header, idx) => ({
    header,
    width: widths[idx],
    align: alignments[idx] || 'left',
  }));

  const lines: string[] = [];

  // Top border
  if (showBorders) {
    lines.push(buildBorderLine(columns, 'top', cellPadding));
  }

  // Header row
  lines.push(buildDataRow(headers, columns, cellPadding, showBorders));

  // Header separator
  if (showBorders) {
    lines.push(buildBorderLine(columns, 'middle', cellPadding));
  } else {
    // Simple dashes under headers when no borders
    const dashes = widths.map(w => '-'.repeat(w + cellPadding * 2));
    lines.push(dashes.join('  '));
  }

  // Data rows
  for (const row of rows) {
    lines.push(buildDataRow(row, columns, cellPadding, showBorders));
  }

  // Bottom border
  if (showBorders) {
    lines.push(buildBorderLine(columns, 'bottom', cellPadding));
  }

  return lines.join('\n');
}

// ============================================================================
// Orchestrator Table Formatter
// ============================================================================

/**
 * Formats a list of VPs as an ASCII table.
 *
 * Displays Orchestrator information in a tabular format with columns for:
 * - Name: The Orchestrator's display name
 * - ID: Unique identifier
 * - Disciplines: Number of assigned disciplines
 * - Capabilities: Number of granted capabilities
 * - Status: Current node status (if available)
 *
 * @param orchestrators - Array of Orchestrator charters to display
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the Orchestrator table
 *
 * @example
 * ```typescript
 * const table = formatVPsAsTable([engineeringVP, financeVP], {
 *   maxWidth: 100,
 *   truncateAt: 25,
 * });
 * console.log(table);
 *
 * // Output:
 * // +---------------------------+----------------+-------------+--------+
 * // | Name                      | ID             | Disciplines | Caps   |
 * // +---------------------------+----------------+-------------+--------+
 * // | Engineering Orchestrator            | orchestrator-eng-001     | 3           | 5      |
 * // | Finance Orchestrator                | orchestrator-fin-001     | 2           | 4      |
 * // +---------------------------+----------------+-------------+--------+
 * ```
 */
export function formatVPsAsTable(
  orchestrators: OrchestratorCharter[],
  options: TableFormatOptions = {}
): string {
  if (orchestrators.length === 0) {
    return 'No VPs found.';
  }

  const headers = ['Name', 'ID', 'Disciplines', 'Capabilities', 'Node ID'];
  const alignments: Array<'left' | 'right' | 'center'> = [
    'left',
    'left',
    'right',
    'right',
    'left',
  ];

  const rows = orchestrators.map(orchestrator => [
    orchestrator.identity.name,
    orchestrator.id,
    String(orchestrator.disciplineIds.length),
    String(orchestrator.capabilities.length),
    orchestrator.nodeId || '-',
  ]);

  return renderTable(headers, rows, alignments, options);
}

/**
 * Formats a single VP's details as a vertical key-value table.
 *
 * Displays detailed Orchestrator information in a two-column format
 * suitable for single-entity inspection.
 *
 * @param orchestrator - The Orchestrator charter to display
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the Orchestrator details
 *
 * @example
 * ```typescript
 * const details = formatVPDetailsAsTable(engineeringVP);
 * console.log(details);
 * ```
 */
export function formatVPDetailsAsTable(
  orchestrator: OrchestratorCharter,
  options: TableFormatOptions = {}
): string {
  const headers = ['Property', 'Value'];
  const alignments: Array<'left' | 'right' | 'center'> = ['left', 'left'];

  const rows: string[][] = [
    ['ID', orchestrator.id],
    ['Name', orchestrator.identity.name],
    ['Slug', orchestrator.identity.slug],
    ['Persona', truncate(orchestrator.identity.persona, 50)],
    ['Core Directive', truncate(orchestrator.coreDirective, 50)],
    ['Tier', String(orchestrator.tier)],
    ['Disciplines', orchestrator.disciplineIds.join(', ') || '-'],
    ['Capabilities', orchestrator.capabilities.join(', ')],
    ['MCP Tools', orchestrator.mcpTools.join(', ') || '-'],
    ['Max Sessions', String(orchestrator.resourceLimits.maxConcurrentSessions)],
    ['Token Budget/hr', String(orchestrator.resourceLimits.tokenBudgetPerHour)],
    ['Node ID', orchestrator.nodeId || '-'],
    ['Created', orchestrator.createdAt.toISOString()],
    ['Updated', orchestrator.updatedAt.toISOString()],
  ];

  return renderTable(headers, rows, alignments, options);
}

// ============================================================================
// Discipline Table Formatter
// ============================================================================

/**
 * Formats a list of disciplines as an ASCII table.
 *
 * Displays discipline information in a tabular format with columns for:
 * - Name: The discipline's display name
 * - ID: Unique identifier
 * - Category: Discipline category
 * - Agents: Number of assigned agents
 * - Parent VP: ID of the parent Orchestrator (if any)
 *
 * @param disciplines - Array of discipline packs to display
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the discipline table
 *
 * @example
 * ```typescript
 * const table = formatDisciplinesAsTable(disciplines, {
 *   showBorders: true,
 * });
 * console.log(table);
 *
 * // Output:
 * // +----------------------+---------------+-------------+--------+------------+
 * // | Name                 | ID            | Category    | Agents | Parent Orchestrator  |
 * // +----------------------+---------------+-------------+--------+------------+
 * // | Frontend Development | disc-fe-001   | engineering | 4      | orchestrator-eng-001 |
 * // | Backend Development  | disc-be-001   | engineering | 3      | orchestrator-eng-001 |
 * // +----------------------+---------------+-------------+--------+------------+
 * ```
 */
export function formatDisciplinesAsTable(
  disciplines: DisciplinePack[],
  options: TableFormatOptions = {}
): string {
  if (disciplines.length === 0) {
    return 'No disciplines found.';
  }

  const headers = ['Name', 'ID', 'Category', 'Agents', 'Parent VP'];
  const alignments: Array<'left' | 'right' | 'center'> = [
    'left',
    'left',
    'left',
    'right',
    'left',
  ];

  const rows = disciplines.map(disc => [
    disc.name,
    disc.id,
    disc.category,
    String(disc.agentIds.length),
    disc.parentVpId || '-',
  ]);

  return renderTable(headers, rows, alignments, options);
}

/**
 * Formats a single discipline's details as a vertical key-value table.
 *
 * Displays detailed discipline information in a two-column format
 * suitable for single-entity inspection.
 *
 * @param discipline - The discipline pack to display
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the discipline details
 *
 * @example
 * ```typescript
 * const details = formatDisciplineDetailsAsTable(frontendDiscipline);
 * console.log(details);
 * ```
 */
export function formatDisciplineDetailsAsTable(
  discipline: DisciplinePack,
  options: TableFormatOptions = {}
): string {
  const headers = ['Property', 'Value'];
  const alignments: Array<'left' | 'right' | 'center'> = ['left', 'left'];

  const rows: string[][] = [
    ['ID', discipline.id],
    ['Name', discipline.name],
    ['Slug', discipline.slug],
    ['Category', discipline.category],
    ['Description', truncate(discipline.description, 50)],
    ['Parent VP', discipline.parentVpId || '-'],
    ['Agents', discipline.agentIds.join(', ') || '-'],
    ['MCP Servers', String(discipline.mcpServers.length)],
    ['Hooks', String(discipline.hooks.length)],
    ['CLAUDE.md Role', discipline.claudeMd.role],
    ['CLAUDE.md Context', truncate(discipline.claudeMd.context, 40)],
    ['Rules Count', String(discipline.claudeMd.rules.length)],
    ['Objectives Count', String(discipline.claudeMd.objectives.length)],
    ['Constraints Count', String(discipline.claudeMd.constraints.length)],
    ['Created', discipline.createdAt.toISOString()],
    ['Updated', discipline.updatedAt.toISOString()],
  ];

  return renderTable(headers, rows, alignments, options);
}

// ============================================================================
// Agent Table Formatter
// ============================================================================

/**
 * Formats a list of agents as an ASCII table.
 *
 * Displays agent information in a tabular format with columns for:
 * - Name: The agent's display name
 * - ID: Unique identifier
 * - Model: Assigned Claude model
 * - Scope: Agent availability scope
 * - Tools: Number of available tools
 *
 * @param agents - Array of agent definitions to display
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the agent table
 *
 * @example
 * ```typescript
 * const table = formatAgentsAsTable(agents, {
 *   maxWidth: 100,
 * });
 * console.log(table);
 *
 * // Output:
 * // +------------------+-----------------+--------+---------------------+-------+
 * // | Name             | ID              | Model  | Scope               | Tools |
 * // +------------------+-----------------+--------+---------------------+-------+
 * // | Code Reviewer    | agent-review-01 | sonnet | discipline-specific | 5     |
 * // | Test Engineer    | agent-test-01   | haiku  | universal           | 4     |
 * // +------------------+-----------------+--------+---------------------+-------+
 * ```
 */
export function formatAgentsAsTable(
  agents: AgentDefinition[],
  options: TableFormatOptions = {}
): string {
  if (agents.length === 0) {
    return 'No agents found.';
  }

  const headers = ['Name', 'ID', 'Model', 'Scope', 'Tools'];
  const alignments: Array<'left' | 'right' | 'center'> = [
    'left',
    'left',
    'center',
    'left',
    'right',
  ];

  const rows = agents.map(agent => [
    agent.name,
    agent.id,
    agent.model,
    agent.scope,
    String(agent.tools.length),
  ]);

  return renderTable(headers, rows, alignments, options);
}

/**
 * Formats a single agent's details as a vertical key-value table.
 *
 * Displays detailed agent information in a two-column format
 * suitable for single-entity inspection.
 *
 * @param agent - The agent definition to display
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the agent details
 *
 * @example
 * ```typescript
 * const details = formatAgentDetailsAsTable(codeReviewer);
 * console.log(details);
 * ```
 */
export function formatAgentDetailsAsTable(
  agent: AgentDefinition,
  options: TableFormatOptions = {}
): string {
  const headers = ['Property', 'Value'];
  const alignments: Array<'left' | 'right' | 'center'> = ['left', 'left'];

  // Format capabilities as readable string
  const caps: string[] = [];
  if (agent.capabilities.canReadFiles) {
    caps.push('read');
  }
  if (agent.capabilities.canWriteFiles) {
    caps.push('write');
  }
  if (agent.capabilities.canExecuteCommands) {
    caps.push('execute');
  }
  if (agent.capabilities.canAccessNetwork) {
    caps.push('network');
  }
  if (agent.capabilities.canSpawnSubAgents) {
    caps.push('spawn');
  }

  // Format tools list
  const toolNames = agent.tools.map(t => `${t.name}(${t.type})`);

  const rows: string[][] = [
    ['ID', agent.id],
    ['Name', agent.name],
    ['Slug', agent.slug],
    ['Tier', String(agent.tier)],
    ['Model', agent.model],
    ['Scope', agent.scope],
    ['Description', truncate(agent.description, 50)],
    ['Charter (preview)', truncate(agent.charter, 50)],
    ['Tools', toolNames.join(', ') || '-'],
    ['Capabilities', caps.join(', ') || 'none'],
    [
      'Custom Capabilities',
      agent.capabilities.customCapabilities?.join(', ') || '-',
    ],
    ['Used by Disciplines', agent.usedByDisciplines.join(', ') || '-'],
    ['Used by VPs', agent.usedByVps?.join(', ') || '-'],
    ['Tags', agent.tags.join(', ') || '-'],
    ['Created', agent.createdAt.toISOString()],
    ['Updated', agent.updatedAt.toISOString()],
  ];

  return renderTable(headers, rows, alignments, options);
}

// ============================================================================
// Summary Table Formatter
// ============================================================================

/**
 * Formats an organization summary as a compact table.
 *
 * Creates a summary view showing counts and key metrics
 * for the entire organization structure.
 *
 * @param orchestratorCount - Number of VPs
 * @param disciplineCount - Number of disciplines
 * @param agentCount - Number of agents
 * @param orgName - Organization name
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the summary table
 *
 * @example
 * ```typescript
 * const summary = formatOrgSummaryTable(3, 8, 24, 'ACME Corp');
 * console.log(summary);
 * ```
 */
export function formatOrgSummaryTable(
  orchestratorCount: number,
  disciplineCount: number,
  agentCount: number,
  orgName: string,
  options: TableFormatOptions = {}
): string {
  const headers = ['Metric', 'Count'];
  const alignments: Array<'left' | 'right' | 'center'> = ['left', 'right'];

  const rows: string[][] = [
    ['Organization', orgName],
    ['VPs (Tier 1)', String(orchestratorCount)],
    ['Disciplines (Tier 2)', String(disciplineCount)],
    ['Agents (Tier 3)', String(agentCount)],
    ['Total Entities', String(orchestratorCount + disciplineCount + agentCount)],
  ];

  return renderTable(headers, rows, alignments, options);
}

/**
 * Formats a comparison table for multiple organizations.
 *
 * Creates a side-by-side comparison of organization metrics.
 *
 * @param orgs - Array of organization summary objects
 * @param options - Optional table formatting configuration
 * @returns Multi-line string representing the comparison table
 *
 * @example
 * ```typescript
 * const comparison = formatOrgComparisonTable([
 *   { name: 'Org A', orchestrators: 3, disciplines: 8, agents: 24 },
 *   { name: 'Org B', orchestrators: 5, disciplines: 12, agents: 36 },
 * ]);
 * console.log(comparison);
 * ```
 */
export function formatOrgComparisonTable(
  orgs: Array<{
    name: string;
    orchestrators: number;
    disciplines: number;
    agents: number;
  }>,
  options: TableFormatOptions = {}
): string {
  if (orgs.length === 0) {
    return 'No organizations to compare.';
  }

  const headers = ['Organization', 'VPs', 'Disciplines', 'Agents', 'Total'];
  const alignments: Array<'left' | 'right' | 'center'> = [
    'left',
    'right',
    'right',
    'right',
    'right',
  ];

  const rows = orgs.map(org => [
    org.name,
    String(org.orchestrators),
    String(org.disciplines),
    String(org.agents),
    String(org.orchestrators + org.disciplines + org.agents),
  ]);

  return renderTable(headers, rows, alignments, options);
}
