#!/usr/bin/env node
// scripts/consolidation/consolidation-manager.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Project, SourceFile, Node } from 'ts-morph';
import * as ts from 'typescript';

interface ConsolidationBatch {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'duplicates' | 'unused-exports' | 'wrapper-patterns' | 'mixed';
  items: any[];
  status?: 'pending' | 'in-progress' | 'completed' | 'skipped';
}

interface ConsolidationPlan {
  targetEntity: {
    name: string;
    file: string;
    type: string;
  };
  sourceEntities: Array<{
    name: string;
    file: string;
    type: string;
  }>;
  affectedFiles: string[];
  estimatedChanges: number;
  strategy: 'merge' | 'replace' | 'refactor';
}

export class ConsolidationManager {
  private project: Project;
  private logFile = 'consolidation.log';
  private stateFile = 'consolidation-state.json';
  private state: Record<string, any> = {};

  constructor() {
    this.project = new Project({
      tsConfigFilePath: './tsconfig.json'
    });

    // Load existing state
    if (fs.existsSync(this.stateFile)) {
      this.state = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
    }
  }

  /**
   * Process a consolidation batch
   */
  async processBatch(batchFile: string) {
    const batch: ConsolidationBatch = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));

    this.log(`Starting batch ${batch.id} (${batch.priority} priority, ${batch.type})`);

    batch.status = 'in-progress';
    this.saveState(batch);

    try {
      switch (batch.type) {
        case 'duplicates':
          await this.processDuplicates(batch);
          break;
        case 'unused-exports':
          await this.processUnusedExports(batch);
          break;
        case 'wrapper-patterns':
          await this.processWrapperPatterns(batch);
          break;
        default:
          throw new Error(`Unknown batch type: ${batch.type}`);
      }

      batch.status = 'completed';
      this.saveState(batch);
      this.log(`Completed batch ${batch.id}`);

    } catch (error) {
      batch.status = 'skipped';
      this.saveState(batch);
      this.log(`Failed to process batch ${batch.id}: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Process duplicate entities
   */
  private async processDuplicates(batch: ConsolidationBatch) {
    for (const duplicateCluster of batch.items) {
      this.log(`Processing duplicate cluster: ${duplicateCluster.entities.length} ${duplicateCluster.type}s`);

      // Create consolidation plan
      const plan = this.createConsolidationPlan(duplicateCluster);

      // Generate the consolidated entity
      const consolidated = await this.generateConsolidatedEntity(plan);

      // Preview changes
      const preview = this.previewChanges(plan);
      this.log(`Preview: ${preview.affectedFiles.length} files, ${preview.estimatedChanges} changes`);

      // Apply changes
      await this.applyConsolidation(plan, consolidated);

      // Verify no compilation errors
      await this.verifyCompilation();
    }
  }

  /**
   * Process unused exports
   */
  private async processUnusedExports(batch: ConsolidationBatch) {
    const filesToModify = new Map<string, string[]>();

    // Group by file
    for (const entity of batch.items) {
      if (!filesToModify.has(entity.file)) {
        filesToModify.set(entity.file, []);
      }
      filesToModify.get(entity.file)!.push(entity.name);
    }

    // Process each file
    for (const [filePath, entities] of filesToModify) {
      this.log(`Removing ${entities.length} unused exports from ${filePath}`);

      const sourceFile = this.project.getSourceFile(filePath);
      if (!sourceFile) throw new Error(`Source file not found: ${filePath}`);

      for (const entityName of entities) {
        this.removeEntity(sourceFile, entityName);
      }

      await (sourceFile as any).save?.();
    }

    // Clean up empty files
    await this.cleanupEmptyFiles();
  }

  /**
   * Process wrapper patterns
   */
  private async processWrapperPatterns(batch: ConsolidationBatch) {
    for (const wrapper of batch.items) {
      this.log(`Refactoring wrapper pattern: ${wrapper.wrapper} wraps ${wrapper.base}`);

      const baseFile = this.project.getSourceFile(wrapper.baseFile);
      const wrapperFile = this.project.getSourceFile(wrapper.wrapperFile);
      if (!baseFile) throw new Error(`Base file not found: ${wrapper.baseFile}`);
      if (!wrapperFile) throw new Error(`Wrapper file not found: ${wrapper.wrapperFile}`);

      // Extract unique functionality from wrapper
      const uniqueFunctionality = this.extractUniqueFunctionality(
        baseFile,
        wrapperFile,
        wrapper.base,
        wrapper.wrapper
      );

      if (uniqueFunctionality.length > 0) {
        // Merge unique functionality into base
        this.mergeIntoBase(baseFile, wrapper.base, uniqueFunctionality);

        // Update all imports
        await this.updateFileImports(wrapper.wrapper, wrapper.base);

        // Remove wrapper
        this.removeEntity(wrapperFile, wrapper.wrapper);
      } else {
        // Wrapper adds no value, just remove
        await this.replaceAllUsages(wrapper.wrapper, wrapper.base);
        this.removeEntity(wrapperFile, wrapper.wrapper);
      }

      await (baseFile as any).save?.();
      await (wrapperFile as any).save?.();
    }
  }

  /**
   * Create a consolidation plan for duplicates
   */
  private createConsolidationPlan(duplicateCluster: any): ConsolidationPlan {
    // Choose the best candidate as target
    const target = this.chooseBestCandidate(duplicateCluster.entities);
    const sources = duplicateCluster.entities.filter((e: any) =>
      e.file !== target.file || e.name !== target.name
    );

    // Find all files that use any of these entities
    const affectedFiles = new Set<string>();
    const usageMap = this.loadUsageMap();

    for (const entity of duplicateCluster.entities) {
      const key = `${entity.file}:${entity.name}`;
      const usage = usageMap[key];
      if (usage) {
        usage.usages.forEach((u: any) => affectedFiles.add(u.file));
      }
    }

    return {
      targetEntity: target,
      sourceEntities: sources,
      affectedFiles: Array.from(affectedFiles),
      estimatedChanges: affectedFiles.size * sources.length,
      strategy: 'merge'
    };
  }

  /**
   * Choose the best candidate from duplicates
   */
  private chooseBestCandidate(entities: any[]): any {
    // Scoring criteria
    const scores = entities.map(entity => {
      let score = 0;

      // Prefer entities in core/types directories
      if (entity.file.includes('/types/') || entity.file.includes('/core/')) {
        score += 10;
      }

      // Prefer entities with JSDoc
      if (entity.jsDoc) {
        score += 5;
      }

      // Prefer entities that are already exported
      if (entity.exportType !== 'none') {
        score += 3;
      }

      // Prefer entities with better names (no temp, old, new prefixes)
      if (!entity.name.match(/^(temp|old|new|tmp)/i)) {
        score += 2;
      }

      // Prefer entities in files with fewer dependencies
      if (entity.dependencies.length < 5) {
        score += 1;
      }

      return { entity, score };
    });

    // Sort by score and return the best
    scores.sort((a, b) => b.score - a.score);
    return scores[0]?.entity;
  }

  /**
   * Generate consolidated entity from multiple sources
   */
  private async generateConsolidatedEntity(plan: ConsolidationPlan): Promise<string> {
    const targetFile = this.project.getSourceFile(plan.targetEntity.file);
    if (!targetFile) throw new Error(`Target file not found: ${plan.targetEntity.file}`);
    const targetNode = this.findEntity(targetFile, plan.targetEntity.name);

    if (!targetNode) {
      throw new Error(`Target entity ${plan.targetEntity.name} not found`);
    }

    // Collect all unique members from all sources
    const allMembers = new Map<string, any>();

    // Add target members
    this.collectMembers(targetNode, allMembers);

    // Add source members
    for (const source of plan.sourceEntities) {
      const sourceFile = this.project.getSourceFile(source.file);
      if (!sourceFile) continue;
      const sourceNode = this.findEntity(sourceFile, source.name);
      if (sourceNode) {
        this.collectMembers(sourceNode, allMembers);
      }
    }

    // Generate consolidated code
    return this.generateEntityCode(plan.targetEntity, allMembers);
  }

  /**
   * Apply consolidation changes
   */
  private async applyConsolidation(plan: ConsolidationPlan, consolidatedCode: string) {
    // Step 1: Update the target entity
    const targetFile = this.project.getSourceFile(plan.targetEntity.file);
    if (!targetFile) throw new Error(`Target file not found: ${plan.targetEntity.file}`);
    const targetNode = this.findEntity(targetFile, plan.targetEntity.name);

    if (targetNode && 'replaceWithText' in targetNode && typeof (targetNode as any).replaceWithText === 'function') {
      (targetNode as any).replaceWithText(consolidatedCode);
      await (targetFile as any).save?.();
    }

    // Step 2: Update all imports in affected files
    for (const affectedFile of plan.affectedFiles) {
      await this.updateFileImports(affectedFile, plan);
    }

    // Step 3: Remove source entities
    for (const source of plan.sourceEntities) {
      const sourceFile = this.project.getSourceFile(source.file);
      if (sourceFile) {
        this.removeEntity(sourceFile, source.name);
        await (sourceFile as any).save?.();
      }
    }

    // Step 4: Clean up empty files
    await this.cleanupEmptyFiles();
  }

  /**
   * Update imports in a file according to consolidation plan
   */
  private async updateFileImports(filePath: string, plan: ConsolidationPlan) {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return;

    const importDeclarations = sourceFile.getImportDeclarations();

    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      // Check if this import is from one of the source files
      for (const source of plan.sourceEntities) {
        if (this.isImportFrom(moduleSpecifier, source.file, filePath)) {
          // Update the import
          const namedImports = importDecl.getNamedImports();

          for (const namedImport of namedImports) {
            if (namedImport.getName() === source.name) {
              // Change to import from target
              const targetPath = this.getRelativeImportPath(filePath, plan.targetEntity.file);

              // Check if we already have an import from target
              const existingTargetImport = sourceFile.getImportDeclarations().find(
                decl => this.isImportFrom(decl.getModuleSpecifierValue(), plan.targetEntity.file, filePath)
              );

              if (existingTargetImport) {
                // Add to existing import
                existingTargetImport.addNamedImport(plan.targetEntity.name);
                namedImport.remove();
              } else {
                // Update this import
                namedImport.setName(plan.targetEntity.name);
                importDecl.setModuleSpecifier(targetPath);
              }
            }
          }

          // Remove import if empty
          if (importDecl.getNamedImports().length === 0) {
            importDecl.remove();
          }
        }
      }
    }

    await (sourceFile as any).save?.();
  }

  /**
   * Utility methods
   */

  private findEntity(sourceFile: SourceFile, name: string): Node | undefined {
    // Try to find as class
    let node: Node | undefined = sourceFile.getClasses().find(c => c.getName() === name);
    if (node) return node;

    // Try interface
    node = sourceFile.getInterfaces().find(i => i.getName() === name);
    if (node) return node;

    // Try type alias  
    node = sourceFile.getTypeAliases().find(t => t.getName() === name);
    if (node) return node;

    // Try enum
    node = sourceFile.getEnums().find(e => e.getName() === name);
    if (node) return node;

    // Try function
    node = sourceFile.getFunctions().find(f => f.getName() === name);
    if (node) return node;

    return undefined;
  }

  private removeEntity(sourceFile: SourceFile, name: string) {
    const node = this.findEntity(sourceFile, name);
    if (node && 'remove' in node && typeof (node as any).remove === 'function') {
      (node as any).remove();
    }
  }

  private collectMembers(node: Node, members: Map<string, any>) {
    if ((node as any).getKind?.() === ts.SyntaxKind.ClassDeclaration || (node as any).getKind?.() === ts.SyntaxKind.InterfaceDeclaration) {
      (node as any).getProperties?.()?.forEach((prop: any) => {
        const name = prop.getName();
        if (!members.has(name)) {
          members.set(name, {
            name,
            type: prop.getType().getText(),
            optional: prop.hasQuestionToken(),
            docs: (prop as any).getJsDocs?.()?.map((d: any) => d.getDescription?.()).join('\n') || ''
          });
        }
      });

      (node as any).getMethods?.()?.forEach((method: any) => {
        const name = method.getName();
        if (!members.has(name)) {
          members.set(name, {
            name,
            signature: method.getText(),
            docs: (method as any).getJsDocs?.()?.map((d: any) => d.getDescription?.()).join('\n') || ''
          });
        }
      });
    }
  }

  private generateEntityCode(targetEntity: any, members: Map<string, any>): string {
    const lines: string[] = [];

    // Add JSDoc if available
    const docs = Array.from(members.values())
      .filter(m => m.docs)
      .map(m => m.docs)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    if (docs.length > 0) {
      lines.push('/**');
      docs.forEach(doc => lines.push(` * ${doc}`));
      lines.push(' */');
    }

    // Generate based on type
    if (targetEntity.type === 'interface') {
      lines.push(`export interface ${targetEntity.name} {`);

      for (const member of members.values()) {
        if (member.type) {
          lines.push(`  ${member.name}${member.optional ? '?' : ''}: ${member.type};`);
        } else if (member.signature) {
          lines.push(`  ${member.signature};`);
        }
      }

      lines.push('}');
    } else if (targetEntity.type === 'type') {
      // For type aliases, merge object types
      lines.push(`export type ${targetEntity.name} = {`);

      for (const member of members.values()) {
        if (member.type) {
          lines.push(`  ${member.name}${member.optional ? '?' : ''}: ${member.type};`);
        }
      }

      lines.push('};');
    }

    return lines.join('\n');
  }

  private async verifyCompilation() {
    try {
      this.log('Verifying compilation...');
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      this.log('✓ Compilation successful');
    } catch (error: any) {
      this.log('✗ Compilation failed', 'error');
      this.log(error.stdout?.toString() || error.message, 'error');
      throw new Error('Compilation failed after consolidation');
    }
  }

  private async cleanupEmptyFiles() {
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Check if file only has imports or is empty
      const hasContent = sourceFile.getClasses().length > 0 ||
        sourceFile.getInterfaces().length > 0 ||
        sourceFile.getTypeAliases().length > 0 ||
        sourceFile.getEnums().length > 0 ||
        sourceFile.getFunctions().length > 0 ||
        (sourceFile as any).getVariableDeclarations?.()?.length > 0;

      if (!hasContent) {
        this.log(`Removing empty file: ${sourceFile.getFilePath()}`);
        (this.project as any).removeSourceFile?.(sourceFile);
        fs.unlinkSync(sourceFile.getFilePath());
      }
    }
  }

  private loadUsageMap(): Record<string, any> {
    const usageMapPath = path.join('analysis-output', 'latest', 'usage-map.json');
    if (fs.existsSync(usageMapPath)) {
      return JSON.parse(fs.readFileSync(usageMapPath, 'utf-8'));
    }
    return {};
  }

  private isImportFrom(moduleSpecifier: string, targetFile: string, fromFile: string): boolean {
    const resolvedPath = path.resolve(path.dirname(fromFile), moduleSpecifier);
    const targetPath = path.resolve(targetFile);

    return resolvedPath === targetPath ||
      resolvedPath === targetPath.replace(/\.ts$/, '') ||
      resolvedPath === targetPath.replace(/\/index\.ts$/, '');
  }

  private getRelativeImportPath(fromFile: string, toFile: string): string {
    const fromDir = path.dirname(fromFile);
    let relativePath = path.relative(fromDir, toFile);

    // Remove .ts extension
    relativePath = relativePath.replace(/\.ts$/, '');

    // Remove /index
    relativePath = relativePath.replace(/\/index$/, '');

    // Ensure starts with ./
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }

    return relativePath;
  }

  private extractUniqueFunctionality(
    baseFile: SourceFile,
    wrapperFile: SourceFile,
    baseName: string,
    wrapperName: string
  ): any[] {
    const baseClass = baseFile.getClasses().find(c => c.getName() === baseName);
    const wrapperClass = wrapperFile.getClasses().find(c => c.getName() === wrapperName);

    if (!baseClass || !wrapperClass) return [];

    const baseMethods = new Set(baseClass.getMethods().map(m => m.getName()));
    const uniqueMethods = wrapperClass.getMethods().filter((m: any) =>
      !baseMethods.has(m.getName())
    );

    return uniqueMethods.map((m: any) => ({
      name: m.getName(),
      implementation: m.getText()
    }));
  }

  private mergeIntoBase(baseFile: SourceFile, baseName: string, functionality: any[]) {
    const baseClass = baseFile.getClasses().find(c => c.getName() === baseName);
    if (!baseClass) return;

    for (const func of functionality) {
      (baseClass as any).addMethod?.({
        name: func.name,
        statements: func.implementation
      });
    }
  }

  private async replaceAllUsages(oldName: string, newName: string) {
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      let modified = false;

      // Update imports
      sourceFile.getImportDeclarations().forEach(importDecl => {
        importDecl.getNamedImports().forEach((namedImport: any) => {
          if (namedImport.getName() === oldName) {
            namedImport.setName(newName);
            modified = true;
          }
        });
      });

      // Update usage in code (simple replacement)
      if (modified) {
        let text = sourceFile.getText();
        const regex = new RegExp(`\\b${oldName}\\b`, 'g');
        text = text.replace(regex, newName);
        (sourceFile as any).replaceWithText?.(text);
        await (sourceFile as any).save?.();
      }
    }
  }

  private previewChanges(plan: ConsolidationPlan): any {
    return {
      affectedFiles: plan.affectedFiles,
      estimatedChanges: plan.estimatedChanges
    };
  }

  private log(message: string, level: 'info' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    fs.appendFileSync(this.logFile, logMessage);

    if (level === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  private saveState(batch: ConsolidationBatch) {
    this.state[batch.id] = {
      status: batch.status,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  /**
   * Generate status report
   */
  generateStatusReport(): string {
    const completed = Object.values(this.state).filter((s: any) => s.status === 'completed').length;
    const inProgress = Object.values(this.state).filter((s: any) => s.status === 'in-progress').length;
    const skipped = Object.values(this.state).filter((s: any) => s.status === 'skipped').length;

    return `
# Consolidation Status Report

Generated: ${new Date().toISOString()}

## Summary
- Completed: ${completed} batches
- In Progress: ${inProgress} batches
- Skipped: ${skipped} batches

## Details
${Object.entries(this.state).map(([id, state]: [string, any]) =>
      `- ${id}: ${state.status} (${state.timestamp})`
    ).join('\n')}
`;
  }
}

// CLI interface
if (require.main === module) {
  const manager = new ConsolidationManager();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'process':
      if (!arg) {
        console.error('Usage: consolidation-manager.ts process <batch-file>');
        process.exit(1);
      }
      manager.processBatch(arg)
        .then(() => console.log('✅ Batch processed successfully'))
        .catch(error => {
          console.error('❌ Batch processing failed:', error.message);
          process.exit(1);
        });
      break;

    case 'status':
      console.log(manager.generateStatusReport());
      break;

    default:
      console.log(`
Usage: consolidation-manager.ts <command> [args]

Commands:
  process <batch-file>  - Process a consolidation batch
  status               - Show consolidation status
      `);
  }
}
