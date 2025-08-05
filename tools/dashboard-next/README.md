# Wundr Dashboard

A modern, feature-rich dashboard for analyzing and refactoring monorepo codebases by Lumic.ai, built with Next.js, shadcn/ui, and Tailwind CSS.

## Features

- 📊 **Real-time Analysis Visualization**: Interactive charts showing code metrics and patterns
- 🔍 **Duplicate Code Detection**: Identify and analyze duplicate code across your monorepo
- 🔄 **Dependency Analysis**: Visualize and understand dependency relationships
- 💡 **Smart Recommendations**: Get actionable refactoring suggestions
- 📚 **Integrated Documentation**: Access guides and templates directly from the dashboard
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Navigate to the dashboard directory:
```bash
cd tools/dashboard-next
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Loading Analysis Data

The dashboard can load analysis data in several ways:

1. **Automatic Loading**: Place your `analysis-report.json` in the `public/analysis-output/` directory
2. **Upload Report**: Use the upload button in the dashboard to load a JSON report
3. **Sample Data**: Click "Load Sample Data" to explore the dashboard with example data

### Navigation

The dashboard includes several main sections:

- **Overview**: Summary cards and charts showing key metrics
- **Analysis**:
  - Duplicates: Browse and filter duplicate code clusters
  - Dependencies: Analyze dependency relationships
  - Code Entities: Explore all code entities in your monorepo
  - Circular Dependencies: Identify circular dependency issues
- **Recommendations**: View prioritized refactoring suggestions
- **Documentation**: Access integrated guides and templates

## Project Structure

```
dashboard-next/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard pages
│   │   ├── analysis/      # Analysis sub-pages
│   │   ├── docs/          # Documentation pages
│   │   └── layout.tsx     # Dashboard layout with sidebar
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── dashboard/         # Dashboard-specific components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utility functions and contexts
│   └── contexts/         # React contexts
└── public/               # Static assets
```

## Development

### Adding New Pages

1. Create a new file in `app/dashboard/[section]/page.tsx`
2. Update the sidebar navigation in `components/app-sidebar.tsx`
3. Use the existing shadcn/ui components for consistency

### Styling

The project uses:
- Tailwind CSS for utility-first styling
- shadcn/ui for pre-built components
- CSS variables for theming

### Data Management

The dashboard uses React Context for state management:
- `AnalysisContext` provides analysis data throughout the app
- Data is loaded from JSON files or can be uploaded by users

## Building for Production

```bash
npm run build
npm start
```

## Contributing

When contributing to the dashboard:
1. Follow the existing code patterns
2. Use TypeScript for type safety
3. Ensure responsive design
4. Test with both real and sample data

## License

Wundr is a product by Lumic.ai.
