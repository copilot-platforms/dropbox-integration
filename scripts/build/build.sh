#!/usr/bin/env bash
set -Eeuo pipefail

echo "👷 Running build script for environment: ${VERCEL_ENV:-local}"

# Validate that all required environment variables are set for environment
pnpm ex scripts/build/validateEnv.ts
echo "\n🎉 Environment variables are valid\n"
echo "--------------------------------------------"

# Apply database migrations
pnpm drizzle-kit migrate
echo "\n🎉 Database migrations applied\n"
echo "--------------------------------------------"

# Build the project with turbopack
pnpm next build --turbopack
echo "\n🎊 Project built successfully!\n"
echo "--------------------------------------------"