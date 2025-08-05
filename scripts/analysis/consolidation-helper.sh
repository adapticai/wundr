#!/bin/bash

# Consolidation Helper Script
# This script helps orchestrate the analysis and consolidation process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="${1:-.}"
OUTPUT_DIR="analysis-output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}=== Code Consolidation Analysis ===${NC}"
echo "Project root: $PROJECT_ROOT"
echo "Timestamp: $TIMESTAMP"

# Create output directory
mkdir -p "$OUTPUT_DIR/$TIMESTAMP"
cd "$OUTPUT_DIR/$TIMESTAMP"

# Step 1: Install dependencies if needed
echo -e "\n${YELLOW}Step 1: Checking dependencies...${NC}"
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: Node.js/npm not found. Please install Node.js${NC}"
    exit 1
fi

# Install TypeScript and other dependencies locally if not present
if [ ! -f "../../package.json" ]; then
    echo "Initializing package.json..."
    npm init -y > /dev/null 2>&1
    npm install --save-dev typescript @types/node glob fastest-levenshtein > /dev/null 2>&1
fi

# Step 2: Run AST Scanner
echo -e "\n${YELLOW}Step 2: Running AST Scanner...${NC}"
npx ts-node ../../ast-scanner.ts "$PROJECT_ROOT"

# Check if inventory was created
if [ ! -f "code-inventory.json" ]; then
    echo -e "${RED}Error: AST Scanner failed to create inventory${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Created code-inventory.json and code-inventory.csv${NC}"

# Step 3: Run Similarity Detector
echo -e "\n${YELLOW}Step 3: Detecting similarities...${NC}"
npx ts-node ../../similarity-detector.ts

if [ ! -f "similarity-report.json" ]; then
    echo -e "${RED}Error: Similarity detection failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Created similarity-report.json and similarities.csv${NC}"

# Step 4: Run Dependency Mapper
echo -e "\n${YELLOW}Step 4: Mapping dependencies...${NC}"
npx ts-node ../../dependency-mapper.ts "$PROJECT_ROOT"

if [ ! -f "dependency-report.json" ]; then
    echo -e "${RED}Error: Dependency mapping failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Created dependency-report.json and entity-usage.csv${NC}"

# Step 5: Generate consolidation recommendations
echo -e "\n${YELLOW}Step 5: Generating consolidation recommendations...${NC}"

cat > generate-recommendations.js << 'EOF'
const fs = require('fs');

// Load all reports
const inventory = JSON.parse(fs.readFileSync('code-inventory.json', 'utf-8'));
const similarities = JSON.parse(fs.readFileSync('similarity-report.json', 'utf-8'));
const dependencies = JSON.parse(fs.readFileSync('dependency-report.json', 'utf-8'));

// Generate recommendations
const recommendations = {
  immediate: [],
  shortTerm: [],
  longTerm: [],
  monorepoStructure: {}
};

// 1. Immediate actions - Critical duplicates
similarities.critical.forEach(sim => {
  recommendations.immediate.push({
    action: 'MERGE_DUPLICATES',
    priority: 'HIGH',
    entities: [sim.entity1, sim.entity2],
    reason: sim.reasons.join('; '),
    estimatedImpact: 'High - reduces code duplication'
  });
});

// 2. Unused exports
dependencies.unused.forEach(entity => {
  recommendations.immediate.push({
    action: 'REMOVE_UNUSED',
    priority: 'MEDIUM',
    entity: `${entity.entity} (${entity.type}) in ${entity.definedIn}`,
    reason: 'Exported but never used',
    estimatedImpact: 'Medium - reduces codebase size'
  });
});

// 3. Orphaned files
dependencies.orphanedFiles.forEach(file => {
  recommendations.shortTerm.push({
    action: 'REVIEW_ORPHANED_FILE',
    priority: 'LOW',
    file: file,
    reason: 'File has exports but no dependencies',
    estimatedImpact: 'Low - may be unused code'
  });
});

// 4. Wrapper patterns
similarities.high.filter(s => s.reasons.some(r => r.includes('Wrapper pattern'))).forEach(sim => {
  recommendations.shortTerm.push({
    action: 'REFACTOR_WRAPPER',
    priority: 'MEDIUM',
    entities: [sim.entity1, sim.entity2],
    reason: sim.reasons.join('; '),
    suggestion: 'Consider extending the base class or using composition',
    estimatedImpact: 'Medium - improves maintainability'
  });
});

// 5. Generate monorepo structure suggestions
const packageSuggestions = {
  '@your-org/core': {
    description: 'Core utilities and shared types',
    include: ['types/', 'interfaces/', 'utils/', 'constants/']
  },
  '@your-org/services': {
    description: 'Business logic services',
    include: ['services/', 'handlers/']
  },
  '@your-org/integrations': {
    description: 'External service integrations',
    include: ['integrations/', 'adapters/']
  },
  '@your-org/models': {
    description: 'Data models and schemas',
    include: ['models/', 'schemas/']
  },
  '@your-org/api': {
    description: 'API routes and controllers',
    include: ['api/', 'routes/', 'controllers/']
  }
};

recommendations.monorepoStructure = packageSuggestions;

// 6. Group entities by suggested package
const entityGroups = {};
inventory.entities.forEach(entity => {
  const filePath = entity.file.toLowerCase();
  let suggestedPackage = '@your-org/core'; // default

  for (const [pkg, config] of Object.entries(packageSuggestions)) {
    if (config.include.some(pattern => filePath.includes(pattern))) {
      suggestedPackage = pkg;
      break;
    }
  }

  if (!entityGroups[suggestedPackage]) {
    entityGroups[suggestedPackage] = [];
  }

  entityGroups[suggestedPackage].push({
    name: entity.name,
    type: entity.type,
    file: entity.file
  });
});

// Save everything
fs.writeFileSync('consolidation-recommendations.json', JSON.stringify(recommendations, null, 2));
fs.writeFileSync('entity-groups-by-package.json', JSON.stringify(entityGroups, null, 2));

// Generate summary report
const summary = `
# Consolidation Summary Report

Generated: ${new Date().toISOString()}

## Key Findings

- Total Entities: ${inventory.summary.totalEntities}
- Critical Duplicates: ${similarities.summary.critical}
- Unused Exports: ${dependencies.summary.unusedExports}
- Orphaned Files: ${dependencies.summary.orphanedFiles}

## Immediate Actions Required

${recommendations.immediate.map(r => `- **${r.action}**: ${r.entities ? r.entities.join(' + ') : r.entity}`).join('\n')}

## Suggested Monorepo Structure

${Object.entries(packageSuggestions).map(([pkg, config]) => `
### ${pkg}
- ${config.description}
- Includes: ${config.include.join(', ')}
- Entity count: ${entityGroups[pkg]?.length || 0}
`).join('')}

## Next Steps

1. Review and merge critical duplicates
2. Remove unused exports
3. Refactor wrapper patterns
4. Reorganize into monorepo packages
5. Standardize naming conventions and error handling
`;

fs.writeFileSync('CONSOLIDATION_SUMMARY.md', summary);

console.log('Recommendations generated successfully!');
console.log(`Total immediate actions: ${recommendations.immediate.length}`);
console.log(`Total short-term actions: ${recommendations.shortTerm.length}`);
EOF

node generate-recommendations.js

echo -e "${GREEN}✓ Generated consolidation recommendations${NC}"

# Step 6: Create action scripts
echo -e "\n${YELLOW}Step 6: Creating action scripts...${NC}"

# Create merge helper script
cat > merge-duplicates.sh << 'EOF'
#!/bin/bash
# Helper script to merge duplicate entities

ENTITY1=$1
ENTITY2=$2
NEW_NAME=$3

echo "Merging $ENTITY1 and $ENTITY2 into $NEW_NAME"

# This is a template - you'll need to customize based on your needs
# 1. Find all usages of both entities
# 2. Create the merged entity
# 3. Update all imports
# 4. Delete the old entities

echo "TODO: Implement merge logic"
EOF

chmod +x merge-duplicates.sh

# Create batch processing script
cat > process-batch.ts << 'EOF'
#!/usr/bin/env node
// Script to process a batch of files for consolidation

import * as fs from 'fs';
import * as path from 'path';

const batchFile = process.argv[2];
if (!batchFile) {
  console.error('Usage: process-batch.ts <batch-file.json>');
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));

// Process each file in the batch
batch.files.forEach((file: string) => {
  console.log(`Processing ${file}...`);

  // TODO: Apply consolidation rules
  // - Standardize naming
  // - Fix error handling
  // - Update imports
  // - etc.
});

console.log('Batch processing complete!');
EOF

echo -e "${GREEN}✓ Created helper scripts${NC}"

# Final summary
echo -e "\n${BLUE}=== Analysis Complete ===${NC}"
echo -e "Results saved to: ${PWD}"
echo -e "\nKey files:"
echo -e "  - ${GREEN}CONSOLIDATION_SUMMARY.md${NC} - Overview and recommendations"
echo -e "  - ${GREEN}consolidation-recommendations.json${NC} - Detailed action items"
echo -e "  - ${GREEN}entity-groups-by-package.json${NC} - Suggested package organization"
echo -e "  - ${GREEN}similarities.csv${NC} - All detected similarities"
echo -e "  - ${GREEN}entity-usage.csv${NC} - Usage statistics for all entities"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Review CONSOLIDATION_SUMMARY.md"
echo -e "2. Start with immediate actions in consolidation-recommendations.json"
echo -e "3. Use entity-groups-by-package.json to plan monorepo structure"
echo -e "4. Create batches of related files to process together"

# Create a simple HTML dashboard
cat > dashboard.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Code Consolidation Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .critical { background-color: #fee; }
        .high { background-color: #ffe; }
        .medium { background-color: #eff; }
        h2 { color: #333; }
        .metric { font-size: 24px; font-weight: bold; color: #007bff; }
    </style>
</head>
<body>
    <h1>Code Consolidation Dashboard</h1>
    <div id="content">Loading...</div>

    <script>
        // Load and display the analysis results
        Promise.all([
            fetch('code-inventory.json').then(r => r.json()),
            fetch('similarity-report.json').then(r => r.json()),
            fetch('dependency-report.json').then(r => r.json()),
            fetch('consolidation-recommendations.json').then(r => r.json())
        ]).then(([inventory, similarities, dependencies, recommendations]) => {
            document.getElementById('content').innerHTML = `
                <div class="card">
                    <h2>Overview</h2>
                    <p>Total Entities: <span class="metric">${inventory.summary.totalEntities}</span></p>
                    <p>Critical Duplicates: <span class="metric">${similarities.summary.critical}</span></p>
                    <p>Unused Exports: <span class="metric">${dependencies.summary.unusedExports}</span></p>
                </div>

                <div class="card critical">
                    <h2>Immediate Actions (${recommendations.immediate.length})</h2>
                    <ul>
                        ${recommendations.immediate.slice(0, 10).map(r =>
                            `<li><strong>${r.action}</strong>: ${r.entity || r.entities.join(' + ')}</li>`
                        ).join('')}
                    </ul>
                </div>

                <div class="card high">
                    <h2>Short-term Actions (${recommendations.shortTerm.length})</h2>
                    <ul>
                        ${recommendations.shortTerm.slice(0, 10).map(r =>
                            `<li><strong>${r.action}</strong>: ${r.file || r.entities.join(' + ')}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        });
    </script>
</body>
</html>
EOF

echo -e "\n${GREEN}✓ Created dashboard.html - open in browser for visual overview${NC}"
