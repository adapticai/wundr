#!/bin/bash

# Script to rename all Orchestrator references to Orchestrator
# This script ONLY renames frontend code, NOT Prisma schema

set -e

BASE_DIR="/Users/iroselli/wundr/packages/@wundr/neolith/apps/web"
cd "$BASE_DIR"

echo "=== Orchestrator to Orchestrator Renaming Script ==="
echo "Starting at: $(date)"
echo ""

# Phase 1: Rename directory structures
echo "Phase 1: Renaming directory structures..."

# Rename main VPs page directory
if [ -d "app/(workspace)/[workspaceId]/vps" ]; then
    echo "  Renaming app/(workspace)/[workspaceId]/vps → orchestrators"
    mv "app/(workspace)/[workspaceId]/vps" "app/(workspace)/[workspaceId]/orchestrators"
fi

# Rename [vpId] to [orchestratorId]
if [ -d "app/(workspace)/[workspaceId]/orchestrators/[vpId]" ]; then
    echo "  Renaming [vpId] → [orchestratorId]"
    mv "app/(workspace)/[workspaceId]/orchestrators/[vpId]" "app/(workspace)/[workspaceId]/orchestrators/[orchestratorId]"
fi

# Rename components/vp directory
if [ -d "components/vp" ]; then
    echo "  Renaming components/vp → components/orchestrator"
    mv "components/vp" "components/orchestrator"
fi

# Rename components/presence/orchestrator-status-card.tsx
if [ -f "components/presence/orchestrator-status-card.tsx" ]; then
    echo "  Renaming components/presence/orchestrator-status-card.tsx → orchestrator-status-card.tsx"
    mv "components/presence/orchestrator-status-card.tsx" "components/presence/orchestrator-status-card.tsx"
fi

# Rename components/empty-states/empty-vps.tsx
if [ -f "components/empty-states/empty-vps.tsx" ]; then
    echo "  Renaming components/empty-states/empty-vps.tsx → empty-orchestrators.tsx"
    mv "components/empty-states/empty-vps.tsx" "components/empty-states/empty-orchestrators.tsx"
fi

# Rename components/skeletons/orchestrator-grid-skeleton.tsx
if [ -f "components/skeletons/orchestrator-grid-skeleton.tsx" ]; then
    echo "  Renaming components/skeletons/orchestrator-grid-skeleton.tsx → orchestrator-grid-skeleton.tsx"
    mv "components/skeletons/orchestrator-grid-skeleton.tsx" "components/skeletons/orchestrator-grid-skeleton.tsx"
fi

# Rename types/vp.ts and orchestrator-analytics.ts
if [ -f "types/vp.ts" ]; then
    echo "  Renaming types/vp.ts → types/orchestrator.ts"
    mv "types/vp.ts" "types/orchestrator.ts"
fi

if [ -f "types/orchestrator-analytics.ts" ]; then
    echo "  Renaming types/orchestrator-analytics.ts → types/orchestrator-analytics.ts"
    mv "types/orchestrator-analytics.ts" "types/orchestrator-analytics.ts"
fi

# Rename hooks
if [ -f "hooks/use-vp.ts" ]; then
    echo "  Renaming hooks/use-vp.ts → hooks/use-orchestrator.ts"
    mv "hooks/use-vp.ts" "hooks/use-orchestrator.ts"
fi

if [ -f "hooks/use-orchestrator-tasks.ts" ]; then
    echo "  Renaming hooks/use-orchestrator-tasks.ts → hooks/use-orchestrator-tasks.ts"
    mv "hooks/use-orchestrator-tasks.ts" "hooks/use-orchestrator-tasks.ts"
fi

if [ -f "hooks/use-orchestrator-presence.ts" ]; then
    echo "  Renaming hooks/use-orchestrator-presence.ts → hooks/use-orchestrator-presence.ts"
    mv "hooks/use-orchestrator-presence.ts" "hooks/use-orchestrator-presence.ts"
fi

# Rename validation files
echo "  Renaming validation files..."
[ -f "lib/validations/vp.ts" ] && mv "lib/validations/vp.ts" "lib/validations/orchestrator.ts"
[ -f "lib/validations/orchestrator-coordination.ts" ] && mv "lib/validations/orchestrator-coordination.ts" "lib/validations/orchestrator-coordination.ts"
[ -f "lib/validations/orchestrator-conversation.ts" ] && mv "lib/validations/orchestrator-conversation.ts" "lib/validations/orchestrator-conversation.ts"
[ -f "lib/validations/orchestrator-memory.ts" ] && mv "lib/validations/orchestrator-memory.ts" "lib/validations/orchestrator-memory.ts"
[ -f "lib/validations/orchestrator-scheduling.ts" ] && mv "lib/validations/orchestrator-scheduling.ts" "lib/validations/orchestrator-scheduling.ts"
[ -f "lib/validations/orchestrator-analytics.ts" ] && mv "lib/validations/orchestrator-analytics.ts" "lib/validations/orchestrator-analytics.ts"

# Rename service files
echo "  Renaming service files..."
[ -f "lib/services/orchestrator-analytics-service.ts" ] && mv "lib/services/orchestrator-analytics-service.ts" "lib/services/orchestrator-analytics-service.ts"
[ -f "lib/services/orchestrator-status-service.ts" ] && mv "lib/services/orchestrator-status-service.ts" "lib/services/orchestrator-status-service.ts"
[ -f "lib/services/orchestrator-memory-service.ts" ] && mv "lib/services/orchestrator-memory-service.ts" "lib/services/orchestrator-memory-service.ts"
[ -f "lib/services/orchestrator-channel-assignment-service.ts" ] && mv "lib/services/orchestrator-channel-assignment-service.ts" "lib/services/orchestrator-channel-assignment-service.ts"
[ -f "lib/services/orchestrator-scheduling-service.ts" ] && mv "lib/services/orchestrator-scheduling-service.ts" "lib/services/orchestrator-scheduling-service.ts"
[ -f "lib/services/orchestrator-analytics-service-extended.ts" ] && mv "lib/services/orchestrator-analytics-service-extended.ts" "lib/services/orchestrator-analytics-service-extended.ts"
[ -f "lib/services/orchestrator-coordination-service.ts" ] && mv "lib/services/orchestrator-coordination-service.ts" "lib/services/orchestrator-coordination-service.ts"
[ -f "lib/services/orchestrator-work-engine-service.ts" ] && mv "lib/services/orchestrator-work-engine-service.ts" "lib/services/orchestrator-work-engine-service.ts"
[ -f "lib/services/__tests__/orchestrator-work-engine-service.test.ts" ] && mv "lib/services/__tests__/orchestrator-work-engine-service.test.ts" "lib/services/__tests__/orchestrator-work-engine-service.test.ts"

# Rename test files
echo "  Renaming test files..."
[ -f "tests/vps.spec.ts" ] && mv "tests/vps.spec.ts" "tests/orchestrators.spec.ts"
[ -f "app/api/vps/__tests__/vps.test.ts" ] && mv "app/api/vps/__tests__/vps.test.ts" "app/api/orchestrators/__tests__/orchestrators.test.ts"

echo ""
echo "Phase 1 complete!"
echo ""
echo "Phase 2: File renames complete. Run content replacement script next."
echo ""
echo "Completed at: $(date)"
