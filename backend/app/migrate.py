from sqlalchemy import inspect, text
from .database import Base, engine
from . import models  # noqa: F401  (registers all tables)

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

def run():
    Base.metadata.create_all(bind=engine)          # creates any brand-new tables
    insp = inspect(engine)
    dialect = engine.dialect.name
    added = 0
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have:
                    continue
                ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(engine.dialect)}"
                d = col.default.arg if (col.default is not None and col.default.is_scalar) else None
                lit = literal(d, dialect) if d is not None else None
                if lit is not None:
                    ddl += f" DEFAULT {lit}"
                conn.execute(text(ddl))
                print("added column:", table.name, col.name)
                added += 1
    print("Migration finished.", added, "column(s) added.")

if __name__ == "__main__":
    run()
