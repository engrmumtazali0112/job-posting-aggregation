from fastapi import HTTPException

@app.get("/api/jobs", response_model=list[JobOut])
def list_jobs(q: str = "", location: str = "", source: str = "",
              limit: int = 12, offset: int = 0, db: Session = Depends(get_db)):
    stmt = select(Job).where(Job.status == "published").order_by(Job.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company_name.ilike(like), Job.description.ilike(like)))
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location}%"))
    if source in ("aggregated", "employer"):
        stmt = stmt.where(Job.source_type == source)
    return db.scalars(stmt.limit(min(limit, 50)).offset(offset)).all()

@app.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(404, "Job not found")
    return job