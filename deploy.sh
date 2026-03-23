#!/usr/bin/env bash
set -e

# Build frontend
npm run build

# Copy to web server
sudo cp -r dist/* /var/www/macros.stephens.page/

echo "Frontend deployed."
