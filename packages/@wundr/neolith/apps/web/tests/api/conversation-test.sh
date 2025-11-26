#!/bin/bash
# Test script for /api/creation/conversation endpoint
# Usage: ./conversation-test.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/creation/conversation"

echo "Testing Conversational Entity Creation API"
echo "==========================================="
echo "Endpoint: ${ENDPOINT}"
echo ""

# Test 1: Orchestrator creation conversation
echo "Test 1: Orchestrator Creation Conversation"
echo "-------------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "orchestrator",
    "messages": [
      {
        "role": "user",
        "content": "I need a customer support orchestrator that can handle tier 1 tickets"
      }
    ],
    "workspaceContext": {
      "workspaceId": "test-workspace",
      "existingChannels": ["#support", "#escalations"],
      "existingOrchestrators": []
    }
  }' \
  --no-buffer

echo -e "\n\n"

# Test 2: Workflow creation conversation
echo "Test 2: Workflow Creation Conversation"
echo "---------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "workflow",
    "messages": [
      {
        "role": "user",
        "content": "Create a workflow that automatically assigns incoming support tickets"
      }
    ],
    "workspaceContext": {
      "workspaceId": "test-workspace",
      "existingWorkflows": ["New Member Onboarding"],
      "existingOrchestrators": ["Support Lead Sarah"]
    }
  }' \
  --no-buffer

echo -e "\n\n"

# Test 3: Invalid entity type (should fail)
echo "Test 3: Invalid Entity Type (Expected Failure)"
echo "----------------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "invalid-type",
    "messages": [
      {
        "role": "user",
        "content": "Test message"
      }
    ]
  }'

echo -e "\n\n"

# Test 4: Missing messages (should fail)
echo "Test 4: Missing Messages (Expected Failure)"
echo "-------------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "channel",
    "messages": []
  }'

echo -e "\n\n"
echo "Tests complete!"
