#!/bin/bash
#
# Test Worker Integration Test Script
#
# This script tests the test-worker Docker image in isolation,
# verifying JSON input/output, various operations, and error handling.
#
# Usage: ./tests/test-worker.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Worker image
IMAGE="saassy/test-worker:latest"

echo ""
echo "============================================================"
echo "  SAASSY TEST WORKER - Docker Integration Tests"
echo "============================================================"
echo ""

# Function to run a test
run_test() {
    local name="$1"
    local input="$2"
    local expected_exit="$3"
    local validate_cmd="$4"

    echo -n "Testing: $name... "

    # Run the container
    local output
    local exit_code
    set +e
    output=$(docker run --rm -e "TASK_INPUT=$input" -e "TASK_ID=test-$$" "$IMAGE" 2>/dev/null)
    exit_code=$?
    set -e

    # Check exit code
    if [ "$exit_code" != "$expected_exit" ]; then
        echo -e "${RED}FAILED${NC} (expected exit $expected_exit, got $exit_code)"
        ((FAILED++))
        return 1
    fi

    # Validate output if validation command provided
    if [ -n "$validate_cmd" ]; then
        if ! echo "$output" | eval "$validate_cmd" > /dev/null 2>&1; then
            echo -e "${RED}FAILED${NC} (validation failed)"
            echo "  Output: $output"
            ((FAILED++))
            return 1
        fi
    fi

    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
    return 0
}

# Function to validate JSON fields
validate_json() {
    local field="$1"
    local expected="$2"
    jq -e "$field == $expected"
}

# Check if image exists, build if not
if ! docker image inspect "$IMAGE" > /dev/null 2>&1; then
    echo -e "${YELLOW}Building test-worker image...${NC}"
    (cd workers/test-worker && npm install && npm run docker:build)
    echo ""
fi

echo -e "${BLUE}Running tests...${NC}"
echo ""

# ==================== ECHO TESTS ====================
echo "--- Echo Operations ---"

run_test "Echo: simple object" \
    '{"operation":"echo","data":{"hello":"world"}}' \
    0 \
    'jq -e ".success == true and .result.echoed.hello == \"world\""'

run_test "Echo: array data" \
    '{"operation":"echo","data":[1,2,3]}' \
    0 \
    'jq -e ".success == true and (.result.echoed | length) == 3"'

run_test "Echo: null data" \
    '{"operation":"echo","data":null}' \
    0 \
    'jq -e ".success == true"'

echo ""

# ==================== MATH TESTS ====================
echo "--- Math Operations ---"

run_test "Math: add" \
    '{"operation":"math","action":"add","numbers":[1,2,3,4,5]}' \
    0 \
    'jq -e ".success == true and .result.result == 15"'

run_test "Math: subtract" \
    '{"operation":"math","action":"subtract","numbers":[100,25,10]}' \
    0 \
    'jq -e ".success == true and .result.result == 65"'

run_test "Math: multiply" \
    '{"operation":"math","action":"multiply","numbers":[2,3,4]}' \
    0 \
    'jq -e ".success == true and .result.result == 24"'

run_test "Math: divide" \
    '{"operation":"math","action":"divide","numbers":[100,2,5]}' \
    0 \
    'jq -e ".success == true and .result.result == 10"'

run_test "Math: power (2^10)" \
    '{"operation":"math","action":"power","numbers":[2,10]}' \
    0 \
    'jq -e ".success == true and .result.result == 1024"'

run_test "Math: factorial (5!)" \
    '{"operation":"math","action":"factorial","numbers":[5]}' \
    0 \
    'jq -e ".success == true and .result.result == 120"'

run_test "Math: factorial (0!)" \
    '{"operation":"math","action":"factorial","numbers":[0]}' \
    0 \
    'jq -e ".success == true and .result.result == 1"'

run_test "Math: divide by zero (error)" \
    '{"operation":"math","action":"divide","numbers":[10,0]}' \
    1 \
    'jq -e ".success == false"'

run_test "Math: no numbers (error)" \
    '{"operation":"math","action":"add","numbers":[]}' \
    1 \
    'jq -e ".success == false"'

echo ""

# ==================== TRANSFORM TESTS ====================
echo "--- Transform Operations ---"

run_test "Transform: uppercase" \
    '{"operation":"transform","action":"uppercase","text":"hello world"}' \
    0 \
    'jq -e ".success == true and .result.result == \"HELLO WORLD\""'

run_test "Transform: lowercase" \
    '{"operation":"transform","action":"lowercase","text":"HELLO WORLD"}' \
    0 \
    'jq -e ".success == true and .result.result == \"hello world\""'

run_test "Transform: reverse" \
    '{"operation":"transform","action":"reverse","text":"hello"}' \
    0 \
    'jq -e ".success == true and .result.result == \"olleh\""'

run_test "Transform: wordcount" \
    '{"operation":"transform","action":"wordcount","text":"one two three four five"}' \
    0 \
    'jq -e ".success == true and .result.result == 5"'

run_test "Transform: wordcount empty" \
    '{"operation":"transform","action":"wordcount","text":""}' \
    0 \
    'jq -e ".success == true and .result.result == 0"'

run_test "Transform: hash" \
    '{"operation":"transform","action":"hash","text":"test string"}' \
    0 \
    'jq -e ".success == true and (.result.result | type) == \"string\" and (.result.result | length) == 8"'

echo ""

# ==================== DELAY TESTS ====================
echo "--- Delay Operations ---"

run_test "Delay: 1 second" \
    '{"operation":"delay","seconds":1,"message":"Quick test"}' \
    0 \
    'jq -e ".success == true and .result.delayedSeconds == 1"'

echo ""

# ==================== FAIL TESTS ====================
echo "--- Failure Handling ---"

run_test "Fail: intentional error" \
    '{"operation":"fail","errorMessage":"Test error"}' \
    1 \
    'jq -e ".success == false"'

run_test "Fail: custom exit code" \
    '{"operation":"fail","errorMessage":"Custom exit","exitCode":42}' \
    42 \
    'jq -e ".success == false"'

echo ""

# ==================== ERROR HANDLING ====================
echo "--- Error Handling ---"

run_test "Unknown operation" \
    '{"operation":"unknown_op"}' \
    1 \
    'jq -e ".success == false"'

run_test "Invalid JSON input" \
    'not valid json' \
    1 \
    'jq -e ".success == false"'

run_test "Empty input" \
    '{}' \
    1 \
    'jq -e ".success == false"'

echo ""

# ==================== METADATA TESTS ====================
echo "--- Output Metadata ---"

output=$(docker run --rm -e 'TASK_INPUT={"operation":"echo","data":"test"}' -e "TASK_ID=metadata-test" "$IMAGE" 2>/dev/null)

echo -n "Testing: Output contains taskId... "
if echo "$output" | jq -e '.taskId == "metadata-test"' > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: Output contains executionTimeMs... "
if echo "$output" | jq -e '.executionTimeMs >= 0' > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: Output contains processedAt timestamp... "
if echo "$output" | jq -e '.processedAt != null' > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: Output contains metadata... "
if echo "$output" | jq -e '.metadata.nodeVersion != null' > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo ""
echo "============================================================"
echo -e "  Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "============================================================"
echo ""

if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0
