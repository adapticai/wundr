# Monorepo Refactoring Tools

This directory contains developer tools to enhance the refactoring experience with the monorepo-refactoring-toolkit.

## Dashboard

### Overview
An interactive web-based dashboard for visualizing and analyzing code analysis results from the enhanced AST analyzer.

### Features
- **Interactive Charts**: Visualize entity distribution, duplicate severity, file complexity, and dependency analysis
- **Detailed Views**: Browse duplicates, recommendations, entities, and dependencies with filtering and search
- **Drag & Drop**: Load analysis JSON files by dropping them onto the dashboard
- **Sample Data**: Generate sample data for testing and demonstration
- **Export Functionality**: Export analysis results in JSON format
- **Responsive Design**: Works on desktop and mobile devices

### Usage

1. **Open the Dashboard**:
   ```bash
   # Navigate to the dashboard directory
   cd tools/dashboard
   
   # Open in browser (requires local server for file loading)
   python -m http.server 8000
   # or
   npx serve .
   ```

2. **Load Analysis Data**:
   - **Auto-load**: Place analysis report at `./analysis-output/analysis-report.json`
   - **File Upload**: Click "Load Report" button and select JSON file
   - **Drag & Drop**: Drag analysis JSON file onto the dashboard
   - **Sample Data**: Click "Load Sample Data" for demonstration

3. **Navigate the Dashboard**:
   - **Summary Cards**: Overview of total files, entities, duplicates, etc.
   - **Charts Section**: Visual representations of code metrics
   - **Details Tabs**: 
     - **Duplicates**: View and filter duplicate code clusters
     - **Recommendations**: Browse refactoring suggestions
     - **Entities**: Search and explore all code entities
     - **Dependencies**: Analyze dependency relationships

4. **Export Data**:
   - Click export buttons in tab headers to download filtered data
   - Available formats: Duplicates, Recommendations, Entities, Complete Report

### Files
- `dashboard.html` - Main dashboard interface
- `dashboard.js` - Dashboard functionality and data processing
- `dashboard.css` - Professional styling and responsive design
- `sample-analysis-data.json` - Sample data for testing

## VS Code Tools

### Overview
Optimized VS Code configuration and tools specifically designed for monorepo refactoring workflows.

### Components

#### 1. Workspace Settings (`settings.json`)
Comprehensive VS Code settings optimized for:
- **TypeScript/JavaScript Development**: Enhanced IntelliSense, auto-imports, formatting
- **Monorepo Support**: Multi-root workspace settings, optimized file watching
- **Code Quality**: ESLint integration, automatic organization of imports
- **Performance**: Optimizations for large codebases
- **Refactoring**: Enhanced refactoring tools and code lens features

#### 2. Recommended Extensions (`extensions.json`)
Curated list of VS Code extensions for:
- **Essential Development**: TypeScript, ESLint, Prettier, GitLens
- **Code Quality**: SonarLint, Error Lens, Import Cost
- **Refactoring Tools**: TypeScript Hero, Auto Import, Path Intellisense
- **Testing & Debugging**: Jest, Playwright, Test Explorer
- **Productivity**: TODO Tree, Bookmarks, Better Comments
- **Documentation**: Markdown support, Mermaid diagrams

#### 3. Code Snippets (`snippets/refactoring.code-snippets`)
Professional code snippets for common refactoring patterns:

**Available Snippets:**
- `extract-interface` - Extract interface from class
- `base-service` - Create base service with CRUD operations
- `extract-type` - Extract common type definitions
- `factory-pattern` - Implement factory pattern
- `dependency-injection` - Dependency injection pattern
- `observer-pattern` - Observer pattern implementation
- `utility-helper` - Utility class with static methods
- `error-wrapper` - Error handling with Result types
- `config-manager` - Configuration manager with validation
- `async-queue` - Async queue manager for concurrent operations
- `consolidate-duplicates` - Consolidation helper functions

### Installation

1. **Copy VS Code Settings**:
   ```bash
   # Copy to your project's .vscode directory
   cp tools/vscode/settings.json .vscode/
   cp tools/vscode/extensions.json .vscode/
   cp -r tools/vscode/snippets .vscode/
   ```

2. **Install Recommended Extensions**:
   - Open VS Code in your project
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Extensions: Show Recommended Extensions"
   - Install the recommended extensions

3. **Apply Settings**:
   - VS Code will automatically apply the workspace settings
   - Restart VS Code if needed for all settings to take effect

### Usage Tips

#### Refactoring Workflow
1. **Use Code Snippets**: Type snippet prefix (e.g., `extract-interface`) and press Tab
2. **Organize Imports**: `Ctrl+Shift+O` to organize imports automatically
3. **Find References**: `Shift+F12` to find all references to a symbol
4. **Rename Symbol**: `F2` to rename symbols across the entire workspace
5. **Extract Method**: Select code and use `Ctrl+Shift+R` for refactoring options

#### Monorepo Navigation
1. **Multi-root Workspace**: Open multiple packages as workspace folders
2. **Global Search**: `Ctrl+Shift+F` to search across all workspace folders
3. **Go to Symbol**: `Ctrl+T` to quickly navigate to any symbol in the workspace
4. **File Explorer**: Use the enhanced file nesting to organize related files

#### Code Quality
1. **Problem Panel**: View all ESLint errors and warnings
2. **Code Lens**: See references and implementations inline
3. **Import Cost**: Monitor bundle impact of imports
4. **TODO Tree**: Track TODO, FIXME, and REFACTOR comments

## Integration with Analysis Tools

The dashboard is designed to work seamlessly with the analysis scripts:

1. **Run Analysis**:
   ```bash
   npm run analyze  # or your analysis command
   ```

2. **View Results**:
   - Analysis output automatically saved to `analysis-output/`
   - Dashboard auto-loads from this location
   - Export results for sharing with team

3. **Iterative Refactoring**:
   - Use dashboard to identify issues
   - Apply VS Code snippets for refactoring
   - Re-run analysis to measure improvements
   - Track progress over time

## Customization

### Dashboard
- Modify `dashboard.js` to add new chart types or data visualizations
- Update `dashboard.css` to customize styling and branding
- Extend `sample-analysis-data.json` with your specific use cases

### VS Code Settings
- Customize `settings.json` for your team's coding standards
- Add or remove extensions in `extensions.json` based on your stack
- Create additional snippets for your specific refactoring patterns

## Troubleshooting

### Dashboard Issues
- **File loading fails**: Ensure you're serving the dashboard via HTTP (not file://)
- **Charts not rendering**: Check browser console for JavaScript errors
- **Large files slow**: Consider filtering data before loading

### VS Code Issues
- **Extensions not installing**: Check VS Code version compatibility
- **Settings not applying**: Restart VS Code after copying settings
- **Snippets not working**: Ensure they're in the correct `.vscode/snippets/` directory

## Contributing

To contribute improvements to these tools:

1. Test changes with the sample data
2. Ensure responsive design for dashboard changes
3. Follow VS Code extension naming conventions
4. Document new snippets with clear descriptions
5. Update this README with any new features

## Support

For issues or questions about these tools:
1. Check the main project documentation
2. Review VS Code extension documentation for configuration issues
3. Test with sample data to isolate problems
4. Consider browser compatibility for dashboard issues