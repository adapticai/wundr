# Manual Review Required

Generated: 2025-08-22T06:42:35.504Z

## Complex Promise Chains (0)

These functions have complex promise chains that should be manually converted to async/await:

## Non-Standard Services (4)

These services don't follow the standard lifecycle pattern:

- /Users/lucas/wundr/scripts/analysis/AnalysisService.ts - AnalysisService
- /Users/lucas/wundr/scripts/core/BaseService.ts - BaseService
- /Users/lucas/wundr/scripts/governance/DriftDetectionService.ts - DriftDetectionService
- /Users/lucas/wundr/tools/web-client/app/api/analysis/route.ts - AnalysisService

## Next Steps

1. Review each item in this report
2. Apply manual refactoring where needed
3. Re-run standardization after manual fixes
