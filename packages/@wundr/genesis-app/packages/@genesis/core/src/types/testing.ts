/**
 * Testing & Quality Assurance Types for Genesis-App
 * Test utilities, mocking, and documentation types
 */

/** Test environment */
export type TestEnvironment = 'unit' | 'integration' | 'e2e' | 'performance';

/** Test status */
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'flaky';

/** Test priority */
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

/** Test metadata */
export interface TestMetadata {
  id: string;
  name: string;
  description?: string;
  environment: TestEnvironment;
  priority: TestPriority;
  tags: string[];
  timeout: number;
  retries: number;
  skip?: boolean;
  only?: boolean;
}

/** Test result */
export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  duration: number;
  startedAt: Date;
  completedAt: Date;
  error?: TestError;
  assertions: AssertionResult[];
  screenshots?: string[];
  logs: string[];
  metadata?: Record<string, unknown>;
}

/** Test error */
export interface TestError {
  message: string;
  stack?: string;
  type: string;
  expected?: unknown;
  actual?: unknown;
  diff?: string;
}

/** Assertion result */
export interface AssertionResult {
  passed: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

/** Test suite */
export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  tests: TestMetadata[];
  beforeAll?: string[];
  afterAll?: string[];
  beforeEach?: string[];
  afterEach?: string[];
}

/** Test run */
export interface TestRun {
  id: string;
  suiteId: string;
  environment: TestEnvironment;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'cancelled';
  results: TestResult[];
  summary: TestSummary;
}

/** Test summary */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
  coverage?: CoverageReport;
}

/** Coverage report */
export interface CoverageReport {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

/** Coverage metric */
export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

/** Mock configuration */
export interface MockConfig {
  name: string;
  type: 'function' | 'module' | 'api' | 'database' | 'redis';
  implementation?: unknown;
  returnValue?: unknown;
  resolvedValue?: unknown;
  rejectedValue?: unknown;
  mockOnce?: boolean;
}

/** Mock call */
export interface MockCall {
  args: unknown[];
  result?: unknown;
  error?: Error;
  timestamp: number;
}

/** Mock instance */
export interface MockInstance {
  name: string;
  calls: MockCall[];
  callCount: number;
  lastCall?: MockCall;
  mockClear: () => void;
  mockReset: () => void;
  mockRestore: () => void;
  mockReturnValue: (value: unknown) => void;
  mockResolvedValue: (value: unknown) => void;
  mockRejectedValue: (error: Error) => void;
  mockImplementation: (fn: (...args: unknown[]) => unknown) => void;
}

/** Fixture */
export interface Fixture<T = unknown> {
  name: string;
  data: T;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/** Factory function */
export type FactoryFunction<T> = (overrides?: Partial<T>) => T;

/** Seeder */
export interface Seeder<T = unknown> {
  name: string;
  count: number;
  factory: FactoryFunction<T>;
  dependencies?: string[];
}

/** Test database */
export interface TestDatabase {
  name: string;
  migrate: () => Promise<void>;
  seed: (seeders: Seeder[]) => Promise<void>;
  truncate: () => Promise<void>;
  drop: () => Promise<void>;
}

/** API mock server */
export interface MockServer {
  baseUrl: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
  mock: (method: string, path: string, response: MockResponse) => void;
  verify: () => MockServerVerification;
}

/** Mock response */
export interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

/** Mock server verification */
export interface MockServerVerification {
  matched: number;
  unmatched: number;
  unmatchedRequests: Array<{ method: string; path: string }>;
}

/** E2E test page */
export interface TestPage {
  url: string;
  goto: (url: string) => Promise<void>;
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  select: (selector: string, value: string) => Promise<void>;
  waitFor: (selector: string, options?: WaitOptions) => Promise<void>;
  screenshot: (name: string) => Promise<string>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  locator: (selector: string) => TestLocator;
}

/** Wait options */
export interface WaitOptions {
  timeout?: number;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
}

/** Test locator */
export interface TestLocator {
  click: () => Promise<void>;
  fill: (value: string) => Promise<void>;
  getText: () => Promise<string>;
  getAttribute: (name: string) => Promise<string | null>;
  isVisible: () => Promise<boolean>;
  count: () => Promise<number>;
}

/** Performance test config */
export interface PerformanceTestConfig {
  name: string;
  duration: number;
  vus: number; // Virtual users
  thresholds: PerformanceThreshold[];
  stages?: LoadStage[];
}

/** Performance threshold */
export interface PerformanceThreshold {
  metric: string;
  threshold: string; // e.g., "p95<500"
  abortOnFail?: boolean;
}

/** Load stage */
export interface LoadStage {
  duration: number;
  target: number;
}

/** Performance metrics */
export interface PerformanceTestMetrics {
  http_req_duration: MetricSummary;
  http_req_waiting: MetricSummary;
  http_reqs: number;
  iterations: number;
  vus: number;
  vus_max: number;
  data_sent: number;
  data_received: number;
}

/** Metric summary */
export interface MetricSummary {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
  p99: number;
}

/** Documentation types */

/** Documentation category */
export type DocCategory = 'guide' | 'api' | 'tutorial' | 'reference' | 'changelog';

/** Documentation page */
export interface DocPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: DocCategory;
  content: string;
  order: number;
  tags: string[];
  lastUpdated: Date;
  author?: string;
}

/** API documentation */
export interface ApiDoc {
  id: string;
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  schemas: ApiSchema[];
  authentication: ApiAuthentication;
}

/** API endpoint */
export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  tags: string[];
  deprecated?: boolean;
  authentication?: boolean;
}

/** API parameter */
export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description: string;
  required: boolean;
  schema: ApiSchemaRef;
  example?: unknown;
}

/** API request body */
export interface ApiRequestBody {
  description: string;
  required: boolean;
  content: Record<string, ApiMediaType>;
}

/** API media type */
export interface ApiMediaType {
  schema: ApiSchemaRef;
  example?: unknown;
  examples?: Record<string, ApiExample>;
}

/** API response */
export interface ApiResponse {
  statusCode: number;
  description: string;
  content?: Record<string, ApiMediaType>;
  headers?: Record<string, ApiParameter>;
}

/** API schema */
export interface ApiSchema {
  name: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, ApiSchemaRef>;
  required?: string[];
  items?: ApiSchemaRef;
  enum?: unknown[];
  format?: string;
  default?: unknown;
  example?: unknown;
}

/** API schema reference */
export type ApiSchemaRef = ApiSchema | { $ref: string };

/** API example */
export interface ApiExample {
  summary: string;
  description?: string;
  value: unknown;
}

/** API authentication */
export interface ApiAuthentication {
  type: 'apiKey' | 'oauth2' | 'bearer' | 'basic';
  description: string;
  flows?: OAuthFlows;
}

/** OAuth flows */
export interface OAuthFlows {
  authorizationCode?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  password?: OAuthFlow;
}

/** OAuth flow */
export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/** Code example */
export interface CodeExample {
  language: string;
  code: string;
  title?: string;
  description?: string;
  runnable?: boolean;
}

/** Component documentation */
export interface ComponentDoc {
  name: string;
  description: string;
  props: PropDoc[];
  examples: CodeExample[];
  accessibility?: AccessibilityDoc;
  changelog?: ChangelogEntry[];
}

/** Prop documentation */
export interface PropDoc {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description: string;
}

/** Accessibility documentation */
export interface AccessibilityDoc {
  role: string;
  ariaAttributes: string[];
  keyboardNavigation: string[];
  screenReaderNotes: string[];
}

/** Changelog entry */
export interface ChangelogEntry {
  version: string;
  date: Date;
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
}

/** Default test configurations */
export const DEFAULT_TEST_TIMEOUT = 30000;
export const DEFAULT_TEST_RETRIES = 2;

export const DEFAULT_COVERAGE_THRESHOLDS: CoverageReport = {
  lines: { total: 0, covered: 0, percentage: 80 },
  functions: { total: 0, covered: 0, percentage: 80 },
  branches: { total: 0, covered: 0, percentage: 75 },
  statements: { total: 0, covered: 0, percentage: 80 },
};

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThreshold[] = [
  { metric: 'http_req_duration', threshold: 'p95<500' },
  { metric: 'http_req_failed', threshold: 'rate<0.01' },
];
