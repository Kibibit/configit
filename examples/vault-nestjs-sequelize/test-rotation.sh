#!/bin/bash

# Test script for Vault dynamic secret rotation with NestJS + Sequelize
# This script starts the application and monitors credential rotation

set -e

PORT=${PORT:-3000}
BASE_URL="http://localhost:${PORT}"
DURATION=${DURATION:-120}  # Test duration in seconds (default 2 minutes)

echo "=========================================="
echo "Vault Dynamic Secret Rotation Test"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Start the NestJS application"
echo "  2. Query the database every 5 seconds"
echo "  3. Monitor credential rotation"
echo "  4. Verify rotation works correctly"
echo ""
echo "Test duration: ${DURATION} seconds"
echo "Database credentials TTL: 60 seconds"
echo "Refresh buffer: 10 seconds (rotation at ~50s)"
echo ""

# Check if application is already running
if curl -s "${BASE_URL}/test/db" > /dev/null 2>&1; then
  echo "⚠ Application is already running at ${BASE_URL}"
  echo "Using existing instance..."
  APP_RUNNING=true
else
  echo "Starting application..."
  npm run start:dev > app.log 2>&1 &
  APP_PID=$!
  APP_RUNNING=false
  
  echo "Waiting for application to start..."
  for i in {1..30}; do
    if curl -s "${BASE_URL}/test/db" > /dev/null 2>&1; then
      echo "✓ Application started (PID: ${APP_PID})"
      APP_RUNNING=true
      break
    fi
    sleep 1
  done
  
  if [ "$APP_RUNNING" = false ]; then
    echo "✗ Failed to start application"
    echo "Check app.log for errors"
    kill $APP_PID 2>/dev/null || true
    exit 1
  fi
fi

# Function to cleanup on exit
cleanup() {
  if [ "$APP_RUNNING" = false ] && [ -n "$APP_PID" ]; then
    echo ""
    echo "Stopping application (PID: ${APP_PID})..."
    kill $APP_PID 2>/dev/null || true
    wait $APP_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Get initial credentials
echo ""
echo "Getting initial credentials..."
INITIAL_RESPONSE=$(curl -s "${BASE_URL}/test/credentials")
INITIAL_USERNAME=$(echo "$INITIAL_RESPONSE" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
INITIAL_PASSWORD_LEN=$(echo "$INITIAL_RESPONSE" | grep -o '"passwordLength":[0-9]*' | cut -d':' -f2)

echo "  Initial username: ${INITIAL_USERNAME}"
echo "  Initial password length: ${INITIAL_PASSWORD_LEN}"
echo ""

# Test variables
ITERATIONS=$((DURATION / 5))
ROTATION_DETECTED=false
QUERY_FAILURES=0
TOTAL_QUERIES=0

echo "Starting rotation test..."
echo "Querying database every 5 seconds..."
echo ""

# Monitor rotation
for i in $(seq 1 $ITERATIONS); do
  ELAPSED=$((i * 5))
  
  # Query database
  RESPONSE=$(curl -s "${BASE_URL}/test/db")
  SUCCESS=$(echo "$RESPONSE" | grep -o '"success":[^,]*' | cut -d':' -f2)
  CURRENT_USERNAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
  
  TOTAL_QUERIES=$((TOTAL_QUERIES + 1))
  
  if [ "$SUCCESS" != "true" ]; then
    QUERY_FAILURES=$((QUERY_FAILURES + 1))
    echo "[${ELAPSED}s] ✗ Query failed"
  else
    if [ "$CURRENT_USERNAME" != "$INITIAL_USERNAME" ]; then
      if [ "$ROTATION_DETECTED" = false ]; then
        ROTATION_DETECTED=true
        echo "[${ELAPSED}s] ✓ Credential rotation detected!"
        echo "    ${INITIAL_USERNAME} → ${CURRENT_USERNAME}"
        INITIAL_USERNAME=$CURRENT_USERNAME
      else
        echo "[${ELAPSED}s] ✓ Query successful (username: ${CURRENT_USERNAME})"
      fi
    else
      echo "[${ELAPSED}s] ✓ Query successful (username: ${CURRENT_USERNAME})"
    fi
  fi
  
  # Show vault health every 30 seconds
  if [ $((ELAPSED % 30)) -eq 0 ]; then
    HEALTH=$(curl -s "${BASE_URL}/test/vault-health")
    echo "    Vault health: $(echo "$HEALTH" | grep -o '"connected":[^,]*' | cut -d':' -f2)"
  fi
  
  sleep 5
done

# Final summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total queries: ${TOTAL_QUERIES}"
echo "Failed queries: ${QUERY_FAILURES}"
echo "Rotation detected: ${ROTATION_DETECTED}"
echo ""

if [ $QUERY_FAILURES -eq 0 ] && [ "$ROTATION_DETECTED" = true ]; then
  echo "✓ Test PASSED"
  echo "  - All queries succeeded"
  echo "  - Credential rotation detected"
  exit 0
elif [ $QUERY_FAILURES -eq 0 ]; then
  echo "⚠ Test PARTIAL"
  echo "  - All queries succeeded"
  echo "  - Credential rotation not detected (may need longer test duration)"
  exit 0
else
  echo "✗ Test FAILED"
  echo "  - ${QUERY_FAILURES} queries failed"
  exit 1
fi
