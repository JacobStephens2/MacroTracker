#!/usr/bin/env bash
set -e

# Build frontend into dist/ (Apache DocumentRoot for fareloch.app
# and the macros.stephens.page alias)
npm run build

echo "Frontend deployed (served from dist/)."
