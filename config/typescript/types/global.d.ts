/**
 * Global type declarations for the monorepo refactoring toolkit
 * These types are available across all packages and applications
 */

declare global {
  // Node.js environment variables
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      DEBUG?: string;
      LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'trace';

      // Database configuration
      DATABASE_URL?: string;
      REDIS_URL?: string;

      // API configuration
      API_PORT?: string;
      API_HOST?: string;
      API_KEY?: string;

      // Monorepo specific
      MONOREPO_ROOT?: string;
      PACKAGE_MANAGER?: 'npm' | 'yarn' | 'pnpm';
      WORKSPACE_ROOT?: string;

      // CI/CD
      CI?: string;
      GITHUB_TOKEN?: string;
      BUILD_NUMBER?: string;

      // Analysis and reporting
      ANALYSIS_OUTPUT_DIR?: string;
      REPORT_FORMAT?: 'json' | 'html' | 'markdown';
    }
  }

  // Console extensions for better logging
  namespace Console {
    interface Console {
      success(message?: any, ...optionalParams: any[]): void;
      warning(message?: any, ...optionalParams: any[]): void;
      header(message?: any, ...optionalParams: any[]): void;
      step(message?: any, ...optionalParams: any[]): void;
    }
  }

  // Global utility types
  type NonEmptyArray<T> = [T, ...T[]];
  type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
  type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
  type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };
  type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
  };

  // File system utilities
  type FilePath = string;
  type DirectoryPath = string;
  type GlobPattern = string;

  // JSON types
  type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

  interface JSONObject {
    [key: string]: JSONValue;
  }

  interface JSONArray extends Array<JSONValue> {
    // JSON array type extending Array<JSONValue>
    // Provides type safety for JSON arrays in global context
  }

  // Error handling
  type ErrorLevel = 'low' | 'medium' | 'high' | 'critical';
  type Result<T, E = Error> =
    | { success: true; data: T }
    | { success: false; error: E };

  // Monorepo specific types
  namespace Monorepo {
    interface PackageJson {
      name: string;
      version: string;
      description?: string;
      main?: string;
      module?: string;
      types?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      private?: boolean;
      workspaces?: string[] | { packages: string[] };
    }

    interface TsConfig {
      extends?: string;
      compilerOptions?: Record<string, any>;
      include?: string[];
      exclude?: string[];
      references?: Array<{ path: string }>;
    }

    interface WorkspaceInfo {
      name: string;
      path: string;
      type: 'package' | 'app' | 'tool';
      dependencies: string[];
      devDependencies: string[];
    }
  }

  // Analysis types
  namespace Analysis {
    interface FileMetrics {
      path: string;
      lines: number;
      complexity: number;
      maintainabilityIndex: number;
      dependencies: string[];
      exports: string[];
    }

    interface DuplicateInfo {
      hash: string;
      files: string[];
      similarity: number;
      type: 'exact' | 'structural' | 'semantic';
    }

    interface CircularDependency {
      cycle: string[];
      severity: ErrorLevel;
    }
  }

  // Git utilities
  namespace Git {
    interface CommitInfo {
      hash: string;
      author: string;
      date: Date;
      message: string;
      files: string[];
    }

    interface BranchInfo {
      name: string;
      current: boolean;
      remote?: string;
      lastCommit: CommitInfo;
    }
  }

  // CLI utilities
  namespace CLI {
    interface Command {
      name: string;
      description: string;
      options?: Record<string, any>;
      action: (...args: any[]) => Promise<void> | void;
    }

    interface ProgressBar {
      start(total: number, current: number): void;
      update(current: number): void;
      stop(): void;
    }
  }
}
