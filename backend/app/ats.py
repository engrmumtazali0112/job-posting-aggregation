"""ATS (applicant tracking system) readiness score for a seeker profile, 0-100. Rule based, no external service.

Every check has a weight (the weights add up to 100) and a tip that is shown while the check is not fully met,
e.g. "Add your GitHub link to increase your score by 10%". ats_score() takes the dict returned by
routes_seeker.profile_out().
"""


def _s(v) -> str:
    return str(v or "").strip()


def _words(*parts) -> int:
    return len(" ".join(_s(x) for x in parts).split())


def ats_score(p: dict) -> dict:
    checks: list[dict] = []

    def add(key: str, label: str, points: int, earned: float, tip: str, focus: str) -> None:
        earned = int(round(max(0, min(points, earned))))
        gain = points - earned
        checks.append({"key": key, "label": label, "points": points, "earned": earned, "focus": focus,
                       "tip": tip.format(gain=gain) if gain else None})

    skills = [x for x in (p.get("skills") or []) if _s(x)]
    exp = [e for e in (p.get("experience") or []) if _s(e.get("title"))]
    edu = [e for e in (p.get("education") or []) if _s(e.get("degree"))]
    projects = [x for x in (p.get("projects") or []) if _s(x.get("name"))]
    summary = _s(p.get("summary"))

    # contact details (10)
    add("email", "Email address", 2, 2 if _s(p.get("email")) else 0, "Add an email address to gain {gain}%.", "basics")
    add("phone", "Phone number", 5, 5 if _s(p.get("phone")) else 0, "Add your phone number to increase your score by {gain}%.", "basics")
    add("location", "Location", 3, 3 if _s(p.get("location")) else 0, "Add your city so recruiters can filter by location (+{gain}%).", "basics")

    # links = proof of work (22)
    add("github", "GitHub link", 10, 10 if _s(p.get("github_url")) else 0, "Add your GitHub link to increase your score by {gain}%.", "links")
    add("linkedin", "LinkedIn link", 8, 8 if _s(p.get("linkedin_url")) else 0, "Add your LinkedIn link to increase your score by {gain}%.", "links")
    add("portfolio", "Portfolio / website link", 4, 4 if _s(p.get("portfolio_url")) else 0, "Add a portfolio or personal website link to gain {gain}%.", "links")

    # summary (10)
    n = len(summary)
    add("summary", "Professional summary", 10, 10 if n >= 250 else 7 if n >= 120 else 4 if n >= 50 else 0,
        "Write a 2-4 sentence summary (about 250+ characters) to gain {gain}%.", "summary")

    # skills = the keywords an ATS searches for (12)
    add("skills", "Skills / keywords", 12, 12 * min(len(skills), 10) / 10,
        f"Add more relevant skills (you have {len(skills)}, aim for 10+) to gain " + "{gain}%.", "skills")

    # experience (16)
    complete = [e for e in exp if _s(e.get("company")) and _s(e.get("start"))]
    entries = 8 if len(complete) >= 2 else 5 if len(complete) == 1 else 2 if exp else 0
    add("experience", "Work experience entries", 8, entries,
        "Add your work experience with job title, company and dates (+{gain}%).", "experience")
    detailed = [e for e in exp if len(_s(e.get("description"))) >= 80]
    add("experience_detail", "Experience descriptions", 4, 4 * len(detailed) / len(exp) if exp else 0,
        "Describe what you did in each role (80+ characters each) to gain {gain}%.", "experience")
    has_numbers = any(any(ch.isdigit() for ch in _s(e.get("description"))) for e in exp)
    add("experience_metrics", "Measurable results", 4, 4 if has_numbers else 0,
        "Add numbers to your experience (%, users, revenue, team size) to gain {gain}%.", "experience")

    # education (6)
    add("education", "Education", 6, 6 if edu else 0, "Add your education to increase your score by {gain}%.", "education")

    # projects = evidence of real work (10)
    good = [x for x in projects if len(_s(x.get("description"))) >= 40 and (x.get("tech_stack") or [])]
    add("projects", "Projects with tech stack", 10, 10 if len(good) >= 2 else 5 if len(good) == 1 else 2 if projects else 0,
        "Add 2 projects, each with a description and tech stack, to gain {gain}%.", "projects")

    # length: ATS and recruiters ignore very thin profiles (6)
    words = _words(summary, " ".join(_s(x) for x in skills),
                   " ".join(f"{_s(e.get('title'))} {_s(e.get('company'))} {_s(e.get('description'))}" for e in exp),
                   " ".join(f"{_s(x.get('name'))} {_s(x.get('description'))}" for x in projects),
                   " ".join(_s(e.get("degree")) for e in edu))
    add("length", "Enough detail", 6, 6 * min(words, 250) / 250,
        f"Your profile is short ({words} words). Aim for 250+ words in total to gain " + "{gain}%.", "summary")

    # target job titles (4) and extras (4)
    add("titles", "Target job titles", 4, 4 if p.get("job_titles") else 0, "Add the job titles you want (+{gain}%).", "titles")
    add("certifications", "Certifications", 2, 2 if p.get("certifications") else 0, "Add a certification or license to gain {gain}%.", "certifications")
    add("languages", "Languages", 2, 2 if p.get("languages") else 0, "Add the languages you speak to gain {gain}%.", "languages")

    score = sum(c["earned"] for c in checks)
    grade = "Excellent" if score >= 80 else "Good" if score >= 60 else "Fair" if score >= 40 else "Needs work"
    tips = sorted(({"key": c["key"], "text": c["tip"], "gain": c["points"] - c["earned"], "focus": c["focus"]}
                   for c in checks if c["tip"]), key=lambda t: -t["gain"])
    return {"score": score, "grade": grade, "checks": checks, "tips": tips[:6]}
