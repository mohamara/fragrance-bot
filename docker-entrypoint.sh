#!/bin/sh
set -e

# Fix permissions for data directory
# If running as root, fix permissions and switch to nodejs
# If already running as nodejs, just ensure directory is writable
if [ -d "/app/data" ]; then
    if [ "$(id -u)" = "0" ]; then
        # Running as root - fix permissions and switch user
        chmod -R 755 /app/data 2>/dev/null || true
        chown -R nodejs:nodejs /app/data 2>/dev/null || true
        exec su-exec nodejs "$@"
    else
        # Already running as non-root - just ensure writable
        chmod -R 755 /app/data 2>/dev/null || true
        exec "$@"
    fi
else
    # Directory doesn't exist, create it
    if [ "$(id -u)" = "0" ]; then
        mkdir -p /app/data
        chmod -R 755 /app/data
        chown -R nodejs:nodejs /app/data
        exec su-exec nodejs "$@"
    else
        mkdir -p /app/data
        chmod -R 755 /app/data
        exec "$@"
    fi
fi

