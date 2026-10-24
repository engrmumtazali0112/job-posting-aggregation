"""Skill matching between a job post and an applicant's profile (rule based, no external AI service).

How it works
  1. Both texts are scanned for known skills (SKILLS below, with spelling variants: "React.js" = "react").
  2. job_terms   = skills found in the job title + description
     applicant   = skills listed on the profile (strong) + skills mentioned in the summary / experience (weaker)
  3. score = share of the job's skills the applicant has (listed counts 1.0, mentioned only counts 0.8),
     plus up to 10 points when the applicant's wanted/previous job titles resemble this job's title.
To use a real LLM later, replace match_score() and keep the same return shape.
"""
import re

# canonical name -> spelling variants (the canonical name itself is always included)
SKILLS: dict[str, list[str]] = {
    "python": [], "java": [], "javascript": ["js", "ecmascript", "es6"], "typescript": ["ts"], "c++": ["cpp"], "c#": ["csharp"],
    ".net": ["dotnet", "asp.net"], "php": [], "ruby": [], "golang": ["go lang"], "rust": [], "kotlin": [], "swift": [], "dart": [],
    "solidity": [], "sql": [], "html": ["html5"], "css": ["css3"], "bash": ["shell scripting"],
    "react": ["reactjs", "react.js", "react js"], "next.js": ["nextjs", "next js"], "vue": ["vuejs", "vue.js"], "angular": ["angularjs"],
    "svelte": [], "redux": [], "tailwind": ["tailwindcss"], "bootstrap": [], "jquery": [],
    "node": ["nodejs", "node.js", "node js"], "express": ["expressjs", "express.js"], "nestjs": ["nest.js"],
    "django": [], "flask": [], "fastapi": ["fast api"], "spring": ["spring boot", "springboot"], "laravel": [], "rails": ["ruby on rails"],
    "flutter": [], "react native": ["react-native"], "android": [], "ios": [],
    "postgresql": ["postgres", "psql"], "mysql": [], "mongodb": ["mongo"], "redis": [], "sqlite": [], "firebase": [], "elasticsearch": [],
    "graphql": [], "rest": ["restful", "rest api", "rest apis"], "websocket": ["websockets"], "microservices": ["microservice"],
    "aws": ["amazon web services"], "azure": [], "gcp": ["google cloud"], "docker": ["containerization"], "kubernetes": ["k8s"],
    "terraform": [], "ansible": [], "jenkins": [], "ci/cd": ["cicd", "ci cd"], "linux": [], "git": ["github", "gitlab"], "nginx": [],
    "machine learning": ["ml"], "deep learning": [], "nlp": ["natural language processing"], "llm": ["llms", "large language models"],
    "rag": [], "pytorch": [], "tensorflow": [], "pandas": [], "numpy": [], "scikit-learn": ["sklearn"], "opencv": [],
    "chatbot": ["chatbots"], "data analysis": ["data analytics"], "data science": [], "power bi": ["powerbi"], "tableau": [], "excel": [],
    "web3": [], "blockchain": [], "stripe": [], "rbac": [], "agile": ["scrum"], "jira": [], "figma": [], "ui/ux": ["ux", "ui design"],
    "photoshop": [], "testing": ["qa", "quality assurance"], "selenium": [], "cypress": [], "jest": [], "unit testing": [],
    "seo": [], "digital marketing": [], "social media": [], "content writing": ["copywriting"], "google ads": ["adwords"],
    "accounting": [], "bookkeeping": [], "quickbooks": [], "tax": ["taxation"], "auditing": ["audit"], "sales": [], "customer service": ["customer support"],
    "project management": ["pmp"], "recruitment": ["talent acquisition"], "communication": [], "leadership": [],
}
DISPLAY = {"javascript": "JavaScript", "typescript": "TypeScript", "next.js": "Next.js", "nestjs": "NestJS", "node": "Node.js",
           "fastapi": "FastAPI", "postgresql": "PostgreSQL", "mysql": "MySQL", "mongodb": "MongoDB", "graphql": "GraphQL",
           "aws": "AWS", "gcp": "GCP", "sql": "SQL", "html": "HTML", "css": "CSS", "php": "PHP", "nlp": "NLP", "llm": "LLM",
           "rag": "RAG", "rbac": "RBAC", "seo": "SEO", "ci/cd": "CI/CD", "ui/ux": "UI/UX", "ios": "iOS", "c#": "C#", "c++": "C++",
           ".net": ".NET", "rest": "REST API", "qa": "QA", "pytorch": "PyTorch", "tensorflow": "TensorFlow", "numpy": "NumPy",
           "opencv": "OpenCV", "jquery": "jQuery", "power bi": "Power BI", "web3": "Web3", "quickbooks": "QuickBooks", "react native": "React Native"}

def _pattern(names: list[str]) -> re.Pattern:
    alts = "|".join(re.escape(n) for n in sorted(set(names), key=len, reverse=True))
    return re.compile(r"(?<![\w+#.])(?:" + alts + r")(?![\w+#])", re.I)

_PATTERNS = {canon: _pattern([canon, *alts]) for canon, alts in SKILLS.items()}
_STOP = {"the", "and", "for", "with", "senior", "junior", "lead", "developer", "engineer", "manager", "executive",
         "officer", "assistant", "specialist", "intern", "full", "time", "remote", "stack"}   # too generic to count as a title match


def label(canon: str) -> str:
    return DISPLAY.get(canon) or canon.title()


def find_skills(text: str | None) -> set[str]:
    t = text or ""
    return {c for c, p in _PATTERNS.items() if p.search(t)}


def _words(s: str | None) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", (s or "").lower()) if w not in _STOP}


def match_score(job_title: str, job_description: str, profile) -> dict:
    """profile: a SeekerProfile row or None. Returns score 0-100 and the skills behind it."""
    skills = list(getattr(profile, "skills", None) or [])
    experience = list(getattr(profile, "experience", None) or [])
    wanted = list(getattr(profile, "job_titles", None) or [])
    text_parts = [getattr(profile, "summary", None) or ""] + [f"{e.get('title') or ''} {e.get('description') or ''}" for e in experience]
    listed = set().union(*[find_skills(s) for s in skills]) if skills else set()
    mentioned = find_skills(" ".join(text_parts)) - listed
    job_terms = find_skills(f"{job_title}\n{job_description}")

    if not skills and not mentioned and not wanted:
        return {"scored": False, "score": 0, "level": "none", "matched": [], "missing": [label(t) for t in sorted(job_terms)][:8]}

    matched_listed = job_terms & listed
    matched_text = (job_terms & mentioned)
    matched_raw = []                                   # listed skills we do not know, but the job text contains
    low = f"{job_title} {job_description}".lower()
    for s in skills:
        s2 = s.strip().lower()
        if len(s2) >= 3 and not find_skills(s2) and re.search(r"(?<![\w])" + re.escape(s2) + r"(?![\w])", low):
            matched_raw.append(s.strip())

    if job_terms:
        base = (len(matched_listed) + 0.8 * len(matched_text) + len(matched_raw)) / (len(job_terms) + len(matched_raw))
        score = base * 90
    else:                                              # job names no known skill: use the applicant's own skills as evidence
        hits = len(matched_raw)
        score = min(hits / max(1, min(len(skills), 5)), 1) * 70

    title_words = _words(job_title)
    mine = set().union(*[_words(t) for t in wanted], *[_words(e.get("title")) for e in experience]) if (wanted or experience) else set()
    if title_words and mine:
        score += 10 * min(1.0, len(title_words & mine) / max(1, len(title_words)) * 2)

    score = int(round(min(100, score)))
    matched = [label(t) for t in sorted(matched_listed | matched_text)] + matched_raw
    missing = [label(t) for t in sorted(job_terms - matched_listed - matched_text)]
    return {"scored": True, "score": score, "level": "top" if score >= 70 else "good" if score >= 45 else "low",
            "matched": matched[:10], "missing": missing[:8]}