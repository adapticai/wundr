/**
 * Analysis Worker - High-performance worker for concurrent analysis tasks
 * Handles AST parsing, duplicate detection, and complexity analysis
 */

const { parentPort, workerData } = require('worker_threads');
const ts = require('typescript');
const fs = require('fs-extra');
const path = require('path');

class AnalysisWorker {
  constructor(workerId) {
    this.workerId = workerId;
    this.port = null;
    this.isInitialized = false;
    this.currentTask = null;
    this.statistics = {
      tasksCompleted: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      errorCount: 0
    };
    
    // TypeScript compiler cache
    this.programCache = new Map();
    this.sourceFileCache = new Map();
    
    this.setupMessageHandling();
  }

  /**
   * Set up message handling with parent
   */
  setupMessageHandling() {
    parentPort.on('message', (message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Handle messages from parent process
   */
  async handleMessage(message) {
    try {
      switch (message.type) {
        case 'init':
          await this.initialize(message.port);
          break;
        case 'shutdown':
          await this.shutdown();
          break;
        default:
          this.sendError(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(`Error handling message: ${error.message}`, error);
    }
  }

  /**
   * Initialize worker with message port
   */
  async initialize(port) {
    this.port = port;
    
    this.port.on('message', (message) => {
      this.handleTaskMessage(message);
    });
    
    this.isInitialized = true;
    
    // Notify parent that worker is ready
    parentPort.postMessage({ type: 'worker-ready', workerId: this.workerId });
  }

  /**
   * Handle task messages from pool manager
   */
  async handleTaskMessage(message) {
    if (message.type === 'execute-task') {
      await this.executeTask(message.task);
    }
  }

  /**
   * Execute analysis task
   */
  async executeTask(task) {
    const startTime = Date.now();
    this.currentTask = task;
    
    try {
      let result;
      
      switch (task.type) {
        case 'analyze-file':
          result = await this.analyzeFile(task.data);
          break;
        case 'extract-entities':
          result = await this.extractEntities(task.data);
          break;
        case 'detect-duplicates':
          result = await this.detectDuplicates(task.data);
          break;
        case 'calculate-complexity':
          result = await this.calculateComplexity(task.data);
          break;
        case 'analyze-dependencies':
          result = await this.analyzeDependencies(task.data);
          break;
        case 'process-ast':
          result = await this.processAST(task.data);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      const executionTime = Date.now() - startTime;
      this.updateStatistics(executionTime, true);
      
      const workerResult = {
        taskId: task.id,
        success: true,
        data: result,
        executionTime,
        workerId: this.workerId
      };
      
      this.port.postMessage({
        type: 'task-result',
        result: workerResult
      });
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStatistics(executionTime, false);
      
      const workerResult = {
        taskId: task.id,
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        executionTime,
        workerId: this.workerId
      };
      
      this.port.postMessage({
        type: 'task-result',
        result: workerResult
      });
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(data) {
    const { filePath, config } = data;
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const sourceFile = await this.getSourceFile(filePath);
    const entities = this.extractEntitiesFromSourceFile(sourceFile);
    const complexity = this.calculateFileComplexity(sourceFile);
    const dependencies = this.extractDependencies(sourceFile);
    
    return {
      filePath,
      entities,
      complexity,
      dependencies,
      metrics: {
        lines: sourceFile.getLineStarts().length,
        size: (await fs.stat(filePath)).size
      }
    };
  }

  /**
   * Extract entities from files
   */
  async extractEntities(data) {
    const { filePaths } = data;
    const entities = [];
    
    for (const filePath of filePaths) {
      try {
        const sourceFile = await this.getSourceFile(filePath);
        const fileEntities = this.extractEntitiesFromSourceFile(sourceFile);
        entities.push(...fileEntities);
      } catch (error) {
        // Log error but continue with other files
        console.warn(`Error extracting entities from ${filePath}:`, error.message);
      }
    }
    
    return entities;
  }

  /**
   * Detect duplicates in entities
   */
  async detectDuplicates(data) {
    const { entities, config } = data;
    const duplicates = [];
    
    // Group entities by type for efficient comparison
    const entitiesByType = new Map();
    
    entities.forEach(entity => {
      if (!entitiesByType.has(entity.type)) {
        entitiesByType.set(entity.type, []);
      }
      entitiesByType.get(entity.type).push(entity);
    });
    
    // Find duplicates within each type
    for (const [type, typeEntities] of entitiesByType) {
      const typeDuplicates = this.findDuplicatesInType(typeEntities, config);
      duplicates.push(...typeDuplicates);
    }
    
    return duplicates;
  }

  /**
   * Calculate complexity metrics
   */
  async calculateComplexity(data) {
    const { filePath } = data;
    const sourceFile = await this.getSourceFile(filePath);
    
    return {
      filePath,
      complexity: this.calculateFileComplexity(sourceFile),
      functions: this.calculateFunctionComplexities(sourceFile)
    };
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies(data) {
    const { filePath } = data;
    const sourceFile = await this.getSourceFile(filePath);
    
    const imports = [];
    const exports = [];
    
    sourceFile.forEachChild(node => {
      if (ts.isImportDeclaration(node)) {
        imports.push(this.extractImportInfo(node));
      } else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        exports.push(this.extractExportInfo(node));
      }
    });
    
    return { filePath, imports, exports };
  }

  /**
   * Process AST with custom visitor
   */
  async processAST(data) {
    const { filePath, visitorType } = data;
    const sourceFile = await this.getSourceFile(filePath);
    
    switch (visitorType) {
      case 'complexity':
        return this.visitForComplexity(sourceFile);
      case 'dependencies':
        return this.visitForDependencies(sourceFile);
      case 'entities':
        return this.visitForEntities(sourceFile);
      default:
        throw new Error(`Unknown visitor type: ${visitorType}`);
    }
  }

  /**
   * Get TypeScript source file with caching
   */
  async getSourceFile(filePath) {
    const normalizedPath = path.normalize(filePath);
    
    if (this.sourceFileCache.has(normalizedPath)) {
      return this.sourceFileCache.get(normalizedPath);
    }
    
    const content = await fs.readFile(normalizedPath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      normalizedPath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
    
    // Cache for reuse
    this.sourceFileCache.set(normalizedPath, sourceFile);
    
    // Limit cache size
    if (this.sourceFileCache.size > 1000) {
      const firstKey = this.sourceFileCache.keys().next().value;
      this.sourceFileCache.delete(firstKey);
    }
    
    return sourceFile;
  }

  /**
   * Extract entities from source file
   */
  extractEntitiesFromSourceFile(sourceFile) {
    const entities = [];
    
    const visit = (node) => {
      const entity = this.nodeToEntity(node, sourceFile);
      if (entity) {
        entities.push(entity);
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return entities;
  }

  /**
   * Convert AST node to entity
   */
  nodeToEntity(node, sourceFile) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const line = position.line + 1;
    const column = position.character + 1;
    
    let entity = null;
    
    if (ts.isFunctionDeclaration(node)) {
      entity = {
        id: `${sourceFile.fileName}-func-${line}-${column}`,
        name: node.name?.text || '<anonymous>',
        type: 'function',
        file: sourceFile.fileName,
        line,
        column,
        signature: this.getFunctionSignature(node),
        complexity: this.calculateNodeComplexity(node),
        dependencies: this.extractNodeDependencies(node)
      };
    } else if (ts.isClassDeclaration(node)) {
      entity = {
        id: `${sourceFile.fileName}-class-${line}-${column}`,
        name: node.name?.text || '<anonymous>',
        type: 'class',
        file: sourceFile.fileName,
        line,
        column,
        members: this.extractClassMembers(node),
        complexity: this.calculateNodeComplexity(node),
        dependencies: this.extractNodeDependencies(node)
      };
    } else if (ts.isInterfaceDeclaration(node)) {
      entity = {
        id: `${sourceFile.fileName}-interface-${line}-${column}`,
        name: node.name.text,
        type: 'interface',
        file: sourceFile.fileName,
        line,
        column,
        members: this.extractInterfaceMembers(node),
        dependencies: this.extractNodeDependencies(node)
      };
    }
    
    return entity;
  }

  /**
   * Calculate file complexity
   */
  calculateFileComplexity(sourceFile) {
    let complexity = {
      cyclomatic: 0,
      cognitive: 0,
      lines: sourceFile.getLineStarts().length,
      functions: 0,
      classes: 0,
      interfaces: 0
    };
    
    const visit = (node) => {
      if (ts.isFunctionDeclaration(node)) {
        complexity.functions++;
        complexity.cyclomatic += this.calculateCyclomaticComplexity(node);
        complexity.cognitive += this.calculateCognitiveComplexity(node);
      } else if (ts.isClassDeclaration(node)) {
        complexity.classes++;
      } else if (ts.isInterfaceDeclaration(node)) {
        complexity.interfaces++;
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return complexity;
  }

  /**
   * Calculate cyclomatic complexity
   */
  calculateCyclomaticComplexity(node) {
    let complexity = 1; // Base complexity
    
    const visit = (node) => {
      if (ts.isIfStatement(node) ||
          ts.isWhileStatement(node) ||
          ts.isForStatement(node) ||
          ts.isForInStatement(node) ||
          ts.isForOfStatement(node) ||
          ts.isConditionalExpression(node) ||
          ts.isCaseClause(node)) {
        complexity++;
      } else if (ts.isBinaryExpression(node) && 
                (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                 node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        complexity++;
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(node);
    return complexity;
  }

  /**
   * Calculate cognitive complexity
   */
  calculateCognitiveComplexity(node) {
    let complexity = 0;
    let nestingLevel = 0;
    
    const visit = (node, isNested = false) => {
      if (ts.isIfStatement(node)) {
        complexity += 1 + nestingLevel;
        nestingLevel++;
        ts.forEachChild(node, child => visit(child, true));
        nestingLevel--;
      } else if (ts.isWhileStatement(node) || ts.isForStatement(node)) {
        complexity += 1 + nestingLevel;
        nestingLevel++;
        ts.forEachChild(node, child => visit(child, true));
        nestingLevel--;
      } else if (ts.isSwitchStatement(node)) {
        complexity += 1 + nestingLevel;
        nestingLevel++;
        ts.forEachChild(node, child => visit(child, true));
        nestingLevel--;
      } else {
        ts.forEachChild(node, child => visit(child, isNested));
      }
    };
    
    visit(node);
    return complexity;
  }

  /**
   * Calculate node complexity
   */
  calculateNodeComplexity(node) {
    return {
      cyclomatic: this.calculateCyclomaticComplexity(node),
      cognitive: this.calculateCognitiveComplexity(node)
    };
  }

  /**
   * Extract function signature
   */
  getFunctionSignature(node) {
    const params = node.parameters.map(param => param.name.text).join(', ');
    const returnType = node.type ? `: ${node.type.getText()}` : '';
    return `${node.name?.text}(${params})${returnType}`;
  }

  /**
   * Extract class members
   */
  extractClassMembers(node) {
    const methods = [];
    const properties = [];
    
    node.members.forEach(member => {
      if (ts.isMethodDeclaration(member)) {
        methods.push({
          name: member.name?.getText() || '<anonymous>',
          visibility: this.getVisibility(member),
          static: member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || false
        });
      } else if (ts.isPropertyDeclaration(member)) {
        properties.push({
          name: member.name?.getText() || '<anonymous>',
          visibility: this.getVisibility(member),
          static: member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || false
        });
      }
    });
    
    return { methods, properties };
  }

  /**
   * Extract interface members
   */
  extractInterfaceMembers(node) {
    const methods = [];
    const properties = [];
    
    node.members.forEach(member => {
      if (ts.isMethodSignature(member)) {
        methods.push({
          name: member.name?.getText() || '<anonymous>',
          signature: member.getText()
        });
      } else if (ts.isPropertySignature(member)) {
        properties.push({
          name: member.name?.getText() || '<anonymous>',
          type: member.type?.getText() || 'any'
        });
      }
    });
    
    return { methods, properties };
  }

  /**
   * Get visibility modifier
   */
  getVisibility(node) {
    if (node.modifiers) {
      if (node.modifiers.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) {
        return 'private';
      }
      if (node.modifiers.some(m => m.kind === ts.SyntaxKind.ProtectedKeyword)) {
        return 'protected';
      }
    }
    return 'public';
  }

  /**
   * Extract node dependencies
   */
  extractNodeDependencies(node) {
    const dependencies = new Set();
    
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        // Simple identifier extraction - could be enhanced
        dependencies.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    
    visit(node);
    return Array.from(dependencies);
  }

  /**
   * Find duplicates within a type
   */
  findDuplicatesInType(entities, config) {
    const duplicates = [];
    const minSimilarity = config?.minSimilarity || 0.8;
    
    for (let i = 0; i < entities.length; i++) {
      const cluster = [entities[i]];
      
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = this.calculateEntitySimilarity(entities[i], entities[j]);
        if (similarity >= minSimilarity) {
          cluster.push(entities[j]);
        }
      }
      
      if (cluster.length > 1) {
        duplicates.push({
          id: `duplicate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: entities[i].type,
          entities: cluster,
          similarity: this.calculateClusterSimilarity(cluster)
        });
        
        // Remove processed entities
        entities.splice(i, 1);
        i--; // Adjust index
      }
    }
    
    return duplicates;
  }

  /**
   * Calculate similarity between two entities
   */
  calculateEntitySimilarity(entity1, entity2) {
    let similarity = 0;
    let factors = 0;
    
    // Name similarity
    const nameSim = this.calculateStringSimilarity(entity1.name, entity2.name);
    similarity += nameSim;
    factors++;
    
    // Signature similarity (for functions)
    if (entity1.signature && entity2.signature) {
      const sigSim = this.calculateStringSimilarity(entity1.signature, entity2.signature);
      similarity += sigSim;
      factors++;
    }
    
    // Complexity similarity
    if (entity1.complexity && entity2.complexity) {
      const complexitySim = this.calculateComplexitySimilarity(
        entity1.complexity, 
        entity2.complexity
      );
      similarity += complexitySim;
      factors++;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate string similarity using Jaccard similarity
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;
    
    const set1 = new Set(str1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const set2 = new Set(str2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate complexity similarity
   */
  calculateComplexitySimilarity(complexity1, complexity2) {
    const cyclomaticSim = this.calculateNumericSimilarity(
      complexity1.cyclomatic, 
      complexity2.cyclomatic
    );
    const cognitiveSim = this.calculateNumericSimilarity(
      complexity1.cognitive, 
      complexity2.cognitive
    );
    
    return (cyclomaticSim + cognitiveSim) / 2;
  }

  /**
   * Calculate numeric similarity
   */
  calculateNumericSimilarity(num1, num2) {
    if (num1 === num2) return 1.0;
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    return max > 0 ? min / max : 1.0;
  }

  /**
   * Calculate cluster similarity
   */
  calculateClusterSimilarity(entities) {
    if (entities.length < 2) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        totalSimilarity += this.calculateEntitySimilarity(entities[i], entities[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Update worker statistics
   */
  updateStatistics(executionTime, success) {
    this.statistics.tasksCompleted++;
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.tasksCompleted;
    
    if (!success) {
      this.statistics.errorCount++;
    }
  }

  /**
   * Send error to parent
   */
  sendError(message, error = null) {
    parentPort.postMessage({
      type: 'error',
      workerId: this.workerId,
      message,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : null
    });
  }

  /**
   * Shutdown worker gracefully
   */
  async shutdown() {
    // Clear caches
    this.programCache.clear();
    this.sourceFileCache.clear();
    
    // Send final statistics
    parentPort.postMessage({
      type: 'worker-statistics',
      workerId: this.workerId,
      statistics: this.statistics
    });
    
    process.exit(0);
  }
}

// Initialize worker
const worker = new AnalysisWorker(workerData.workerId);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception in worker ${workerData.workerId}:`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`Unhandled rejection in worker ${workerData.workerId}:`, reason);
  process.exit(1);
});