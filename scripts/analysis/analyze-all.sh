#!/bin/bash
# scripts/analyze-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="${1:-.}"
OUTPUT_DIR="analysis-output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}🔍 Starting Comprehensive Code Analysis${NC}"
echo "Project root: $PROJECT_ROOT"
echo "Timestamp: $TIMESTAMP"

# Create output directory
mkdir -p "$OUTPUT_DIR/$TIMESTAMP"
cd "$OUTPUT_DIR/$TIMESTAMP"

# Function to check command availability
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 not found. Please install it first.${NC}"
        exit 1
    fi
}

# Check dependencies
echo -e "\n${YELLOW}Checking dependencies...${NC}"
check_command node
check_command npm
check_command npx

# Install required packages if not present
if [ ! -f "../../package.json" ]; then
    echo "Initializing package.json..."
    npm init -y > /dev/null 2>&1
fi

# Install analysis dependencies
echo "Installing analysis tools..."
npm install --save-dev \
    typescript \
    ts-node \
    @types/node \
    ts-morph \
    glob \
    fastest-levenshtein \
    madge \
    csv-writer \
    @octokit/rest > /dev/null 2>&1

# Step 1: TypeScript AST Analysis
echo -e "\n${YELLOW}📊 Step 1: Analyzing code structure...${NC}"
npx ts-node ../../scripts/enhanced-ast-analyzer.ts

if [ ! -f "analysis-report.json" ]; then
    echo -e "${RED}Error: AST analysis failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ AST analysis complete${NC}"

# Step 2: Circular Dependencies Check
echo -e "\n${YELLOW}🔄 Step 2: Checking circular dependencies...${NC}"
npx madge --circular --extensions ts,tsx "$PROJECT_ROOT/src" \
    --json > circular-deps.json || true

npx madge --extensions ts,tsx "$PROJECT_ROOT/src" \
    --image dependency-graph.svg || true

echo -e "${GREEN}✓ Dependency analysis complete${NC}"

# Step 3: Generate Visual Reports
echo -e "\n${YELLOW}📈 Step 3: Creating visualizations...${NC}"

# Create HTML dashboard
cat > dashboard.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Code Analysis Dashboard</title>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .metric {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric.good { color: #27ae60; }
        .metric.warning { color: #f39c12; }
        .metric.danger { color: #e74c3c; }
        .chart {
            margin: 20px 0;
            height: 300px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .severity-critical { background: #fee; }
        .severity-high { background: #ffe; }
        .severity-medium { background: #eff; }
        .severity-low { background: #efe; }
        .recommendation {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #666;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <div class="container">
            <h1>Code Analysis Dashboard</h1>
            <p id="timestamp">Loading...</p>
        </div>
    </div>

    <div class="container">
        <div id="content">
            <div class="loading">
                <p>Loading analysis data...</p>
            </div>
        </div>
    </div>

    <script>
        async function loadDashboard() {
            try {
                const report = await fetch('analysis-report.json').then(r => r.json());
                const circularDeps = await fetch('circular-deps.json').then(r => r.json()).catch(() => ({ circular: [] }));

                const content = document.getElementById('content');
                document.getElementById('timestamp').textContent = `Generated: ${new Date(report.timestamp).toLocaleString()}`;

                // Calculate metrics
                const criticalIssues = report.duplicates.filter(d => d.severity === 'critical').length;
                const totalIssues = report.duplicates.length + report.unusedExports.length + circularDeps.circular.length;

                content.innerHTML = `
                    <div class="grid">
                        <div class="card">
                            <h3>Total Entities</h3>
                            <div class="metric">${report.summary.totalEntities}</div>
                            <p>Across ${report.summary.totalFiles} files</p>
                        </div>

                        <div class="card">
                            <h3>Duplicate Clusters</h3>
                            <div class="metric ${report.summary.duplicateClusters > 10 ? 'danger' : 'warning'}">${report.summary.duplicateClusters}</div>
                            <p>${criticalIssues} critical</p>
                        </div>

                        <div class="card">
                            <h3>Unused Exports</h3>
                            <div class="metric ${report.summary.unusedExports > 20 ? 'danger' : 'warning'}">${report.summary.unusedExports}</div>
                            <p>Can be safely removed</p>
                        </div>

                        <div class="card">
                            <h3>Circular Dependencies</h3>
                            <div class="metric ${circularDeps.circular.length > 0 ? 'danger' : 'good'}">${circularDeps.circular.length}</div>
                            <p>Must be resolved</p>
                        </div>
                    </div>

                    <div class="card">
                        <h3>Entity Distribution</h3>
                        <canvas id="entityChart" class="chart"></canvas>
                    </div>

                    <div class="card">
                        <h3>Critical Duplicates</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Count</th>
                                    <th>Entities</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${report.duplicates
                                    .filter(d => d.severity === 'critical')
                                    .slice(0, 10)
                                    .map(d => `
                                        <tr class="severity-${d.severity}">
                                            <td>${d.type}</td>
                                            <td>${d.entities.length}</td>
                                            <td>${d.entities.map(e => e.name).join(', ')}</td>
                                            <td>Merge immediately</td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="card">
                        <h3>Top Recommendations</h3>
                        ${report.recommendations
                            .slice(0, 5)
                            .map(rec => `
                                <div class="recommendation">
                                    <strong>${rec.priority}: ${rec.description}</strong>
                                    <p>${rec.impact}</p>
                                </div>
                            `).join('')}
                    </div>
                `;

                // Create entity distribution chart
                const ctx = document.getElementById('entityChart').getContext('2d');
                const entityTypes = {};
                report.entities.forEach(e => {
                    entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
                });

                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(entityTypes),
                        datasets: [{
                            data: Object.values(entityTypes),
                            backgroundColor: [
                                '#3498db', '#2ecc71', '#f39c12', '#e74c3c',
                                '#9b59b6', '#1abc9c', '#34495e', '#f1c40f'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right'
                            }
                        }
                    }
                });

            } catch (error) {
                console.error('Failed to load dashboard:', error);
                document.getElementById('content').innerHTML = `
                    <div class="card">
                        <h3>Error</h3>
                        <p>Failed to load analysis data. Please check the console for details.</p>
                    </div>
                `;
            }
        }

        loadDashboard();
    </script>
</body>
</html>
EOF

echo -e "${GREEN}✓ Dashboard created${NC}"

# Step 4: Generate actionable reports
echo -e "\n${YELLOW}📋 Step 4: Generating actionable reports...${NC}"

# Create consolidation batches
npx ts-node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('analysis-report.json', 'utf-8'));

// Group duplicates by type and severity
const batches = [];
const batchSize = 5;

// Critical duplicates first
const criticalDuplicates = report.duplicates.filter(d => d.severity === 'critical');
for (let i = 0; i < criticalDuplicates.length; i += batchSize) {
    batches.push({
        id: \`batch-\${batches.length + 1}\`,
        priority: 'critical',
        type: 'duplicates',
        items: criticalDuplicates.slice(i, i + batchSize)
    });
}

// Unused exports
for (let i = 0; i < report.unusedExports.length; i += batchSize * 2) {
    batches.push({
        id: \`batch-\${batches.length + 1}\`,
        priority: 'high',
        type: 'unused-exports',
        items: report.unusedExports.slice(i, i + batchSize * 2)
    });
}

fs.writeFileSync('consolidation-batches.json', JSON.stringify(batches, null, 2));
console.log(\`Created \${batches.length} consolidation batches\`);
"

echo -e "${GREEN}✓ Reports generated${NC}"

# Step 5: Create summary
echo -e "\n${YELLOW}📊 Step 5: Creating executive summary...${NC}"

cat > ANALYSIS_SUMMARY.md << 'EOF'
# Code Analysis Summary

## Overview

This analysis provides a comprehensive view of the codebase to guide refactoring efforts.

## Key Metrics

- **Total Entities**: See dashboard.html
- **Critical Issues**: Require immediate attention
- **Technical Debt Score**: Based on duplicates, complexity, and unused code

## Priority Actions

1. **Immediate (Week 1)**
   - Merge critical duplicates
   - Remove unused exports
   - Fix circular dependencies

2. **Short-term (Weeks 2-3)**
   - Standardize patterns
   - Refactor wrapper services
   - Consolidate similar types

3. **Long-term (Month 2)**
   - Implement monorepo structure
   - Establish governance
   - Automate quality checks

## Next Steps

1. Review `dashboard.html` for visual overview
2. Process `consolidation-batches.json` in order
3. Use entity reports to guide refactoring
4. Re-run analysis weekly to track progress

## Files Generated

- `dashboard.html` - Interactive visual dashboard
- `analysis-report.json` - Complete analysis data
- `entities.csv` - All entities in spreadsheet format
- `duplicates.csv` - Duplicate clusters
- `consolidation-batches.json` - Prioritized work items
- `circular-deps.json` - Circular dependency chains
- `dependency-graph.svg` - Visual dependency graph
EOF

echo -e "${GREEN}✓ Summary created${NC}"

# Final summary
echo -e "\n${BLUE}=== Analysis Complete ===${NC}"
echo -e "Results saved to: ${PWD}"
echo -e "\nKey files:"
echo -e "  - ${GREEN}dashboard.html${NC} - Open in browser for visual overview"
echo -e "  - ${GREEN}ANALYSIS_SUMMARY.md${NC} - Executive summary"
echo -e "  - ${GREEN}consolidation-batches.json${NC} - Prioritized work items"
echo -e "\n${YELLOW}Next step:${NC} Open dashboard.html in your browser"

# Create a simple HTTP server script for viewing dashboard
cat > view-dashboard.sh << 'EOF'
#!/bin/bash
echo "Starting local server..."
echo "Dashboard will be available at http://localhost:8080/dashboard.html"
python3 -m http.server 8080 2>/dev/null || python -m SimpleHTTPServer 8080
EOF
chmod +x view-dashboard.sh

echo -e "\n${YELLOW}Tip:${NC} Run ./view-dashboard.sh to view the dashboard"
