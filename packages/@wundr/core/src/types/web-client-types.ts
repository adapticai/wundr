/**
 * Web client type definitions - replaces any types with proper interfaces
 */

// Import base types
import type { JsonValue, JsonObject } from './index.js';

// Chart and visualization types
export interface ChartDataPoint {
  readonly x: number | string | Date;
  readonly y: number;
  readonly label?: string;
  readonly metadata?: JsonObject;
}

export interface ChartDataset {
  readonly label: string;
  readonly data: readonly ChartDataPoint[];
  readonly backgroundColor?: string | readonly string[];
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly fill?: boolean;
  readonly tension?: number;
}

export interface ChartConfiguration {
  readonly type: 'line' | 'bar' | 'pie' | 'doughnut' | 'scatter' | 'area';
  readonly datasets: readonly ChartDataset[];
  readonly options?: ChartOptions;
}

export interface ChartOptions {
  readonly responsive?: boolean;
  readonly maintainAspectRatio?: boolean;
  readonly plugins?: ChartPluginOptions;
  readonly scales?: ChartScaleOptions;
  readonly interaction?: ChartInteractionOptions;
  readonly animation?: ChartAnimationOptions;
}

export interface ChartPluginOptions {
  readonly legend?: LegendOptions;
  readonly tooltip?: TooltipOptions;
  readonly title?: TitleOptions;
}

export interface LegendOptions {
  readonly display: boolean;
  readonly position: 'top' | 'bottom' | 'left' | 'right';
  readonly align?: 'start' | 'center' | 'end';
}

export interface TooltipOptions {
  readonly enabled: boolean;
  readonly mode?: 'nearest' | 'point' | 'index' | 'dataset' | 'x' | 'y';
  readonly intersect?: boolean;
}

export interface TitleOptions {
  readonly display: boolean;
  readonly text: string;
  readonly position?: 'top' | 'bottom';
}

export interface ChartScaleOptions {
  readonly x?: AxisOptions;
  readonly y?: AxisOptions;
}

export interface AxisOptions {
  readonly type?: 'linear' | 'logarithmic' | 'category' | 'time';
  readonly display?: boolean;
  readonly title?: {
    readonly display: boolean;
    readonly text: string;
  };
  readonly min?: number;
  readonly max?: number;
  readonly beginAtZero?: boolean;
}

export interface ChartInteractionOptions {
  readonly mode: 'nearest' | 'point' | 'index' | 'dataset' | 'x' | 'y';
  readonly intersect: boolean;
}

export interface ChartAnimationOptions {
  readonly duration: number;
  readonly easing: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad';
}

// Dashboard and analytics types
export interface DashboardMetrics {
  readonly overview: OverviewMetrics;
  readonly quality: QualityMetrics;
  readonly performance: PerformanceMetrics;
  readonly security: SecurityMetrics;
  readonly trends: TrendMetrics;
}

export interface OverviewMetrics {
  readonly totalFiles: number;
  readonly totalLines: number;
  readonly totalFunctions: number;
  readonly totalClasses: number;
  readonly lastUpdated: Date;
}

export interface QualityMetrics {
  readonly maintainabilityIndex: number;
  readonly codeComplexity: number;
  readonly duplicationPercentage: number;
  readonly testCoverage: number;
  readonly issuesCount: IssueCount;
}

export interface IssueCount {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly total: number;
}

export interface PerformanceMetrics {
  readonly buildTime: number;
  readonly testExecutionTime: number;
  readonly memoryUsage: number;
  readonly bundleSize: number;
}

export interface SecurityMetrics {
  readonly vulnerabilityCount: VulnerabilityCount;
  readonly complianceScore: number;
  readonly securityRating: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface VulnerabilityCount {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

export interface TrendMetrics {
  readonly quality: readonly TrendPoint[];
  readonly coverage: readonly TrendPoint[];
  readonly performance: readonly TrendPoint[];
  readonly security: readonly TrendPoint[];
}

export interface TrendPoint {
  readonly date: Date;
  readonly value: number;
  readonly change?: number;
}

// File and project management types
export interface FileItem {
  readonly path: string;
  readonly name: string;
  readonly type: 'file' | 'directory';
  readonly size: number;
  readonly lastModified: Date;
  readonly extension?: string;
  readonly isExecutable?: boolean;
  readonly children?: readonly FileItem[];
}

export interface ProjectInfo {
  readonly name: string;
  readonly path: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  readonly repository?: string;
  readonly dependencies: readonly DependencyInfo[];
  readonly devDependencies: readonly DependencyInfo[];
  readonly scripts: readonly ScriptInfo[];
}

export interface DependencyInfo {
  readonly name: string;
  readonly version: string;
  readonly type: 'production' | 'development' | 'peer' | 'optional';
  readonly isOutdated: boolean;
  readonly latestVersion?: string;
  readonly vulnerabilities?: readonly VulnerabilityInfo[];
}

export interface VulnerabilityInfo {
  readonly id: string;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly title: string;
  readonly description: string;
  readonly patchAvailable: boolean;
}

export interface ScriptInfo {
  readonly name: string;
  readonly command: string;
  readonly description?: string;
}

// Analysis and reporting types
export interface AnalysisReport {
  readonly id: string;
  readonly projectId: string;
  readonly timestamp: Date;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly progress: number;
  readonly results?: AnalysisResults;
  readonly error?: AnalysisError;
}

export interface AnalysisResults {
  readonly summary: AnalysisSummary;
  readonly entities: readonly AnalysisEntity[];
  readonly issues: readonly AnalysisIssue[];
  readonly duplicates: readonly DuplicateCluster[];
  readonly dependencies: readonly DependencyAnalysis[];
  readonly metrics: AnalysisMetrics;
}

export interface AnalysisSummary {
  readonly filesAnalyzed: number;
  readonly entitiesFound: number;
  readonly issuesFound: number;
  readonly duplicatesFound: number;
  readonly totalLines: number;
  readonly analysisTime: number;
}

export interface AnalysisEntity {
  readonly id: string;
  readonly name: string;
  readonly type:
    | 'class'
    | 'function'
    | 'interface'
    | 'type'
    | 'enum'
    | 'variable';
  readonly file: string;
  readonly line: number;
  readonly complexity: number;
  readonly dependencies: readonly string[];
  readonly usages: readonly EntityUsage[];
}

export interface EntityUsage {
  readonly file: string;
  readonly line: number;
  readonly type: 'import' | 'call' | 'extend' | 'implement';
}

export interface AnalysisIssue {
  readonly id: string;
  readonly type: 'bug' | 'vulnerability' | 'code_smell' | 'maintainability';
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly title: string;
  readonly description: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly rule: string;
  readonly suggestion: string;
  readonly tags: readonly string[];
}

export interface DuplicateCluster {
  readonly id: string;
  readonly type: 'exact' | 'structural' | 'functional';
  readonly similarity: number;
  readonly instances: readonly DuplicateInstance[];
  readonly recommendedAction: string;
}

export interface DuplicateInstance {
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly snippet: string;
}

export interface DependencyAnalysis {
  readonly module: string;
  readonly type: 'internal' | 'external';
  readonly usage: 'direct' | 'transitive';
  readonly dependents: readonly string[];
  readonly dependencies: readonly string[];
  readonly isCircular: boolean;
  readonly circularPath?: readonly string[];
}

export interface AnalysisMetrics {
  readonly codeComplexity: ComplexityMetrics;
  readonly maintainability: MaintainabilityMetrics;
  readonly testability: TestabilityMetrics;
  readonly documentation: DocumentationMetrics;
}

export interface ComplexityMetrics {
  readonly cyclomatic: number;
  readonly cognitive: number;
  readonly halstead: HalsteadMetrics;
}

export interface HalsteadMetrics {
  readonly vocabulary: number;
  readonly length: number;
  readonly volume: number;
  readonly difficulty: number;
  readonly effort: number;
  readonly bugs: number;
}

export interface MaintainabilityMetrics {
  readonly index: number;
  readonly technicalDebt: number;
  readonly codeSmells: number;
  readonly duplication: number;
}

export interface TestabilityMetrics {
  readonly coverage: number;
  readonly testRatio: number;
  readonly assertionDensity: number;
}

export interface DocumentationMetrics {
  readonly coverage: number;
  readonly quality: number;
  readonly outdated: number;
}

export interface AnalysisError {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly stack?: string;
}

// UI and component types
export interface TableColumn<T = JsonValue> {
  readonly key: string;
  readonly title: string;
  readonly dataIndex: keyof T;
  readonly width?: number;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly render?: (
    value: T[keyof T],
    record: T,
    index: number
  ) => React.ReactNode;
}

export interface TableProps<T = JsonObject> {
  readonly columns: readonly TableColumn<T>[];
  readonly dataSource: readonly T[];
  readonly loading?: boolean;
  readonly pagination?: PaginationConfig;
  readonly rowSelection?: RowSelectionConfig<T>;
  readonly expandable?: ExpandableConfig<T>;
  readonly scroll?: { x?: number; y?: number };
  readonly size?: 'small' | 'middle' | 'large';
}

export interface PaginationConfig {
  readonly current: number;
  readonly pageSize: number;
  readonly total: number;
  readonly showSizeChanger?: boolean;
  readonly showQuickJumper?: boolean;
  readonly pageSizeOptions?: readonly string[];
}

export interface RowSelectionConfig<T> {
  readonly type: 'checkbox' | 'radio';
  readonly selectedRowKeys: readonly string[];
  readonly onChange: (
    selectedRowKeys: readonly string[],
    selectedRows: readonly T[]
  ) => void;
  readonly onSelect?: (
    record: T,
    selected: boolean,
    selectedRows: readonly T[]
  ) => void;
  readonly onSelectAll?: (
    selected: boolean,
    selectedRows: readonly T[],
    changeRows: readonly T[]
  ) => void;
}

export interface ExpandableConfig<T> {
  readonly expandedRowRender: (
    record: T,
    index: number,
    indent: number,
    expanded: boolean
  ) => React.ReactNode;
  readonly expandedRowKeys?: readonly string[];
  readonly defaultExpandedRowKeys?: readonly string[];
  readonly onExpand?: (expanded: boolean, record: T) => void;
  readonly onExpandedRowsChange?: (expandedKeys: readonly string[]) => void;
}

// Form and input types
export interface FormField<T = JsonValue> {
  readonly name: string;
  readonly label: string;
  readonly type:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'date';
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly defaultValue?: T;
  readonly options?: readonly SelectOption[];
  readonly validation?: ValidationRule<T>[];
  readonly disabled?: boolean;
  readonly description?: string;
}

export interface SelectOption {
  readonly value: string | number;
  readonly label: string;
  readonly disabled?: boolean;
  readonly group?: string;
}

export interface ValidationRule<T> {
  readonly type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  readonly value?: unknown;
  readonly message: string;
  readonly validator?: (value: T) => boolean | Promise<boolean>;
}

export interface FormProps<T extends JsonObject> {
  readonly fields: readonly FormField<T[keyof T]>[];
  readonly initialValues?: Partial<T>;
  readonly onSubmit: (values: T) => Promise<void>;
  readonly onValuesChange?: (changedValues: Partial<T>, allValues: T) => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly layout?: 'horizontal' | 'vertical' | 'inline';
}

// Navigation and routing types
export interface NavigationItem {
  readonly key: string;
  readonly label: string;
  readonly path?: string;
  readonly icon?: string;
  readonly children?: readonly NavigationItem[];
  readonly disabled?: boolean;
  readonly badge?: number | string;
}

export interface BreadcrumbItem {
  readonly key: string;
  readonly title: string;
  readonly path?: string;
}

export interface RouteConfig {
  readonly path: string;
  readonly element: React.ComponentType;
  readonly exact?: boolean;
  readonly children?: readonly RouteConfig[];
  readonly meta?: RouteMetadata;
}

export interface RouteMetadata {
  readonly title?: string;
  readonly requiresAuth?: boolean;
  readonly permissions?: readonly string[];
  readonly breadcrumbs?: readonly BreadcrumbItem[];
}

// Theme and styling types
export interface ThemeConfig {
  readonly colors: ColorPalette;
  readonly typography: TypographyConfig;
  readonly spacing: SpacingConfig;
  readonly breakpoints: BreakpointConfig;
  readonly components: ComponentTheme;
}

export interface ColorPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly info: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly border: string;
  readonly divider: string;
}

export interface TypographyConfig {
  readonly fontFamily: string;
  readonly fontSize: FontSizeScale;
  readonly fontWeight: FontWeightScale;
  readonly lineHeight: LineHeightScale;
}

export interface FontSizeScale {
  readonly xs: string;
  readonly sm: string;
  readonly base: string;
  readonly lg: string;
  readonly xl: string;
  readonly '2xl': string;
  readonly '3xl': string;
}

export interface FontWeightScale {
  readonly light: number;
  readonly normal: number;
  readonly medium: number;
  readonly semibold: number;
  readonly bold: number;
}

export interface LineHeightScale {
  readonly tight: number;
  readonly normal: number;
  readonly relaxed: number;
}

export interface SpacingConfig {
  readonly xs: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly xl: string;
  readonly '2xl': string;
  readonly '3xl': string;
}

export interface BreakpointConfig {
  readonly xs: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly xl: string;
  readonly '2xl': string;
}

export interface ComponentTheme {
  readonly button: ButtonTheme;
  readonly input: InputTheme;
  readonly card: CardTheme;
  readonly table: TableTheme;
}

export interface ButtonTheme {
  readonly borderRadius: string;
  readonly padding: string;
  readonly variants: ButtonVariants;
}

export interface ButtonVariants {
  readonly primary: ButtonVariant;
  readonly secondary: ButtonVariant;
  readonly outline: ButtonVariant;
  readonly ghost: ButtonVariant;
}

export interface ButtonVariant {
  readonly backgroundColor: string;
  readonly color: string;
  readonly borderColor: string;
  readonly hoverBackgroundColor: string;
  readonly hoverColor: string;
  readonly hoverBorderColor: string;
}

export interface InputTheme {
  readonly borderRadius: string;
  readonly padding: string;
  readonly borderColor: string;
  readonly focusBorderColor: string;
  readonly backgroundColor: string;
}

export interface CardTheme {
  readonly borderRadius: string;
  readonly padding: string;
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly shadow: string;
}

export interface TableTheme {
  readonly borderColor: string;
  readonly headerBackground: string;
  readonly rowHoverBackground: string;
  readonly stripedBackground: string;
}

// Notification and messaging types
export interface NotificationConfig {
  readonly type: 'success' | 'info' | 'warning' | 'error';
  readonly title: string;
  readonly message?: string;
  readonly duration?: number;
  readonly closable?: boolean;
  readonly action?: NotificationAction;
}

export interface NotificationAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastConfig {
  readonly type: 'success' | 'info' | 'warning' | 'error';
  readonly message: string;
  readonly duration?: number;
  readonly position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
}

// Types are already exported above, no need to re-export
