import os
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from .database import SessionLocal
from .ingest import run_all


def ingest_job():
    with SessionLocal() as db:
        print("[ingest]", run_all(db))


def start():
    sched = BackgroundScheduler()
    # Set RUN_SCHEDULER=false on extra workers so ingestion only runs once.
    if os.getenv("RUN_SCHEDULER", "true").lower() != "false":
        sched.add_job(ingest_job, "interval", minutes=30, next_run_time=datetime.now())
    sched.start()
    return sched
