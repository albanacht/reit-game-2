#!/bin/bash
start=$(date +%s); mkdir -p /tmp/o
for t in "$@"; do
  now=$(date +%s); if [ $((now-start)) -gt 110 ]; then echo "SKIP $t"; continue; fi
  (cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules timeout 150 node "/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/tools/$t.js" /tmp/o > /tmp/o/$t.log 2>&1); ec=$?
  echo "$t exit=$ec pass=$(grep -c ^PASS /tmp/o/$t.log) fail=$(grep -c ^FAIL /tmp/o/$t.log)"
done
