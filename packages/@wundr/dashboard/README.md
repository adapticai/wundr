# @wundr/dashboard

A comprehensive Next.js 15 web dashboard for the unified Wundr platform, providing real-time monitoring, visualization, and analysis capabilities.

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
- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start WebSocket server (in separate terminal)
pnpm ws

# Build for production
pnpm build
```

### Development URLs
- **Dashboard**: http://localhost:3001
- **WebSocket**: ws://localhost:8080

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
# Production build
pnpm build

# Start production server
pnpm start
```

### Environment Variables
```env
# WebSocket configuration
NEXT_PUBLIC_WS_URL=ws://localhost:8080

# API configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Theme configuration
NEXT_PUBLIC_DEFAULT_THEME=system
```

## 🔧 Configuration

### Dashboard Config
The dashboard can be configured via `dashboard.config.ts`:

```typescript
export const dashboardConfig = {
  layout: {
    sidebar: { collapsed: false, width: 280 },
    theme: { theme: 'system', accentColor: '#3b82f6' }
  },
  features: {
    realtime: true,
    notifications: true,
    autoRefresh: true
  }
}
```

### Chart Configuration
Chart themes and defaults are configurable in `lib/charts/index.ts`.

### WebSocket Configuration
Real-time features can be configured in `lib/websocket.ts`.

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

### Script Execution Safety
- **Safety Levels**: safe, caution, dangerous
- **Sandboxed Execution**: Isolated script environment
- **Permission System**: Controlled access levels
- **Audit Logging**: Complete execution history

## 📚 Documentation

- **Component Documentation**: Storybook integration
- **API Documentation**: OpenAPI/Swagger specs
- **Type Documentation**: Generated from TypeScript
- **Usage Examples**: Complete implementation examples

## 🔮 Future Enhancements

- **Plugin System**: Extensible dashboard plugins
- **Custom Visualizations**: User-created charts
- **Advanced Analytics**: ML-powered insights
- **Multi-tenant Support**: Organization separation
- **Mobile App**: React Native companion

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ by the Wundr team at Lumic.ai