#!/bin/bash
set -e
echo "$DIFF_INPUT" | npx tsx "$(dirname "$0")/review.ts"
