/**
 * Enhanced AST Analyzer - High-performance code analysis with 10k+ files support
 * Migrated and optimized from original enhanced-ast-analyzer.ts
 */

import { execSync } from 'child_process';

import chalk from 'chalk';
import { Project } from 'ts-morph';
import * as ts from 'typescript';

import { BaseAnalysisService } from './BaseAnalysisService';
import {
  generateNormalizedHash,
  generateSemanticHash,
  createId,
  normalizeFilePath,
  processConcurrently,
} from '../utils';

import type {
  EntityInfo,
  ExportType,
  ComplexityMetrics,
  AnalysisConfig,
  ServiceConfig,
} from '../types';

/**
 * Enhanced AST Analyzer with performance optimizations for large codebases
 */
export class EnhancedASTAnalyzer extends BaseAnalysisService {
  private project: Project;
  private tsProgram: ts.Program;
  private typeChecker: ts.TypeChecker;
  private imports: Map<string, Set<string>> = new Map();
  private exports: Map<string, Set<string>> = new Map();

  // Add program property to match base class expectations
  protected override program: ts.Program | null = null;

  // Performance optimizations
  private entityBatch: EntityInfo[] = [];
  private batchSize = 1000;

  constructor(config: Partial<AnalysisConfig & ServiceConfig> = {}) {
    super('EnhancedASTAnalyzer', {
      ...config,
      performance: {
        maxConcurrency: 15, // Increased for AST analysis
        chunkSize: 50, // Smaller chunks for memory management
        enableCaching: true,
        ...config.performance,
      },
    });

    // Initialize ts-morph project with optimizations
    this.project = new Project({
      tsConfigFilePath: config.targetDir
        ? `${config.targetDir}/tsconfig.json`
        : './tsconfig.json',
      skipAddingFilesFromTsConfig: true, // We'll add files manually for control
      useInMemoryFileSystem: false, // Use real filesystem for better performance
      compilerOptions: {
        skipLibCheck: true,
        skipDefaultLibCheck: true,
        noResolve: false,
        allowJs: true,
        checkJs: false,
        target: ts.ScriptTarget.ES2020 as any,
        module: ts.ModuleKind.CommonJS as any,
      },
    });

    // Get optimized TypeScript program and type checker
    this.tsProgram = (this.project as any).getProgram?.()?.compilerObject;
    this.typeChecker = this.tsProgram?.getTypeChecker();

    // Initialize the program property for base class compatibility
    this.program = this.tsProgram;
  }

  /**
   * Perform comprehensive AST analysis
   */
  protected override async performAnalysis(
    entities: EntityInfo[],
  ): Promise<any> {
    this.emitProgress({
      type: 'phase',
      message: 'Performing advanced AST analysis...',
    });

    // Run analysis phases concurrently where possible
    const [
      duplicates,
      circularDeps,
      unusedExports,
      codeSmells,
      wrapperPatterns,
    ] = await Promise.all([
      this.detectDuplicatesOptimized(entities),
      this.detectCircularDependencies(),
      this.findUnusedExports(entities),
      this.detectCodeSmells(entities),
      this.detectWrapperPatterns(entities),
    ]);

    const recommendations = this.generateRecommendations({
      duplicates,
      circularDeps,
      unusedExports,
      codeSmells,
      wrapperPatterns,
    });

    const visualizations = this.generateVisualizationData(entities, {
      duplicates,
      circularDeps,
    });

    return {
      duplicates,
      circularDependencies: circularDeps,
      unusedExports,
      codeSmells,
      wrapperPatterns,
      recommendations,
      visualizations,
    };
  }

  /**
   * Extract entity information from TypeScript node
   */
  protected override extractEntityFromNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ): EntityInfo | null {
    const filePath = normalizeFilePath(sourceFile.fileName);
    const position = this.getPositionInfo(node, sourceFile);

    switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        return this.extractClassEntity(
          node as ts.ClassDeclaration,
          filePath,
          position,
        );

      case ts.SyntaxKind.InterfaceDeclaration:
        return this.extractInterfaceEntity(
          node as ts.InterfaceDeclaration,
          filePath,
          position,
        );

      case ts.SyntaxKind.TypeAliasDeclaration:
        return this.extractTypeAliasEntity(
          node as ts.TypeAliasDeclaration,
          filePath,
          position,
        );

      case ts.SyntaxKind.EnumDeclaration:
        return this.extractEnumEntity(
          node as ts.EnumDeclaration,
          filePath,
          position,
        );

      case ts.SyntaxKind.FunctionDeclaration:
        return this.extractFunctionEntity(
          node as ts.FunctionDeclaration,
          filePath,
          position,
        );

      case ts.SyntaxKind.VariableStatement:
        return this.extractVariableEntity(
          node as ts.VariableStatement,
          filePath,
          position,
        );

      default:
        return null;
    }
  }

  /**
   * Extract class entity with enhanced analysis
   */
  private extractClassEntity(
    classDecl: ts.ClassDeclaration,
    filePath: string,
    position: { line: number; column: number },
  ): EntityInfo | null {
    const name = classDecl.name?.getText();
    if (!name) {
return null;
}

    const isService = this.isServiceClass(classDecl, name);
    const isComponent = this.isReactComponent(classDecl, name);

    const methods = this.extractMethods(classDecl);
    const properties = this.extractProperties(classDecl);
    const complexity = this.calculateNodeComplexity(classDecl);
    const dependencies = this.extractNodeDependencies(classDecl, filePath);

    const entity: EntityInfo = {
      id: createId(),
      name,
      type: isService ? 'service' : isComponent ? 'component' : 'class',
      file: filePath,
      startLine: position.line,
      line: position.line,
      column: position.column,
      exportType: this.getExportType(classDecl),
      normalizedHash: generateNormalizedHash({ methods, properties }),
      semanticHash: generateSemanticHash({
        methods,
        properties,
        type: 'class',
      }),
      jsDoc: this.extractJsDoc(classDecl),
      complexity,
      dependencies,
      members: { methods, properties },
    };

    return entity;
  }

  /**
   * Extract interface entity with type information
   */
  private extractInterfaceEntity(
    interfaceDecl: ts.InterfaceDeclaration,
    filePath: string,
    position: { line: number; column: number },
  ): EntityInfo {
    const name = interfaceDecl.name.getText();
    const properties = this.extractInterfaceProperties(interfaceDecl);
    const methods = this.extractInterfaceMethods(interfaceDecl);

    // Sort for consistent hashing
    properties.sort((a, b) => a.name.localeCompare(b.name));
    methods.sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: createId(),
      name,
      type: 'interface',
      file: filePath,
      startLine: position.line,
      line: position.line,
      column: position.column,
      exportType: this.getExportType(interfaceDecl),
      normalizedHash: generateNormalizedHash({ properties, methods }),
      semanticHash: generateSemanticHash({
        properties,
        methods,
        type: 'interface',
      }),
      jsDoc: this.extractJsDoc(interfaceDecl),
      dependencies: this.extractNodeDependencies(interfaceDecl, filePath),
      members: { properties, methods },
    };
  }

  /**
   * Extract type alias entity
   */
  private extractTypeAliasEntity(
    typeAlias: ts.TypeAliasDeclaration,
    filePath: string,
    position: { line: number; column: number },
  ): EntityInfo {
    const name = typeAlias.name.getText();
    const typeText = typeAlias.type.getText();

    return {
      id: createId(),
      name,
      type: 'type',
      file: filePath,
      startLine: position.line,
      line: position.line,
      column: position.column,
      exportType: this.getExportType(typeAlias),
      signature: typeText,
      normalizedHash: generateNormalizedHash(typeText),
      jsDoc: this.extractJsDoc(typeAlias),
      dependencies: this.extractNodeDependencies(typeAlias, filePath),
    };
  }

  /**
   * Extract enum entity
   */
  private extractEnumEntity(
    enumDecl: ts.EnumDeclaration,
    filePath: string,
    position: { line: number; column: number },
  ): EntityInfo {
    const name = enumDecl.name.getText();
    const members = enumDecl.members.map(member => ({
      name: member.name.getText(),
      type: member.initializer?.getText() || '',
      optional: false,
    }));

    return {
      id: createId(),
      name,
      type: 'enum',
      file: filePath,
      startLine: position.line,
      line: position.line,
      column: position.column,
      exportType: this.getExportType(enumDecl),
      normalizedHash: generateNormalizedHash(members),
      jsDoc: this.extractJsDoc(enumDecl),
      dependencies: [],
      members: { properties: members },
    };
  }

  /**
   * Extract function entity with complexity analysis
   */
  private extractFunctionEntity(
    func: ts.FunctionDeclaration,
    filePath: string,
    position: { line: number; column: number },
  ): EntityInfo | null {
    const name = func.name?.getText();
    if (!name) {
return null;
}

    const signature = func.getText();
    const complexity = this.calculateNodeComplexity(func);
    const isHook = this.isReactHook(name);
    const isUtility = this.isUtilityFunction(func, name);

    return {
      id: createId(),
      name,
      type: isHook ? 'hook' : isUtility ? 'utility' : 'function',
      file: filePath,
      startLine: position.line,
      line: position.line,
      column: position.column,
      exportType: this.getExportType(func),
      signature,
      normalizedHash: generateNormalizedHash(signature),
      semanticHash: generateSemanticHash({
        name,
        parameters: func.parameters.length,
      }),
      jsDoc: this.extractJsDoc(func),
      complexity,
      dependencies: this.extractNodeDependencies(func, filePath),
    };
  }

  /**
   * Extract variable entity (const, let, var)
   */
  private extractVariableEntity(
    varStatement: ts.VariableStatement,
    filePath: string,
    position: { line: number; column: number },
  ): EntityInfo | null {
    if (!this.hasExportModifier(varStatement)) {
      return null;
    }

    const declaration = varStatement.declarationList.declarations[0];
    if (!declaration?.name || !ts.isIdentifier(declaration.name)) {
      return null;
    }

    const name = declaration.name.getText();
    const typeText = declaration.type?.getText() || 'unknown';

    return {
      id: createId(),
      name,
      type: 'const',
      file: filePath,
      startLine: position.line,
      line: position.line,
      column: position.column,
      exportType: 'named',
      signature: typeText,
      jsDoc: this.extractJsDoc(varStatement),
      dependencies: [],
    };
  }

  /**
   * Optimized duplicate detection with clustering
   */
  private async detectDuplicatesOptimized(
    entities: EntityInfo[],
  ): Promise<any[]> {
    this.emitProgress({
      type: 'phase',
      message: 'Detecting duplicates with clustering...',
    });

    const hashGroups = new Map<string, EntityInfo[]>();
    const semanticGroups = new Map<string, EntityInfo[]>();

    // Group by hash values
    entities.forEach(entity => {
      if (entity.normalizedHash) {
        if (!hashGroups.has(entity.normalizedHash)) {
          hashGroups.set(entity.normalizedHash, []);
        }
        hashGroups.get(entity.normalizedHash)!.push(entity);
      }

      if (entity.semanticHash) {
        if (!semanticGroups.has(entity.semanticHash)) {
          semanticGroups.set(entity.semanticHash, []);
        }
        semanticGroups.get(entity.semanticHash)!.push(entity);
      }
    });

    const duplicateClusters: any[] = [];

    // Process structural duplicates
    for (const [hash, duplicateEntities] of hashGroups.entries()) {
      if (duplicateEntities.length > 1) {
        const cluster = {
          id: createId(),
          hash,
          type: duplicateEntities[0]?.type || 'unknown',
          severity: this.calculateDuplicateSeverity(duplicateEntities),
          entities: duplicateEntities,
          structuralMatch: true,
          semanticMatch: semanticGroups.has(hash),
          similarity: 1.0,
          consolidationSuggestion:
            this.generateConsolidationSuggestion(duplicateEntities),
        };
        duplicateClusters.push(cluster);
      }
    }

    return duplicateClusters;
  }

  /**
   * Enhanced circular dependency detection
   */
  private async detectCircularDependencies(): Promise<any[]> {
    try {
      this.emitProgress({
        type: 'phase',
        message: 'Analyzing circular dependencies...',
      });

      // Try using madge for comprehensive analysis
      const result = execSync(
        `npx madge --circular --extensions ts,tsx,js,jsx --json "${this.config.targetDir}"`,
        {
          encoding: 'utf-8',
          timeout: 30000,
          cwd: this.config.targetDir,
        },
      );

      const madgeOutput = JSON.parse(result.toString());
      const cycles = madgeOutput.circular || [];

      return cycles.map((cycle: string[]) => ({
        id: createId(),
        cycle,
        severity: this.calculateCircularDependencySeverity(cycle),
        depth: cycle.length,
        files: cycle,
        suggestions: this.generateCircularDependencySuggestions(cycle),
      }));
    } catch (_error) {
      if (this.config.verbose) {
        console.warn(
          chalk.yellow('⚠️ Could not run madge for circular dependencies'),
        );
      }

      // Fallback to internal analysis
      return this.detectCircularDependenciesInternal();
    }
  }

  /**
   * Internal circular dependency detection as fallback
   */
  private detectCircularDependenciesInternal(): any[] {
    const graph = new Map<string, Set<string>>();

    // Build dependency graph
    for (const [file, imports] of this.imports.entries()) {
      if (!graph.has(file)) {
        graph.set(file, new Set());
      }

      for (const importPath of imports) {
        const resolvedPath = this.resolveImportPath(importPath, file);
        if (resolvedPath) {
          graph.get(file)!.add(resolvedPath);
        }
      }
    }

    // Find cycles using DFS
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), neighbor]);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles.map(cycle => ({
      id: createId(),
      cycle,
      severity: this.calculateCircularDependencySeverity(cycle),
      depth: cycle.length,
      files: cycle,
      suggestions: this.generateCircularDependencySuggestions(cycle),
    }));
  }

  /**
   * Find unused exports with cross-reference analysis
   */
  private findUnusedExports(entities: EntityInfo[]): EntityInfo[] {
    this.emitProgress({ type: 'phase', message: 'Finding unused exports...' });

    const exportedEntities = entities.filter(e => e.exportType !== 'none');
    const usedNames = new Set<string>();

    // Collect all imported/used names
    for (const [file, imports] of this.imports.entries()) {
      for (const importPath of imports) {
        // Extract imported names from import statements
        const sourceFile = this.getSourceFile(file);
        if (sourceFile) {
          sourceFile.forEachChild(child => {
            if (ts.isImportDeclaration(child) && child.moduleSpecifier) {
              const moduleSpecifier = child.moduleSpecifier
                .getText()
                .replace(/['"]/g, '');
              if (moduleSpecifier === importPath && child.importClause) {
                this.extractImportedNames(child.importClause, usedNames);
              }
            }
          });
        }
      }
    }

    // Find entities that are exported but never imported
    return exportedEntities.filter(entity => {
      // Skip default exports and common patterns
      if (
        entity.exportType === 'default' ||
        entity.name.startsWith('_') ||
        entity.name.toLowerCase().includes('test')
      ) {
        return false;
      }

      return !usedNames.has(entity.name);
    });
  }

  /**
   * Detect code smells with pattern recognition
   */
  private async detectCodeSmells(entities: EntityInfo[]): Promise<any[]> {
    this.emitProgress({ type: 'phase', message: 'Detecting code smells...' });

    const codeSmells: any[] = [];

    await processConcurrently(
      entities,
      async entity => {
        const smells = this.analyzeEntityForCodeSmells(entity);
        codeSmells.push(...smells);
      },
      this.config.performance.maxConcurrency,
    );

    return codeSmells;
  }

  /**
   * Analyze entity for various code smells
   */
  private analyzeEntityForCodeSmells(entity: EntityInfo): any[] {
    const smells: any[] = [];
    const complexity = entity.complexity;

    // Long method/function
    if (
      complexity?.lines &&
      complexity.lines > this.config.thresholds.fileSize.maxLines / 10
    ) {
      smells.push({
        id: createId(),
        type: 'long-method',
        severity:
          complexity.lines > this.config.thresholds.fileSize.maxLines / 5
            ? 'high'
            : 'medium',
        file: entity.file,
        line: entity.line,
        message: `${entity.type} '${entity.name}' is too long (${complexity.lines} lines)`,
        suggestion: 'Consider breaking down into smaller functions',
        entity,
      });
    }

    // High complexity
    if (
      complexity?.cyclomatic &&
      complexity.cyclomatic > this.config.thresholds.complexity.cyclomatic
    ) {
      smells.push({
        id: createId(),
        type: 'complex-conditional',
        severity:
          complexity.cyclomatic >
          this.config.thresholds.complexity.cyclomatic * 2
            ? 'critical'
            : 'high',
        file: entity.file,
        line: entity.line,
        message: `${entity.type} '${entity.name}' has high cyclomatic complexity (${complexity.cyclomatic})`,
        suggestion: 'Simplify conditional logic or extract methods',
        entity,
      });
    }

    // God object (large class with many responsibilities)
    if (
      entity.type === 'class' &&
      entity.members?.methods &&
      entity.members.methods.length > 20
    ) {
      smells.push({
        id: createId(),
        type: 'god-object',
        severity: 'high',
        file: entity.file,
        line: entity.line,
        message: `Class '${entity.name}' has too many methods (${entity.members.methods.length})`,
        suggestion:
          'Consider splitting into multiple classes with single responsibilities',
        entity,
      });
    }

    return smells;
  }

  /**
   * Detect wrapper patterns with confidence scoring
   */
  private detectWrapperPatterns(entities: EntityInfo[]): any[] {
    const patterns = [
      { prefix: 'Enhanced', confidence: 0.9 },
      { prefix: 'Extended', confidence: 0.9 },
      { prefix: 'Improved', confidence: 0.85 },
      { suffix: 'Integration', confidence: 0.85 },
      { suffix: 'Wrapper', confidence: 0.95 },
      { suffix: 'Adapter', confidence: 0.9 },
      { suffix: 'Proxy', confidence: 0.85 },
    ];

    const wrappers: any[] = [];

    for (const entity of entities) {
      for (const pattern of patterns) {
        let baseName = entity.name;
        let matched = false;

        if (pattern.prefix && entity.name.startsWith(pattern.prefix)) {
          baseName = entity.name.substring(pattern.prefix.length);
          matched = true;
        } else if (pattern.suffix && entity.name.endsWith(pattern.suffix)) {
          baseName = entity.name.substring(
            0,
            entity.name.length - pattern.suffix.length,
          );
          matched = true;
        }

        if (matched) {
          // Look for the base entity
          const baseEntity = entities.find(
            e =>
              e.name === baseName &&
              e.type === entity.type &&
              e.file !== entity.file,
          );

          if (baseEntity) {
            wrappers.push({
              id: createId(),
              base: baseName,
              wrapper: entity.name,
              confidence: pattern.confidence,
              baseEntity,
              wrapperEntity: entity,
            });
          }
        }
      }
    }

    return wrappers;
  }

  // Utility methods for enhanced analysis

  private isServiceClass(
    classDecl: ts.ClassDeclaration,
    name: string,
  ): boolean {
    return (
      name.toLowerCase().includes('service') ||
      this.hasJsDocTag(classDecl, '@service') ||
      this.extendsBaseClass(classDecl, 'Service')
    );
  }

  private isReactComponent(
    classDecl: ts.ClassDeclaration,
    name: string,
  ): boolean {
    return (
      this.extendsBaseClass(classDecl, 'Component') ||
      this.extendsBaseClass(classDecl, 'PureComponent') ||
      /^[A-Z]/.test(name) // React components start with capital letter
    );
  }

  private isReactHook(name: string): boolean {
    return name.startsWith('use') && name.length > 3 && /^use[A-Z]/.test(name);
  }

  private isUtilityFunction(
    func: ts.FunctionDeclaration,
    name: string,
  ): boolean {
    return (
      name.includes('util') ||
      name.includes('helper') ||
      this.hasJsDocTag(func, '@utility')
    );
  }

  private extendsBaseClass(
    classDecl: ts.ClassDeclaration,
    baseClassName: string,
  ): boolean {
    const heritage = classDecl.heritageClauses;
    if (!heritage) {
return false;
}

    for (const clause of heritage) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        for (const type of clause.types) {
          if (type.expression.getText().includes(baseClassName)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private hasJsDocTag(node: ts.Node, tag: string): boolean {
    const jsDoc = ts.getJSDocTags(node);
    return jsDoc.some(jd => jd.tagName.getText() === tag);
  }

  private extractMethods(classDecl: ts.ClassDeclaration): any[] {
    return classDecl.members
      .filter(member => ts.isMethodDeclaration(member))
      .map(method => {
        const methodDecl = method as ts.MethodDeclaration;
        return {
          name: methodDecl.name?.getText() || 'unknown',
          signature: methodDecl.getText(),
          complexity: this.calculateNodeComplexity(methodDecl),
          visibility: this.getVisibility(methodDecl),
        };
      });
  }

  private extractProperties(classDecl: ts.ClassDeclaration): any[] {
    return classDecl.members
      .filter(member => ts.isPropertyDeclaration(member))
      .map(property => {
        const propDecl = property as ts.PropertyDeclaration;
        return {
          name: propDecl.name?.getText() || 'unknown',
          type: propDecl.type?.getText() || 'unknown',
          optional: !!propDecl.questionToken,
          visibility: this.getVisibility(propDecl),
        };
      });
  }

  private extractInterfaceProperties(
    interfaceDecl: ts.InterfaceDeclaration,
  ): any[] {
    return interfaceDecl.members
      .filter(member => ts.isPropertySignature(member))
      .map(property => {
        const propSig = property as ts.PropertySignature;
        return {
          name: propSig.name?.getText() || 'unknown',
          type: propSig.type?.getText() || 'unknown',
          optional: !!propSig.questionToken,
        };
      });
  }

  private extractInterfaceMethods(
    interfaceDecl: ts.InterfaceDeclaration,
  ): any[] {
    return interfaceDecl.members
      .filter(member => ts.isMethodSignature(member))
      .map(method => {
        const methodSig = method as ts.MethodSignature;
        return {
          name: methodSig.name?.getText() || 'unknown',
          signature: methodSig.getText(),
        };
      });
  }

  private getVisibility(
    node: ts.ClassElement,
  ): 'public' | 'private' | 'protected' {
    const modifiers = (node as any).modifiers as ts.Modifier[] | undefined;
    if (modifiers) {
      for (const modifier of modifiers) {
        if (modifier.kind === ts.SyntaxKind.PrivateKeyword) {
return 'private';
}
        if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) {
return 'protected';
}
      }
    }
    return 'public';
  }

  private getExportType(node: ts.Node): ExportType {
    const modifiers = (node as any).modifiers;
    if (!modifiers) {
return 'none';
}

    let hasExport = false;
    let hasDefault = false;

    for (const modifier of modifiers) {
      if (modifier.kind === ts.SyntaxKind.ExportKeyword) {
hasExport = true;
}
      if (modifier.kind === ts.SyntaxKind.DefaultKeyword) {
hasDefault = true;
}
    }

    if (hasExport) {
      return hasDefault ? 'default' : 'named';
    }

    return 'none';
  }

  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = (node as any).modifiers;
    if (!modifiers) {
return false;
}

    return modifiers.some(
      (modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  }

  private extractJsDoc(node: ts.Node): string {
    const jsDocTags = ts.getJSDocTags(node);
    if (jsDocTags.length === 0) {
return '';
}

    const comments = ts.getJSDocCommentsAndTags(node);
    return comments
      .map(comment => comment.getText())
      .join('\n')
      .trim();
  }

  private calculateNodeComplexity(node: ts.Node): ComplexityMetrics {
    let cyclomatic = 1;
    let cognitive = 0;
    let _depth = 0;
    let maxDepth = 0;
    let parameters = 0;
    let lines = 0;

    // Count lines
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    lines = end.line - start.line + 1;

    // Extract parameters for functions/methods
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      parameters = node.parameters.length;
    }

    // Calculate complexity
    const visit = (child: ts.Node, currentDepth: number) => {
      _depth = currentDepth;
      maxDepth = Math.max(maxDepth, currentDepth);

      switch (child.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
          cyclomatic++;
          cognitive += currentDepth === 0 ? 1 : currentDepth;
          break;

        case ts.SyntaxKind.BinaryExpression: {
          const binExpr = child as ts.BinaryExpression;
          if (
            binExpr.operatorToken.kind ===
              ts.SyntaxKind.AmpersandAmpersandToken ||
            binExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken
          ) {
            cyclomatic++;
            cognitive += currentDepth === 0 ? 1 : currentDepth;
          }
          break;
        }
      }

      // Increase depth for nested structures
      const newDepth = this.isNestingStructure(child)
        ? currentDepth + 1
        : currentDepth;

      ts.forEachChild(child, grandChild => visit(grandChild, newDepth));
    };

    ts.forEachChild(node, child => visit(child, 0));

    // Calculate maintainability index (simplified)
    const maintainability = Math.max(
      0,
      Math.min(
        100,
        171 -
          5.2 * Math.log(lines || 1) -
          0.23 * cyclomatic -
          16.2 * Math.log(parameters + 1),
      ),
    );

    return {
      cyclomatic,
      cognitive,
      maintainability,
      depth: maxDepth,
      parameters,
      lines,
    };
  }

  private isNestingStructure(node: ts.Node): boolean {
    return [
      ts.SyntaxKind.IfStatement,
      ts.SyntaxKind.WhileStatement,
      ts.SyntaxKind.ForStatement,
      ts.SyntaxKind.ForInStatement,
      ts.SyntaxKind.ForOfStatement,
      ts.SyntaxKind.WhileStatement,
      ts.SyntaxKind.TryStatement,
      ts.SyntaxKind.SwitchStatement,
    ].includes(node.kind);
  }

  private extractNodeDependencies(
    node: ts.Node,
    currentFile: string,
  ): string[] {
    const dependencies = new Set<string>();

    const visit = (child: ts.Node) => {
      if (ts.isImportDeclaration(child) && child.moduleSpecifier) {
        const moduleSpecifier = child.moduleSpecifier
          .getText()
          .replace(/['"]/g, '');
        if (moduleSpecifier.startsWith('.')) {
          const resolved = this.resolveImportPath(moduleSpecifier, currentFile);
          if (resolved) {
            dependencies.add(resolved);
          }
        }
      }

      ts.forEachChild(child, visit);
    };

    visit(node);
    return Array.from(dependencies);
  }

  private extractImportedNames(
    importClause: ts.ImportClause,
    usedNames: Set<string>,
  ): void {
    // Default import
    if (importClause.name) {
      usedNames.add(importClause.name.getText());
    }

    // Named imports
    if (importClause.namedBindings) {
      if (ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          usedNames.add(element.name.getText());
        }
      } else if (ts.isNamespaceImport(importClause.namedBindings)) {
        usedNames.add(importClause.namedBindings.name.getText());
      }
    }
  }

  private resolveImportPath(
    importPath: string,
    fromFile: string,
  ): string | null {
    try {
      const basePath = fromFile.substring(0, fromFile.lastIndexOf('/'));
      let resolvedPath = importPath;

      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        resolvedPath = normalizeFilePath(`${basePath}/${importPath}`);
      }

      // Try different extensions
      const extensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '/index.ts',
        '/index.tsx',
      ];
      for (const ext of extensions) {
        const fullPath = `${resolvedPath}${ext}`;
        if (this.program?.getSourceFile(fullPath)) {
          return fullPath;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private calculateDuplicateSeverity(
    entities: EntityInfo[],
  ): 'critical' | 'high' | 'medium' | 'low' {
    const count = entities.length;
    const totalComplexity = entities.reduce(
      (sum, e) => sum + (e.complexity?.cyclomatic || 0),
      0,
    );
    const avgDependencies =
      entities.reduce((sum, e) => sum + e.dependencies.length, 0) / count;

    if (count > 4 || totalComplexity > 100 || avgDependencies > 15) {
      return 'critical';
    } else if (count > 3 || totalComplexity > 50 || avgDependencies > 10) {
      return 'high';
    } else if (count > 2 || totalComplexity > 20 || avgDependencies > 5) {
      return 'medium';
    }
    return 'low';
  }

  private calculateCircularDependencySeverity(
    cycle: string[],
  ): 'critical' | 'high' | 'medium' | 'low' {
    const depth = cycle.length;

    if (depth > 5) {
return 'critical';
}
    if (depth > 3) {
return 'high';
}
    if (depth > 2) {
return 'medium';
}
    return 'low';
  }

  private generateConsolidationSuggestion(entities: EntityInfo[]): any {
    const primaryEntity = entities[0];
    if (!primaryEntity) {
return null;
}

    const strategy =
      primaryEntity.type === 'interface'
        ? 'merge'
        : primaryEntity.type === 'class'
          ? 'extract'
          : 'refactor';

    return {
      strategy,
      targetFile: primaryEntity.file,
      estimatedEffort:
        entities.length > 3 ? 'high' : entities.length > 2 ? 'medium' : 'low',
      impact: `Consolidating ${entities.length} duplicate ${primaryEntity.type}s will reduce maintenance burden`,
      steps: [
        'Review duplicate implementations for differences',
        'Create unified implementation',
        'Update all references',
        'Remove duplicate code',
        'Test changes thoroughly',
      ],
    };
  }

  private generateCircularDependencySuggestions(_cycle: string[]): string[] {
    return [
      'Extract common interfaces to break circular dependencies',
      'Use dependency injection to invert dependencies',
      'Consider merging related modules',
      'Introduce intermediate abstraction layer',
      'Move shared types to separate module',
    ];
  }

  private generateRecommendations(analysisResults: any): any[] {
    const recommendations: any[] = [];

    // Critical duplicates
    analysisResults.duplicates
      .filter((d: any) => d.severity === 'critical')
      .forEach((cluster: any) => {
        recommendations.push({
          id: createId(),
          type: 'MERGE_DUPLICATES',
          priority: 'critical',
          title: `Merge ${cluster.entities.length} duplicate ${cluster.type}s`,
          description: `Found ${cluster.entities.length} duplicate ${cluster.type}s that should be consolidated`,
          impact: 'High - Reduces code duplication and maintenance burden',
          effort: cluster.consolidationSuggestion?.estimatedEffort || 'medium',
          entities: cluster.entities.map((e: any) => `${e.name} (${e.file})`),
          estimatedTimeHours: cluster.entities.length * 2,
          steps: cluster.consolidationSuggestion?.steps,
        });
      });

    // Circular dependencies
    if (analysisResults.circularDeps?.length > 0) {
      recommendations.push({
        id: createId(),
        type: 'BREAK_CIRCULAR_DEPS',
        priority: 'high',
        title: `Break ${analysisResults.circularDeps.length} circular dependencies`,
        description:
          'Circular dependencies can cause build issues and make code harder to understand',
        impact: 'Critical - Improves build times and prevents runtime issues',
        effort: 'high',
        estimatedTimeHours: analysisResults.circularDeps.length * 4,
      });
    }

    // Unused exports
    if (analysisResults.unusedExports?.length > 0) {
      recommendations.push({
        id: createId(),
        type: 'REMOVE_DEAD_CODE',
        priority: 'medium',
        title: `Remove ${analysisResults.unusedExports.length} unused exports`,
        description: 'Dead code increases bundle size and maintenance burden',
        impact: 'Medium - Reduces bundle size and complexity',
        effort: 'low',
        estimatedTimeHours: analysisResults.unusedExports.length * 0.25,
      });
    }

    // Code smells
    const criticalSmells =
      analysisResults.codeSmells?.filter(
        (s: any) => s.severity === 'critical',
      ) || [];
    if (criticalSmells.length > 0) {
      recommendations.push({
        id: createId(),
        type: 'REDUCE_COMPLEXITY',
        priority: 'high',
        title: `Fix ${criticalSmells.length} critical complexity issues`,
        description:
          'High complexity code is harder to maintain and more prone to bugs',
        impact: 'High - Improves code maintainability and reduces bug risk',
        effort: 'medium',
        estimatedTimeHours: criticalSmells.length * 1.5,
      });
    }

    return recommendations.sort((a, b) => {
      const priorities = { critical: 0, high: 1, medium: 2, low: 3 };
      return (
        priorities[a.priority as keyof typeof priorities] -
        priorities[b.priority as keyof typeof priorities]
      );
    });
  }

  private generateVisualizationData(
    entities: EntityInfo[],
    analysisResults: any,
  ): any {
    // Generate data for dependency graphs, duplicate networks, and complexity heatmaps
    return {
      dependencyGraph: this.generateDependencyGraphData(entities),
      duplicateNetworks: this.generateDuplicateNetworkData(
        analysisResults.duplicates,
      ),
      complexityHeatmap: this.generateComplexityHeatmapData(entities),
    };
  }

  private generateDependencyGraphData(entities: EntityInfo[]): any {
    const nodes = entities.map(entity => ({
      id: entity.id,
      label: entity.name,
      type: entity.type,
      file: entity.file,
      complexity: entity.complexity?.cyclomatic,
    }));

    const edges: any[] = [];
    const fileToEntities = new Map<string, EntityInfo[]>();

    entities.forEach(entity => {
      if (!fileToEntities.has(entity.file)) {
        fileToEntities.set(entity.file, []);
      }
      fileToEntities.get(entity.file)!.push(entity);
    });

    // Create edges based on dependencies
    entities.forEach(entity => {
      entity.dependencies.forEach(depFile => {
        const depEntities = fileToEntities.get(depFile) || [];
        depEntities.forEach(depEntity => {
          edges.push({
            source: entity.id,
            target: depEntity.id,
            type: 'import',
          });
        });
      });
    });

    return { nodes, edges };
  }

  private generateDuplicateNetworkData(duplicates: any[]): any[] {
    return duplicates.map(cluster => ({
      clusterId: cluster.id,
      nodes: cluster.entities.map((entity: any) => ({
        id: entity.id,
        label: entity.name,
        file: entity.file,
        similarity: cluster.similarity,
      })),
      edges: this.generateDuplicateEdges(cluster.entities, cluster.similarity),
    }));
  }

  private generateDuplicateEdges(entities: any[], similarity: number): any[] {
    const edges: any[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        edges.push({
          source: entities[i].id,
          target: entities[j].id,
          similarity,
        });
      }
    }

    return edges;
  }

  private generateComplexityHeatmapData(entities: EntityInfo[]): any[] {
    const fileComplexity = new Map<string, any>();

    entities.forEach(entity => {
      if (!fileComplexity.has(entity.file)) {
        fileComplexity.set(entity.file, {
          file: entity.file,
          complexity: 0,
          entities: [],
        });
      }

      const fileData = fileComplexity.get(entity.file)!;
      const complexity = entity.complexity?.cyclomatic || 0;

      fileData.complexity += complexity;
      fileData.entities.push({
        name: entity.name,
        complexity,
        line: entity.line,
      });
    });

    return Array.from(fileComplexity.values());
  }
}
