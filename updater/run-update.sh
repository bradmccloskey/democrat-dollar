#!/bin/bash

# DemocratDollar Updater - Full pipeline
# Runs company update, candidate update, then sends push notification

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
  source .env
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate log filename with timestamp
LOG_FILE="logs/update-$(date +%Y%m%d-%H%M%S).log"

echo "Starting DemocratDollar full update pipeline..."
echo "Log file: $LOG_FILE"

# Step 1: Company update
echo ""
echo "========== STEP 1: Company Pipeline =========="
node src/index.js 2>&1 | tee -a "$LOG_FILE"
COMPANY_EXIT=${PIPESTATUS[0]}

if [ $COMPANY_EXIT -ne 0 ]; then
  echo "Company pipeline failed with exit code $COMPANY_EXIT"
  echo "Continuing to candidate pipeline..."
fi

# Step 2: Candidate update (nationwide)
echo ""
echo "========== STEP 2: Candidate Pipeline =========="
node src/update-candidates.js 2>&1 | tee -a "$LOG_FILE"
CANDIDATE_EXIT=${PIPESTATUS[0]}

if [ $CANDIDATE_EXIT -ne 0 ]; then
  echo "Candidate pipeline failed with exit code $CANDIDATE_EXIT"
fi

# Step 3: Send push notification (if at least one pipeline succeeded)
if [ $COMPANY_EXIT -eq 0 ] || [ $CANDIDATE_EXIT -eq 0 ]; then
  echo ""
  echo "========== STEP 3: Push Notification =========="
  # Approximate counts — notification is best-effort
  COMPANY_COUNT=500
  CANDIDATE_COUNT=2000
  node src/send-notification.js $COMPANY_COUNT $CANDIDATE_COUNT 2>&1 | tee -a "$LOG_FILE"
fi

echo ""
echo "Pipeline complete."
echo "Company exit: $COMPANY_EXIT, Candidate exit: $CANDIDATE_EXIT"
echo "Log file: $LOG_FILE"

# Exit with error if both failed
if [ $COMPANY_EXIT -ne 0 ] && [ $CANDIDATE_EXIT -ne 0 ]; then
  exit 1
fi

exit 0
