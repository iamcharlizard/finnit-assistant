#!/bin/sh
set -eu

# Apply pending migrations before starting. Migrations must stay
# backwards-compatible: during a rolling update the previous container keeps
# serving traffic against the migrated schema.
cd /repo/packages/database
./node_modules/.bin/prisma migrate deploy

cd /repo/apps/api
exec node dist/main.js
