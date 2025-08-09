/**
 * Type definitions extracted from analysis context for test utilities
 * This avoids importing TSX files in test utilities
 */

export interface Entity {
  name: string
  type: string
  file: string
  line: number
  column: number
  exportType: string
  complexity?: number
  dependencies: string[]
  jsDoc?: string
  signature?: string
  members?: {
    properties?: Array<{ name: string; type: string; optional?: boolean }>
    methods?: Array<{ name: string; signature: string }>
  }
}

export interface DuplicateCluster {
  hash: string
  type: string
  severity: "critical" | "high" | "medium"
  structuralMatch: boolean
  semanticMatch: boolean
  entities: Entity[]
}

export interface CircularDependency {
  id: string
  chain: string[]
  severity: "critical" | "high" | "medium"
  type: "import" | "require" | "dynamic"
}

export interface UnusedExport {
  name: string
  file: string
  type: string
  line: number
  exportType: "default" | "named"
}

export interface WrapperPattern {
  id: string
  pattern: string
  files: string[]
  complexity: number
  suggestions: string[]
}

export interface Recommendation {
  description: string
  priority: "critical" | "high" | "medium" | "low"
  type: string
  impact: string
  estimatedEffort: string
  suggestion?: string
  entities?: string[]
}

export interface AnalysisData {
  timestamp: string
  summary: {
    totalFiles: number
    totalEntities: number
    duplicateClusters: number
    circularDependencies: number
    unusedExports: number
    codeSmells: number
  }
  entities: Entity[]
  duplicates: DuplicateCluster[]
  circularDeps: CircularDependency[]
  unusedExports: UnusedExport[]
  wrapperPatterns: WrapperPattern[]
  recommendations: Recommendation[]
}

// Export Duplicate type alias for backward compatibility
export type Duplicate = DuplicateCluster;