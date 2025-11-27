#!/bin/bash

# Script to replace all Orchestrator text references with Orchestrator
# Phase 2: Content replacement

set -e

BASE_DIR="/Users/iroselli/wundr/packages/@wundr/neolith/apps/web"
cd "$BASE_DIR"

echo "=== Orchestrator to Orchestrator Content Replacement ==="
echo "Starting at: $(date)"
echo ""

# Function to replace content in a file
replace_in_file() {
    local file="$1"
    if [ ! -f "$file" ]; then
        return
    fi

    # Create a temporary file
    tmpfile=$(mktemp)

    # Apply all replacements using sed
    sed \
        -e 's/\bVPs\b/Orchestrators/g' \
        -e 's/\bVP\b/Orchestrator/g' \
        -e 's/\bvps\b/orchestrators/g' \
        -e 's/\bvp\b/orchestrator/g' \
        -e 's/\bvpId\b/orchestratorId/g' \
        -e 's/\bvpID\b/orchestratorID/g' \
        -e 's/\[vpId\]/[orchestratorId]/g' \
        -e 's/\[workspaceId\]\/vps/[workspaceId]\/orchestrators/g' \
        -e 's/\/vps\//\/orchestrators\//g' \
        -e 's/\/vps"/\/orchestrators"/g' \
        -e 's/\/vps'"'"'/\/orchestrators'"'"'/g' \
        -e 's/\/vps`/\/orchestrators`/g' \
        -e 's/\/vps\//\/orchestrators\//g' \
        -e 's/api\/vps/api\/orchestrators/g' \
        -e 's/\bVPStatus\b/OrchestratorStatus/g' \
        -e 's/\bVPCharter\b/OrchestratorCharter/g' \
        -e 's/\bVPPersonality\b/OrchestratorPersonality/g' \
        -e 's/\bVPModelConfig\b/OrchestratorModelConfig/g' \
        -e 's/\bVPFilters\b/OrchestratorFilters/g' \
        -e 's/\bVPDiscipline\b/OrchestratorDiscipline/g' \
        -e 's/\bCreateVPInput\b/CreateOrchestratorInput/g' \
        -e 's/\bUpdateVPInput\b/UpdateOrchestratorInput/g' \
        -e 's/\bVPApiResponse\b/OrchestratorApiResponse/g' \
        -e 's/\bVP_DISCIPLINES\b/ORCHESTRATOR_DISCIPLINES/g' \
        -e 's/\bVP_STATUS_CONFIG\b/ORCHESTRATOR_STATUS_CONFIG/g' \
        -e 's/\buseVP\b/useOrchestrator/g' \
        -e 's/\buseVPs\b/useOrchestrators/g' \
        -e 's/\buseVPMutations\b/useOrchestratorMutations/g' \
        -e 's/\buseVPTasks\b/useOrchestratorTasks/g' \
        -e 's/\buseVPPresence\b/useOrchestratorPresence/g' \
        -e 's/\bUseVPReturn\b/UseOrchestratorReturn/g' \
        -e 's/\bUseVPsReturn\b/UseOrchestr atorsReturn/g' \
        -e 's/\bUseVPMutationsReturn\b/UseOrchestratorMutationsReturn/g' \
        -e 's/\bCreateVPDialog\b/CreateOrchestratorDialog/g' \
        -e 's/\bVPCard\b/OrchestratorCard/g' \
        -e 's/\bVPCardSkeleton\b/OrchestratorCardSkeleton/g' \
        -e 's/\bVPGridSkeleton\b/OrchestratorGridSkeleton/g' \
        -e 's/\bVPConfigForm\b/OrchestratorConfigForm/g' \
        -e 's/\bVPStatusBadge\b/OrchestratorStatusBadge/g' \
        -e 's/\bVPPresenceIndicator\b/OrchestratorPresenceIndicator/g' \
        -e 's/\bVPAnalyticsCard\b/OrchestratorAnalyticsCard/g' \
        -e 's/\bVPTaskAssignmentDialog\b/OrchestratorTaskAssignmentDialog/g' \
        -e 's/\bVPWorkSummary\b/OrchestratorWorkSummary/g' \
        -e 's/\bVPsPage\b/OrchestratorsPage/g' \
        -e 's/\bVPsLoading\b/OrchestratorsLoading/g' \
        -e 's/\bVPsError\b/OrchestratorsError/g' \
        -e 's/\bVPDetailPage\b/OrchestratorDetailPage/g' \
        -e 's/\bcreate-orchestrator-dialog\b/create-orchestrator-dialog/g' \
        -e 's/\borchestrator-config-form\b/orchestrator-config-form/g' \
        -e 's/\borchestrator-card\b/orchestrator-card/g' \
        -e 's/\borchestrator-status-badge\b/orchestrator-status-badge/g' \
        -e 's/\borchestrator-presence-indicator\b/orchestrator-presence-indicator/g' \
        -e 's/\borchestrator-analytics-card\b/orchestrator-analytics-card/g' \
        -e 's/\borchestrator-task-assignment-dialog\b/orchestrator-task-assignment-dialog/g' \
        -e 's/\borchestrator-grid-skeleton\b/orchestrator-grid-skeleton/g' \
        -e 's/\borchestrator-status-card\b/orchestrator-status-card/g' \
        -e 's/\bempty-vps\b/empty-orchestrators/g' \
        -e 's/\buse-vp\b/use-orchestrator/g' \
        -e 's/\buse-orchestrator-tasks\b/use-orchestrator-tasks/g' \
        -e 's/\buse-orchestrator-presence\b/use-orchestrator-presence/g' \
        -e 's/\borchestrator-analytics\b/orchestrator-analytics/g' \
        -e 's/\borchestrator-coordination\b/orchestrator-coordination/g' \
        -e 's/\borchestrator-conversation\b/orchestrator-conversation/g' \
        -e 's/\borchestrator-memory\b/orchestrator-memory/g' \
        -e 's/\borchestrator-scheduling\b/orchestrator-scheduling/g' \
        -e 's/\borchestrator-analytics-service\b/orchestrator-analytics-service/g' \
        -e 's/\borchestrator-status-service\b/orchestrator-status-service/g' \
        -e 's/\borchestrator-memory-service\b/orchestrator-memory-service/g' \
        -e 's/\borchestrator-channel-assignment-service\b/orchestrator-channel-assignment-service/g' \
        -e 's/\borchestrator-scheduling-service\b/orchestrator-scheduling-service/g' \
        -e 's/\borchestrator-coordination-service\b/orchestrator-coordination-service/g' \
        -e 's/\borchestrator-work-engine-service\b/orchestrator-work-engine-service/g' \
        -e 's/\borchestrator-health\b/orchestrator-health/g' \
        -e 's/"Virtual Person"/"Orchestrator"/g' \
        -e 's/"Virtual Persons"/"Orchestrators"/g' \
        -e 's/Virtual Person/Orchestrator/g' \
        -e 's/Virtual Persons/Orchestrators/g' \
        -e 's/virtual person/orchestrator/g' \
        -e 's/virtual persons/orchestrators/g' \
        -e 's/Virtual Participant/Orchestrator/g' \
        -e 's/Virtual Participants/Orchestrators/g' \
        -e 's/virtual participant/orchestrator/g' \
        -e 's/virtual participants/orchestrators/g' \
        -e 's/@\/components\/vp\//@\/components\/orchestrator\//g' \
        -e 's/@\/types\/vp/@\/types\/orchestrator/g' \
        -e 's/@\/hooks\/use-vp/@\/hooks\/use-orchestrator/g' \
        -e 's/@\/lib\/validations\/vp/@\/lib\/validations\/orchestrator/g' \
        -e 's/@\/lib\/services\/vp/@\/lib\/services\/orchestrator/g' \
        "$file" > "$tmpfile"

    # Only update if changes were made
    if ! cmp -s "$file" "$tmpfile"; then
        mv "$tmpfile" "$file"
        echo "  Updated: $file"
    else
        rm "$tmpfile"
    fi
}

# Find and process all TypeScript/TSX files
echo "Phase 1: Processing TypeScript and React files..."
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "./node_modules/*" \
    ! -path "./out/*" \
    ! -path "./.next/*" \
    ! -path "./dist/*" \
    ! -path "./build/*" \
    ! -path "./.turbo/*" \
    ! -path "./scripts/rename-orchestrator-to-orchestrator.sh" \
    ! -path "./scripts/replace-orchestrator-content.sh" | while read -r file; do
    replace_in_file "$file"
done

echo ""
echo "Phase 2: Processing JSON files (package.json, tsconfig.json, etc.)..."
find . -type f -name "*.json" \
    ! -path "./node_modules/*" \
    ! -path "./out/*" \
    ! -path "./.next/*" \
    ! -path "./dist/*" \
    ! -path "./build/*" | while read -r file; do
    replace_in_file "$file"
done

echo ""
echo "Phase 3: Processing Markdown files..."
find . -type f -name "*.md" \
    ! -path "./node_modules/*" \
    ! -path "./out/*" | while read -r file; do
    replace_in_file "$file"
done

echo ""
echo "=== Content Replacement Complete ==="
echo "Completed at: $(date)"
echo ""
echo "Summary:"
echo "- All Orchestrator references replaced with Orchestrator"
echo "- All route paths updated: /vps → /orchestrators"
echo "- All param names updated: vpId → orchestratorId"
echo "- All type names updated"
echo "- All hook names updated"
echo "- All component names updated"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test the application"
echo "3. Run type checking: npm run typecheck"
echo "4. Commit changes"
