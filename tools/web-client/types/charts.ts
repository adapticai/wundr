/**
 * Chart.js Type Definitions for Enterprise Web Client
 *
 * Comprehensive type definitions for Chart.js components and configurations
 * to replace all 'any' types with proper type safety.
 *
 * @version 1.0.0
 * @author Wundr Development Team
 */

import type {
  ChartConfiguration,
  ChartOptions as ChartJSOptions,
  ChartData as ChartJSData,
  Plugin,
  TooltipItem,
  LegendItem,
  Chart,
  ChartType,
  ScriptableContext,
  CartesianScaleOptions,
  RadialLinearScaleOptions,
  ScaleOptions
} from 'chart.js';

// =============================================================================
// CHART DATA TYPES
// =============================================================================

/**
 * Enhanced chart dataset interface with enterprise requirements
 */
export interface ChartDataset {
  /** Dataset label */
  label: string;
  /** Dataset values */
  data: number[];
  /** Background colors (single color or array) */
  backgroundColor?: string | string[];
  /** Border colors (single color or array) */
  borderColor?: string | string[];
  /** Border width */
  borderWidth?: number;
  /** Fill configuration */
  fill?: boolean | number | string;
  /** Line tension for line charts */
  tension?: number;
  /** Point styles */
  pointStyle?: 'circle' | 'cross' | 'crossRot' | 'dash' | 'line' | 'rect' | 'rectRounded' | 'rectRot' | 'star' | 'triangle';
  /** Point radius */
  pointRadius?: number;
  /** Point hover radius */
  pointHoverRadius?: number;
  /** Hidden state */
  hidden?: boolean;
  /** Animation configuration */
  animation?: ChartAnimationConfig;
}

/**
 * Chart data structure with proper typing
 */
export interface ChartData {
  /** Chart labels */
  labels: string[];
  /** Chart datasets */
  datasets: ChartDataset[];
}

/**
 * Chart animation configuration
 */
export interface ChartAnimationConfig {
  /** Animation duration in milliseconds */
  duration?: number;
  /** Animation easing function */
  easing?: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart';
  /** Animate rotation for doughnut/pie charts */
  animateRotate?: boolean;
  /** Animate scale for doughnut/pie charts */
  animateScale?: boolean;
  /** Delay before animation starts */
  delay?: number;
  /** Animation loop */
  loop?: boolean;
}

// =============================================================================
// CHART OPTIONS TYPES
// =============================================================================

/**
 * Enhanced tooltip configuration
 */
export interface TooltipOptions {
  /** Whether tooltips are enabled */
  enabled?: boolean;
  /** Tooltip mode */
  mode?: 'point' | 'nearest' | 'index' | 'dataset' | 'x' | 'y';
  /** Tooltip position */
  position?: 'average' | 'nearest';
  /** Custom tooltip callbacks */
  callbacks?: {
    title?: (tooltipItems: TooltipItem<ChartType>[]) => string | string[];
    label?: (tooltipItem: TooltipItem<ChartType>) => string | string[];
    footer?: (tooltipItems: TooltipItem<ChartType>[]) => string | string[];
    labelColor?: (tooltipItem: TooltipItem<ChartType>) => { borderColor: string; backgroundColor: string };
  };
  /** Background color */
  backgroundColor?: string;
  /** Border color */
  borderColor?: string;
  /** Border width */
  borderWidth?: number;
  /** Title font */
  titleFont?: FontConfig;
  /** Body font */
  bodyFont?: FontConfig;
  /** Footer font */
  footerFont?: FontConfig;
  /** Padding */
  padding?: number | { top: number; bottom: number; left: number; right: number };
  /** Animation */
  animation?: ChartAnimationConfig;
}

/**
 * Enhanced legend configuration
 */
export interface LegendOptions {
  /** Whether legend is displayed */
  display?: boolean;
  /** Legend position */
  position?: 'top' | 'left' | 'bottom' | 'right' | 'chartArea';
  /** Legend alignment */
  align?: 'start' | 'center' | 'end';
  /** Maximum columns */
  maxHeight?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Legend labels configuration */
  labels?: {
    /** Box width */
    boxWidth?: number;
    /** Box height */
    boxHeight?: number;
    /** Font configuration */
    font?: FontConfig;
    /** Color */
    color?: string;
    /** Padding */
    padding?: number;
    /** Use point style */
    usePointStyle?: boolean;
    /** Point style width */
    pointStyleWidth?: number;
    /** Generate labels callback */
    generateLabels?: (chart: Chart) => LegendItem[];
    /** Filter callback */
    filter?: (legendItem: LegendItem, chartData: ChartJSData) => boolean;
    /** Sort callback */
    sort?: (a: LegendItem, b: LegendItem, chartData: ChartJSData) => number;
  };
  /** Click handler */
  onClick?: (event: Event, legendItem: LegendItem, legend: any) => void;
  /** Hover handler */
  onHover?: (event: Event, legendItem: LegendItem, legend: any) => void;
  /** Leave handler */
  onLeave?: (event: Event, legendItem: LegendItem, legend: any) => void;
}

/**
 * Font configuration interface
 */
export interface FontConfig {
  /** Font family */
  family?: string;
  /** Font size */
  size?: number;
  /** Font style */
  style?: 'normal' | 'italic' | 'oblique';
  /** Font weight */
  weight?: 'normal' | 'bold' | 'lighter' | 'bolder' | number;
  /** Line height */
  lineHeight?: number | string;
}

/**
 * Scale configuration for charts
 */
export interface ScaleConfig {
  /** Scale type */
  type?: 'linear' | 'logarithmic' | 'category' | 'time' | 'timeseries' | 'radialLinear';
  /** Scale display */
  display?: boolean;
  /** Scale position */
  position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
  /** Scale title */
  title?: {
    display?: boolean;
    text?: string | string[];
    color?: string;
    font?: FontConfig;
    padding?: number | { top: number; bottom: number; left: number; right: number };
  };
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Suggested minimum */
  suggestedMin?: number;
  /** Suggested maximum */
  suggestedMax?: number;
  /** Grid configuration */
  grid?: {
    display?: boolean;
    color?: string | string[];
    lineWidth?: number | number[];
    drawBorder?: boolean;
    drawOnChartArea?: boolean;
    drawTicks?: boolean;
    tickLength?: number;
    offset?: boolean;
    borderColor?: string;
    borderWidth?: number;
    borderDash?: number[];
    borderDashOffset?: number;
  };
  /** Ticks configuration */
  ticks?: {
    display?: boolean;
    color?: string;
    font?: FontConfig;
    padding?: number;
    stepSize?: number;
    maxTicksLimit?: number;
    precision?: number;
    callback?: (tickValue: any, index: number, ticks: any[]) => string | number | null | undefined;
    maxRotation?: number;
    minRotation?: number;
    mirror?: boolean;
    textStrokeColor?: string;
    textStrokeWidth?: number;
    z?: number;
  };
}

/**
 * Complete chart options interface
 */
export interface ChartOptions {
  /** Whether chart is responsive */
  responsive?: boolean;
  /** Maintain aspect ratio */
  maintainAspectRatio?: boolean;
  /** Aspect ratio */
  aspectRatio?: number;
  /** Device pixel ratio */
  devicePixelRatio?: number;
  /** Resize delay */
  resizeDelay?: number;
  /** Locale */
  locale?: string;
  /** Animation configuration */
  animation?: ChartAnimationConfig;
  /** Tooltip configuration */
  tooltip?: TooltipOptions;
  /** Legend configuration */
  legend?: LegendOptions;
  /** Plugins configuration */
  plugins?: {
    legend?: LegendOptions;
    tooltip?: TooltipOptions;
    title?: {
      display?: boolean;
      text?: string | string[];
      color?: string;
      font?: FontConfig;
      padding?: number | { top: number; bottom: number; left: number; right: number };
      position?: 'top' | 'left' | 'bottom' | 'right';
    };
    subtitle?: {
      display?: boolean;
      text?: string | string[];
      color?: string;
      font?: FontConfig;
      padding?: number | { top: number; bottom: number; left: number; right: number };
      position?: 'top' | 'left' | 'bottom' | 'right';
    };
  };
  /** Scales configuration */
  scales?: {
    x?: ScaleConfig;
    y?: ScaleConfig;
    [key: string]: ScaleConfig | undefined;
  };
  /** Interaction configuration */
  interaction?: {
    mode?: 'point' | 'nearest' | 'index' | 'dataset' | 'x' | 'y';
    intersect?: boolean;
    axis?: 'x' | 'y' | 'xy';
    includeInvisible?: boolean;
  };
  /** Layout configuration */
  layout?: {
    padding?: number | {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
  };
  /** Element default configurations */
  elements?: {
    point?: {
      radius?: number;
      pointStyle?: string;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      hitRadius?: number;
      hoverRadius?: number;
      hoverBorderWidth?: number;
    };
    line?: {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderCapStyle?: 'butt' | 'round' | 'square';
      borderDash?: number[];
      borderDashOffset?: number;
      borderJoinStyle?: 'round' | 'bevel' | 'miter';
      capBezierPoints?: boolean;
      cubicInterpolationMode?: 'default' | 'monotone';
      fill?: boolean | number | string;
      stepped?: boolean | 'before' | 'after' | 'middle';
      tension?: number;
    };
    bar?: {
      backgroundColor?: string;
      borderColor?: string;
      borderSkipped?: 'start' | 'end' | 'middle' | 'bottom' | 'left' | 'top' | 'right' | false;
      borderWidth?: number;
      borderRadius?: number | {
        topLeft?: number;
        topRight?: number;
        bottomLeft?: number;
        bottomRight?: number;
      };
      inflateAmount?: number | 'auto';
    };
    arc?: {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderAlign?: 'center' | 'inner';
      hoverBackgroundColor?: string;
      hoverBorderColor?: string;
      hoverBorderWidth?: number;
    };
  };
  /** Event handlers */
  onClick?: (event: Event, elements: any[], chart: Chart) => void;
  onHover?: (event: Event, elements: any[], chart: Chart) => void;
  onResize?: (chart: Chart, size: { width: number; height: number }) => void;
}

// =============================================================================
// SPECIALIZED CHART CONFIGURATIONS
// =============================================================================

/**
 * Line chart specific options
 */
export interface LineChartOptions extends ChartOptions {
  /** Span gaps in data */
  spanGaps?: boolean | number;
  /** Show lines */
  showLine?: boolean;
  /** Elements configuration for line charts */
  elements?: ChartOptions['elements'];
}

/**
 * Bar chart specific options
 */
export interface BarChartOptions extends ChartOptions {
  /** Index axis */
  indexAxis?: 'x' | 'y';
  /** Skip null values */
  skipNull?: boolean;
  /** Elements configuration for bar charts */
  elements?: ChartOptions['elements'];
}

/**
 * Doughnut/Pie chart specific options
 */
export interface DoughnutChartOptions extends ChartOptions {
  /** Circumference of the chart */
  circumference?: number;
  /** Rotation of the chart */
  rotation?: number;
  /** Cutout percentage (for doughnut) */
  cutout?: number | string;
  /** Radius of the chart */
  radius?: number | string;
  /** Elements configuration for doughnut charts */
  elements?: ChartOptions['elements'];
}

/**
 * Area chart specific options
 */
export interface AreaChartOptions extends LineChartOptions {
  /** Fill configuration */
  fill?: boolean | number | string | {
    target?: boolean | number | string;
    above?: string;
    below?: string;
  };
}

// =============================================================================
// CHART COMPONENT PROPS
// =============================================================================

/**
 * Base chart component props
 */
export interface BaseChartProps {
  /** Chart data */
  data: ChartData;
  /** Chart options */
  options?: ChartOptions;
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Chart plugins */
  plugins?: Plugin[];
  /** Redraw chart on data change */
  redraw?: boolean;
  /** Chart type override */
  type?: ChartType;
  /** Update mode */
  updateMode?: 'resize' | 'reset' | 'none' | 'hide' | 'show' | 'normal' | 'active';
  /** Fallback content when chart fails to render */
  fallbackContent?: React.ReactNode;
  /** Error handler */
  onError?: (error: Error) => void;
  /** Chart ready handler */
  onChartReady?: (chart: Chart) => void;
}

/**
 * Line chart component props
 */
export interface LineChartProps extends BaseChartProps {
  /** Line chart specific options */
  options?: LineChartOptions;
}

/**
 * Bar chart component props
 */
export interface BarChartProps extends BaseChartProps {
  /** Bar chart specific options */
  options?: BarChartOptions;
}

/**
 * Doughnut chart component props
 */
export interface DoughnutChartProps extends BaseChartProps {
  /** Doughnut chart specific options */
  options?: DoughnutChartOptions;
}

/**
 * Area chart component props
 */
export interface AreaChartProps extends BaseChartProps {
  /** Area chart specific options */
  options?: AreaChartOptions;
}

// =============================================================================
// CHART UTILITY TYPES
// =============================================================================

/**
 * Chart theme configuration
 */
export interface ChartTheme {
  /** Theme name */
  name: string;
  /** Primary colors */
  colors: {
    primary: string[];
    secondary: string[];
    success: string[];
    warning: string[];
    error: string[];
    info: string[];
  };
  /** Font configuration */
  fonts: {
    default: FontConfig;
    title: FontConfig;
    legend: FontConfig;
    tooltip: FontConfig;
  };
  /** Grid configuration */
  grid: {
    color: string;
    borderColor: string;
    lineWidth: number;
  };
  /** Background colors */
  backgrounds: {
    chart: string;
    tooltip: string;
    legend: string;
  };
}

/**
 * Chart data transformation utilities
 */
export interface ChartDataTransform {
  /** Transform function name */
  name: string;
  /** Transform function */
  transform: (data: any[]) => ChartData;
  /** Transform options */
  options?: Record<string, any>;
}

/**
 * Chart configuration preset
 */
export interface ChartPreset {
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Chart type */
  type: ChartType;
  /** Default options */
  options: ChartOptions;
  /** Sample data */
  sampleData?: ChartData;
  /** Required data format */
  dataFormat?: {
    labels: string;
    datasets: string;
    valueFormat?: 'number' | 'percentage' | 'currency' | 'bytes';
  };
}

// =============================================================================
// PERFORMANCE MONITORING TYPES
// =============================================================================

/**
 * Chart performance metrics
 */
export interface ChartPerformanceMetrics {
  /** Render time in milliseconds */
  renderTime: number;
  /** Animation duration */
  animationDuration: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Data points count */
  dataPointsCount: number;
  /** Interactions per second */
  interactionsPerSecond: number;
  /** Frame rate during animation */
  frameRate: number;
}

/**
 * Chart error tracking
 */
export interface ChartError {
  /** Error type */
  type: 'render' | 'data' | 'configuration' | 'plugin' | 'animation';
  /** Error message */
  message: string;
  /** Error timestamp */
  timestamp: Date;
  /** Chart configuration when error occurred */
  chartConfig?: Partial<ChartConfiguration>;
  /** Stack trace */
  stack?: string;
  /** Recovery suggestions */
  recoverySuggestions?: string[];
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type {
  ChartConfiguration,
  ChartOptions as ChartJSOptions,
  ChartData as ChartJSData,
  Plugin,
  TooltipItem,
  LegendItem,
  Chart,
  ChartType,
  ScriptableContext
} from 'chart.js';