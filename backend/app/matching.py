"""Skill matching between a job post and an applicant's RESUME (rule based, no external AI service).

How it works
  1. The job title + description and the resume text are scanned for known skills (SKILLS below, with
     spelling variants: "React.js" = "react").
  2. score = share of the job's skills that appear in the resume (max 90), plus up to 10 points when the
     words of the job title also appear in the resume.
  3. If the job names no known skill, the most frequent keywords of the job post are compared with the resume instead (max 70).
The profile is NOT used: only what is written in the uploaded resume counts.
To use a real LLM later, replace match_score() and keep the same return shape.
"""
import re
from collections import Counter

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


_COMMON = _STOP | {"with", "that", "this", "will", "have", "from", "your", "they", "their", "about", "work", "working", "team",
                   "experience", "years", "year", "ability", "strong", "skills", "skill", "knowledge", "looking", "should", "including",
                   "must", "also", "well", "good", "role", "company", "candidate", "position", "responsibilities", "requirements",
                   "required", "preferred", "description", "apply", "using", "across", "other", "more", "than", "into", "able", "great",
                   "excellent", "join", "help", "build", "building", "need", "needs", "plus", "such", "like", "make", "ensure", "within"}


def _keywords(text: str, n: int = 25) -> set[str]:
    words = [w for w in re.findall(r"[a-z]{4,}", text.lower()) if w not in _COMMON]
    return {w for w, _ in Counter(words).most_common(n)}


def match_score(job_title: str, job_description: str, resume_text: str | None) -> dict:
    """Score 0-100 of how well the resume text fits the job post."""
    job_text = f"{job_title}\n{job_description}"
    job_terms = find_skills(job_text)
    text = (resume_text or "").strip()
    if not text:
        return {"scored": False, "score": 0, "level": "none", "matched": [], "missing": [label(t) for t in sorted(job_terms)][:8]}

    have = find_skills(text)
    matched = job_terms & have
    if job_terms:
        score = len(matched) / len(job_terms) * 90
    else:                                              # job names no known skill: compare plain keywords
        kw = _keywords(job_text)
        rw = _words(text)
        score = min(70.0, (len(kw & rw) / len(kw) * 100) if kw else 0)
        matched = set()

    tw, rw = _words(job_title), _words(text)
    if tw:
        score += 10 * min(1.0, len(tw & rw) / len(tw) * 2)

    score = int(round(min(100, score)))
    return {"scored": True, "score": score, "level": "top" if score >= 70 else "good" if score >= 45 else "low",
            "matched": [label(t) for t in sorted(matched)][:10],
            "missing": [label(t) for t in sorted(job_terms - matched)][:8]}