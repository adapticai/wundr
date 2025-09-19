/**
 * Circular Dependency Detection Engine
 * Advanced graph algorithms for detecting and analyzing circular dependencies
 */

import { execSync } from 'child_process';
import * as path from 'path';
import {
  EntityInfo,
  CircularDependency,
  BaseAnalyzer,
  AnalysisConfig,
} from '../types';
import { createId, normalizeFilePath } from '../utils';

interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;
  weights: Map<string, number>;
}

interface CircularDetectionConfig {
  enableMadge: boolean;
  enableInternalAnalysis: boolean;
  maxCycleLength: number;
  includeTransitive: boolean;
  weightThreshold: number;
}

/**
 * High-performance circular dependency detection engine
 */
export class CircularDependencyEngine
  implements BaseAnalyzer<CircularDependency[]>
{
  public readonly name = 'CircularDependencyEngine';
  public readonly version = '2.0.0';

  private config: CircularDetectionConfig;
  private dependencyGraph: DependencyGraph = {
    nodes: new Set(),
    edges: new Map(),
    weights: new Map(),
  };

  constructor(config: Partial<CircularDetectionConfig> = {}) {
    this.config = {
      enableMadge: true,
      enableInternalAnalysis: true,
      maxCycleLength: 10,
      includeTransitive: true,
      weightThreshold: 1,
      ...config,
    };
  }

  async analyze(
    entities: EntityInfo[],
    analysisConfig: AnalysisConfig
  ): Promise<CircularDependency[]> {
    // Build dependency graph from entities
    this.buildDependencyGraph(entities);

    const circularDependencies: CircularDependency[] = [];

    // Method 1: Use madge for comprehensive analysis
    if (this.config.enableMadge) {
      const madgeCycles = await this.detectWithMadge(analysisConfig.targetDir);
      circularDependencies.push(...madgeCycles);
    }

    // Method 2: Internal graph analysis
    if (this.config.enableInternalAnalysis) {
      const internalCycles = await this.detectWithInternalAlgorithm();
      // Merge with madge results, avoiding duplicates
      const uniqueInternalCycles = this.filterUniqueCycles(
        circularDependencies,
        internalCycles
      );
      circularDependencies.push(...uniqueInternalCycles);
    }

    // Enhance cycles with additional analysis
    return this.enhanceCycles(circularDependencies);
  }

  /**
   * Build dependency graph from entity information
   */
  private buildDependencyGraph(entities: EntityInfo[]): void {
    // Clear existing graph
    this.dependencyGraph = {
      nodes: new Set(),
      edges: new Map(),
      weights: new Map(),
    };

    // Build file-to-entities mapping
    const fileToEntities = new Map<string, EntityInfo[]>();
    entities.forEach(entity => {
      const normalizedFile = normalizeFilePath(entity.file);
      if (!fileToEntities.has(normalizedFile)) {
        fileToEntities.set(normalizedFile, []);
      }
      fileToEntities.get(normalizedFile)!.push(entity);
      this.dependencyGraph.nodes.add(normalizedFile);
    });

    // Build edges based on dependencies
    entities.forEach(entity => {
      const sourceFile = normalizeFilePath(entity.file);

      entity.dependencies.forEach(depPath => {
        const targetFile = normalizeFilePath(depPath);

        if (fileToEntities.has(targetFile) && sourceFile !== targetFile) {
          // Add edge
          if (!this.dependencyGraph.edges.has(sourceFile)) {
            this.dependencyGraph.edges.set(sourceFile, new Set());
          }
          this.dependencyGraph.edges.get(sourceFile)!.add(targetFile);

          // Track weight (number of dependencies between files)
          const edgeKey = `${sourceFile}->${targetFile}`;
          const currentWeight = this.dependencyGraph.weights.get(edgeKey) || 0;
          this.dependencyGraph.weights.set(edgeKey, currentWeight + 1);
        }
      });
    });
  }

  /**
   * Detect circular dependencies using madge
   */
  private async detectWithMadge(
    targetDir: string
  ): Promise<CircularDependency[]> {
    try {
      const result = execSync(
        `npx madge --circular --extensions ts,tsx,js,jsx --json "${targetDir}"`,
        {
          encoding: 'utf-8',
          timeout: 60000, // 1 minute timeout
          cwd: targetDir,
        }
      );

      const madgeOutput = JSON.parse(result.toString());
      const cycles = madgeOutput.circular || [];

      return cycles.map((cycle: string[], index: number) => ({
        id: createId(),
        cycle: cycle.map(file =>
          normalizeFilePath(path.resolve(targetDir, file))
        ),
        severity: this.calculateCycleSeverity(cycle),
        depth: cycle.length,
        files: cycle.map(file =>
          normalizeFilePath(path.resolve(targetDir, file))
        ),
        suggestions: this.generateCycleSuggestions(cycle),
        source: 'madge',
        weight: this.calculateCycleWeight(
          cycle.map(file => normalizeFilePath(path.resolve(targetDir, file)))
        ),
      }));
    } catch (error) {
      console.warn(
        '⚠️ Madge analysis failed, falling back to internal analysis'
      );
      return [];
    }
  }

  /**
   * Detect circular dependencies using internal graph algorithms
   */
  private detectWithInternalAlgorithm(): Promise<CircularDependency[]> {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];

    // Tarjan's algorithm for finding strongly connected components
    const tarjanSCC = this.findStronglyConnectedComponents();

    // Convert SCCs to cycles
    tarjanSCC.forEach(scc => {
      if (scc.length > 1) {
        // Find actual cycle within SCC
        const cycle = this.extractCycleFromSCC(scc);
        if (cycle.length > 1) {
          cycles.push({
            id: createId(),
            cycle,
            severity: this.calculateCycleSeverity(cycle),
            depth: cycle.length,
            files: cycle,
            suggestions: this.generateCycleSuggestions(cycle),
            source: 'internal',
            weight: this.calculateCycleWeight(cycle),
          });
        }
      }
    });

    // Also run DFS-based detection for simple cycles
    const dfsCycles = this.findCyclesDFS();
    cycles.push(...dfsCycles);

    return Promise.resolve(cycles);
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   */
  private findStronglyConnectedComponents(): string[][] {
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: string[][] = [];
    let index = 0;

    const strongConnect = (node: string): void => {
      indices.set(node, index);
      lowlinks.set(node, index);
      index++;
      stack.push(node);
      onStack.add(node);

      const neighbors = this.dependencyGraph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!indices.has(neighbor)) {
          strongConnect(neighbor);
          lowlinks.set(
            node,
            Math.min(lowlinks.get(node)!, lowlinks.get(neighbor)!)
          );
        } else if (onStack.has(neighbor)) {
          lowlinks.set(
            node,
            Math.min(lowlinks.get(node)!, indices.get(neighbor)!)
          );
        }
      }

      if (lowlinks.get(node) === indices.get(node)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== node);

        if (scc.length > 1) {
          sccs.push(scc);
        }
      }
    };

    for (const node of this.dependencyGraph.nodes) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return sccs;
  }

  /**
   * Extract actual cycle from strongly connected component
   */
  private extractCycleFromSCC(scc: string[]): string[] {
    // Find a cycle within the SCC using DFS
    const visited = new Set<string>();
    const path: string[] = [];
    const inPath = new Set<string>();

    const dfs = (node: string): string[] | null => {
      if (inPath.has(node)) {
        // Found cycle - return the cycle portion
        const cycleStart = path.indexOf(node);
        return [...path.slice(cycleStart), node];
      }

      if (visited.has(node)) {
        return null;
      }

      visited.add(node);
      path.push(node);
      inPath.add(node);

      const neighbors = this.dependencyGraph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (scc.includes(neighbor)) {
          // Only follow edges within SCC
          const cycle = dfs(neighbor);
          if (cycle) {
            return cycle;
          }
        }
      }

      path.pop();
      inPath.delete(node);
      return null;
    };

    // Try starting from each node in SCC
    for (const startNode of scc) {
      visited.clear();
      path.length = 0;
      inPath.clear();

      const cycle = dfs(startNode);
      if (cycle && cycle.length > 1) {
        return cycle;
      }
    }

    return scc; // Fallback to the entire SCC
  }

  /**
   * Find cycles using DFS
   */
  private findCyclesDFS(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];

    const dfs = (node: string): void => {
      if (recursionStack.has(node)) {
        // Found cycle
        const cycleStart = pathStack.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = [...pathStack.slice(cycleStart), node];
          if (cycle.length > 1 && cycle.length <= this.config.maxCycleLength) {
            cycles.push({
              id: createId(),
              cycle,
              severity: this.calculateCycleSeverity(cycle),
              depth: cycle.length,
              files: cycle,
              suggestions: this.generateCycleSuggestions(cycle),
              source: 'dfs',
              weight: this.calculateCycleWeight(cycle),
            });
          }
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      pathStack.push(node);

      const neighbors = this.dependencyGraph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      recursionStack.delete(node);
      pathStack.pop();
    };

    for (const node of this.dependencyGraph.nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Calculate cycle severity based on length and weight
   */
  private calculateCycleSeverity(
    cycle: string[]
  ): 'critical' | 'high' | 'medium' | 'low' {
    const depth = cycle.length;
    const weight = this.calculateCycleWeight(cycle);

    if (depth > 6 || weight > 10) {
      return 'critical';
    } else if (depth > 4 || weight > 5) {
      return 'high';
    } else if (depth > 2 || weight > 2) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate weight of a cycle based on dependency counts
   */
  private calculateCycleWeight(cycle: string[]): number {
    let weight = 0;

    for (let i = 0; i < cycle.length; i++) {
      const current = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const edgeKey = `${current}->${next}`;
      weight += this.dependencyGraph.weights.get(edgeKey) || 1;
    }

    return weight;
  }

  /**
   * Generate suggestions for breaking circular dependencies
   */
  private generateCycleSuggestions(cycle: string[]): string[] {
    const suggestions = [
      'Extract common interfaces to break circular dependencies',
      'Use dependency injection to invert dependencies',
      'Move shared types to a separate module',
      'Consider merging related modules if they are tightly coupled',
    ];

    // Add cycle-specific suggestions
    if (cycle.length > 4) {
      suggestions.push(
        'Break the cycle by introducing intermediate abstraction layers'
      );
    }

    if (cycle.length === 2) {
      suggestions.push('Consider if one module can be absorbed into the other');
      suggestions.push('Extract shared functionality into a third module');
    }

    return suggestions;
  }

  /**
   * Filter unique cycles to avoid duplicates between methods
   */
  private filterUniqueCycles(
    existingCycles: CircularDependency[],
    newCycles: CircularDependency[]
  ): CircularDependency[] {
    const uniqueCycles: CircularDependency[] = [];

    for (const newCycle of newCycles) {
      const isDuplicate = existingCycles.some(existing =>
        this.cyclesAreEquivalent(existing.cycle, newCycle.cycle)
      );

      if (!isDuplicate) {
        uniqueCycles.push(newCycle);
      }
    }

    return uniqueCycles;
  }

  /**
   * Check if two cycles are equivalent (same nodes, possibly different starting points)
   */
  private cyclesAreEquivalent(cycle1: string[], cycle2: string[]): boolean {
    if (cycle1.length !== cycle2.length) {
      return false;
    }

    // Normalize both cycles (remove last element if it equals first - closed cycle)
    const norm1 = cycle1.slice();
    const norm2 = cycle2.slice();

    if (norm1.length > 1 && norm1[0] === norm1[norm1.length - 1]) {
      norm1.pop();
    }
    if (norm2.length > 1 && norm2[0] === norm2[norm2.length - 1]) {
      norm2.pop();
    }

    // Check all rotations
    for (let i = 0; i < norm1.length; i++) {
      const rotated = [...norm1.slice(i), ...norm1.slice(0, i)];
      if (rotated.join('|') === norm2.join('|')) {
        return true;
      }
    }

    // Check reverse rotations
    const reversed = [...norm1].reverse();
    for (let i = 0; i < reversed.length; i++) {
      const rotated = [...reversed.slice(i), ...reversed.slice(0, i)];
      if (rotated.join('|') === norm2.join('|')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Enhance cycles with additional analysis
   */
  private enhanceCycles(cycles: CircularDependency[]): CircularDependency[] {
    return cycles.map(cycle => ({
      ...cycle,
      // Add impact analysis
      impact: this.calculateCycleImpact(cycle),
      // Add break point suggestions
      breakPoints: this.identifyBreakPoints(cycle),
      // Add related cycles
      relatedCycles: this.findRelatedCycles(cycle, cycles),
    }));
  }

  /**
   * Calculate impact of breaking a cycle
   */
  private calculateCycleImpact(cycle: CircularDependency): any {
    return {
      affectedFiles: cycle.files.length,
      estimatedRefactoringHours: Math.max(2, cycle.depth * 2),
      riskLevel: cycle.severity,
      buildTimeImprovement:
        (cycle.weight ?? 0) > 5 ? 'significant' : 'moderate',
    };
  }

  /**
   * Identify potential break points in a cycle
   */
  private identifyBreakPoints(cycle: CircularDependency): any[] {
    const breakPoints: any[] = [];

    for (let i = 0; i < cycle.files.length; i++) {
      const current = cycle.files[i];
      const next = cycle.files[(i + 1) % cycle.files.length];
      const edgeKey = `${current}->${next}`;
      const weight = this.dependencyGraph.weights.get(edgeKey) || 1;

      breakPoints.push({
        from: current,
        to: next,
        weight,
        difficulty: weight < 2 ? 'easy' : weight < 5 ? 'medium' : 'hard',
        suggestion:
          weight === 1
            ? 'Extract interface or move shared types'
            : 'Consider architectural refactoring',
      });
    }

    // Sort by difficulty (easiest first)
    return breakPoints.sort((a, b) => a.weight - b.weight);
  }

  /**
   * Find cycles related to the current cycle
   */
  private findRelatedCycles(
    currentCycle: CircularDependency,
    allCycles: CircularDependency[]
  ): string[] {
    const currentFiles = new Set(currentCycle.files);
    const relatedCycleIds: string[] = [];

    for (const otherCycle of allCycles) {
      if (otherCycle.id === currentCycle.id) continue;

      // Check if cycles share any files
      const sharedFiles = otherCycle.files.filter(file =>
        currentFiles.has(file)
      );
      if (sharedFiles.length > 0) {
        relatedCycleIds.push(otherCycle.id);
      }
    }

    return relatedCycleIds;
  }

  /**
   * Generate visualization data for circular dependencies
   */
  generate(cycles: CircularDependency[]): any {
    const nodes = new Set<string>();
    const edges: any[] = [];

    cycles.forEach(cycle => {
      // Add nodes
      cycle.files.forEach(file => nodes.add(file));

      // Add edges for the cycle
      for (let i = 0; i < cycle.files.length; i++) {
        const from = cycle.files[i];
        const to = cycle.files[(i + 1) % cycle.files.length];

        edges.push({
          source: from,
          target: to,
          type: 'circular',
          severity: cycle.severity,
          weight: this.dependencyGraph.weights.get(`${from}->${to}`) || 1,
        });
      }
    });

    return {
      nodes: Array.from(nodes).map(file => ({
        id: file,
        label: path.basename(file),
        file,
        inCycle: true,
      })),
      edges,
    };
  }
}
