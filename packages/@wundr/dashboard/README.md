# @wundr/dashboard

A comprehensive Next.js 15 web dashboard for the unified Wundr platform, providing real-time
monitoring, visualization, and analysis capabilities.

## 🚀 Features

- **Next.js 15** with App Router and React 19
- **Real-time WebSocket integration** for live data updates
- **D3.js visualizations** for interactive dependency graphs and heatmaps
- **Chart.js integration** with theme support
- **shadcn/ui components** with dark/light theme switching
- **Responsive design** with Tailwind CSS
- **Script execution engine** with safety levels
- **TypeScript** throughout with comprehensive type definitions

## 🏗️ Architecture

### Core Components

- **Dashboard Layout**: Responsive sidebar navigation with header
- **Real-time Data**: WebSocket-powered live metrics and events
- **Visualizations**: D3.js network graphs, heatmaps, and circular diagrams
- **Charts**: Chart.js integration with dynamic theming
- **Script Engine**: Safe execution environment for automation scripts

### Directory Structure

```
packages/@wundr/dashboard/
├── app/                        # Next.js 15 App Router
│   ├── dashboard/             # Dashboard pages
│   │   ├── overview/          # Main dashboard overview
│   │   ├── analytics/         # Analytics and metrics
│   │   ├── dependencies/      # Dependency management
│   │   ├── performance/       # Performance monitoring
│   │   └── scripts/          # Script execution
│   ├── api/                   # API routes
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── providers.tsx         # Context providers
├── components/                # React components
│   ├── ui/                   # shadcn/ui base components
│   ├── dashboard/            # Dashboard-specific components
│   ├── visualizations/       # D3.js visualization components
│   └── layout/              # Layout components
├── lib/                      # Utility libraries
│   ├── websocket.ts         # WebSocket client/store
│   ├── charts/              # Chart.js configuration
│   ├── d3/                  # D3.js visualization classes
│   └── utils.ts             # Common utilities
├── hooks/                    # React hooks
├── types/                    # TypeScript definitions
└── scripts/                  # Development scripts
```

## 🛠️ Technology Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library
- **Framer Motion** - Animations and transitions

### Visualization

- **D3.js v7** - Interactive data visualizations
- **Chart.js v4** - Chart library with Chart.js React wrapper
- **Recharts** - React-specific charting library

### Real-time Features

- **WebSocket** - Real-time data streaming
- **Server-Sent Events** - Push notifications
- **Zustand** - State management

### Development

- **Jest** - Testing framework
- **React Testing Library** - Component testing
- **Storybook** - Component development

## 🚦 Getting Started

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **pnpm 8+** (required for monorepo management)
- **Git** (for repository integration features)
- **Modern Browser** (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Quick Setup

#### Option 1: Standalone Development

```bash
# Clone and navigate to dashboard
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/dashboard

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Start development server
pnpm dev
```

#### Option 2: Full Wundr Platform

```bash
# From the root of the Wundr monorepo
pnpm install
pnpm build
pnpm dev

# The dashboard will be available as part of the platform
```

### Development Setup

1. **Environment Configuration**
   ```bash
   # Create environment file
   cp .env.example .env.local
   
   # Edit with your settings
   nano .env.local
   ```

2. **Start Services**
   ```bash
   # Terminal 1: Start dashboard
   pnpm dev
   
   # Terminal 2: Start WebSocket server (if not auto-started)
   pnpm ws:start
   
   # Terminal 3: Start mock data generator (optional)
   pnpm mock-data
   ```

3. **Verify Setup**
   ```bash
   # Check health endpoints
   curl http://localhost:3001/api/health
   curl http://localhost:8080/health
   ```

### Development URLs

- **Dashboard**: http://localhost:3001
- **API Routes**: http://localhost:3001/api
- **WebSocket**: ws://localhost:8080
- **Storybook**: http://localhost:6006 (run `pnpm storybook`)
- **Bundle Analyzer**: http://localhost:3001/__nextjs_original-stack-frame (after `pnpm analyze`)

### Environment Variables

Create `.env.local` with these variables:

```env
# Required - WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_WS_RECONNECT_INTERVAL=5000

# Required - API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_TIMEOUT=30000

# Optional - Dashboard Configuration
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_AUTO_REFRESH_INTERVAL=30000

# Optional - Feature Flags
NEXT_PUBLIC_ENABLE_REAL_TIME=true
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_SCRIPT_EXECUTION=true

# Optional - Performance
NEXT_PUBLIC_MAX_CHART_DATA_POINTS=1000
NEXT_PUBLIC_DEBOUNCE_INTERVAL=300

# Development Only
NEXT_PUBLIC_MOCK_DATA=false
NEXT_PUBLIC_DEBUG_MODE=false
```

## 📊 Dashboard Features

### Overview Page

- **Metrics Grid**: Key performance indicators
- **Project Health**: Real-time status monitoring
- **Activity Feed**: Recent changes and events
- **Quick Actions**: Common tasks and shortcuts

### Analytics Page

- **Trend Analysis**: Historical data visualization
- **Performance Metrics**: Build times, test coverage
- **Quality Scores**: Code maintainability indicators
- **Custom Reports**: Configurable analytics

### Dependencies Page

- **Interactive Network Graph**: Dependency relationships
- **Circular Dependencies**: Detection and visualization
- **Package Analysis**: Size, versions, security issues
- **Optimization Suggestions**: Automated recommendations

### Performance Page

- **Real-time Metrics**: CPU, memory, network usage
- **Build Performance**: Time trends and optimization
- **Bundle Analysis**: Size breakdown and optimization
- **Benchmarking**: Performance comparisons

### Scripts Page

- **Execution Environment**: Safe script running
- **Template Library**: Pre-built automation scripts
- **History Tracking**: Execution logs and results
- **Safety Levels**: Controlled execution permissions

## 🎨 Theming System

The dashboard supports comprehensive theming:

### Theme Support

- **Light Mode**: Clean, professional appearance
- **Dark Mode**: Eye-friendly dark interface
- **System**: Automatic theme detection
- **Custom Colors**: Configurable accent colors

### Component Themes

- Charts automatically adapt to selected theme
- D3.js visualizations use theme colors
- All UI components support theme switching

## 🔌 Real-time Features

### WebSocket Integration

- **Automatic Reconnection**: Resilient connection handling
- **Event Streaming**: Live data updates
- **State Synchronization**: Consistent data across clients

### Real-time Data Types

- **System Metrics**: Performance monitoring
- **Build Events**: Compilation and testing status
- **Git Activity**: Repository changes
- **Analysis Results**: Code quality updates

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## 🏭 Production Deployment

### Build Process

```bash
# Production build with optimizations
pnpm build

# Analyze bundle size
pnpm analyze

# Start production server
pnpm start

# Or export static files
pnpm export
```

### Production Environment Variables

```env
# Production Configuration
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws
NEXT_PUBLIC_WS_SECURE=true

# API Configuration
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_API_VERSION=v1

# Security
NEXT_PUBLIC_ENABLE_SCRIPT_EXECUTION=false
NEXT_PUBLIC_CSP_ENABLED=true

# Performance
NEXT_PUBLIC_ENABLE_SERVICE_WORKER=true
NEXT_PUBLIC_CACHE_STRATEGY=stale-while-revalidate

# Analytics (if enabled)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

```bash
# Build and run Docker container
docker build -t wundr-dashboard .
docker run -p 3000:3000 wundr-dashboard
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wundr-dashboard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wundr-dashboard
  template:
    metadata:
      labels:
        app: wundr-dashboard
    spec:
      containers:
      - name: dashboard
        image: wundr-dashboard:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_WS_URL
          value: "wss://api.your-domain.com/ws"
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.your-domain.com/api"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: wundr-dashboard-service
spec:
  selector:
    app: wundr-dashboard
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Nginx Configuration

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Dashboard
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### Performance Optimizations

1. **Enable Compression**
   ```javascript
   // next.config.js
   module.exports = {
     compress: true,
     poweredByHeader: false,
     generateEtags: true
   };
   ```

2. **Configure CDN**
   ```javascript
   // next.config.js
   module.exports = {
     assetPrefix: process.env.CDN_URL || '',
     images: {
       loader: 'custom',
       domains: ['cdn.your-domain.com']
     }
   };
   ```

3. **Bundle Optimization**
   ```javascript
   // next.config.js
   module.exports = {
     experimental: {
       optimizeCss: true,
       optimizePackageImports: ['@wundr/ui']
     }
   };
   ```

## 🔧 Configuration

### Dashboard Configuration

The dashboard can be configured via `dashboard.config.ts`:

```typescript
// dashboard.config.ts
export const dashboardConfig = {
  // Layout Configuration
  layout: {
    sidebar: { 
      collapsed: false, 
      width: 280,
      collapsible: true,
      position: 'left' // 'left' | 'right'
    },
    header: {
      height: 64,
      showBreadcrumbs: true,
      showUserMenu: true
    },
    theme: { 
      defaultTheme: 'system', // 'light' | 'dark' | 'system'
      accentColor: '#3b82f6',
      borderRadius: 8
    },
  },
  
  // Feature Configuration
  features: {
    realtime: true,
    notifications: true,
    autoRefresh: true,
    aiAssistant: true,
    scriptExecution: true,
    exportData: true
  },
  
  // Performance Configuration
  performance: {
    maxDataPoints: 1000,
    refreshInterval: 30000,
    debounceInterval: 300,
    enableVirtualization: true
  },
  
  // Chart Configuration
  charts: {
    defaultType: 'line',
    animations: true,
    responsive: true,
    maintainAspectRatio: false,
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    }
  }
};
```

### Advanced Configuration

#### Custom Theme Configuration

```typescript
// lib/theme.ts
export const customTheme = {
  colors: {
    light: {
      background: '#ffffff',
      foreground: '#0f172a',
      primary: '#3b82f6',
      // ... more colors
    },
    dark: {
      background: '#0f172a',
      foreground: '#f8fafc',
      primary: '#60a5fa',
      // ... more colors
    }
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem'
    }
  }
};
```

#### Chart Configuration

```typescript
// lib/charts/config.ts
export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'white',
      bodyColor: 'white'
    }
  },
  scales: {
    x: {
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)'
      }
    },
    y: {
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)'
      }
    }
  }
};
```

#### WebSocket Configuration

```typescript
// lib/websocket/config.ts
export const websocketConfig = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  reconnect: {
    enabled: true,
    interval: 5000,
    maxAttempts: 10,
    backoffFactor: 1.5
  },
  heartbeat: {
    enabled: true,
    interval: 30000,
    timeout: 5000
  },
  events: {
    maxListeners: 100,
    enableLogging: process.env.NODE_ENV === 'development'
  }
};
```

## 🤝 Integration Points

### API Integration

- RESTful API routes for data fetching
- Real-time WebSocket for live updates
- GraphQL support for complex queries

### External Services

- Git repository integration
- CI/CD pipeline monitoring
- Package registry analysis

## 📈 Performance

### Optimization Features

- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js image optimization
- **Bundle Optimization**: Webpack optimization
- **Lazy Loading**: Component-level lazy loading

### Monitoring

- Real-time performance metrics
- Bundle size analysis
- Core Web Vitals tracking

## 🛡️ Security

### Security Features

#### Content Security Policy (CSP)

```typescript
// next.config.js security headers
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' ws: wss:",
      "font-src 'self'",
    ].join('; ')
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];
```

#### Script Execution Safety

- **Safety Levels**: 
  - `safe`: Read-only operations, no system access
  - `moderate`: Limited file system access, validated commands
  - `dangerous`: Full system access (development only)
- **Sandboxed Execution**: Isolated Node.js worker threads
- **Permission System**: Role-based access control
- **Resource Limits**: CPU, memory, and time constraints
- **Audit Logging**: Complete execution history with user tracking

#### Authentication & Authorization

```typescript
// lib/auth.ts
export const authConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    // OAuth providers for enterprise
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    }),
    // Local development
    CredentialsProvider({
      async authorize(credentials) {
        // Custom auth logic
        return user;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      return { ...token, ...user };
    },
    async session({ session, token }) {
      return { ...session, user: token };
    }
  }
};
```

#### Data Protection

- **Encryption at Rest**: Sensitive configuration data
- **Encryption in Transit**: HTTPS/WSS enforced
- **Data Sanitization**: All user inputs validated
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content sanitization

## 📚 Documentation

- **Component Documentation**: Storybook integration
- **API Documentation**: OpenAPI/Swagger specs
- **Type Documentation**: Generated from TypeScript
- **Usage Examples**: Complete implementation examples

## 🚀 Advanced Features

### Plugin System

#### Creating Dashboard Plugins

```typescript
// plugins/my-plugin/index.ts
import { DashboardPlugin } from '@wundr/dashboard';

export class MyDashboardPlugin implements DashboardPlugin {
  name = 'my-plugin';
  version = '1.0.0';

  async initialize(context: DashboardPluginContext) {
    // Register new page
    context.registerPage({
      path: '/my-feature',
      component: MyFeatureComponent,
      title: 'My Feature',
      icon: 'star'
    });

    // Register custom visualization
    context.registerVisualization({
      name: 'custom-chart',
      component: CustomChartComponent,
      dataTransform: transformData
    });
  }
}
```

#### Loading Plugins

```typescript
// lib/plugins.ts
import { loadDashboardPlugins } from '@wundr/dashboard/plugins';

const plugins = await loadDashboardPlugins([
  './plugins/my-plugin',
  '@wundr/plugin-security',
  '@wundr/plugin-performance'
]);
```

### Custom Visualizations

#### D3.js Integration

```typescript
// components/visualizations/CustomVisualization.tsx
import { useD3 } from '@/hooks/useD3';
import * as d3 from 'd3';

export const CustomVisualization = ({ data }) => {
  const ref = useD3((svg) => {
    const width = 800;
    const height = 400;
    
    // D3.js visualization logic
    svg.selectAll('*').remove();
    
    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.x))
      .range([0, width]);
    
    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.y))
      .range([height, 0]);
    
    // Add your visualization elements
    svg.selectAll('circle')
      .data(data)
      .enter().append('circle')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 5);
  }, [data]);

  return <svg ref={ref} width="100%" height="400" />;
};
```

### Real-time Collaboration

```typescript
// lib/collaboration.ts
export class CollaborationManager {
  private websocket: WebSocket;
  private cursors = new Map();

  async shareView(viewId: string, userId: string) {
    this.websocket.send(JSON.stringify({
      type: 'share-view',
      viewId,
      userId,
      timestamp: Date.now()
    }));
  }

  onCursorMove(position: { x: number, y: number }) {
    this.websocket.send(JSON.stringify({
      type: 'cursor-move',
      position,
      userId: this.userId
    }));
  }
}
```

## 🔮 Future Enhancements

### Short Term (Next 3 months)
- **Enhanced Plugin System**: Marketplace and hot-loading
- **Mobile Responsive**: Improved mobile experience
- **Advanced Theming**: Visual theme editor
- **Export Functionality**: PDF, PNG report generation

### Medium Term (Next 6 months)
- **Multi-tenant Support**: Organization isolation
- **Advanced Analytics**: ML-powered insights and predictions
- **Real-time Collaboration**: Shared dashboard views
- **Custom Dashboards**: Drag-and-drop dashboard builder

### Long Term (Next year)
- **Mobile App**: React Native companion app
- **AI Assistant**: Integrated ChatGPT/Claude interface
- **Advanced Security**: SSO, RBAC, audit compliance
- **Enterprise Features**: White-labeling, custom branding

## 🤝 Contributing

### Development Guidelines

1. **Setup Development Environment**
   ```bash
   # Fork and clone
   git clone https://github.com/YOUR_USERNAME/wundr.git
   cd wundr/packages/@wundr/dashboard
   
   # Install dependencies
   pnpm install
   
   # Start development
   pnpm dev
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/dashboard-enhancement
   ```

3. **Development Standards**
   - Follow TypeScript strict mode
   - Write tests for new components
   - Follow the established component patterns
   - Use proper TypeScript types
   - Update documentation

4. **Testing Requirements**
   ```bash
   # Run tests
   pnpm test
   
   # Run tests with coverage
   pnpm test:coverage
   
   # Run E2E tests
   pnpm test:e2e
   
   # Visual regression tests
   pnpm test:visual
   ```

5. **Code Quality Checks**
   ```bash
   # Linting
   pnpm lint
   
   # Type checking
   pnpm typecheck
   
   # Format code
   pnpm format
   
   # Build check
   pnpm build
   ```

### Component Development

#### Component Structure

```
components/
├── YourComponent/
│   ├── YourComponent.tsx      # Main component
│   ├── YourComponent.test.tsx # Tests
│   ├── YourComponent.stories.tsx # Storybook
│   ├── index.ts              # Exports
│   └── types.ts              # Component types
```

#### Component Template

```typescript
// components/YourComponent/YourComponent.tsx
import { FC } from 'react';
import { cn } from '@/lib/utils';
import { YourComponentProps } from './types';

export const YourComponent: FC<YourComponentProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('your-component-base-styles', className)} {...props}>
      {children}
    </div>
  );
};

YourComponent.displayName = 'YourComponent';
```

### Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add Storybook stories for UI components
4. Follow conventional commit messages
5. Submit PR with detailed description

### Areas for Contribution

- 🎨 **UI/UX Improvements**: Better user experience
- 📊 **New Visualizations**: Additional chart types
- 🔌 **Plugin Development**: Dashboard extensions
- 🧪 **Testing**: Improve test coverage
- 📚 **Documentation**: Examples and guides
- 🌍 **Accessibility**: WCAG compliance improvements
- 📱 **Mobile Support**: Mobile-first enhancements

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ by the Wundr team at [Wundr, by Adaptic.ai](https://adaptic.ai)

## 📞 Support & Community

- **Documentation**: [docs.wundr.io](https://docs.wundr.io)
- **Discord**: [Join our community](https://discord.gg/wundr)
- **GitHub Issues**: [Report bugs or request features](https://github.com/adapticai/wundr/issues)
- **Email**: [support@adaptic.ai](mailto:support@adaptic.ai)
