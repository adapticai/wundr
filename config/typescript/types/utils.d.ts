/**
 * Utility types specific to the monorepo refactoring toolkit
 * These types provide domain-specific typing for refactoring operations
 */

declare namespace RefactoringToolkit {
  // AST Analysis Types
  namespace AST {
    interface SourceLocation {
      start: { line: number; column: number };
      end: { line: number; column: number };
    }

    interface ASTNode {
      type: string;
      loc?: SourceLocation;
      range?: [number, number];
    }

    interface Identifier extends ASTNode {
      type: 'Identifier';
      name: string;
    }

    interface Literal extends ASTNode {
      type: 'Literal';
      value: string | number | boolean | null;
      raw: string;
    }

    interface Declaration extends ASTNode {
      id: Identifier;
    }

    interface FunctionDeclaration extends Declaration {
      type: 'FunctionDeclaration';
      params: Array<Identifier>;
      body: BlockStatement;
      generator: boolean;
      async: boolean;
    }

    interface ClassDeclaration extends Declaration {
      type: 'ClassDeclaration';
      superClass: Identifier | null;
      body: ClassBody;
    }

    interface BlockStatement extends ASTNode {
      type: 'BlockStatement';
      body: Array<ASTNode>;
    }

    interface ClassBody extends ASTNode {
      type: 'ClassBody';
      body: Array<MethodDefinition | PropertyDefinition>;
    }

    interface MethodDefinition extends ASTNode {
      type: 'MethodDefinition';
      key: Identifier;
      value: FunctionExpression;
      kind: 'constructor' | 'method' | 'get' | 'set';
      static: boolean;
    }

    interface PropertyDefinition extends ASTNode {
      type: 'PropertyDefinition';
      key: Identifier;
      value: ASTNode | null;
      static: boolean;
    }

    interface FunctionExpression extends ASTNode {
      type: 'FunctionExpression';
      id: Identifier | null;
      params: Array<Identifier>;
      body: BlockStatement;
      generator: boolean;
      async: boolean;
    }
  }

  // Dependency Analysis Types
  namespace Dependencies {
    interface DependencyInfo {
      name: string;
      version: string;
      type: 'production' | 'development' | 'peer' | 'optional';
      source: 'npm' | 'workspace' | 'file' | 'git';
      path?: string;
      usedBy: string[];
    }

    interface DependencyGraph {
      nodes: Map<string, DependencyNode>;
      edges: Map<string, string[]>;
    }

    interface DependencyNode {
      id: string;
      name: string;
      version: string;
      dependencies: string[];
      dependents: string[];
      depth: number;
      circular?: boolean;
    }

    interface CircularDependency {
      chain: string[];
      depth: number;
      severity: 'warning' | 'error';
    }
  }

  // Code Quality Types
  namespace Quality {
    interface MetricResult {
      file: string;
      metrics: {
        cyclomaticComplexity: number;
        maintainabilityIndex: number;
        linesOfCode: number;
        cognitiveComplexity: number;
        duplicateLines: number;
        technicalDebt: number;
      };
      issues: Issue[];
    }

    interface Issue {
      type: 'error' | 'warning' | 'info';
      category: 'complexity' | 'duplication' | 'maintainability' | 'security' | 'performance';
      message: string;
      location: {
        file: string;
        line: number;
        column: number;
      };
      rule: string;
      severity: number;
      fixable: boolean;
      suggestion?: string;
    }

    interface QualityGate {
      name: string;
      threshold: number;
      operator: '>' | '>=' | '<' | '<=' | '=' | '!=';
      metric: keyof MetricResult['metrics'];
      blocking: boolean;
    }
  }

  // Refactoring Types
  namespace Refactoring {
    interface RefactoringOperation {
      id: string;
      type: RefactoringType;
      description: string;
      files: string[];
      changes: Change[];
      status: 'pending' | 'in-progress' | 'completed' | 'failed';
      estimatedEffort: 'low' | 'medium' | 'high';
      risk: 'low' | 'medium' | 'high';
    }

    type RefactoringType =
      | 'extract-function'
      | 'extract-class'
      | 'move-file'
      | 'rename-symbol'
      | 'merge-duplicates'
      | 'split-file'
      | 'consolidate-imports'
      | 'remove-dead-code'
      | 'inline-function'
      | 'extract-interface';

    interface Change {
      file: string;
      type: 'create' | 'modify' | 'delete' | 'move';
      oldContent?: string;
      newContent?: string;
      oldPath?: string;
      newPath?: string;
    }

    interface RefactoringPlan {
      name: string;
      description: string;
      operations: RefactoringOperation[];
      phases: RefactoringPhase[];
      estimatedDuration: string;
      prerequisites: string[];
      risks: Risk[];
    }

    interface RefactoringPhase {
      name: string;
      description: string;
      operations: string[]; // operation IDs
      dependencies: string[]; // phase dependencies
      parallel: boolean;
    }

    interface Risk {
      level: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      mitigation: string;
      impact: string;
    }
  }

  // Migration Types
  namespace Migration {
    interface MigrationPlan {
      from: string;
      to: string;
      steps: MigrationStep[];
      rollback: RollbackPlan;
      validation: ValidationStep[];
    }

    interface MigrationStep {
      id: string;
      name: string;
      description: string;
      type: 'file-move' | 'code-transform' | 'dependency-update' | 'config-change';
      automated: boolean;
      commands?: string[];
      files?: string[];
      validation?: string[];
    }

    interface RollbackPlan {
      steps: Array<{
        stepId: string;
        action: 'revert-files' | 'run-command' | 'restore-backup';
        details: any;
      }>;
    }

    interface ValidationStep {
      name: string;
      type: 'build' | 'test' | 'lint' | 'type-check';
      command: string;
      failureAction: 'stop' | 'warn' | 'continue';
    }
  }

  // Reporting Types
  namespace Reporting {
    interface Report {
      id: string;
      title: string;
      summary: ReportSummary;
      sections: ReportSection[];
      metadata: ReportMetadata;
      recommendations: Recommendation[];
    }

    interface ReportSummary {
      totalFiles: number;
      totalIssues: number;
      criticalIssues: number;
      technicalDebt: string;
      maintainabilityScore: number;
      testCoverage?: number;
    }

    interface ReportSection {
      title: string;
      type: 'text' | 'table' | 'chart' | 'code' | 'list';
      content: any;
      importance: 'low' | 'medium' | 'high';
    }

    interface ReportMetadata {
      generatedAt: Date;
      generatedBy: string;
      version: string;
      duration: number;
      scope: string[];
    }

    interface Recommendation {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      effort: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      category: 'structure' | 'quality' | 'performance' | 'security' | 'maintainability';
      actionItems: string[];
    }
  }

  // Configuration Types
  namespace Config {
    interface ToolkitConfig {
      project: ProjectConfig;
      analysis: AnalysisConfig;
      refactoring: RefactoringConfig;
      quality: QualityConfig;
      reporting: ReportingConfig;
    }

    interface ProjectConfig {
      name: string;
      type: 'monorepo' | 'single';
      packageManager: 'npm' | 'yarn' | 'pnpm';
      typescript: boolean;
      framework?: string;
      testFramework?: string;
      buildTool?: string;
    }

    interface AnalysisConfig {
      patterns: {
        include: string[];
        exclude: string[];
      };
      duplicateThreshold: number;
      complexityThreshold: number;
      dependencies: {
        checkCircular: boolean;
        checkUnused: boolean;
        checkOutdated: boolean;
      };
    }

    interface RefactoringConfig {
      autoFix: boolean;
      backupFiles: boolean;
      validateChanges: boolean;
      patterns: {
        naming: Record<string, string>;
        structure: Record<string, any>;
      };
    }

    interface QualityConfig {
      gates: Quality.QualityGate[];
      metrics: {
        complexity: { max: number };
        maintainability: { min: number };
        duplication: { max: number };
      };
    }

    interface ReportingConfig {
      format: 'json' | 'html' | 'markdown' | 'pdf';
      output: string;
      includeCharts: boolean;
      includeCode: boolean;
      template?: string;
    }
  }

  // Utility Types for the toolkit
  type FileExtension = '.ts' | '.tsx' | '.js' | '.jsx' | '.json' | '.md' | '.yml' | '.yaml';
  type PathPattern = string; // glob pattern
  type Severity = 'low' | 'medium' | 'high' | 'critical';
  type Priority = 'low' | 'medium' | 'high' | 'urgent';
  type Status = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';

  // Common result types
  type OperationResult<T = any> = {
    success: true;
    data: T;
    duration: number;
  } | {
    success: false;
    error: string;
    details?: any;
    duration: number;
  };

  type AsyncOperationResult<T = any> = Promise<OperationResult<T>>;

  // Progress tracking
  interface ProgressCallback {
    (current: number, total: number, message?: string): void;
  }

  interface ProgressTracker {
    start(total: number): void;
    update(current: number, message?: string): void;
    finish(message?: string): void;
    fail(error: string): void;
  }
}