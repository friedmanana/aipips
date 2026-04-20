"""
Candidate Sourcing Agent — agentic, Groq-powered.

The agent autonomously decides:
  - Whether to search LinkedIn (external)
  - Whether to fetch platform candidates from the DB (internal)
  - How to score each candidate against the role
  - When it has enough information to return results

It uses Llama 3.3 70B on Groq via the core.agent engine.
"""
from __future__ import annotations

import json
import os
import re

import httpx
from duckduckgo_search import DDGS

from core.agent import agent_tool


# ---------------------------------------------------------------------------
# Tool: Search LinkedIn via DuckDuckGo X-Ray
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Search LinkedIn for candidates matching a job title and skills using DuckDuckGo X-Ray. "
        "Returns a list of candidates with name, title, LinkedIn URL, and snippet."
    ),
    parameters={
        "type": "object",
        "properties": {
            "job_title": {"type": "string", "description": "The job title to search for"},
            "skills":    {"type": "array",  "items": {"type": "string"}, "description": "Key skills to include in search"},
            "location":  {"type": "string", "description": "Location, default 'New Zealand'"},
            "max_results": {"type": "integer", "description": "Max results to return, default 10"},
        },
        "required": ["job_title"],
    },
)
def search_linkedin_profiles(
    job_title: str,
    skills: list[str] | None = None,
    location: str = "New Zealand",
    max_results: int = 10,
) -> list[dict]:
    skills = skills or []
    skills_query = " ".join(f'"{s}"' for s in skills[:4])
    query = f'site:linkedin.com/in/ "{job_title}" "{location}" {skills_query}'
    results = []
    try:
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                name, title = _parse_linkedin_title(r.get("title", ""))
                results.append({
                    "name": name,
                    "title": title,
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                    "location_hint": _extract_location_hint(r.get("body", "")),
                    "source": "LINKEDIN_XRAY",
                })
    except Exception as exc:
        print(f"[sourcing] LinkedIn search error: {exc}")
    print(f"[sourcing] LinkedIn search returned {len(results)} results")
    return results


# ---------------------------------------------------------------------------
# Tool: Fetch platform candidates from the AI Pips database
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Fetch job seekers who have uploaded their CVs to the AI Pips platform. "
        "Returns candidates with their full CV text for scoring. "
        "Always call this — internal candidates are higher quality leads."
    ),
    parameters={
        "type": "object",
        "properties": {},
        "required": [],
    },
)
def get_platform_candidates() -> list[dict]:
    try:
        from services.database import get_platform_candidates_with_cvs
        candidates = get_platform_candidates_with_cvs()
        print(f"[sourcing] platform candidates from DB: {len(candidates)}")
        # Don't send full CV text to the agent context — return summary
        return [
            {
                "profile_id": c.get("profile_id", ""),
                "name": c.get("full_name", "Platform Member"),
                "email": c.get("email", ""),
                "current_title": c.get("current_title", ""),
                "cv_length": len(c.get("cv_text", "")),
                "cv_preview": c.get("cv_text", "")[:500],
                "source": "PLATFORM",
            }
            for c in candidates
        ]
    except Exception as exc:
        print(f"[sourcing] platform DB error: {exc}")
        return []


# ---------------------------------------------------------------------------
# Tool: Score a candidate against job requirements
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Score a candidate against the job requirements using semantic relevance. "
        "Uses skill overlap, transferable experience, and domain fit — not just keyword matching. "
        "Call this for each candidate you want to evaluate."
    ),
    parameters={
        "type": "object",
        "properties": {
            "candidate_name":   {"type": "string"},
            "candidate_title":  {"type": "string"},
            "cv_or_snippet":    {"type": "string", "description": "CV text or LinkedIn snippet"},
            "source":           {"type": "string", "description": "PLATFORM or LINKEDIN_XRAY"},
            "profile_id":       {"type": "string", "description": "Profile ID if PLATFORM source"},
            "email":            {"type": "string"},
            "url":              {"type": "string", "description": "LinkedIn URL if external"},
            "job_title":        {"type": "string"},
            "job_requirements": {"type": "string", "description": "JSON string of job requirements"},
        },
        "required": ["candidate_name", "cv_or_snippet", "job_title", "job_requirements"],
    },
)
def score_candidate(
    candidate_name: str,
    cv_or_snippet: str,
    job_title: str,
    job_requirements: str,
    candidate_title: str = "",
    source: str = "LINKEDIN_XRAY",
    profile_id: str = "",
    email: str = "",
    url: str = "",
) -> dict:
    prompt = f"""Score this candidate against the job requirements using SEMANTIC RELEVANCE.
Consider transferable skills and adjacent experience — not just exact title/keyword matching.

Candidate: {candidate_name}
Title: {candidate_title or 'Not specified'}
Source: {source}

CV / Profile:
{cv_or_snippet[:3000]}

Job: {job_title}
Requirements: {job_requirements[:1500]}

Scoring guide:
- 80-100 → SHORTLIST: Strong skill overlap, clearly can do the job
- 55-79  → REVIEW: Meaningful transferable skills, adjacent experience
- 0-54   → SKIP: Little relevant overlap

Return JSON only:
{{
  "estimated_match_score": <0-100>,
  "reasoning": "<2-3 sentences on specific skill/experience overlap>",
  "recommended_action": "SHORTLIST|REVIEW|SKIP",
  "extracted_skills": ["skill1", "skill2"],
  "years_experience": <integer>
}}"""

    result = _call_groq(prompt)

    try:
        match = re.search(r"\{.*\}", result, re.DOTALL)
        scored = json.loads(match.group()) if match else {}
    except (json.JSONDecodeError, AttributeError):
        scored = {}

    return {
        "name": candidate_name,
        "current_title": candidate_title,
        "source": source,
        "profile_id": profile_id,
        "email": email,
        "url": url,
        "cv_text": cv_or_snippet if source == "PLATFORM" else "",
        "estimated_match_score": scored.get("estimated_match_score", 50),
        "reasoning": scored.get("reasoning", "Scoring unavailable — review manually."),
        "recommended_action": scored.get("recommended_action", "REVIEW"),
        "extracted_skills": scored.get("extracted_skills", []),
        "years_experience": scored.get("years_experience", 0),
    }


# ---------------------------------------------------------------------------
# Public interface — called by the API route
# ---------------------------------------------------------------------------

def run_sourcing(job: dict) -> dict:
    """
    Run the sourcing agent for a job. Returns structured results dict
    compatible with SourcingResponse.
    """
    job_title = job.get("title", "")
    organisation = job.get("organisation", "")

    job_requirements = {
        "title": job_title,
        "organisation": organisation,
        "location": job.get("location", "New Zealand"),
        "required_skills": job.get("required_skills", []),
        "preferred_skills": job.get("preferred_skills", []),
        "qualifications": job.get("qualifications", []),
        "competencies": job.get("competencies", []),
        "overview": job.get("overview", ""),
    }

    print(f"[sourcing] starting agent for: {job_title}")

    # Collect and score candidates directly — calling tool functions without
    # the agent loop avoids duplicate Groq calls and 429 rate-limit errors.
    all_scored = _collect_scored_candidates(job_requirements)

    all_scored.sort(key=lambda x: x.get("estimated_match_score", 0), reverse=True)
    shortlisted = [c for c in all_scored if c.get("recommended_action") == "SHORTLIST"]
    for_review   = [c for c in all_scored if c.get("recommended_action") == "REVIEW"]

    platform_count = sum(1 for c in all_scored if c.get("source") == "PLATFORM")
    external_count = sum(1 for c in all_scored if c.get("source") == "LINKEDIN_XRAY")

    return {
        "job_title": job_title,
        "organisation": organisation,
        "total_found": len(all_scored),
        "total_scored": len(all_scored),
        "total_platform": platform_count,
        "total_external": external_count,
        "shortlisted": shortlisted,
        "for_review": for_review,
        "all_scored": all_scored,
    }


def _collect_scored_candidates(job_requirements: dict) -> list[dict]:
    """
    Run a focused scoring pass: fetch all candidates directly and score them.
    This ensures we always have structured results regardless of how the agent
    chose to present its findings.
    """
    all_scored: list[dict] = []

    # 1. Platform candidates
    try:
        from services.database import get_platform_candidates_with_cvs
        platform_candidates = get_platform_candidates_with_cvs()
        job_req_str = json.dumps(job_requirements)
        for c in platform_candidates:
            # full_name may be empty if the profile wasn't completed —
            # extract name from CV text: find first non-empty, non-header line
            full_name = (c.get("full_name") or "").strip()
            if not full_name and c.get("cv_text"):
                header_keywords = {
                    "curriculum vitae", "cv", "resume", "profile", "summary",
                    "personal statement", "contact", "about me",
                }
                for line in c["cv_text"].strip().split("\n"):
                    line = line.strip()
                    if line and line.lower() not in header_keywords and len(line) < 60:
                        full_name = line
                        break
            candidate_name = full_name or "Platform Member"
            print(f"[sourcing] platform candidate: name={candidate_name!r}, profile_id={c.get('profile_id', '')[:8]}...")
            result = score_candidate.fn(
                candidate_name=candidate_name,
                candidate_title=c.get("current_title", ""),
                cv_or_snippet=c.get("cv_text", ""),
                source="PLATFORM",
                profile_id=c.get("profile_id", ""),
                email=c.get("email", ""),
                url="",
                job_title=job_requirements.get("title", ""),
                job_requirements=job_req_str,
            )
            if result.get("recommended_action") != "SKIP":
                all_scored.append(result)
    except Exception as exc:
        print(f"[sourcing] platform scoring error: {exc}")

    # 2. External candidates via LinkedIn X-Ray
    try:
        linkedin_results = search_linkedin_profiles.fn(
            job_title=job_requirements.get("title", ""),
            skills=job_requirements.get("required_skills", []),
            location=job_requirements.get("location", "New Zealand"),
            max_results=5,
        )
        job_req_str = json.dumps(job_requirements)
        for c in linkedin_results:
            if not c.get("url"):
                continue
            result = score_candidate.fn(
                candidate_name=c.get("name", "Unknown"),
                candidate_title=c.get("title", ""),
                cv_or_snippet=c.get("snippet", ""),
                source="LINKEDIN_XRAY",
                profile_id="",
                email="",
                url=c.get("url", ""),
                job_title=job_requirements.get("title", ""),
                job_requirements=job_req_str,
            )
            all_scored.append(result)
    except Exception as exc:
        print(f"[sourcing] LinkedIn scoring error: {exc}")

    return all_scored


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _call_groq(prompt: str, system: str = "You are a recruitment specialist. Return only valid JSON.") -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    resp = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system",  "content": system},
                {"role": "user",    "content": prompt},
            ],
            "max_tokens": 1024,
            "temperature": 0.2,
        },
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _parse_linkedin_title(raw_title: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s*\|.*$", "", raw_title).strip()
    parts = [p.strip() for p in cleaned.split(" - ")]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return cleaned, ""


def _extract_location_hint(snippet: str) -> str:
    nz_cities = [
        "Wellington", "Auckland", "Christchurch", "Hamilton", "Tauranga",
        "Dunedin", "Palmerston North", "Nelson", "New Zealand",
    ]
    for city in nz_cities:
        if city.lower() in snippet.lower():
            return city
    return ""
