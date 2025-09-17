/**
 * Enterprise-grade TypeScript API types - replaces all 'any' with proper typing
 */

// Base API value types
export type ApiPrimitiveValue = string | number | boolean | null;
export type ApiArrayValue = ApiValue[];
export type ApiObjectValue = { [key: string]: ApiValue };
export type ApiValue = ApiPrimitiveValue | ApiArrayValue | ApiObjectValue;

// HTTP Request/Response types
export interface ApiRequest<TBody = ApiValue, TQuery = ApiQueryParams> {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: ApiHeaders;
  readonly body?: TBody;
  readonly query?: TQuery;
  readonly params?: ApiPathParams;
  readonly user?: AuthenticatedUser;
}

export interface ApiResponse<TData = ApiValue> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: ApiError;
  readonly metadata?: ResponseMetadata;
}

export interface ApiHeaders {
  readonly [key: string]: string | readonly string[];
}

export interface ApiQueryParams {
  readonly [key: string]: string | readonly string[] | undefined;
}

export interface ApiPathParams {
  readonly [key: string]: string;
}

export interface ResponseMetadata {
  readonly timestamp: string;
  readonly requestId: string;
  readonly version: string;
  readonly processingTime: number;
  readonly rateLimit?: RateLimitInfo;
  readonly pagination?: PaginationInfo;
}

export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
}

export interface PaginationInfo {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Authentication and Authorization
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly permissions: readonly Permission[];
  readonly sessionId: string;
  readonly lastActivity: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
  SERVICE = 'service'
}

export enum Permission {
  READ_ANALYSIS = 'read:analysis',
  WRITE_ANALYSIS = 'write:analysis',
  DELETE_ANALYSIS = 'delete:analysis',
  READ_PROJECTS = 'read:projects',
  WRITE_PROJECTS = 'write:projects',
  DELETE_PROJECTS = 'delete:projects',
  ADMIN_USERS = 'admin:users',
  ADMIN_SYSTEM = 'admin:system'
}

// Error types
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: ApiErrorDetails;
  readonly timestamp: string;
  readonly requestId: string;
}

export interface ApiErrorDetails {
  readonly field?: string;
  readonly value?: ApiValue;
  readonly constraint?: string;
  readonly context?: ApiObjectValue;
}

// Analysis API types
export interface AnalysisApiData {
  readonly id: string;
  readonly projectId: string;
  readonly summary: DashboardSummary;
  readonly entities: readonly AnalysisEntity[];
  readonly issues: readonly AnalysisIssue[];
  readonly duplicates: readonly AnalysisDuplicate[];
  readonly recommendations: readonly AnalysisRecommendation[];
  readonly dependencyGraph: DependencyGraph;
  readonly metrics: ProjectMetrics;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DashboardSummary {
  readonly totalFiles: number;
  readonly totalLines: number;
  readonly codeQuality: QualityScore;
  readonly coverage: CoverageScore;
  readonly complexity: ComplexityScore;
  readonly security: SecurityScore;
  readonly trends: TrendData;
}

export interface QualityScore {
  readonly overall: number;
  readonly maintainability: number;
  readonly reliability: number;
  readonly security: number;
  readonly coverage: number;
}

export interface CoverageScore {
  readonly statements: number;
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
}

export interface ComplexityScore {
  readonly cyclomatic: number;
  readonly cognitive: number;
  readonly halstead: HalsteadMetrics;
}

export interface HalsteadMetrics {
  readonly vocabulary: number;
  readonly length: number;
  readonly calculatedLength: number;
  readonly volume: number;
  readonly difficulty: number;
  readonly effort: number;
  readonly time: number;
  readonly bugs: number;
}

export interface SecurityScore {
  readonly overall: number;
  readonly vulnerabilities: VulnerabilityCount;
  readonly compliance: ComplianceScore;
}

export interface VulnerabilityCount {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly info: number;
}

export interface ComplianceScore {
  readonly owasp: number;
  readonly cwe: number;
  readonly pci: number;
  readonly sox: number;
}

export interface TrendData {
  readonly quality: readonly TrendPoint[];
  readonly coverage: readonly TrendPoint[];
  readonly complexity: readonly TrendPoint[];
  readonly security: readonly TrendPoint[];
}

export interface TrendPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface AnalysisEntity {
  readonly id: string;
  readonly type: EntityType;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly complexity: number;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
  readonly issues: readonly string[];
  readonly metrics: EntityMetrics;
}

export enum EntityType {
  FILE = 'file',
  CLASS = 'class',
  FUNCTION = 'function',
  MODULE = 'module',
  PACKAGE = 'package',
  INTERFACE = 'interface',
  TYPE = 'type'
}

export interface EntityMetrics {
  readonly lines: number;
  readonly statements: number;
  readonly functions: number;
  readonly classes: number;
  readonly complexity: ComplexityMetrics;
  readonly coverage: CoverageMetrics;
}

export interface ComplexityMetrics {
  readonly cyclomatic: number;
  readonly cognitive: number;
  readonly nesting: number;
  readonly coupling: number;
  readonly cohesion: number;
}

export interface CoverageMetrics {
  readonly statements: number;
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
}

export interface AnalysisIssue {
  readonly id: string;
  readonly type: IssueType;
  readonly severity: IssueSeverity;
  readonly title: string;
  readonly description: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly rule: string;
  readonly suggestion: string;
  readonly effort: EstimatedEffort;
  readonly tags: readonly string[];
}

export enum IssueType {
  BUG = 'bug',
  CODE_SMELL = 'code_smell',
  VULNERABILITY = 'vulnerability',
  SECURITY_HOTSPOT = 'security_hotspot',
  PERFORMANCE = 'performance',
  MAINTAINABILITY = 'maintainability',
  RELIABILITY = 'reliability'
}

export enum IssueSeverity {
  BLOCKER = 'blocker',
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  INFO = 'info'
}

export enum EstimatedEffort {
  TRIVIAL = '5min',
  EASY = '10min',
  MEDIUM = '20min',
  MAJOR = '1h',
  HIGH = '3h',
  COMPLEX = '1d'
}

export interface AnalysisDuplicate {
  readonly id: string;
  readonly type: DuplicateType;
  readonly files: readonly DuplicateFile[];
  readonly lines: number;
  readonly tokens: number;
  readonly similarity: number;
  readonly effort: EstimatedEffort;
}

export enum DuplicateType {
  EXACT = 'exact',
  STRUCTURAL = 'structural',
  SEMANTIC = 'semantic'
}

export interface DuplicateFile {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly snippet: string;
}

export interface AnalysisRecommendation {
  readonly id: string;
  readonly type: RecommendationType;
  readonly priority: RecommendationPriority;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly implementation: ImplementationGuidance;
  readonly impact: ImpactAssessment;
  readonly effort: EstimatedEffort;
  readonly tags: readonly string[];
}

export enum RecommendationType {
  REFACTOR = 'refactor',
  OPTIMIZE = 'optimize',
  MODERNIZE = 'modernize',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  MAINTAINABILITY = 'maintainability',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation'
}

export enum RecommendationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface ImplementationGuidance {
  readonly steps: readonly ImplementationStep[];
  readonly examples: readonly CodeExample[];
  readonly resources: readonly Resource[];
  readonly tooling: readonly Tool[];
}

export interface ImplementationStep {
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly code?: string;
  readonly validation: string;
}

export interface CodeExample {
  readonly title: string;
  readonly before: string;
  readonly after: string;
  readonly explanation: string;
}

export interface Resource {
  readonly type: ResourceType;
  readonly title: string;
  readonly url: string;
  readonly description: string;
}

export enum ResourceType {
  DOCUMENTATION = 'documentation',
  TUTORIAL = 'tutorial',
  BLOG_POST = 'blog_post',
  VIDEO = 'video',
  BOOK = 'book',
  PAPER = 'paper'
}

export interface Tool {
  readonly name: string;
  readonly type: ToolType;
  readonly description: string;
  readonly url: string;
  readonly configuration?: ApiObjectValue;
}

export enum ToolType {
  LINTER = 'linter',
  FORMATTER = 'formatter',
  ANALYZER = 'analyzer',
  TESTING = 'testing',
  BUILD = 'build',
  DEPLOYMENT = 'deployment'
}

export interface ImpactAssessment {
  readonly quality: ImpactLevel;
  readonly performance: ImpactLevel;
  readonly security: ImpactLevel;
  readonly maintainability: ImpactLevel;
  readonly team: TeamImpact;
}

export enum ImpactLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal'
}

export interface TeamImpact {
  readonly learning: ImpactLevel;
  readonly workload: ImpactLevel;
  readonly risk: ImpactLevel;
}

export interface DependencyGraph {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
  readonly clusters: readonly DependencyCluster[];
  readonly metrics: DependencyMetrics;
}

export interface DependencyNode {
  readonly id: string;
  readonly name: string;
  readonly type: DependencyNodeType;
  readonly path?: string;
  readonly version?: string;
  readonly size: number;
  readonly complexity: number;
  readonly stability: number;
  readonly abstractness: number;
}

export enum DependencyNodeType {
  FILE = 'file',
  MODULE = 'module',
  PACKAGE = 'package',
  EXTERNAL = 'external',
  SYSTEM = 'system'
}

export interface DependencyEdge {
  readonly source: string;
  readonly target: string;
  readonly type: DependencyType;
  readonly weight: number;
  readonly strength: number;
}

export enum DependencyType {
  IMPORT = 'import',
  REQUIRE = 'require',
  INHERITANCE = 'inheritance',
  COMPOSITION = 'composition',
  AGGREGATION = 'aggregation',
  USAGE = 'usage'
}

export interface DependencyCluster {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly string[];
  readonly cohesion: number;
  readonly coupling: number;
}

export interface DependencyMetrics {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly avgDegree: number;
  readonly density: number;
  readonly modularity: number;
  readonly cycles: readonly DependencyCycle[];
}

export interface DependencyCycle {
  readonly nodes: readonly string[];
  readonly length: number;
  readonly strength: number;
}

export interface ProjectMetrics {
  readonly overview: ProjectOverview;
  readonly codebase: CodebaseMetrics;
  readonly quality: QualityMetrics;
  readonly testing: TestingMetrics;
  readonly security: SecurityMetrics;
  readonly performance: PerformanceMetrics;
  readonly dependencies: DependencyAnalysis;
}

export interface ProjectOverview {
  readonly name: string;
  readonly version: string;
  readonly language: string;
  readonly framework: string;
  readonly createdAt: string;
  readonly lastAnalyzed: string;
  readonly contributors: number;
  readonly commits: number;
}

export interface CodebaseMetrics {
  readonly files: FileMetrics;
  readonly lines: LineMetrics;
  readonly functions: FunctionMetrics;
  readonly classes: ClassMetrics;
  readonly complexity: ComplexityMetrics;
}

export interface FileMetrics {
  readonly total: number;
  readonly byType: Record<string, number>;
  readonly bySize: SizeDistribution;
  readonly largest: readonly LargeFile[];
}

export interface SizeDistribution {
  readonly small: number; // < 100 lines
  readonly medium: number; // 100-500 lines
  readonly large: number; // 500-1000 lines
  readonly veryLarge: number; // > 1000 lines
}

export interface LargeFile {
  readonly path: string;
  readonly lines: number;
  readonly complexity: number;
  readonly issues: number;
}

export interface LineMetrics {
  readonly total: number;
  readonly code: number;
  readonly comments: number;
  readonly blank: number;
  readonly documentation: number;
}

export interface FunctionMetrics {
  readonly total: number;
  readonly avgComplexity: number;
  readonly avgLength: number;
  readonly distribution: ComplexityDistribution;
  readonly mostComplex: readonly ComplexFunction[];
}

export interface ComplexityDistribution {
  readonly simple: number; // 1-5
  readonly moderate: number; // 6-10
  readonly complex: number; // 11-20
  readonly veryComplex: number; // 21+
}

export interface ComplexFunction {
  readonly name: string;
  readonly file: string;
  readonly complexity: number;
  readonly lines: number;
  readonly parameters: number;
}

export interface ClassMetrics {
  readonly total: number;
  readonly avgMethods: number;
  readonly avgComplexity: number;
  readonly inheritance: InheritanceMetrics;
  readonly largest: readonly LargeClass[];
}

export interface InheritanceMetrics {
  readonly maxDepth: number;
  readonly avgDepth: number;
  readonly trees: number;
}

export interface LargeClass {
  readonly name: string;
  readonly file: string;
  readonly methods: number;
  readonly lines: number;
  readonly complexity: number;
}

export interface QualityMetrics {
  readonly maintainabilityIndex: number;
  readonly technicalDebt: TechnicalDebtMetrics;
  readonly codeSmells: CodeSmellMetrics;
  readonly duplication: DuplicationMetrics;
}

export interface TechnicalDebtMetrics {
  readonly total: number; // in hours
  readonly byType: Record<IssueType, number>;
  readonly bySeverity: Record<IssueSeverity, number>;
  readonly trend: readonly TechnicalDebtPoint[];
}

export interface TechnicalDebtPoint {
  readonly date: string;
  readonly debt: number;
  readonly ratio: number;
}

export interface CodeSmellMetrics {
  readonly total: number;
  readonly byType: Record<string, number>;
  readonly density: number; // per 1000 lines
}

export interface DuplicationMetrics {
  readonly percentage: number;
  readonly lines: number;
  readonly blocks: number;
  readonly files: number;
}

export interface TestingMetrics {
  readonly coverage: DetailedCoverageMetrics;
  readonly tests: TestMetrics;
  readonly quality: TestQualityMetrics;
}

export interface DetailedCoverageMetrics {
  readonly overall: CoverageMetrics;
  readonly byFile: Record<string, CoverageMetrics>;
  readonly byType: Record<string, CoverageMetrics>;
  readonly trend: readonly CoveragePoint[];
}

export interface CoveragePoint {
  readonly date: string;
  readonly coverage: CoverageMetrics;
}

export interface TestMetrics {
  readonly total: number;
  readonly unit: number;
  readonly integration: number;
  readonly e2e: number;
  readonly performance: number;
  readonly ratio: TestRatio;
}

export interface TestRatio {
  readonly testsPerFile: number;
  readonly assertionsPerTest: number;
  readonly coveragePerTest: number;
}

export interface TestQualityMetrics {
  readonly flaky: number;
  readonly slow: number;
  readonly maintenance: TestMaintenanceMetrics;
}

export interface TestMaintenanceMetrics {
  readonly lastUpdated: string;
  readonly outdated: number;
  readonly deprecated: number;
}

export interface SecurityMetrics {
  readonly vulnerabilities: DetailedVulnerabilityMetrics;
  readonly compliance: DetailedComplianceMetrics;
  readonly dependencies: SecurityDependencyMetrics;
}

export interface DetailedVulnerabilityMetrics {
  readonly total: number;
  readonly bySeverity: VulnerabilityCount;
  readonly byType: Record<string, number>;
  readonly byFile: Record<string, number>;
  readonly trend: readonly VulnerabilityPoint[];
}

export interface VulnerabilityPoint {
  readonly date: string;
  readonly vulnerabilities: VulnerabilityCount;
}

export interface DetailedComplianceMetrics {
  readonly frameworks: Record<string, ComplianceFramework>;
  readonly overall: number;
}

export interface ComplianceFramework {
  readonly name: string;
  readonly version: string;
  readonly score: number;
  readonly requirements: readonly ComplianceRequirement[];
}

export interface ComplianceRequirement {
  readonly id: string;
  readonly title: string;
  readonly status: ComplianceStatus;
  readonly evidence: readonly string[];
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  NOT_APPLICABLE = 'not_applicable'
}

export interface SecurityDependencyMetrics {
  readonly vulnerable: number;
  readonly outdated: number;
  readonly licenses: LicenseMetrics;
}

export interface LicenseMetrics {
  readonly byType: Record<string, number>;
  readonly compatible: number;
  readonly incompatible: number;
  readonly unknown: number;
}

export interface PerformanceMetrics {
  readonly benchmarks: readonly BenchmarkResult[];
  readonly profiling: ProfilingResults;
  readonly memory: MemoryMetrics;
}

export interface BenchmarkResult {
  readonly name: string;
  readonly operations: number;
  readonly duration: number;
  readonly memory: number;
  readonly cpu: number;
}

export interface ProfilingResults {
  readonly hotspots: readonly PerformanceHotspot[];
  readonly callGraph: CallGraphMetrics;
}

export interface PerformanceHotspot {
  readonly function: string;
  readonly file: string;
  readonly line: number;
  readonly time: number;
  readonly calls: number;
  readonly percentage: number;
}

export interface CallGraphMetrics {
  readonly nodes: number;
  readonly edges: number;
  readonly depth: number;
  readonly cycles: number;
}

export interface MemoryMetrics {
  readonly peak: number;
  readonly average: number;
  readonly leaks: readonly MemoryLeak[];
  readonly allocations: AllocationMetrics;
}

export interface MemoryLeak {
  readonly function: string;
  readonly file: string;
  readonly size: number;
  readonly age: number;
}

export interface AllocationMetrics {
  readonly total: number;
  readonly byType: Record<string, number>;
  readonly byFunction: Record<string, number>;
}

export interface DependencyAnalysis {
  readonly direct: number;
  readonly transitive: number;
  readonly security: SecurityDependencyMetrics;
  readonly licenses: LicenseAnalysis;
  readonly outdated: OutdatedDependencies;
  readonly graph: DependencyGraphMetrics;
}

export interface LicenseAnalysis {
  readonly distribution: Record<string, number>;
  readonly risks: readonly LicenseRisk[];
  readonly compatibility: LicenseCompatibility;
}

export interface LicenseRisk {
  readonly license: string;
  readonly risk: RiskLevel;
  readonly reason: string;
  readonly dependencies: readonly string[];
}

export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface LicenseCompatibility {
  readonly compatible: number;
  readonly incompatible: number;
  readonly unknown: number;
  readonly conflicts: readonly LicenseConflict[];
}

export interface LicenseConflict {
  readonly license1: string;
  readonly license2: string;
  readonly dependencies: readonly string[];
  readonly resolution: string;
}

export interface OutdatedDependencies {
  readonly total: number;
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly dependencies: readonly OutdatedDependency[];
}

export interface OutdatedDependency {
  readonly name: string;
  readonly current: string;
  readonly latest: string;
  readonly type: DependencyUpdateType;
  readonly risk: RiskLevel;
}

export enum DependencyUpdateType {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch'
}

export interface DependencyGraphMetrics {
  readonly nodes: number;
  readonly edges: number;
  readonly clusters: number;
  readonly cycles: number;
  readonly depth: number;
  readonly fanIn: number;
  readonly fanOut: number;
}

// API Request/Response schemas for specific endpoints
export interface GetAnalysisRequest {
  readonly projectId?: string;
  readonly includeMetrics?: boolean;
  readonly includeDependencies?: boolean;
  readonly format?: 'json' | 'xml' | 'csv';
}

export interface GetAnalysisResponse extends ApiResponse<AnalysisApiData> {}

export interface CreateAnalysisRequest {
  readonly projectId: string;
  readonly config: AnalysisConfiguration;
  readonly async?: boolean;
}

export interface AnalysisConfiguration {
  readonly scope: AnalysisScope;
  readonly rules: AnalysisRules;
  readonly output: AnalysisOutput;
}

export interface AnalysisScope {
  readonly paths: readonly string[];
  readonly exclude: readonly string[];
  readonly languages: readonly string[];
  readonly frameworks: readonly string[];
}

export interface AnalysisRules {
  readonly quality: QualityRules;
  readonly security: SecurityRules;
  readonly performance: PerformanceRules;
}

export interface QualityRules {
  readonly enabled: boolean;
  readonly severity: IssueSeverity;
  readonly rules: readonly string[];
  readonly customRules?: readonly CustomRule[];
}

export interface SecurityRules {
  readonly enabled: boolean;
  readonly frameworks: readonly string[];
  readonly severity: IssueSeverity;
  readonly includeThirdParty: boolean;
}

export interface PerformanceRules {
  readonly enabled: boolean;
  readonly thresholds: PerformanceThresholds;
  readonly includeMemory: boolean;
}

export interface PerformanceThresholds {
  readonly complexity: number;
  readonly responseTime: number;
  readonly memoryUsage: number;
}

export interface CustomRule {
  readonly id: string;
  readonly name: string;
  readonly pattern: string;
  readonly severity: IssueSeverity;
  readonly message: string;
}

export interface AnalysisOutput {
  readonly format: readonly ('json' | 'xml' | 'html' | 'pdf')[];
  readonly includeSourceCode: boolean;
  readonly includeRecommendations: boolean;
  readonly groupBy: 'file' | 'type' | 'severity';
}

export interface CreateAnalysisResponse extends ApiResponse<{ analysisId: string; status: AnalysisStatus }> {}

export enum AnalysisStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Type guards for API types
export const isApiValue = (value: unknown): value is ApiValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isApiValue);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(isApiValue);
  }
  return false;
};

export const isApiResponse = <T = ApiValue>(value: unknown): value is ApiResponse<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as ApiResponse).success === 'boolean'
  );
};

export const isAnalysisApiData = (value: unknown): value is AnalysisApiData => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'projectId' in value &&
    'summary' in value &&
    'entities' in value &&
    'issues' in value
  );
};

// API utilities
export const createApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: ApiError,
  metadata?: ResponseMetadata
): ApiResponse<T> => ({
  success,
  data,
  error,
  metadata
});

export const createApiError = (
  code: string,
  message: string,
  requestId: string,
  details?: ApiErrorDetails
): ApiError => ({
  code,
  message,
  details,
  timestamp: new Date().toISOString(),
  requestId
});