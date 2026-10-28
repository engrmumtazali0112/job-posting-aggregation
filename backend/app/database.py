from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

url = settings.database_url
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql+psycopg://", 1)
elif url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)

if url.startswith("sqlite"):
    args = {"check_same_thread": False}
else:
    # connect_timeout = seconds libpq waits for the server to answer. Neon's free tier suspends after inactivity and can take
    # several seconds to wake up; without this the first connection can hang or die with "Socket is not connected".
    args = {"prepare_threshold": None, "connect_timeout": 30}

engine = create_engine(
    url,
    connect_args=args,
    pool_pre_ping=True,     # test a pooled connection before using it; replaces it if Neon closed it while idle
    pool_recycle=300,       # never reuse a connection older than 5 minutes (Neon drops idle ones)
    pool_timeout=30,        # max seconds to wait for a free connection from the pool
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
