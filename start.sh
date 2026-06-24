#!/usr/bin/env bash
# start.sh — Render startup script
# 1. Seed the database if it doesn't exist yet
# 2. Launch the production WSGI server (gunicorn)

set -e

echo "==> Running database initialisation..."
python3 db_init.py

echo "==> Starting gunicorn server..."
exec gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
