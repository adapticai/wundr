#!/usr/bin/env node
// scripts/enhanced-ast-analyzer.ts

import * as ts from 'typescript';
import { Project, SourceFile, Node, Type } from 'ts-morph';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface EntityInfo {
  name: string;
  type: 'class' | 'interface' | 'type' | 'enum' | 'function' | 'const' | 'service';
  file: string;
  line: number;
  column: number;
  exportType: 'default' | 'named' | 'none';
  signature?: string;
  normalizedHash?: string;
  semanticHash?: string;
  jsDoc?: string;
  complexity?: number;
  dependencies: string[];
  members?: {
    properties?: Array<{ name: string; type: string; optional: boolean }>;
    methods?: Array<{ name: string; signature: string }>;
  };
}

interface DuplicateCluster {
  hash: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  entities: EntityInfo[];
  structuralMatch: boolean;
  semanticMatch: boolean;
}

interface AnalysisReport {
  timestamp: string;
  summary: {
    totalFiles: number;
    totalEntities: number;
    duplicateClusters: number;
    circularDependencies: number;
    unusedExports: number;
    codeSmells: number;
  };
  entities: EntityInfo[];
  duplicates: DuplicateCluster[];
  circularDeps: any[];
  unusedExports: EntityInfo[];
  wrapperPatterns: Array<{ base: string; wrapper: string; confidence: number }>;
  recommendations: any[];
}

export class EnhancedASTAnalyzer {
  private project: Project;
  private tsProgram: ts.Program;
  private typeChecker: ts.TypeChecker;
  private entities: Map<string, EntityInfo> = new Map();
  private imports: Map<string, Set<string>> = new Map();
  private exports: Map<string, Set<string>> = new Map();

  constructor(tsConfigPath = './tsconfig.json') {
    // Initialize ts-morph project
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      addFilesFromTsConfig: true
    });

    // Get TypeScript program and type checker for semantic analysis
    this.tsProgram = this.project.getProgram().compilerObject;
    this.typeChecker = this.tsProgram.getTypeChecker();
  }

  async analyzeProject(): Promise<AnalysisReport> {
    console.log('🔍 Starting enhanced AST analysis...');

    const startTime = Date.now();
    const sourceFiles = this.project.getSourceFiles();

    // Phase 1: Extract all entities
    console.log(`📊 Analyzing ${sourceFiles.length} files...`);
    for (const sourceFile of sourceFiles) {
      await this.analyzeSourceFile(sourceFile);
    }

    // Phase 2: Detect duplicates with multiple algorithms
    console.log('🔍 Detecting duplicates...');
    const duplicates = await this.detectDuplicates();

    // Phase 3: Analyze dependencies and circular refs
    console.log('🔄 Analyzing dependencies...');
    const circularDeps = await this.detectCircularDependencies();

    // Phase 4: Find unused exports
    console.log('🗑️ Finding unused exports...');
    const unusedExports = this.findUnusedExports();

    // Phase 5: Detect wrapper patterns
    console.log('🎁 Detecting wrapper patterns...');
    const wrapperPatterns = this.detectWrapperPatterns();

    // Phase 6: Generate recommendations
    console.log('💡 Generating recommendations...');
    const recommendations = this.generateRecommendations(
      duplicates,
      unusedExports,
      wrapperPatterns,
      circularDeps
    );

    const report: AnalysisReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: sourceFiles.length,
        totalEntities: this.entities.size,
        duplicateClusters: duplicates.length,
        circularDependencies: circularDeps.length,
        unusedExports: unusedExports.length,
        codeSmells: wrapperPatterns.length
      },
      entities: Array.from(this.entities.values()),
      duplicates,
      circularDeps,
      unusedExports,
      wrapperPatterns,
      recommendations
    };

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Analysis completed in ${duration}s`);

    return report;
  }

  private async analyzeSourceFile(sourceFile: SourceFile) {
    const filePath = sourceFile.getFilePath();

    // Skip test files and type definitions
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.endsWith('.d.ts')) {
      return;
    }

    // Extract imports for dependency analysis
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      if (moduleSpecifier.startsWith('.')) {
        if (!this.imports.has(filePath)) {
          this.imports.set(filePath, new Set());
        }
        this.imports.get(filePath)!.add(moduleSpecifier);
      }
    });

    // Extract all declarations
    this.extractClasses(sourceFile);
    this.extractInterfaces(sourceFile);
    this.extractTypeAliases(sourceFile);
    this.extractEnums(sourceFile);
    this.extractFunctions(sourceFile);
    this.extractVariables(sourceFile);
  }

  private extractClasses(sourceFile: SourceFile) {
    sourceFile.getClasses().forEach(classDecl => {
      const name = classDecl.getName();
      if (!name) return;

      const isService = name.toLowerCase().includes('service') ||
        classDecl.getJsDocs().some(doc =>
          doc.getDescription().toLowerCase().includes('service')
        );

      const methods = classDecl.getMethods().map(m => ({
        name: m.getName(),
        signature: m.getSignature().getDeclaration().getText()
      }));

      const properties = classDecl.getProperties().map(p => ({
        name: p.getName(),
        type: p.getType().getText(),
        optional: p.hasQuestionToken()
      }));

      const entity: EntityInfo = {
        name,
        type: isService ? 'service' : 'class',
        file: sourceFile.getFilePath(),
        line: classDecl.getStartLineNumber(),
        column: classDecl.getStartLinePos(),
        exportType: this.getExportType(classDecl),
        normalizedHash: this.generateNormalizedHash({ methods, properties }),
        semanticHash: this.generateSemanticHash(classDecl),
        jsDoc: this.extractJsDoc(classDecl),
        complexity: this.calculateComplexity(classDecl),
        dependencies: this.extractDependencies(classDecl),
        members: { methods, properties }
      };

      this.entities.set(`${entity.file}:${entity.name}`, entity);
    });
  }

  private extractInterfaces(sourceFile: SourceFile) {
    sourceFile.getInterfaces().forEach(interfaceDecl => {
      const properties = interfaceDecl.getProperties().map(p => ({
        name: p.getName(),
        type: p.getType().getText(),
        optional: p.hasQuestionToken()
      }));

      const methods = interfaceDecl.getMethods().map(m => ({
        name: m.getName(),
        signature: m.getSignature().getDeclaration().getText()
      }));

      // Sort for consistent hashing (from Gemini's approach)
      properties.sort((a, b) => a.name.localeCompare(b.name));
      methods.sort((a, b) => a.name.localeCompare(b.name));

      const entity: EntityInfo = {
        name: interfaceDecl.getName(),
        type: 'interface',
        file: sourceFile.getFilePath(),
        line: interfaceDecl.getStartLineNumber(),
        column: interfaceDecl.getStartLinePos(),
        exportType: this.getExportType(interfaceDecl),
        normalizedHash: this.generateNormalizedHash({ properties, methods }),
        semanticHash: this.generateSemanticHash(interfaceDecl),
        jsDoc: this.extractJsDoc(interfaceDecl),
        dependencies: this.extractDependencies(interfaceDecl),
        members: { properties, methods }
      };

      this.entities.set(`${entity.file}:${entity.name}`, entity);
    });
  }

  private extractTypeAliases(sourceFile: SourceFile) {
    sourceFile.getTypeAliases().forEach(typeAlias => {
      const entity: EntityInfo = {
        name: typeAlias.getName(),
        type: 'type',
        file: sourceFile.getFilePath(),
        line: typeAlias.getStartLineNumber(),
        column: typeAlias.getStartLinePos(),
        exportType: this.getExportType(typeAlias),
        signature: typeAlias.getType().getText(),
        normalizedHash: this.generateNormalizedHash(typeAlias.getType().getText()),
        jsDoc: this.extractJsDoc(typeAlias),
        dependencies: this.extractDependencies(typeAlias)
      };

      this.entities.set(`${entity.file}:${entity.name}`, entity);
    });
  }

  private extractEnums(sourceFile: SourceFile) {
    sourceFile.getEnums().forEach(enumDecl => {
      const members = enumDecl.getMembers().map(m => ({
        name: m.getName(),
        value: m.getValue()?.toString() || ''
      }));

      const entity: EntityInfo = {
        name: enumDecl.getName(),
        type: 'enum',
        file: sourceFile.getFilePath(),
        line: enumDecl.getStartLineNumber(),
        column: enumDecl.getStartLinePos(),
        exportType: this.getExportType(enumDecl),
        normalizedHash: this.generateNormalizedHash(members),
        jsDoc: this.extractJsDoc(enumDecl),
        dependencies: [],
        members: {
          properties: members.map(m => ({
            name: m.name,
            type: m.value,
            optional: false
          }))
        }
      };

      this.entities.set(`${entity.file}:${entity.name}`, entity);
    });
  }

  private extractFunctions(sourceFile: SourceFile) {
    sourceFile.getFunctions().forEach(func => {
      const name = func.getName();
      if (!name) return;

      const entity: EntityInfo = {
        name,
        type: 'function',
        file: sourceFile.getFilePath(),
        line: func.getStartLineNumber(),
        column: func.getStartLinePos(),
        exportType: this.getExportType(func),
        signature: func.getSignature().getDeclaration().getText(),
        normalizedHash: this.generateNormalizedHash(func.getText()),
        semanticHash: this.generateSemanticHash(func),
        jsDoc: this.extractJsDoc(func),
        complexity: this.calculateComplexity(func),
        dependencies: this.extractDependencies(func)
      };

      this.entities.set(`${entity.file}:${entity.name}`, entity);
    });
  }

  private extractVariables(sourceFile: SourceFile) {
    sourceFile.getVariableDeclarations().forEach(varDecl => {
      if (varDecl.isExported() && varDecl.getVariableStatement()?.isExported()) {
        const entity: EntityInfo = {
          name: varDecl.getName(),
          type: 'const',
          file: sourceFile.getFilePath(),
          line: varDecl.getStartLineNumber(),
          column: varDecl.getStartLinePos(),
          exportType: 'named',
          signature: varDecl.getType().getText(),
          dependencies: []
        };

        this.entities.set(`${entity.file}:${entity.name}`, entity);
      }
    });
  }

  private generateNormalizedHash(content: any): string {
    // Normalize content to ensure consistent hashing
    const normalized = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 8);
  }

  private generateSemanticHash(node: Node): string {
    // Use TypeChecker for semantic comparison
    const type = node.getType();
    const typeString = this.typeChecker.typeToString(
      type.compilerType,
      undefined,
      ts.TypeFormatFlags.NoTruncation
    );
    return crypto.createHash('sha256').update(typeString).digest('hex').substring(0, 8);
  }

  private async detectDuplicates(): Promise<DuplicateCluster[]> {
    const hashMap = new Map<string, EntityInfo[]>();
    const semanticMap = new Map<string, EntityInfo[]>();

    // Group by normalized hash
    for (const entity of this.entities.values()) {
      if (entity.normalizedHash) {
        if (!hashMap.has(entity.normalizedHash)) {
          hashMap.set(entity.normalizedHash, []);
        }
        hashMap.get(entity.normalizedHash)!.push(entity);
      }

      if (entity.semanticHash) {
        if (!semanticMap.has(entity.semanticHash)) {
          semanticMap.set(entity.semanticHash, []);
        }
        semanticMap.get(entity.semanticHash)!.push(entity);
      }
    }

    const clusters: DuplicateCluster[] = [];

    // Process structural duplicates
    for (const [hash, entities] of hashMap.entries()) {
      if (entities.length > 1) {
        clusters.push({
          hash,
          type: entities[0].type,
          severity: this.calculateDuplicateSeverity(entities),
          entities,
          structuralMatch: true,
          semanticMatch: semanticMap.has(hash)
        });
      }
    }

    return clusters;
  }

  private calculateDuplicateSeverity(entities: EntityInfo[]): 'critical' | 'high' | 'medium' {
    // Critical if exact match and used extensively
    const totalComplexity = entities.reduce((sum, e) => sum + (e.complexity || 0), 0);
    const avgDependencies = entities.reduce((sum, e) => sum + e.dependencies.length, 0) / entities.length;

    if (entities.length > 3 || totalComplexity > 50 || avgDependencies > 10) {
      return 'critical';
    } else if (entities.length > 2 || totalComplexity > 20 || avgDependencies > 5) {
      return 'high';
    }
    return 'medium';
  }

  private async detectCircularDependencies(): Promise<any[]> {
    try {
      // Use madge for circular dependency detection (from o3-pro's approach)
      const result = execSync(
        'npx madge --circular --extensions ts,tsx --json src',
        { encoding: 'utf-8' }
      );

      const madgeOutput = JSON.parse(result);
      return madgeOutput.circular || [];
    } catch (error) {
      console.warn('⚠️ Could not run madge for circular dependencies');
      return [];
    }
  }

  private findUnusedExports(): EntityInfo[] {
    const used = new Set<string>();

    // Mark all imported entities as used
    for (const sourceFile of this.project.getSourceFiles()) {
      sourceFile.getImportDeclarations().forEach(importDecl => {
        importDecl.getNamedImports().forEach(namedImport => {
          used.add(namedImport.getName());
        });
      });
    }

    // Find exported but unused entities
    return Array.from(this.entities.values()).filter(entity =>
      entity.exportType !== 'none' && !used.has(entity.name)
    );
  }

  private detectWrapperPatterns(): Array<{ base: string; wrapper: string; confidence: number }> {
    const patterns = [
      { prefix: 'Enhanced', confidence: 0.9 },
      { prefix: 'Extended', confidence: 0.9 },
      { suffix: 'Integration', confidence: 0.85 },
      { suffix: 'Wrapper', confidence: 0.9 },
      { suffix: 'Adapter', confidence: 0.85 }
    ];

    const wrappers: Array<{ base: string; wrapper: string; confidence: number }> = [];

    for (const entity of this.entities.values()) {
      for (const pattern of patterns) {
        let baseName = entity.name;

        if (pattern.prefix && entity.name.startsWith(pattern.prefix)) {
          baseName = entity.name.substring(pattern.prefix.length);
        } else if (pattern.suffix && entity.name.endsWith(pattern.suffix)) {
          baseName = entity.name.substring(0, entity.name.length - pattern.suffix.length);
        } else {
          continue;
        }

        // Look for the base entity
        const baseEntity = Array.from(this.entities.values()).find(e =>
          e.name === baseName && e.type === entity.type
        );

        if (baseEntity) {
          wrappers.push({
            base: baseName,
            wrapper: entity.name,
            confidence: pattern.confidence
          });
        }
      }
    }

    return wrappers;
  }

  private getExportType(node: Node): 'default' | 'named' | 'none' {
    if (node.hasModifier(ts.SyntaxKind.ExportKeyword)) {
      if (node.hasModifier(ts.SyntaxKind.DefaultKeyword)) {
        return 'default';
      }
      return 'named';
    }
    return 'none';
  }

  private extractJsDoc(node: Node): string | undefined {
    const jsDocs = node.getJsDocs();
    if (jsDocs.length > 0) {
      return jsDocs[0].getDescription().trim();
    }
    return undefined;
  }

  private calculateComplexity(node: Node): number {
    // Simple cyclomatic complexity calculation
    let complexity = 1;

    node.forEachDescendant(child => {
      if (
        Node.isIfStatement(child) ||
        Node.isWhileStatement(child) ||
        Node.isForStatement(child) ||
        Node.isConditionalExpression(child) ||
        Node.isCaseClause(child)
      ) {
        complexity++;
      }
    });

    return complexity;
  }

  private extractDependencies(node: Node): string[] {
    const deps = new Set<string>();

    node.forEachDescendant(child => {
      if (Node.isIdentifier(child)) {
        const symbol = child.getSymbol();
        if (symbol && symbol.getDeclarations().length > 0) {
          const declaration = symbol.getDeclarations()[0];
          const sourceFile = declaration.getSourceFile();
          if (sourceFile.getFilePath() !== node.getSourceFile().getFilePath()) {
            deps.add(sourceFile.getFilePath());
          }
        }
      }
    });

    return Array.from(deps);
  }

  private generateRecommendations(
    duplicates: DuplicateCluster[],
    unusedExports: EntityInfo[],
    wrapperPatterns: any[],
    circularDeps: any[]
  ): any[] {
    const recommendations = [];

    // Critical duplicates
    duplicates
      .filter(d => d.severity === 'critical')
      .forEach(cluster => {
        recommendations.push({
          type: 'MERGE_DUPLICATES',
          priority: 'CRITICAL',
          description: `Merge ${cluster.entities.length} duplicate ${cluster.type}s`,
          entities: cluster.entities.map(e => `${e.name} (${e.file})`),
          estimatedEffort: 'High',
          impact: 'High - Reduces code duplication and maintenance burden'
        });
      });

    // Unused exports
    if (unusedExports.length > 0) {
      recommendations.push({
        type: 'REMOVE_DEAD_CODE',
        priority: 'HIGH',
        description: `Remove ${unusedExports.length} unused exports`,
        count: unusedExports.length,
        estimatedEffort: 'Low',
        impact: 'Medium - Reduces bundle size and complexity'
      });
    }

    // Wrapper patterns
    wrapperPatterns.forEach(wrapper => {
      recommendations.push({
        type: 'REFACTOR_WRAPPER',
        priority: 'MEDIUM',
        description: `Refactor wrapper pattern: ${wrapper.wrapper} wraps ${wrapper.base}`,
        suggestion: 'Consider extending the base class or using composition',
        estimatedEffort: 'Medium',
        impact: 'Medium - Improves maintainability and reduces indirection'
      });
    });

    // Circular dependencies
    if (circularDeps.length > 0) {
      recommendations.push({
        type: 'BREAK_CIRCULAR_DEPS',
        priority: 'HIGH',
        description: `Break ${circularDeps.length} circular dependencies`,
        count: circularDeps.length,
        estimatedEffort: 'High',
        impact: 'Critical - Improves build times and prevents runtime issues'
      });
    }

    return recommendations;
  }

  async saveReport(report: AnalysisReport, outputDir = './analysis-output') {
    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save full JSON report
    fs.writeFileSync(
      path.join(outputDir, 'analysis-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Save CSV summary
    const csvRows = [
      'Entity,Type,File,Line,Exported,Dependencies,Hash'
    ];

    report.entities.forEach(entity => {
      csvRows.push(
        `"${entity.name}","${entity.type}","${entity.file}",${entity.line},"${entity.exportType}",${entity.dependencies.length},"${entity.normalizedHash || ''}"`
      );
    });

    fs.writeFileSync(
      path.join(outputDir, 'entities.csv'),
      csvRows.join('\n')
    );

    // Save duplicates CSV
    const dupRows = [
      'Type,Severity,Count,Entities'
    ];

    report.duplicates.forEach(cluster => {
      dupRows.push(
        `"${cluster.type}","${cluster.severity}",${cluster.entities.length},"${cluster.entities.map(e => e.name).join(';')}"`
      );
    });

    fs.writeFileSync(
      path.join(outputDir, 'duplicates.csv'),
      dupRows.join('\n')
    );

    // Generate markdown summary
    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(
      path.join(outputDir, 'ANALYSIS_SUMMARY.md'),
      markdown
    );

    console.log(`📊 Reports saved to ${outputDir}/`);
  }

  private generateMarkdownReport(report: AnalysisReport): string {
    return `# Code Analysis Report

Generated: ${report.timestamp}

## Summary

- **Total Files**: ${report.summary.totalFiles}
- **Total Entities**: ${report.summary.totalEntities}
- **Duplicate Clusters**: ${report.summary.duplicateClusters}
- **Circular Dependencies**: ${report.summary.circularDependencies}
- **Unused Exports**: ${report.summary.unusedExports}
- **Code Smells**: ${report.summary.codeSmells}

## Critical Issues

### 🔴 Critical Duplicates
${report.duplicates
        .filter(d => d.severity === 'critical')
        .map(d => `- ${d.entities.length} duplicate ${d.type}s: ${d.entities.map(e => e.name).join(', ')}`)
        .join('\n')}

### 🔴 Circular Dependencies
${report.circularDeps.length > 0 ?
        report.circularDeps.map(cycle => `- ${cycle.join(' → ')}`).join('\n') :
        'None detected'
      }

## Recommendations

${report.recommendations
        .sort((a, b) => {
          const priority = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return priority[a.priority] - priority[b.priority];
        })
        .map(rec => `
### ${rec.priority}: ${rec.description}
- **Type**: ${rec.type}
- **Impact**: ${rec.impact}
- **Effort**: ${rec.estimatedEffort}
${rec.entities ? `- **Entities**: ${rec.entities.join(', ')}` : ''}
${rec.suggestion ? `- **Suggestion**: ${rec.suggestion}` : ''}
`).join('\n')}

## Next Steps

1. Review critical duplicates and create consolidation plan
2. Remove unused exports to reduce codebase size
3. Refactor wrapper patterns to reduce complexity
4. Break circular dependencies to improve build times
5. Run analysis again after each phase to track progress
`;
  }
}

// CLI execution
if (require.main === module) {
  const analyzer = new EnhancedASTAnalyzer();

  analyzer.analyzeProject()
    .then(report => analyzer.saveReport(report))
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}
