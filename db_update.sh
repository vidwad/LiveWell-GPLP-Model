#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# LiveWell GPLP Model — Database Update Script
# ═══════════════════════════════════════════════════════════════════════
# Run this after pulling the latest code to bring your database up to
# date with all schema changes from the validation/fix session.
#
# Usage:
#   cd LiveWell-GPLP-Model/backend
#   chmod +x ../db_update.sh
#   bash ../db_update.sh
#
# For PostgreSQL (production), set DATABASE_URL in your .env first.
# For SQLite (development), the script auto-detects livingwell_dev.db.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

cd "$BACKEND_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  LiveWell GPLP Model — Database Update"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── Step 0: Detect database type ──────────────────────────────────────
if [ -f ".env" ]; then
    DB_URL=$(grep -E "^DATABASE_URL=" .env | cut -d'=' -f2- || true)
fi

if [[ "${DB_URL:-}" == *"postgresql"* ]] || [[ "${DB_URL:-}" == *"postgres"* ]]; then
    DB_TYPE="postgresql"
    echo "  Database: PostgreSQL"
elif [[ "${DB_URL:-}" == *"mysql"* ]]; then
    DB_TYPE="mysql"
    echo "  Database: MySQL"
else
    DB_TYPE="sqlite"
    echo "  Database: SQLite (livingwell_dev.db)"
fi

echo ""

# ── Step 1: Run Alembic migrations (001 → 007) ───────────────────────
echo "Step 1: Running Alembic migrations..."
echo "  Target: revision 007 (latest)"

# Check current alembic version
CURRENT_VERSION=$(PYTHONPATH=. python3 -c "
from app.db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
try:
    result = db.execute(text('SELECT version_num FROM alembic_version'))
    row = result.fetchone()
    print(row[0] if row else 'none')
except:
    print('none')
finally:
    db.close()
" 2>/dev/null || echo "none")

echo "  Current version: $CURRENT_VERSION"

if [ "$CURRENT_VERSION" = "007" ]; then
    echo "  ✓ Already at latest migration (007). Skipping."
elif [ "$CURRENT_VERSION" = "none" ]; then
    echo "  No alembic version found. Running all migrations from scratch..."
    PYTHONPATH=. alembic upgrade head
    echo "  ✓ All migrations applied."
else
    echo "  Upgrading from $CURRENT_VERSION to 007..."
    PYTHONPATH=. alembic upgrade head
    echo "  ✓ Migrations applied."
fi

echo ""

# ── Step 2: Add columns not yet in Alembic migrations ────────────────
# These columns exist in models.py but were added manually during
# the validation session. A future migration (008) should formalize them.
echo "Step 2: Adding columns not yet covered by Alembic migrations..."

if [ "$DB_TYPE" = "sqlite" ]; then
    # SQLite: use ALTER TABLE (no IF NOT EXISTS for columns)
    python3 -c "
import sqlite3, sys

db_path = 'livingwell_dev.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

changes = []

# ── users table: google_calendar columns ──
c.execute('PRAGMA table_info(users)')
user_cols = {row[1] for row in c.fetchall()}

if 'google_calendar_connected' not in user_cols:
    c.execute('ALTER TABLE users ADD COLUMN google_calendar_connected BOOLEAN DEFAULT 0')
    changes.append('users.google_calendar_connected')

if 'google_calendar_email' not in user_cols:
    c.execute('ALTER TABLE users ADD COLUMN google_calendar_email VARCHAR(256)')
    changes.append('users.google_calendar_email')

# ── debt_facilities table: lender_fee_amount ──
c.execute('PRAGMA table_info(debt_facilities)')
debt_cols = {row[1] for row in c.fetchall()}

if 'lender_fee_amount' not in debt_cols:
    c.execute('ALTER TABLE debt_facilities ADD COLUMN lender_fee_amount NUMERIC(15, 2)')
    changes.append('debt_facilities.lender_fee_amount')

conn.commit()
conn.close()

if changes:
    for ch in changes:
        print(f'  + Added: {ch}')
else:
    print('  ✓ All columns already exist. Skipping.')
"

elif [ "$DB_TYPE" = "postgresql" ]; then
    # PostgreSQL: use IF NOT EXISTS (available in PG 9.6+)
    PYTHONPATH=. python3 -c "
from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    changes = []

    # users.google_calendar_connected
    result = conn.execute(text(\"\"\"
        SELECT column_name FROM information_schema.columns
        WHERE table_name='users' AND column_name='google_calendar_connected'
    \"\"\"))
    if not result.fetchone():
        conn.execute(text('ALTER TABLE users ADD COLUMN google_calendar_connected BOOLEAN DEFAULT FALSE'))
        changes.append('users.google_calendar_connected')

    # users.google_calendar_email
    result = conn.execute(text(\"\"\"
        SELECT column_name FROM information_schema.columns
        WHERE table_name='users' AND column_name='google_calendar_email'
    \"\"\"))
    if not result.fetchone():
        conn.execute(text('ALTER TABLE users ADD COLUMN google_calendar_email VARCHAR(256)'))
        changes.append('users.google_calendar_email')

    # debt_facilities.lender_fee_amount
    result = conn.execute(text(\"\"\"
        SELECT column_name FROM information_schema.columns
        WHERE table_name='debt_facilities' AND column_name='lender_fee_amount'
    \"\"\"))
    if not result.fetchone():
        conn.execute(text('ALTER TABLE debt_facilities ADD COLUMN lender_fee_amount NUMERIC(15, 2)'))
        changes.append('debt_facilities.lender_fee_amount')

    conn.commit()

    if changes:
        for ch in changes:
            print(f'  + Added: {ch}')
    else:
        print('  ✓ All columns already exist. Skipping.')
"
fi

echo ""

# ── Step 3: Verify final schema ──────────────────────────────────────
echo "Step 3: Verifying final schema..."

PYTHONPATH=. python3 -c "
from app.db.session import engine
from sqlalchemy import inspect

inspector = inspect(engine)
tables = inspector.get_table_names()

# Key tables that must exist
required_tables = [
    'users', 'properties', 'units', 'beds', 'debt_facilities',
    'development_plans', 'ancillary_revenue_streams',
    'operating_expense_line_items', 'alembic_version'
]

missing = [t for t in required_tables if t not in tables]
if missing:
    print(f'  ✗ MISSING TABLES: {missing}')
    exit(1)
else:
    print(f'  ✓ All {len(required_tables)} required tables present.')

# Key columns that must exist on debt_facilities
debt_cols = {c['name'] for c in inspector.get_columns('debt_facilities')}
required_debt_cols = [
    'is_cmhc_insured', 'cmhc_program', 'compounding_method',
    'lender_fee_pct', 'capitalized_fees', 'lender_fee_amount',
    'replaces_debt_id', 'development_plan_id'
]
missing_debt = [c for c in required_debt_cols if c not in debt_cols]
if missing_debt:
    print(f'  ✗ MISSING DEBT COLUMNS: {missing_debt}')
    exit(1)
else:
    print(f'  ✓ All CMHC/debt columns present.')

# Key columns on users
user_cols = {c['name'] for c in inspector.get_columns('users')}
required_user_cols = ['google_calendar_connected', 'google_calendar_email']
missing_user = [c for c in required_user_cols if c not in user_cols]
if missing_user:
    print(f'  ✗ MISSING USER COLUMNS: {missing_user}')
    exit(1)
else:
    print(f'  ✓ All user columns present.')

print(f'  ✓ Total tables in database: {len(tables)}')
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ Database update complete!"
echo "═══════════════════════════════════════════════════════════════"
