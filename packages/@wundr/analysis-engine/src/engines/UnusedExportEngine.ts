/**
 * Unused Export Detection Engine - Identifies unused exports and dead code
 * Advanced analysis with cross-module dependency tracking
 */

import { existsSync } from 'fs';
import * as path from 'path';

import * as fs from 'fs-extra';

import { createId } from '../utils';

import type {
  EntityInfo,
  BaseAnalyzer,
  AnalysisConfig,
  SeverityLevel,
} from '../types';

interface UnusedExport {
  id: string;
  entity: EntityInfo;
  severity: SeverityLevel;
  reason: UnusedReason;
  suggestions: string[];
  potentialImpact: string;
  safeToRemove: boolean;
  usageAnalysis: UsageAnalysis;
}

type UnusedReason =
  | 'never-imported'
  | 'imported-but-unused'
  | 'only-type-usage'
  | 'circular-dependency'
  | 'dead-code'
  | 'redundant-export';

interface UsageAnalysis {
  importedBy: string[];
  usedBy: string[];
  typeOnlyUsage: boolean;
  externalLibraryUsage: boolean;
  dynamicImportUsage: boolean;
  reExportedBy: string[];
}

interface UnusedExportConfig {
  includeTypeExports: boolean;
  includePrivateExports: boolean;
  checkExternalUsage: boolean;
  ignoreTestFiles: boolean;
  ignorePatterns: string[];
  aggressiveAnalysis: boolean;
}

interface DependencyGraph {
  imports: Map<string, Set<string>>; // file -> imported modules
  exports: Map<string, Set<EntityInfo>>; // file -> exported entities
  usage: Map<string, Set<string>>; // entity id -> files using it
  reExports: Map<string, Set<string>>; // file -> re-exported modules
}

/**
 * Advanced unused export detection with comprehensive dependency analysis
 */
export class UnusedExportEngine implements BaseAnalyzer<UnusedExport[]> {
  public readonly name = 'UnusedExportEngine';
  public readonly version = '2.0.0';

  private config: UnusedExportConfig;
  private dependencyGraph: DependencyGraph = {
    imports: new Map(),
    exports: new Map(),
    usage: new Map(),
    reExports: new Map(),
  };

  constructor(_config: Partial<UnusedExportConfig> = {}) {
    this.config = {
      includeTypeExports: true,
      includePrivateExports: false,
      checkExternalUsage: true,
      ignoreTestFiles: true,
      ignorePatterns: ['.test.', '.spec.', '__tests__', 'test/', 'tests/'],
      aggressiveAnalysis: false,
      ..._config,
    };
  }

  /**
   * Analyze entities for unused exports
   */
  async analyze(
    _entities: EntityInfo[],
    _analysisConfig: AnalysisConfig,
  ): Promise<UnusedExport[]> {
    // Build comprehensive dependency graph
    await this.buildDependencyGraph(_entities, _analysisConfig);

    // Identify unused exports
    const unusedExports: UnusedExport[] = [];

    for (const entity of _entities) {
      if (this.shouldAnalyzeEntity(entity)) {
        const unusedAnalysis = await this.analyzeEntityUsage(entity, _entities);
        if (unusedAnalysis) {
          unusedExports.push(unusedAnalysis);
        }
      }
    }

    // Sort by severity and potential impact
    return unusedExports.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Build comprehensive dependency graph
   */
  private async buildDependencyGraph(
    _entities: EntityInfo[],
    _config: AnalysisConfig,
  ): Promise<void> {
    // Clear previous analysis
    this.dependencyGraph = {
      imports: new Map(),
      exports: new Map(),
      usage: new Map(),
      reExports: new Map(),
    };

    // Group entities by file
    const entitiesByFile = new Map<string, EntityInfo[]>();
    _entities.forEach(entity => {
      if (!entitiesByFile.has(entity.file)) {
        entitiesByFile.set(entity.file, []);
      }
      entitiesByFile.get(entity.file)!.push(entity);
    });

    // Build exports map
    entitiesByFile.forEach((fileEntities, filePath) => {
      const exportedEntities = fileEntities.filter(
        e => e.exportType !== 'none',
      );
      if (exportedEntities.length > 0) {
        this.dependencyGraph.exports.set(filePath, new Set(exportedEntities));
      }
    });

    // Analyze imports and usage
    for (const [filePath, fileEntities] of entitiesByFile) {
      await this.analyzeFileImportsAndUsage(filePath, fileEntities, _config);
    }

    // Build usage graph
    await this.buildUsageGraph(_entities);
  }

  /**
   * Analyze imports and usage for a specific file
   */
  private async analyzeFileImportsAndUsage(
    filePath: string,
    _entities: EntityInfo[],
    _config: AnalysisConfig,
  ): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Extract imports from file content
      const imports = this.extractImportsFromContent(fileContent, filePath);
      if (imports.size > 0) {
        this.dependencyGraph.imports.set(filePath, imports);
      }

      // Extract re-exports
      const reExports = this.extractReExportsFromContent(fileContent);
      if (reExports.size > 0) {
        this.dependencyGraph.reExports.set(filePath, reExports);
      }

      // Analyze usage within the file
      this.analyzeInFileUsage(fileContent, filePath, _entities);
    } catch (error) {
      console.warn(`Failed to analyze file ${filePath}:`, error);
    }
  }

  /**
   * Extract import statements from file content
   */
  private extractImportsFromContent(
    content: string,
    filePath: string,
  ): Set<string> {
    const imports = new Set<string>();

    // Regular expressions for different import patterns
    const importPatterns = [
      // import { ... } from '...'
      /import\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g,
      // import * as ... from '...'
      /import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g,
      // import ... from '...'
      /import\s+\w+\s+from\s+['"]([^'"]+)['"]/g,
      // import '...'
      /import\s+['"]([^'"]+)['"]/g,
      // const ... = require('...')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Dynamic imports
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    importPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const matchResult = match[1];
        if (!matchResult) {
continue;
}
        const importPath = this.resolveImportPath(matchResult, filePath);
        imports.add(importPath);
      }
    });

    return imports;
  }

  /**
   * Extract re-export statements from file content
   */
  private extractReExportsFromContent(content: string): Set<string> {
    const reExports = new Set<string>();

    // export { ... } from '...'
    const reExportPattern = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;
    // export * from '...'
    const reExportAllPattern = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;

    [reExportPattern, reExportAllPattern].forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const matchResult = match[1];
        if (!matchResult) {
continue;
}
        reExports.add(matchResult);
      }
    });

    return reExports;
  }

  /**
   * Analyze usage within a file
   */
  private analyzeInFileUsage(
    content: string,
    filePath: string,
    _entities: EntityInfo[],
  ): void {
    // For each exported entity from other files, check if it's used in this file
    for (const [exportFilePath, exportedEntities] of this.dependencyGraph
      .exports) {
      if (exportFilePath === filePath) {
continue;
}

      exportedEntities.forEach(entity => {
        if (this.isEntityUsedInContent(entity, content)) {
          if (!this.dependencyGraph.usage.has(entity.id)) {
            this.dependencyGraph.usage.set(entity.id, new Set());
          }
          this.dependencyGraph.usage.get(entity.id)!.add(filePath);
        }
      });
    }
  }

  /**
   * Check if entity is used in file content
   */
  private isEntityUsedInContent(_entity: EntityInfo, content: string): boolean {
    // Remove comments and strings to avoid false positives
    const cleanContent = this.removeCommentsAndStrings(content);

    // Check for entity name usage
    const namePattern = new RegExp(
      `\\b${this.escapeRegExp(_entity.name)}\\b`,
      'g',
    );

    // Don't count the entity's own declaration
    const lines = cleanContent.split('\n');
    const usageLines = lines.filter((line, _index) => {
      const hasUsage = namePattern.test(line);

      // Skip if it's likely the entity's own declaration/definition line
      if (hasUsage) {
        const isDeclaration = this.isLikelyDeclarationLine(line, _entity);
        return !isDeclaration;
      }

      return false;
    });

    return usageLines.length > 0;
  }

  /**
   * Check if a line is likely an entity declaration
   */
  private isLikelyDeclarationLine(line: string, _entity: EntityInfo): boolean {
    const declarationPatterns = [
      `export\\s+(const|let|var|function|class|interface|type|enum)\\s+${_entity.name}`,
      `^\\s*(const|let|var|function|class|interface|type|enum)\\s+${_entity.name}`,
      `export\\s+default\\s+${_entity.name}`,
      `export\\s*\\{[^}]*${_entity.name}[^}]*\\}`,
    ];

    return declarationPatterns.some(pattern =>
      new RegExp(pattern, 'i').test(line.trim()),
    );
  }

  /**
   * Build usage graph from dependency information
   */
  private async buildUsageGraph(_entities: EntityInfo[]): Promise<void> {
    // Cross-reference imports with exports to build usage graph
    for (const [filePath, importedModules] of this.dependencyGraph.imports) {
      for (const importedModule of importedModules) {
        const resolvedPath = this.resolveImportPath(importedModule, filePath);

        // Find exported entities from the imported module
        const exportedEntities = this.dependencyGraph.exports.get(resolvedPath);
        if (exportedEntities) {
          exportedEntities.forEach(entity => {
            if (!this.dependencyGraph.usage.has(entity.id)) {
              this.dependencyGraph.usage.set(entity.id, new Set());
            }
            this.dependencyGraph.usage.get(entity.id)!.add(filePath);
          });
        }
      }
    }
  }

  /**
   * Analyze entity usage to determine if it's unused
   */
  private async analyzeEntityUsage(
    entity: EntityInfo,
    _allEntities: EntityInfo[],
  ): Promise<UnusedExport | null> {
    const _usage = this.dependencyGraph.usage.get(entity.id) || new Set();
    const usageAnalysis = await this.buildUsageAnalysis(
      entity,
      _usage,
      _allEntities,
    );

    // Determine if entity is unused
    const unusedReason = this.determineUnusedReason(entity, usageAnalysis);
    if (!unusedReason) {
      return null; // Entity is used
    }

    const severity = this.calculateUnusedSeverity(
      entity,
      usageAnalysis,
      unusedReason,
    );
    const suggestions = this.generateUnusedSuggestions(
      entity,
      unusedReason,
      usageAnalysis,
    );
    const safeToRemove = this.isSafeToRemove(
      entity,
      usageAnalysis,
      unusedReason,
    );
    const potentialImpact = this.calculatePotentialImpact(
      entity,
      usageAnalysis,
    );

    return {
      id: createId(),
      entity,
      severity,
      reason: unusedReason,
      suggestions,
      potentialImpact,
      safeToRemove,
      usageAnalysis,
    };
  }

  /**
   * Build comprehensive usage analysis for an entity
   */
  private async buildUsageAnalysis(
    entity: EntityInfo,
    _usage: Set<string>,
    _allEntities: EntityInfo[],
  ): Promise<UsageAnalysis> {
    const usageFiles = Array.from(_usage);

    // Check for type-only usage
    const typeOnlyUsage = await this.isTypeOnlyUsage(entity, usageFiles);

    // Check for external library usage (if entity is exported from index files)
    const externalLibraryUsage = this.checkExternalLibraryUsage(entity);

    // Check for dynamic import usage
    const dynamicImportUsage = await this.checkDynamicImportUsage(
      entity,
      usageFiles,
    );

    // Find re-exports
    const reExportedBy = this.findReExports(entity);

    return {
      importedBy: this.findImporters(entity, _allEntities),
      usedBy: usageFiles,
      typeOnlyUsage,
      externalLibraryUsage,
      dynamicImportUsage,
      reExportedBy,
    };
  }

  /**
   * Find files that import the entity
   */
  private findImporters(
    entity: EntityInfo,
    _allEntities: EntityInfo[],
  ): string[] {
    const importers: string[] = [];

    for (const [filePath, importedModules] of this.dependencyGraph.imports) {
      for (const importedModule of importedModules) {
        const resolvedPath = this.resolveImportPath(importedModule, filePath);
        if (resolvedPath === entity.file) {
          importers.push(filePath);
          break;
        }
      }
    }

    return importers;
  }

  /**
   * Check if entity usage is type-only
   */
  private async isTypeOnlyUsage(
    entity: EntityInfo,
    usageFiles: string[],
  ): Promise<boolean> {
    if (entity.type === 'type' || entity.type === 'interface') {
      return true;
    }

    // Check if used only in type contexts
    for (const filePath of usageFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hasRuntimeUsage = this.hasRuntimeUsage(entity.name, content);
        if (hasRuntimeUsage) {
          return false;
        }
      } catch {
        // If we can't read the file, assume runtime usage
        return false;
      }
    }

    return true;
  }

  /**
   * Check if entity has runtime usage in content
   */
  private hasRuntimeUsage(entityName: string, content: string): boolean {
    const cleanContent = this.removeCommentsAndStrings(content);

    // Patterns that indicate runtime usage
    const runtimePatterns = [
      // Function calls
      new RegExp(`\\b${this.escapeRegExp(entityName)}\\s*\\(`),
      // Property access
      new RegExp(`\\b${this.escapeRegExp(entityName)}\\s*\\.`),
      // Object instantiation
      new RegExp(`\\bnew\\s+${this.escapeRegExp(entityName)}\\b`),
      // Assignment (not type annotation)
      new RegExp(`=\\s*${this.escapeRegExp(entityName)}\\b`),
      // Array/object literal usage
      new RegExp(`[\\[{,]\\s*${this.escapeRegExp(entityName)}\\s*[\\]},]`),
    ];

    return runtimePatterns.some(pattern => pattern.test(cleanContent));
  }

  /**
   * Check for external library usage
   */
  private checkExternalLibraryUsage(entity: EntityInfo): boolean {
    // Check if entity is in an index file or public API file
    const fileName = path.basename(entity.file);
    const isPublicAPI = [
      'index.ts',
      'index.js',
      'public.ts',
      'api.ts',
    ].includes(fileName);

    return isPublicAPI && entity.exportType !== 'none';
  }

  /**
   * Check for dynamic import usage
   */
  private async checkDynamicImportUsage(
    entity: EntityInfo,
    usageFiles: string[],
  ): Promise<boolean> {
    for (const filePath of usageFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hasDynamicImport = /import\s*\([^)]+\)/.test(content);
        if (hasDynamicImport) {
          return true;
        }
      } catch {
        // Ignore read errors
      }
    }
    return false;
  }

  /**
   * Find re-exports of the entity
   */
  private findReExports(entity: EntityInfo): string[] {
    const reExportedBy: string[] = [];

    for (const [filePath, reExportedModules] of this.dependencyGraph
      .reExports) {
      for (const reExportedModule of reExportedModules) {
        const resolvedPath = this.resolveImportPath(reExportedModule, filePath);
        if (resolvedPath === entity.file) {
          reExportedBy.push(filePath);
          break;
        }
      }
    }

    return reExportedBy;
  }

  /**
   * Determine the reason why an entity is unused
   */
  private determineUnusedReason(
    entity: EntityInfo,
    _usage: UsageAnalysis,
  ): UnusedReason | null {
    if (_usage.usedBy.length === 0 && _usage.importedBy.length === 0) {
      return 'never-imported';
    }

    if (_usage.importedBy.length > 0 && _usage.usedBy.length === 0) {
      return 'imported-but-unused';
    }

    if (
      _usage.typeOnlyUsage &&
      entity.type !== 'type' &&
      entity.type !== 'interface'
    ) {
      return 'only-type-usage';
    }

    // Check for circular dependencies
    if (this.hasCircularDependency(entity)) {
      return 'circular-dependency';
    }

    // If aggressive analysis is enabled, check for more cases
    if (this.config.aggressiveAnalysis) {
      if (this.isDeadCode(entity)) {
        return 'dead-code';
      }

      if (this.isRedundantExport(entity, _usage)) {
        return 'redundant-export';
      }
    }

    return null; // Entity is used
  }

  /**
   * Check if entity has circular dependency
   */
  private hasCircularDependency(entity: EntityInfo): boolean {
    // Simplified circular dependency check
    // This would ideally integrate with CircularDependencyEngine
    return entity.dependencies.includes(entity.file);
  }

  /**
   * Check if entity is dead code
   */
  private isDeadCode(entity: EntityInfo): boolean {
    // Check for common dead code patterns
    if (entity.name.includes('TODO') || entity.name.includes('FIXME')) {
      return true;
    }

    // Check if it's a test utility in non-test files
    if (entity.name.includes('Mock') || entity.name.includes('Stub')) {
      const isTestFile = this.config.ignorePatterns.some(pattern =>
        entity.file.includes(pattern),
      );
      return !isTestFile;
    }

    return false;
  }

  /**
   * Check if export is redundant
   */
  private isRedundantExport(entity: EntityInfo, _usage: UsageAnalysis): boolean {
    // If only used internally and re-exported, might be redundant
    return (
      _usage.usedBy.length === 1 &&
      _usage.usedBy[0] === entity.file &&
      _usage.reExportedBy.length === 0
    );
  }

  /**
   * Calculate severity of unused export
   */
  private calculateUnusedSeverity(
    _entity: EntityInfo,
    _usage: UsageAnalysis,
    reason: UnusedReason,
  ): SeverityLevel {
    // External library exports are critical
    if (_usage.externalLibraryUsage) {
      return 'critical';
    }

    // Never imported exports are high priority
    if (reason === 'never-imported') {
      return 'high';
    }

    // Type-only exports are usually lower priority
    if (reason === 'only-type-usage') {
      return 'medium';
    }

    // Dead code is high priority
    if (reason === 'dead-code') {
      return 'high';
    }

    // Circular dependencies are critical
    if (reason === 'circular-dependency') {
      return 'critical';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Check if entity is safe to remove
   */
  private isSafeToRemove(
    _entity: EntityInfo,
    _usage: UsageAnalysis,
    reason: UnusedReason,
  ): boolean {
    // Not safe if used externally
    if (_usage.externalLibraryUsage || _usage.dynamicImportUsage) {
      return false;
    }

    // Not safe if re-exported
    if (_usage.reExportedBy.length > 0) {
      return false;
    }

    // Safe if never imported
    if (reason === 'never-imported') {
      return true;
    }

    // Safe if dead code
    if (reason === 'dead-code') {
      return true;
    }

    // Requires manual review for other cases
    return false;
  }

  /**
   * Calculate potential impact of removal
   */
  private calculatePotentialImpact(
    _entity: EntityInfo,
    _usage: UsageAnalysis,
  ): string {
    if (_usage.externalLibraryUsage) {
      return 'High - May break external consumers';
    }

    if (_usage.reExportedBy.length > 0) {
      return `Medium - Re-exported by ${_usage.reExportedBy.length} file(s)`;
    }

    if (_usage.importedBy.length > 0) {
      return `Low - Imported by ${_usage.importedBy.length} file(s) but not used`;
    }

    return 'Low - No apparent usage';
  }

  /**
   * Generate suggestions for unused exports
   */
  private generateUnusedSuggestions(
    _entity: EntityInfo,
    reason: UnusedReason,
    _usage: UsageAnalysis,
  ): string[] {
    const suggestions: string[] = [];

    switch (reason) {
      case 'never-imported':
        suggestions.push('Remove the export entirely if not needed');
        suggestions.push('Consider if this should be used elsewhere');
        suggestions.push('Check if export name matches expected usage');
        break;

      case 'imported-but-unused':
        suggestions.push('Remove unused imports from consuming files');
        suggestions.push('Remove export if truly unused');
        suggestions.push('Consider if the import was intended to be used');
        break;

      case 'only-type-usage':
        suggestions.push('Convert to type-only export if appropriate');
        suggestions.push('Consider moving to types-only file');
        suggestions.push(
          'Remove runtime implementation if only types are needed',
        );
        break;

      case 'dead-code':
        suggestions.push('Remove dead code and associated exports');
        suggestions.push('Clean up any related test files');
        suggestions.push('Update documentation to remove references');
        break;

      case 'circular-dependency':
        suggestions.push('Resolve circular dependency first');
        suggestions.push('Extract shared dependencies to separate module');
        suggestions.push('Use dependency injection to break cycles');
        break;

      case 'redundant-export':
        suggestions.push('Consider making the entity internal');
        suggestions.push('Evaluate if export is part of public API');
        break;
    }

    return suggestions;
  }

  /**
   * Should analyze entity for unused exports
   */
  private shouldAnalyzeEntity(entity: EntityInfo): boolean {
    // Only analyze exported entities
    if (entity.exportType === 'none') {
      return false;
    }

    // Skip private exports if configured
    if (!this.config.includePrivateExports && entity.name.startsWith('_')) {
      return false;
    }

    // Skip type exports if configured
    if (
      !this.config.includeTypeExports &&
      (entity.type === 'type' || entity.type === 'interface')
    ) {
      return false;
    }

    // Skip test files if configured
    if (
      this.config.ignoreTestFiles &&
      this.config.ignorePatterns.some(pattern => entity.file.includes(pattern))
    ) {
      return false;
    }

    return true;
  }

  /**
   * Resolve import path relative to current file
   */
  private resolveImportPath(importPath: string, currentFile: string): string {
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = path.dirname(currentFile);
      const resolved = path.resolve(currentDir, importPath);

      // Try common extensions
      const extensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '/index.ts',
        '/index.js',
      ];
      for (const ext of extensions) {
        if (existsSync(resolved + ext)) {
          return resolved + ext;
        }
      }

      return resolved;
    }

    return importPath;
  }

  /**
   * Remove comments and strings from content
   */
  private removeCommentsAndStrings(content: string): string {
    // Remove single-line comments
    let cleaned = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove string literals (simplified)
    cleaned = cleaned.replace(/["'`][^"'`]*["'`]/g, '""');

    return cleaned;
  }

  /**
   * Escape string for regex
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get dependency graph (for debugging/visualization)
   */
  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }
}
