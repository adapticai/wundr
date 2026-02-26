/**
 * Skill Dependency Resolution
 *
 * Resolves dependency graphs between skills using topological sorting.
 * Detects cycles, missing dependencies, and produces a deterministic
 * execution order for skills with declared `dependencies` in frontmatter.
 *
 * @module skills/skill-dependencies
 */

import type { SkillDependencyResolution, SkillEntry } from './types';

// ---------------------------------------------------------------------------
// Dependency Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the dependency graph for a skill and produce a topological
 * execution order.
 *
 * @param skillName - The root skill to resolve dependencies for
 * @param entries - Map of all available skill entries by name
 * @returns Resolution result with ordered names, missing deps, or cycle info
 */
export function resolveDependencies(
  skillName: string,
  entries: Map<string, SkillEntry>
): SkillDependencyResolution {
  const entry = entries.get(skillName);
  if (!entry) {
    return {
      order: [],
      resolved: false,
      missing: [skillName],
    };
  }

  const deps = entry.skill.frontmatter.dependencies ?? [];
  if (deps.length === 0) {
    return {
      order: [skillName],
      resolved: true,
      missing: [],
    };
  }

  // Build adjacency list for the entire reachable graph
  const graph = new Map<string, string[]>();
  const missing: string[] = [];
  const visited = new Set<string>();

  function collectDeps(name: string): void {
    if (visited.has(name)) {
      return;
    }
    visited.add(name);

    const e = entries.get(name);
    if (!e) {
      missing.push(name);
      graph.set(name, []);
      return;
    }

    const nodeDeps = e.skill.frontmatter.dependencies ?? [];
    graph.set(name, nodeDeps);

    for (const dep of nodeDeps) {
      collectDeps(dep);
    }
  }

  collectDeps(skillName);

  // Detect cycles using DFS coloring
  const cyclePath = detectCycle(graph, skillName);
  if (cyclePath) {
    return {
      order: [],
      resolved: false,
      missing,
      cyclePath,
    };
  }

  // Topological sort (post-order DFS)
  const order = topologicalSort(graph, skillName);

  return {
    order,
    resolved: missing.length === 0,
    missing,
  };
}

/**
 * Resolve dependencies for multiple skills at once.
 * Returns a single merged topological order covering all requested skills.
 */
export function resolveDependenciesBatch(
  skillNames: string[],
  entries: Map<string, SkillEntry>
): SkillDependencyResolution {
  const allMissing: string[] = [];
  const allOrders: string[][] = [];

  for (const name of skillNames) {
    const result = resolveDependencies(name, entries);

    if (result.cyclePath) {
      return {
        order: [],
        resolved: false,
        missing: result.missing,
        cyclePath: result.cyclePath,
      };
    }

    allMissing.push(...result.missing);
    allOrders.push(result.order);
  }

  // Merge orders preserving topological constraints
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const order of allOrders) {
    for (const name of order) {
      if (!seen.has(name)) {
        seen.add(name);
        merged.push(name);
      }
    }
  }

  const uniqueMissing = [...new Set(allMissing)];

  return {
    order: merged,
    resolved: uniqueMissing.length === 0,
    missing: uniqueMissing,
  };
}

/**
 * Check if adding a dependency would create a cycle.
 *
 * @param fromSkill - The skill that wants to declare a dependency
 * @param toSkill - The skill to depend on
 * @param entries - Map of all skill entries
 * @returns true if adding the dependency would create a cycle
 */
export function wouldCreateCycle(
  fromSkill: string,
  toSkill: string,
  entries: Map<string, SkillEntry>
): boolean {
  // Check if toSkill transitively depends on fromSkill
  const visited = new Set<string>();

  function hasPath(current: string, target: string): boolean {
    if (current === target) {
      return true;
    }
    if (visited.has(current)) {
      return false;
    }
    visited.add(current);

    const entry = entries.get(current);
    if (!entry) {
      return false;
    }

    const deps = entry.skill.frontmatter.dependencies ?? [];
    for (const dep of deps) {
      if (hasPath(dep, target)) {
        return true;
      }
    }

    return false;
  }

  return hasPath(toSkill, fromSkill);
}

// ---------------------------------------------------------------------------
// Graph Algorithms
// ---------------------------------------------------------------------------

/**
 * Detect a cycle in the dependency graph using DFS coloring.
 * Returns the cycle path if found, or undefined if no cycle exists.
 */
function detectCycle(
  graph: Map<string, string[]>,
  startNode: string
): string[] | undefined {
  const WHITE = 0; // Unvisited
  const GRAY = 1; // In progress
  const BLACK = 2; // Completed

  const colors = new Map<string, number>();
  const parent = new Map<string, string>();

  for (const key of graph.keys()) {
    colors.set(key, WHITE);
  }

  function dfs(node: string): string[] | undefined {
    colors.set(node, GRAY);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      const color = colors.get(neighbor) ?? WHITE;

      if (color === GRAY) {
        // Cycle found -- reconstruct path
        const cycle: string[] = [neighbor, node];
        let current = node;
        while (current !== neighbor) {
          const p = parent.get(current);
          if (!p || cycle.includes(p)) {
            break;
          }
          cycle.push(p);
          current = p;
        }
        return cycle.reverse();
      }

      if (color === WHITE) {
        parent.set(neighbor, node);
        const result = dfs(neighbor);
        if (result) {
          return result;
        }
      }
    }

    colors.set(node, BLACK);
    return undefined;
  }

  return dfs(startNode);
}

/**
 * Topological sort using post-order DFS.
 * Returns nodes in dependency-first order (leaves before roots).
 */
function topologicalSort(
  graph: Map<string, string[]>,
  startNode: string
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(node: string): void {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    result.push(node);
  }

  dfs(startNode);

  return result;
}
