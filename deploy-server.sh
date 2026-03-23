#!/usr/bin/env bash
set -e

cd server
npx tsc
sudo systemctl restart macros-api

echo "Server deployed."
