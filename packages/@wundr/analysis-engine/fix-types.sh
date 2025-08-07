#!/bin/bash
# Quick TypeScript fixes

# Fix unused imports and variables
sed -i '' 's/^import.*SourceFile.*Node.*$/import { Project } from "ts-morph";/' src/analyzers/EnhancedASTAnalyzer.ts
sed -i '' 's/EntityType,//' src/analyzers/EnhancedASTAnalyzer.ts
sed -i '' 's/calculateSimilarity,//' src/engines/DuplicateDetectionEngine.ts
sed -i '' 's/VisualizationData//' src/engines/CircularDependencyEngine.ts
sed -i '' 's/CodeSmell//' src/engines/ComplexityMetricsEngine.ts

# Fix DoWhileStatement
sed -i '' 's/DoWhileStatement/WhileStatement/g' src/analyzers/EnhancedASTAnalyzer.ts
sed -i '' 's/DoWhileStatement/WhileStatement/g' src/engines/ComplexityMetricsEngine.ts

# Fix undefined checks
sed -i '' 's/throw result.error || new Error/throw (result.error as Error) || new Error/' src/analyzers/BaseAnalysisService.ts

echo "Types fixed!"