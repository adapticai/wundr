// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TestSetup, TestIsolation, customMatchers } from './__tests__/setup/test-environment'

// Extend Jest with custom matchers
expect.extend(customMatchers)

// Global setup
beforeAll(async () => {
  await TestSetup.setupBeforeAll()
  TestIsolation.setup()
})

afterAll(async () => {
  await TestSetup.teardownAfterAll()
  TestIsolation.teardown()
})

beforeEach(() => {
  TestSetup.setupBeforeEach()
})

afterEach(() => {
  TestSetup.teardownAfterEach()
})

// Mock Chart.js - Keep minimal mocking for charts
jest.mock('chart.js', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
    render: jest.fn()
  })),
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  PointElement: jest.fn(),
  LineElement: jest.fn(),
  BarElement: jest.fn(),
  ArcElement: jest.fn(),
  RadialLinearScale: jest.fn(),
  TimeScale: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn(),
  Filler: jest.fn(),
  register: jest.fn(),
}))

// Mock react-chartjs-2 with simple DOM elements
jest.mock('react-chartjs-2', () => ({
  Line: (props) => {
    return {
      type: 'canvas',
      props: {
        'data-testid': 'line-chart',
        'data-chart-type': 'line',
        'data-datasets': props.data?.datasets?.length || 0
      }
    }
  },
  Bar: (props) => {
    return {
      type: 'canvas',
      props: {
        'data-testid': 'bar-chart',
        'data-chart-type': 'bar',
        'data-datasets': props.data?.datasets?.length || 0
      }
    }
  },
  Doughnut: (props) => {
    return {
      type: 'canvas',
      props: {
        'data-testid': 'doughnut-chart',
        'data-chart-type': 'doughnut',
        'data-datasets': props.data?.datasets?.length || 0
      }
    }
  },
  Radar: (props) => {
    return {
      type: 'canvas',
      props: {
        'data-testid': 'radar-chart',
        'data-chart-type': 'radar',
        'data-datasets': props.data?.datasets?.length || 0
      }
    }
  },
}))

// Mock next/navigation with more realistic router behavior
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockPrefetch = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: mockPush,
      replace: mockReplace,
      prefetch: mockPrefetch,
      back: mockBack,
      pathname: '/',
      query: {},
      asPath: '/'
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    systemTheme: 'light',
    themes: ['light', 'dark', 'system']
  }),
  ThemeProvider: ({ children }) => children,
}))

// Mock lucide-react icons with simple objects
jest.mock('lucide-react', () => {
  const createMockIcon = (name) => 
    (props) => ({
      type: 'svg',
      props: {
        'data-testid': `${name.toLowerCase()}-icon`,
        'data-icon': name.toLowerCase(),
        ...props
      }
    })

  return {
    __esModule: true,
    ...jest.requireActual('lucide-react'),
    // Common icons used in the app
    ChevronDown: createMockIcon('ChevronDown'),
    ChevronRight: createMockIcon('ChevronRight'),
    ChevronLeft: createMockIcon('ChevronLeft'),
    Search: createMockIcon('Search'),
    X: createMockIcon('X'),
    Plus: createMockIcon('Plus'),
    Minus: createMockIcon('Minus'),
    Download: createMockIcon('Download'),
    Upload: createMockIcon('Upload'),
    Settings: createMockIcon('Settings'),
    Menu: createMockIcon('Menu'),
    TrendingUp: createMockIcon('TrendingUp'),
    TrendingDown: createMockIcon('TrendingDown'),
    AlertCircle: createMockIcon('AlertCircle'),
    CheckCircle: createMockIcon('CheckCircle'),
    XCircle: createMockIcon('XCircle'),
    ZoomIn: createMockIcon('ZoomIn'),
    ZoomOut: createMockIcon('ZoomOut'),
    Maximize2: createMockIcon('Maximize2'),
  }
})

// Enhanced window.matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query.includes('(prefers-color-scheme: dark)') ? false : true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Enhanced Canvas API mock
const createCanvasContext = () => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 100, height: 20 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  getTransform: jest.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  setLineDash: jest.fn(),
  getLineDash: jest.fn(() => []),
  // Canvas properties
  canvas: {
    width: 800,
    height: 600,
    style: {},
    toDataURL: jest.fn(() => 'data:image/png;base64,mock'),
    toBlob: jest.fn()
  },
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  strokeStyle: '#000000',
  fillStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  lineDashOffset: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  direction: 'ltr'
})

HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === '2d') {
    return createCanvasContext()
  }
  return null
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Enhanced URL mocks
global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = jest.fn()

// Mock FileReader
global.FileReader = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  result: null,
  error: null,
  readyState: 0,
  EMPTY: 0,
  LOADING: 1,
  DONE: 2
}))

// Performance API mock
Object.defineProperty(window, 'performance', {
  value: {
    ...window.performance,
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000000
    },
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  }
})

// Suppress specific console warnings during tests
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    const message = args[0]?.toString() || ''
    const suppressedMessages = [
      'Warning: ReactDOM.render',
      'Warning: componentWillMount',
      'Warning: componentWillReceiveProps',
      'Warning: componentWillUpdate',
      'act(...) is not supported',
      'You are using the simple (heuristic) fragment matcher'
    ]
    
    if (!suppressedMessages.some(msg => message.includes(msg))) {
      originalError.apply(console, args)
    }
  }
  
  console.warn = (...args) => {
    const message = args[0]?.toString() || ''
    const suppressedMessages = [
      'Failed prop type',
      'deprecated'
    ]
    
    if (!suppressedMessages.some(msg => message.includes(msg))) {
      originalWarn.apply(console, args)
    }
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})