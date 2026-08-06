#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS='--max-old-space-size=768' ./node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "Server died, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
