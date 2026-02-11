#!/bin/bash

# DemocratDollar Updater - Run script
# This script runs the FEC data pipeline and logs output

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
  source .env
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate log filename with timestamp
LOG_FILE="logs/update-$(date +%Y%m%d-%H%M%S).log"

echo "Starting DemocratDollar FEC data pipeline..."
echo "Log file: $LOG_FILE"

# Run the updater and tee output to both console and log file
node src/index.js 2>&1 | tee -a "$LOG_FILE"

# Capture exit code
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -eq 0 ]; then
  echo "Update completed successfully!"
else
  echo "Update failed with exit code $EXIT_CODE"
  echo "Check log file for details: $LOG_FILE"
fi

exit $EXIT_CODE
