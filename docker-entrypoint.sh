#!/bin/sh
# Start the workspace named by $SERVICE.
#
# A Next.js app runs `next start` from its own directory; a NestJS service runs
# its compiled entrypoint. The runtime stage carries the built workspace, so
# neither branch needs pnpm at run time.
set -e

if [ -z "$SERVICE" ]; then
  echo "SERVICE is not set: pass --build-arg SERVICE=<workspace>" >&2
  exit 1
fi

if [ -d "/app/apps/${SERVICE}" ]; then
  cd "/app/apps/${SERVICE}"
  exec node node_modules/next/dist/bin/next start -p "${PORT:-3000}"
fi

if [ -f "/app/services/${SERVICE}/dist/main.js" ]; then
  exec node "services/${SERVICE}/dist/main.js"
fi

echo "SERVICE='${SERVICE}' has no Next.js app or compiled service entrypoint" >&2
exit 1
