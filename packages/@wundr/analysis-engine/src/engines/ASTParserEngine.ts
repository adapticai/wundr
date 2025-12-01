/**
 * AST Parser Engine - Advanced TypeScript/JavaScript AST parsing and analysis
 * Core component for analyzing source code structure and extracting entity information
 */

import * as path from 'path';

import * as fs from 'fs-extra';
import { Project, SyntaxKind, ts } from 'ts-morph';

import {
  createId,
  generateNormalizedHash,
  generateSemanticHash,
} from '../utils';

import type {
  EntityInfo,
  EntityType,
  ExportType,
  ComplexityMetrics,
  EntityMembers,
  BaseAnalyzer,
  AnalysisConfig,
} from '../types';
import type {
  SourceFile,
  Node,
  ClassDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  EnumDeclaration,
  FunctionDeclaration,
  MethodDeclaration,
  VariableDeclaration,
  ArrowFunction,
  BinaryExpression,
} from 'ts-morph';

interface ASTParsingConfig {
  includePrivateMembers: boolean;
  analyzeNodeModules: boolean;
  includeTypeDefinitions: boolean;
  extractJSDoc: boolean;
  calculateComplexity: boolean;
  preserveComments: boolean;
  parseOptions: {
    allowJs: boolean;
    jsx: boolean;
    target: ts.ScriptTarget;
    module: ts.ModuleKind;
  };
}

interface ParsedFileResult {
  filePath: string;
  entities: EntityInfo[];
  imports: string[];
  exports: string[];
  dependencies: string[];
  ast: SourceFile;
  diagnostics: ts.Diagnostic[];
}

/**
 * Advanced AST parser for TypeScript and JavaScript with comprehensive entity extraction
 */
export class ASTParserEngine implements BaseAnalyzer<EntityInfo[]> {
  public readonly name = 'ASTParserEngine';
  public readonly version = '3.0.0';

  private config: ASTParsingConfig;
  private project: Project;
  private typeChecker?: ts.TypeChecker;
  private parsedFiles = new Map<string, ParsedFileResult>();

  constructor(config: Partial<ASTParsingConfig> = {}) {
    this.config = {
      includePrivateMembers: false,
      analyzeNodeModules: false,
      includeTypeDefinitions: true,
      extractJSDoc: true,
      calculateComplexity: true,
      preserveComments: true,
      parseOptions: {
        allowJs: true,
        jsx: true,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
      ...config,
    };

    // Initialize ts-morph project
    this.project = new Project({
      compilerOptions: {
        target: this.config.parseOptions.target,
        module: this.config.parseOptions.module,
        allowJs: this.config.parseOptions.allowJs,
        jsx: this.config.parseOptions.jsx ? ts.JsxEmit.Preserve : undefined,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      useInMemoryFileSystem: false,
    });
  }

  /**
   * Analyze source files and extract entities
   */
  async analyze(
    files: string[] | EntityInfo[],
    analysisConfig: AnalysisConfig
  ): Promise<EntityInfo[]> {
    // If we receive EntityInfo[], we're being called as part of a pipeline - return them
    if (files.length > 0 && typeof files[0] === 'object' && 'id' in files[0]) {
      return files as EntityInfo[];
    }

    const filePaths = files as string[];
    const allEntities: EntityInfo[] = [];

    // Clear previous results
    this.parsedFiles.clear();

    try {
      // Add source files to project
      for (const filePath of filePaths) {
        if (await this.shouldAnalyzeFile(filePath, analysisConfig)) {
          await this.addSourceFile(filePath);
        }
      }

      // Parse all files
      const sourceFiles = this.project.getSourceFiles();
      for (const sourceFile of sourceFiles) {
        const result = await this.parseSourceFile(sourceFile);
        if (result) {
          this.parsedFiles.set(result.filePath, result);
          allEntities.push(...result.entities);
        }
      }

      // Post-process to resolve dependencies and enhance entities
      await this.postProcessEntities(allEntities);

      return allEntities;
    } catch (error) {
      console.error('AST parsing failed:', error);
      return [];
    }
  }

  /**
   * Determine if file should be analyzed
   */
  private async shouldAnalyzeFile(
    filePath: string,
    config: AnalysisConfig
  ): Promise<boolean> {
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      return false;
    }

    // Check exclusions
    if (config.excludePatterns.some(pattern => filePath.includes(pattern))) {
      return false;
    }

    // Check if it's in node_modules and we should skip
    if (!this.config.analyzeNodeModules && filePath.includes('node_modules')) {
      return false;
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

    if (this.config.includeTypeDefinitions) {
      supportedExtensions.push('.d.ts');
    }

    return supportedExtensions.includes(ext);
  }

  /**
   * Add source file to project
   */
  private async addSourceFile(filePath: string): Promise<void> {
    try {
      const absolutePath = path.resolve(filePath);
      if (!this.project.getSourceFile(absolutePath)) {
        this.project.addSourceFileAtPath(absolutePath);
      }
    } catch (error) {
      console.warn(`Failed to add source file ${filePath}:`, error);
    }
  }

  /**
   * Parse a source file and extract entities
   */
  private async parseSourceFile(
    sourceFile: SourceFile
  ): Promise<ParsedFileResult | null> {
    try {
      const filePath = sourceFile.getFilePath();
      const entities: EntityInfo[] = [];
      const imports: string[] = [];
      const exports: string[] = [];
      const dependencies: string[] = [];

      // Extract imports
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        imports.push(moduleSpecifier);
        dependencies.push(
          this.resolveDependencyPath(moduleSpecifier, filePath)
        );
      }

      // Parse AST nodes
      await this.visitNode(sourceFile, entities, filePath, dependencies);

      // Extract exports
      const exportDeclarations = sourceFile.getExportDeclarations();
      for (const exportDecl of exportDeclarations) {
        const moduleSpecifier = exportDecl.getModuleSpecifierValue();
        if (moduleSpecifier) {
          exports.push(moduleSpecifier);
        }
      }

      // Get TypeScript diagnostics
      const diagnostics = sourceFile.getPreEmitDiagnostics();

      return {
        filePath,
        entities,
        imports,
        exports,
        dependencies,
        ast: sourceFile,
        diagnostics: diagnostics.map(d => d.compilerObject),
      };
    } catch (error) {
      console.warn(`Failed to parse ${sourceFile.getFilePath()}:`, error);
      return null;
    }
  }

  /**
   * Visit AST node and extract entity information
   */
  private async visitNode(
    node: Node,
    entities: EntityInfo[],
    filePath: string,
    dependencies: string[],
    parentEntity?: EntityInfo
  ): Promise<void> {
    // Extract entity based on node type
    const entity = this.extractEntityFromNode(
      node,
      filePath,
      dependencies,
      parentEntity
    );
    if (entity) {
      entities.push(entity);
    }

    // Recursively visit children
    for (const child of node.getChildren()) {
      await this.visitNode(
        child,
        entities,
        filePath,
        dependencies,
        entity || parentEntity
      );
    }
  }

  /**
   * Extract entity information from AST node
   */
  private extractEntityFromNode(
    node: Node,
    filePath: string,
    dependencies: string[],
    parent?: EntityInfo
  ): EntityInfo | null {
    let entityType: EntityType | null = null;
    let name: string = '';
    let exportType: ExportType = 'none';
    let signature: string = '';
    let jsDoc: string = '';
    let members: EntityMembers | undefined;

    // Determine entity type and extract information based on node kind
    switch (node.getKind()) {
      case SyntaxKind.ClassDeclaration: {
        entityType = 'class';
        const classDecl = node as ClassDeclaration;
        name = classDecl.getName() || 'AnonymousClass';
        signature = this.extractClassSignature(classDecl);
        members = this.extractClassMembers(classDecl);
        exportType = this.determineExportType(classDecl);
        jsDoc = this.extractJSDoc(classDecl);
        break;
      }

      case SyntaxKind.InterfaceDeclaration: {
        entityType = 'interface';
        const interfaceDecl = node as InterfaceDeclaration;
        name = interfaceDecl.getName();
        signature = this.extractInterfaceSignature(interfaceDecl);
        members = this.extractInterfaceMembers(interfaceDecl);
        exportType = this.determineExportType(interfaceDecl);
        jsDoc = this.extractJSDoc(interfaceDecl);
        break;
      }

      case SyntaxKind.TypeAliasDeclaration: {
        entityType = 'type';
        const typeDecl = node as TypeAliasDeclaration;
        name = typeDecl.getName();
        signature = this.extractTypeSignature(typeDecl);
        exportType = this.determineExportType(typeDecl);
        jsDoc = this.extractJSDoc(typeDecl);
        break;
      }

      case SyntaxKind.EnumDeclaration: {
        entityType = 'enum';
        const enumDecl = node as EnumDeclaration;
        name = enumDecl.getName();
        signature = this.extractEnumSignature(enumDecl);
        exportType = this.determineExportType(enumDecl);
        jsDoc = this.extractJSDoc(enumDecl);
        break;
      }

      case SyntaxKind.FunctionDeclaration: {
        entityType = 'function';
        const funcDecl = node as FunctionDeclaration;
        name = funcDecl.getName() || 'AnonymousFunction';
        signature = this.extractFunctionSignature(funcDecl);
        exportType = this.determineExportType(funcDecl);
        jsDoc = this.extractJSDoc(funcDecl);
        break;
      }

      case SyntaxKind.MethodDeclaration: {
        entityType = 'method';
        const methodDecl = node as MethodDeclaration;
        name = methodDecl.getName();
        signature = this.extractMethodSignature(methodDecl);
        jsDoc = this.extractJSDoc(methodDecl);
        break;
      }

      case SyntaxKind.VariableDeclaration: {
        const varDecl = node as VariableDeclaration;
        name = varDecl.getName();

        // Determine if it's const or variable
        const variableStatement = varDecl.getVariableStatement();
        if (variableStatement) {
          const declarationKind = variableStatement.getDeclarationKind();
          entityType = declarationKind === 'const' ? 'const' : 'variable';
          exportType = this.determineExportType(variableStatement);
          signature = this.extractVariableSignature(varDecl);
          jsDoc = this.extractJSDoc(variableStatement);
        }
        break;
      }

      case SyntaxKind.ArrowFunction: {
        entityType = 'function';
        const arrowFunc = node as ArrowFunction;
        name = parent
          ? `${parent.name}_arrow_${Date.now()}`
          : `arrow_${Date.now()}`;
        signature = this.extractArrowFunctionSignature(arrowFunc);
        break;
      }

      default:
        return null;
    }

    if (!entityType || !name) {
      return null;
    }

    // Skip private members if configured
    if (!this.config.includePrivateMembers && name.startsWith('_')) {
      return null;
    }

    // Calculate position information
    const start = node.getStart();
    const sourceFile = node.getSourceFile();
    const { line, column } = sourceFile.getLineAndColumnAtPos(start);
    const endPos = node.getEnd();
    const endLineColumn = sourceFile.getLineAndColumnAtPos(endPos);

    // Calculate complexity if enabled
    let complexity: ComplexityMetrics | undefined;
    if (this.config.calculateComplexity && signature) {
      complexity = this.calculateNodeComplexity(node, signature);
    }

    // Generate hashes
    const normalizedHash = generateNormalizedHash(signature || name);
    const semanticHash = generateSemanticHash(signature || name);

    const entity: EntityInfo = {
      id: createId(),
      name,
      type: entityType,
      file: filePath,
      startLine: line,
      endLine: endLineColumn.line,
      line, // Keep for compatibility
      column,
      exportType,
      signature,
      normalizedHash,
      semanticHash,
      jsDoc: this.config.extractJSDoc ? jsDoc : undefined,
      complexity,
      dependencies,
      members,
      metadata: {
        nodeKind: node.getKindName(),
        hasJSDoc: !!jsDoc,
        isExported: exportType !== 'none',
        parentEntity: parent?.id,
      },
    };

    return entity;
  }

  /**
   * Extract class signature
   */
  private extractClassSignature(classDecl: ClassDeclaration): string {
    try {
      return classDecl.getText();
    } catch {
      return `class ${classDecl.getName() || 'Anonymous'} { ... }`;
    }
  }

  /**
   * Extract class members
   */
  private extractClassMembers(classDecl: ClassDeclaration): EntityMembers {
    const members: EntityMembers = {
      properties: [],
      methods: [],
    };

    try {
      // Extract properties
      const properties = classDecl.getProperties();
      for (const prop of properties) {
        members.properties!.push({
          name: prop.getName(),
          type: prop.getType()?.getText() || 'any',
          optional: prop.hasQuestionToken(),
          visibility: this.getVisibility(prop),
        });
      }

      // Extract methods
      const methods = classDecl.getMethods();
      for (const method of methods) {
        const complexity = this.config.calculateComplexity
          ? this.calculateNodeComplexity(method, method.getText())
          : undefined;

        members.methods!.push({
          name: method.getName(),
          signature: method.getText(),
          complexity: complexity?.cyclomatic,
          visibility: this.getVisibility(method),
        });
      }
    } catch (error) {
      console.warn('Failed to extract class members:', error);
    }

    return members;
  }

  /**
   * Extract interface signature
   */
  private extractInterfaceSignature(
    interfaceDecl: InterfaceDeclaration
  ): string {
    try {
      return interfaceDecl.getText();
    } catch {
      return `interface ${interfaceDecl.getName()} { ... }`;
    }
  }

  /**
   * Extract interface members
   */
  private extractInterfaceMembers(
    interfaceDecl: InterfaceDeclaration
  ): EntityMembers {
    const members: EntityMembers = {
      properties: [],
      methods: [],
    };

    try {
      // Extract property signatures
      const properties = interfaceDecl.getProperties();
      for (const prop of properties) {
        members.properties!.push({
          name: prop.getName(),
          type: prop.getType()?.getText() || 'any',
          optional: prop.hasQuestionToken(),
        });
      }

      // Extract method signatures
      const methods = interfaceDecl.getMethods();
      for (const method of methods) {
        members.methods!.push({
          name: method.getName(),
          signature: method.getText(),
        });
      }
    } catch (error) {
      console.warn('Failed to extract interface members:', error);
    }

    return members;
  }

  /**
   * Extract type signature
   */
  private extractTypeSignature(typeDecl: TypeAliasDeclaration): string {
    try {
      return typeDecl.getText();
    } catch {
      return `type ${typeDecl.getName()} = ...`;
    }
  }

  /**
   * Extract enum signature
   */
  private extractEnumSignature(enumDecl: EnumDeclaration): string {
    try {
      return enumDecl.getText();
    } catch {
      return `enum ${enumDecl.getName()} { ... }`;
    }
  }

  /**
   * Extract function signature
   */
  private extractFunctionSignature(funcDecl: FunctionDeclaration): string {
    try {
      return funcDecl.getText();
    } catch {
      return `function ${funcDecl.getName() || 'anonymous'}(...) { ... }`;
    }
  }

  /**
   * Extract method signature
   */
  private extractMethodSignature(methodDecl: MethodDeclaration): string {
    try {
      return methodDecl.getText();
    } catch {
      return `${methodDecl.getName()}(...) { ... }`;
    }
  }

  /**
   * Extract variable signature
   */
  private extractVariableSignature(varDecl: VariableDeclaration): string {
    try {
      return varDecl.getText();
    } catch {
      return `${varDecl.getName()} = ...`;
    }
  }

  /**
   * Extract arrow function signature
   */
  private extractArrowFunctionSignature(arrowFunc: ArrowFunction): string {
    try {
      return arrowFunc.getText();
    } catch {
      return '(...) => { ... }';
    }
  }

  /**
   * Determine export type
   */
  private determineExportType(node: Node): ExportType {
    try {
      if (
        'isDefaultExport' in node &&
        typeof node.isDefaultExport === 'function' &&
        node.isDefaultExport()
      ) {
        return 'default';
      }
      if (
        'isExported' in node &&
        typeof node.isExported === 'function' &&
        node.isExported()
      ) {
        return 'named';
      }
    } catch {
      // Ignore errors
    }
    return 'none';
  }

  /**
   * Extract JSDoc comment
   */
  private extractJSDoc(node: Node): string {
    try {
      if ('getJsDocs' in node && typeof node.getJsDocs === 'function') {
        const jsDocs = node.getJsDocs();
        return jsDocs.map(doc => doc.getText()).join('\n');
      }
    } catch {
      return '';
    }
    return '';
  }

  /**
   * Get member visibility
   */
  private getVisibility(node: Node): 'public' | 'private' | 'protected' {
    try {
      if ('hasModifier' in node && typeof node.hasModifier === 'function') {
        if (node.hasModifier(SyntaxKind.PrivateKeyword)) {
          return 'private';
        }
        if (node.hasModifier(SyntaxKind.ProtectedKeyword)) {
          return 'protected';
        }
      }
    } catch {
      // Ignore errors
    }
    return 'public';
  }

  /**
   * Calculate complexity metrics for a node
   */
  private calculateNodeComplexity(
    node: Node,
    signature: string
  ): ComplexityMetrics {
    let cyclomatic = 1;
    let cognitive = 0;
    let maxDepth = 0;
    let parameters = 0;

    const lines = signature.split('\n').filter(line => line.trim()).length;

    try {
      // Count parameters for function-like nodes
      if ('getParameters' in node && typeof node.getParameters === 'function') {
        const params = node.getParameters();
        parameters = Array.isArray(params) ? params.length : 0;
      }

      // Walk the AST to calculate complexity
      const visit = (child: Node, depth: number) => {
        maxDepth = Math.max(maxDepth, depth);

        switch (child.getKind()) {
          case SyntaxKind.IfStatement:
          case SyntaxKind.WhileStatement:
          case SyntaxKind.ForStatement:
          case SyntaxKind.ForInStatement:
          case SyntaxKind.ForOfStatement:
          case SyntaxKind.ConditionalExpression:
          case SyntaxKind.CaseClause:
          case SyntaxKind.CatchClause:
            cyclomatic++;
            cognitive += Math.max(1, depth);
            break;

          case SyntaxKind.BinaryExpression: {
            const binExpr = child as BinaryExpression;
            if (
              'getOperatorToken' in binExpr &&
              typeof binExpr.getOperatorToken === 'function'
            ) {
              const operatorKind = binExpr.getOperatorToken().getKind();
              if (
                [
                  SyntaxKind.AmpersandAmpersandToken,
                  SyntaxKind.BarBarToken,
                ].includes(operatorKind)
              ) {
                cyclomatic++;
                cognitive += Math.max(1, depth);
              }
            }
            break;
          }
        }

        // Visit children with updated depth
        const newDepth = this.isComplexityNestingNode(child)
          ? depth + 1
          : depth;
        child.getChildren().forEach(grandChild => visit(grandChild, newDepth));
      };

      node.getChildren().forEach(child => visit(child, 0));
    } catch (error) {
      console.warn('Complexity calculation failed:', error);
    }

    // Calculate maintainability index
    const maintainability = Math.max(
      0,
      Math.min(
        100,
        171 -
          5.2 * Math.log(lines * Math.log2(parameters + 1)) -
          0.23 * cyclomatic -
          16.2 * Math.log(lines)
      )
    );

    return {
      cyclomatic,
      cognitive,
      maintainability: Math.round(maintainability * 100) / 100,
      depth: maxDepth,
      parameters,
      lines,
    };
  }

  /**
   * Check if node creates complexity nesting
   */
  private isComplexityNestingNode(node: Node): boolean {
    return [
      SyntaxKind.IfStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.TryStatement,
      SyntaxKind.SwitchStatement,
    ].includes(node.getKind());
  }

  /**
   * Resolve dependency path
   */
  private resolveDependencyPath(
    moduleSpecifier: string,
    currentFile: string
  ): string {
    try {
      // Handle relative imports
      if (
        moduleSpecifier.startsWith('./') ||
        moduleSpecifier.startsWith('../')
      ) {
        const currentDir = path.dirname(currentFile);
        return path.resolve(currentDir, moduleSpecifier);
      }

      // Handle absolute imports or node_modules
      return moduleSpecifier;
    } catch {
      return moduleSpecifier;
    }
  }

  /**
   * Post-process entities to resolve cross-references and enhance data
   */
  private async postProcessEntities(entities: EntityInfo[]): Promise<void> {
    // Build entity lookup maps for performance
    const entityByName = new Map<string, EntityInfo[]>();
    const entityByFile = new Map<string, EntityInfo[]>();

    entities.forEach(entity => {
      // Group by name
      if (!entityByName.has(entity.name)) {
        entityByName.set(entity.name, []);
      }
      entityByName.get(entity.name)!.push(entity);

      // Group by file
      if (!entityByFile.has(entity.file)) {
        entityByFile.set(entity.file, []);
      }
      entityByFile.get(entity.file)!.push(entity);
    });

    // Enhance entities with cross-reference information
    for (const entity of entities) {
      // Add metadata about related entities
      entity.metadata = {
        ...entity.metadata,
        relatedEntities:
          entityByName
            .get(entity.name)
            ?.filter(e => e.id !== entity.id)
            .map(e => e.id) || [],
        fileEntityCount: entityByFile.get(entity.file)?.length || 1,
      };
    }
  }

  /**
   * Get parsed file results
   */
  getParsedFiles(): Map<string, ParsedFileResult> {
    return this.parsedFiles;
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics(): ts.Diagnostic[] {
    const allDiagnostics: ts.Diagnostic[] = [];
    this.parsedFiles.forEach(result => {
      allDiagnostics.push(...result.diagnostics);
    });
    return allDiagnostics;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.parsedFiles.clear();
    // Note: ts-morph Project cleanup is handled automatically
  }
}
