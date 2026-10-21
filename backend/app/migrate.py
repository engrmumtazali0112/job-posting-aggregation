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

def run(dry=False):
    dialect = engine.dialect.name
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    todo = []
    for table in Base.metadata.sorted_tables:
        if table.name not in tables:
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
    for ddl in todo:
        print(("would run: " if dry else "running: ") + ddl)
    if dry:
        print("Dry run only. Nothing changed.")
        return
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for ddl in todo:
            conn.execute(text(ddl))
    print("Migration finished.", len(todo), "column(s) added.")

if __name__ == "__main__":
    run(dry="--dry-run" in sys.argv)
