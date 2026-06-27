#!/bin/bash
set -e

# ============================================================
# Cricket Auction Helper — Data Refresh Script
# Downloads latest Cricsheet data and runs the ETL pipeline.
# ============================================================

# cd to the directory where this script lives (data/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  Cricket Auction Helper — Data Refresh"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# 1. Verify required Python scripts exist
# ------------------------------------------------------------------
echo "[1/5] Checking required files..."

REQUIRED_SCRIPTS=("download_cricsheet.py" "etl_cricsheet.py")
OPTIONAL_SCRIPTS=("seed_venues.py")

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
        echo "ERROR: Required script '$script' not found in $SCRIPT_DIR"
        exit 1
    fi
    echo "  Found: $script"
done

for script in "${OPTIONAL_SCRIPTS[@]}"; do
    if [ -f "$SCRIPT_DIR/$script" ]; then
        echo "  Found: $script (optional)"
    fi
done

if [ ! -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo "WARNING: requirements.txt not found. Proceeding without pip install."
fi

echo ""

# ------------------------------------------------------------------
# 2. Check Python 3 availability
# ------------------------------------------------------------------
echo "[2/5] Checking Python 3..."

PYTHON=""
if command -v python3 &>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    # Verify it's Python 3
    PY_VERSION=$(python --version 2>&1)
    if echo "$PY_VERSION" | grep -q "Python 3"; then
        PYTHON="python"
    fi
fi

if [ -z "$PYTHON" ]; then
    echo "ERROR: Python 3 is required but not found."
    echo "  Install it from https://www.python.org/downloads/"
    exit 1
fi

PY_VERSION=$($PYTHON --version 2>&1)
echo "  Using: $PY_VERSION ($PYTHON)"
echo ""

# ------------------------------------------------------------------
# 3. Create virtual environment if needed and install dependencies
# ------------------------------------------------------------------
echo "[3/5] Setting up virtual environment..."

VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "  Creating virtual environment at $VENV_DIR..."
    $PYTHON -m venv "$VENV_DIR"
    echo "  Virtual environment created."
else
    echo "  Virtual environment already exists."
fi

# Activate venv
source "$VENV_DIR/bin/activate"
echo "  Activated: $(which python)"

# Install requirements if the file exists
if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo "  Installing dependencies from requirements.txt..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$SCRIPT_DIR/requirements.txt"
    echo "  Dependencies installed."
fi

echo ""

# ------------------------------------------------------------------
# 4. Download latest Cricsheet data
# ------------------------------------------------------------------
echo "[4/5] Downloading Cricsheet archives (T20I, IPL)..."
echo "  Source: https://cricsheet.org/downloads/"
echo ""

python "$SCRIPT_DIR/download_cricsheet.py"

echo ""

# ------------------------------------------------------------------
# 5. Run ETL pipeline
# ------------------------------------------------------------------
echo "[5/5] Running ETL pipeline..."
echo ""

python "$SCRIPT_DIR/etl_cricsheet.py"

echo ""

# ------------------------------------------------------------------
# Optional: Seed venue pitch data
# ------------------------------------------------------------------
if [ -f "$SCRIPT_DIR/seed_venues.py" ]; then
    echo "[Bonus] Seeding venue pitch characteristics..."
    python "$SCRIPT_DIR/seed_venues.py"
    echo ""
fi

# ------------------------------------------------------------------
# Done
# ------------------------------------------------------------------
echo "============================================================"
echo "  Data refresh complete!  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
