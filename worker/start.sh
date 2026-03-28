#!/bin/bash
# Centric Intake Local Worker — Start Script
# Runs the compute worker that polls Neon for jobs and processes them locally.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f .env ]; then
    echo "Loading .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.11+."
    exit 1
fi

# Check dependencies
if ! python3 -c "import mlx_lm" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip3 install -r requirements.txt
fi

# Check Playwright browsers
if ! python3 -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    echo "Installing Playwright browsers..."
    python3 -m playwright install chromium
fi

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   OneForma Recruitment Intake — Local Worker ║"
echo "  ║                                              ║"
echo "  ║   MLX models on Apple Silicon                ║"
echo "  ║   Polling Neon every ${POLL_INTERVAL_SECONDS:-30}s              ║"
echo "  ║                                              ║"
echo "  ║   Ctrl+C to stop                             ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

python3 main.py
