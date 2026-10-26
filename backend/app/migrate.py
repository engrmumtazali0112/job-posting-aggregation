import sys
from sqlalchemy import inspect, text
from .database import Base, engine
from . import models  # noqa: F401

def literal(v, dialect):
    if isinstance(v, bool):
        if dialect == "postgresql":
            return "TRUE" if v else "FALSE"
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    return None

def missing_column_ddl(verbose=False):
    """ALTER TABLE statements for columns that exist in models.py but not in the database yet."""
    dialect = engine.dialect.name
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    todo = []
    for table in Base.metadata.sorted_tables:
        if table.name not in tables:
            if verbose:
                print("new table:", table.name)
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in have:
                continue
            ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(engine.dialect)}"
            d = col.default.arg if (col.default is not None and col.default.is_scalar) else None
            lit = literal(d, dialect) if d is not None else None
            if lit is not None:
                ddl += f" DEFAULT {lit}"
            todo.append(ddl)
    return todo


def relax_job_alert_user_unique():
    """job_alerts.user_id used to be UNIQUE (one alert per user). Several alerts per user need it to be a plain index.
    Idempotent: does nothing once the unique index / constraint is gone. Returns the statements it ran."""
    insp = inspect(engine)
    if "job_alerts" not in insp.get_table_names():
        return []
    q = engine.dialect.identifier_preparer.quote
    stmts = []
    if engine.dialect.name == "postgresql":
        for uc in insp.get_unique_constraints("job_alerts"):
            if uc["column_names"] == ["user_id"] and uc.get("name"):
                stmts.append(f"ALTER TABLE job_alerts DROP CONSTRAINT {q(uc['name'])}")
                stmts.append("CREATE INDEX IF NOT EXISTS ix_job_alerts_user_id ON job_alerts (user_id)")   # the constraint's own index goes with it
    constraint_backed = {uc.get("name") for uc in insp.get_unique_constraints("job_alerts") if uc["column_names"] == ["user_id"]}
    for ix in insp.get_indexes("job_alerts"):
        if ix.get("unique") and ix["column_names"] == ["user_id"] and ix["name"] not in constraint_backed:
            stmts.append(f"DROP INDEX {q(ix['name'])}")
            stmts.append(f"CREATE INDEX {q(ix['name'])} ON job_alerts (user_id)")
    for s in stmts:
        with engine.begin() as conn:          # one transaction per statement, so one failure cannot abort the rest on PostgreSQL
            conn.execute(text(s))
    return stmts


def add_missing_columns():
    """Quiet and safe: called at every app start, so an update that adds a column never breaks a running site."""
    todo = missing_column_ddl()
    if todo:
        with engine.begin() as conn:
            for ddl in todo:
                conn.execute(text(ddl))
    todo += relax_job_alert_user_unique()
    return todo


def run(dry=False):
    dialect = engine.dialect.name
    todo = missing_column_ddl(verbose=True)
    for ddl in todo:
        print(("would run: " if dry else "running: ") + ddl)
    if dry:
        print("Dry run only. Nothing changed.")
        return
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for ddl in todo:
            conn.execute(text(ddl))
        if dialect == "postgresql":
            # companies can now be unclaimed (created from aggregated jobs)
            conn.execute(text("ALTER TABLE companies ALTER COLUMN user_id DROP NOT NULL"))
    print("Migration finished.", len(todo), "column(s) added.")
    extra = relax_job_alert_user_unique()
    if extra:
        print("job_alerts: allowed several alerts per user:", extra)
    backfill_companies()


def backfill_companies():
    """Create unclaimed company pages for existing aggregated jobs that have none."""
    from sqlalchemy import select
    from .database import SessionLocal
    from .models import Job
    from .services import unclaimed_company
    with SessionLocal() as db:
        jobs = db.scalars(select(Job).where(Job.company_id.is_(None), Job.company_name != "Unknown")).all()
        cache: dict = {}
        for j in jobs:
            j.company_id = unclaimed_company(db, j.company_name, cache).id
        db.commit()
        print("Linked", len(jobs), "job(s) to company pages.")

if __name__ == "__main__":
    run(dry="--dry-run" in sys.argv)