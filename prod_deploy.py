"""Production deployment script — runs migrations on DigitalOcean droplet."""
import paramiko
import time

HOST = "165.22.226.72"
USER = "root"
PASS = "AshNatIsyJac1+k"
PROJECT = "/root/LiveWell-GPLP-Model"

def run(ssh, cmd, label=""):
    if label:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"{'='*60}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out)
    if err.strip():
        print(err)
    return out, err

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

run(ssh, f"cd {PROJECT} && git log --oneline -1", "Current commit")
run(ssh, f"cd {PROJECT} && docker compose ps --format 'table {{{{.Name}}}}\t{{{{.Status}}}}'", "Container status")

# Step 1: Create new tables
run(ssh, f"cd {PROJECT} && docker compose exec -T backend python -c 'from app.db.session import engine; from app.db.base import Base; from app.db import models; Base.metadata.create_all(bind=engine); print(\"Tables created/verified\")'", "Create new tables")

# Step 2: Add missing columns to development_plans via a script file
migrate_script = """
from app.db.session import engine
from sqlalchemy import text, inspect
with engine.connect() as conn:
    existing = {c['name'] for c in inspect(engine).get_columns('development_plans')}
    new_cols = [
        ('exit_sale_year','INTEGER'),('exit_noi','NUMERIC(16,2)'),
        ('exit_cap_rate','NUMERIC(5,2)'),('exit_sale_price','NUMERIC(16,2)'),
        ('exit_selling_cost_pct','NUMERIC(5,2) DEFAULT 5.0'),
        ('exit_mortgage_prepayment_pct','NUMERIC(5,2)'),
        ('exit_net_proceeds','NUMERIC(16,2)'),('exit_irr','NUMERIC(8,4)'),
        ('exit_equity_multiple','NUMERIC(8,4)'),
        ('hold_period_after_stabilization_months','INTEGER'),
        ('lease_up_months','INTEGER'),('construction_duration_months','INTEGER'),
    ]
    added = []
    for col_name, col_type in new_cols:
        if col_name not in existing:
            conn.execute(text(f'ALTER TABLE development_plans ADD COLUMN {col_name} {col_type}'))
            added.append(col_name)
    conn.commit()
    print(f'Added {len(added)} columns: {added}')
"""

# Write migration script to server, then execute inside container
sftp = ssh.open_sftp()
with sftp.file(f"{PROJECT}/backend/app/_migrate_exit.py", "w") as f:
    f.write(migrate_script)
sftp.close()

run(ssh, f"cd {PROJECT} && docker compose exec -T backend python app/_migrate_exit.py", "Add exit columns to development_plans")
run(ssh, f"rm {PROJECT}/backend/app/_migrate_exit.py", "Cleanup temp script")

# Step 3: Verify tables
verify_script = """
from app.db.session import engine
from sqlalchemy import inspect
inspector = inspect(engine)
for t in ['acquisition_baselines','exit_forecasts','exit_actuals']:
    exists = t in inspector.get_table_names()
    cols = len(inspector.get_columns(t)) if exists else 0
    print(f'  {t}: exists={exists}, columns={cols}')
dp_cols = [c['name'] for c in inspector.get_columns('development_plans') if 'exit' in c['name']]
print(f'  development_plans exit columns: {len(dp_cols)} -> {dp_cols}')
"""
sftp = ssh.open_sftp()
with sftp.file(f"{PROJECT}/backend/app/_verify.py", "w") as f:
    f.write(verify_script)
sftp.close()

run(ssh, f"cd {PROJECT} && docker compose exec -T backend python app/_verify.py", "Verify database")
run(ssh, f"rm {PROJECT}/backend/app/_verify.py", "")

# Step 4: Check endpoints
run(ssh, "curl -s -o /dev/null -w 'Backend: %{http_code}' http://localhost:8000/api/auth/me && echo '' && curl -s -o /dev/null -w 'Frontend: %{http_code}' http://localhost:3000 && echo ''", "Health check")

# Step 5: Check backend logs for errors
run(ssh, f"cd {PROJECT} && docker compose logs --tail=10 backend 2>&1 | grep -i error || echo 'No errors in backend logs'", "Backend errors")

ssh.close()
print("\n" + "="*60)
print("  PRODUCTION DEPLOYMENT COMPLETE")
print("="*60)
