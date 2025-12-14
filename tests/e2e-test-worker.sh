#!/bin/bash
#
# End-to-End Test for Test Worker
#
# This script tests the complete flow:
# 1. Create a user and get auth token
# 2. Submit a task via API
# 3. Wait for task completion
# 4. Verify execution result
# 5. Check usage/accounting records
#
# Prerequisites:
# - docker-compose up (or individual services running)
# - PocketBase running on localhost:8090
# - Worker Manager running on localhost:3001
#
# Usage: ./tests/e2e-test-worker.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
POCKETBASE_URL="${POCKETBASE_URL:-http://localhost:8090}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
WORKER_MANAGER_URL="${WORKER_MANAGER_URL:-http://localhost:3001}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-dev-secret-key}"

# Test user credentials
TEST_EMAIL="test-worker-$(date +%s)@example.com"
TEST_PASSWORD="testpassword123"

# Test data
TEST_TASK_INPUT='{"operation":"math","action":"add","numbers":[10,20,30,40]}'
EXPECTED_RESULT=100

echo ""
echo "============================================================"
echo "  SAASSY TEST WORKER - End-to-End Test"
echo "============================================================"
echo ""
echo "Configuration:"
echo "  PocketBase URL: $POCKETBASE_URL"
echo "  Web URL: $WEB_URL"
echo "  Worker Manager URL: $WORKER_MANAGER_URL"
echo ""

# Check if services are running
echo -e "${BLUE}Checking services...${NC}"

check_service() {
    local name="$1"
    local url="$2"
    local endpoint="${3:-}"

    echo -n "  $name ($url$endpoint)... "
    if curl -s -o /dev/null -w "%{http_code}" "$url$endpoint" | grep -q "200\|404\|401"; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}NOT AVAILABLE${NC}"
        return 1
    fi
}

SERVICES_OK=true
check_service "PocketBase" "$POCKETBASE_URL" "/api/health" || SERVICES_OK=false
check_service "Worker Manager" "$WORKER_MANAGER_URL" "/health" || true  # May not have health endpoint

if [ "$SERVICES_OK" = false ]; then
    echo ""
    echo -e "${YELLOW}Warning: Some services may not be running.${NC}"
    echo "Run 'docker-compose up -d' to start all services."
    echo ""
fi

echo ""
echo -e "${BLUE}Step 1: Create test user${NC}"
echo "  Email: $TEST_EMAIL"

# Create user
CREATE_USER_RESPONSE=$(curl -s -X POST "$POCKETBASE_URL/api/collections/users/records" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"passwordConfirm\": \"$TEST_PASSWORD\",
        \"name\": \"Test Worker User\"
    }")

USER_ID=$(echo "$CREATE_USER_RESPONSE" | jq -r '.id // empty')

if [ -z "$USER_ID" ]; then
    echo -e "${RED}Failed to create user${NC}"
    echo "Response: $CREATE_USER_RESPONSE"
    exit 1
fi

echo -e "  User ID: ${GREEN}$USER_ID${NC}"

# Authenticate
echo ""
echo -e "${BLUE}Step 2: Authenticate user${NC}"

AUTH_RESPONSE=$(curl -s -X POST "$POCKETBASE_URL/api/collections/users/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{
        \"identity\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}Failed to authenticate${NC}"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

echo -e "  Token: ${GREEN}${AUTH_TOKEN:0:20}...${NC}"

# Create task in PocketBase
echo ""
echo -e "${BLUE}Step 3: Create task record${NC}"
echo "  Input: $TEST_TASK_INPUT"

CREATE_TASK_RESPONSE=$(curl -s -X POST "$POCKETBASE_URL/api/collections/tasks/records" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "{
        \"user\": \"$USER_ID\",
        \"type\": \"test-worker\",
        \"status\": \"pending\",
        \"input\": $TEST_TASK_INPUT
    }")

TASK_ID=$(echo "$CREATE_TASK_RESPONSE" | jq -r '.id // empty')

if [ -z "$TASK_ID" ]; then
    echo -e "${RED}Failed to create task${NC}"
    echo "Response: $CREATE_TASK_RESPONSE"
    exit 1
fi

echo -e "  Task ID: ${GREEN}$TASK_ID${NC}"

# Queue task for execution
echo ""
echo -e "${BLUE}Step 4: Queue task for execution${NC}"

QUEUE_RESPONSE=$(curl -s -X POST "$WORKER_MANAGER_URL/internal/tasks/start" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $INTERNAL_API_KEY" \
    -d "{
        \"taskId\": \"$TASK_ID\",
        \"userId\": \"$USER_ID\",
        \"type\": \"test-worker\",
        \"input\": $TEST_TASK_INPUT,
        \"plan\": \"free\"
    }")

QUEUED=$(echo "$QUEUE_RESPONSE" | jq -r '.success // empty')

if [ "$QUEUED" != "true" ]; then
    echo -e "${RED}Failed to queue task${NC}"
    echo "Response: $QUEUE_RESPONSE"
    # Continue anyway to check if task was already queued
fi

echo -e "  Queued: ${GREEN}$QUEUED${NC}"

# Wait for task completion
echo ""
echo -e "${BLUE}Step 5: Waiting for task completion...${NC}"

MAX_WAIT=60
WAIT_INTERVAL=2
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    TASK_STATUS_RESPONSE=$(curl -s "$POCKETBASE_URL/api/collections/tasks/records/$TASK_ID" \
        -H "Authorization: Bearer $AUTH_TOKEN")

    TASK_STATUS=$(echo "$TASK_STATUS_RESPONSE" | jq -r '.status // empty')

    echo -n "."

    if [ "$TASK_STATUS" = "completed" ] || [ "$TASK_STATUS" = "failed" ]; then
        echo ""
        break
    fi

    sleep $WAIT_INTERVAL
    WAITED=$((WAITED + WAIT_INTERVAL))
done

echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}Task timed out (waited ${MAX_WAIT}s)${NC}"
    exit 1
fi

# Get final task result
echo -e "${BLUE}Step 6: Verify task result${NC}"

FINAL_TASK=$(curl -s "$POCKETBASE_URL/api/collections/tasks/records/$TASK_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN")

FINAL_STATUS=$(echo "$FINAL_TASK" | jq -r '.status')
TASK_OUTPUT=$(echo "$FINAL_TASK" | jq -r '.output')
TASK_ERROR=$(echo "$FINAL_TASK" | jq -r '.error // empty')
RESOURCE_USAGE=$(echo "$FINAL_TASK" | jq -r '.resourceUsage')
STARTED_AT=$(echo "$FINAL_TASK" | jq -r '.startedAt // empty')
COMPLETED_AT=$(echo "$FINAL_TASK" | jq -r '.completedAt // empty')

echo "  Status: $FINAL_STATUS"
echo "  Started: $STARTED_AT"
echo "  Completed: $COMPLETED_AT"
echo "  Output: $TASK_OUTPUT"

if [ -n "$TASK_ERROR" ] && [ "$TASK_ERROR" != "null" ]; then
    echo "  Error: $TASK_ERROR"
fi

if [ -n "$RESOURCE_USAGE" ] && [ "$RESOURCE_USAGE" != "null" ]; then
    echo "  Resource Usage: $RESOURCE_USAGE"
fi

# Verify result
if [ "$FINAL_STATUS" = "completed" ]; then
    RESULT_VALUE=$(echo "$TASK_OUTPUT" | jq -r '.result.result // empty')

    if [ "$RESULT_VALUE" = "$EXPECTED_RESULT" ]; then
        echo -e "  ${GREEN}✓ Result matches expected value ($EXPECTED_RESULT)${NC}"
    else
        echo -e "  ${RED}✗ Result mismatch: expected $EXPECTED_RESULT, got $RESULT_VALUE${NC}"
    fi
else
    echo -e "  ${RED}✗ Task failed with status: $FINAL_STATUS${NC}"
fi

# Check usage records
echo ""
echo -e "${BLUE}Step 7: Check usage/accounting records${NC}"

PERIOD=$(date +%Y-%m)
USAGE_RESPONSE=$(curl -s "$POCKETBASE_URL/api/collections/usage_records/records" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -G --data-urlencode "filter=user=\"$USER_ID\" && period=\"$PERIOD\"")

USAGE_ITEMS=$(echo "$USAGE_RESPONSE" | jq -r '.totalItems // 0')

echo "  Period: $PERIOD"
echo "  Usage records found: $USAGE_ITEMS"

if [ "$USAGE_ITEMS" -gt 0 ]; then
    USAGE_DATA=$(echo "$USAGE_RESPONSE" | jq -r '.items[0]')
    CPU_SECONDS=$(echo "$USAGE_DATA" | jq -r '.cpuSeconds // 0')
    MEMORY_MB_SECONDS=$(echo "$USAGE_DATA" | jq -r '.memoryMbSeconds // 0')
    TASK_COUNT=$(echo "$USAGE_DATA" | jq -r '.taskCount // 0')

    echo "  CPU Seconds: $CPU_SECONDS"
    echo "  Memory MB-Seconds: $MEMORY_MB_SECONDS"
    echo "  Task Count: $TASK_COUNT"

    if [ "$TASK_COUNT" -gt 0 ]; then
        echo -e "  ${GREEN}✓ Usage recorded correctly${NC}"
    fi
fi

# Cleanup
echo ""
echo -e "${BLUE}Step 8: Cleanup${NC}"

# Delete task
curl -s -X DELETE "$POCKETBASE_URL/api/collections/tasks/records/$TASK_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null

# Delete usage records
if [ "$USAGE_ITEMS" -gt 0 ]; then
    USAGE_ID=$(echo "$USAGE_RESPONSE" | jq -r '.items[0].id')
    curl -s -X DELETE "$POCKETBASE_URL/api/collections/usage_records/records/$USAGE_ID" \
        -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null 2>&1 || true
fi

# Delete user
curl -s -X DELETE "$POCKETBASE_URL/api/collections/users/records/$USER_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null 2>&1 || true

echo -e "  ${GREEN}✓ Test data cleaned up${NC}"

# Summary
echo ""
echo "============================================================"
if [ "$FINAL_STATUS" = "completed" ] && [ "$RESULT_VALUE" = "$EXPECTED_RESULT" ]; then
    echo -e "  ${GREEN}END-TO-END TEST PASSED${NC}"
    echo "============================================================"
    exit 0
else
    echo -e "  ${RED}END-TO-END TEST FAILED${NC}"
    echo "============================================================"
    exit 1
fi
