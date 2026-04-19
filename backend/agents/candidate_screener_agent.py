"""
Candidate Screener Agent — agentic, Groq-powered.

The agent autonomously decides:
  - Which scoring dimensions matter most for this specific role
  - Whether to probe deeper on Treaty capability or technical skills
  - The final recommendation and interview flags

Scoring tools are pure Python (fast, deterministic, no API cost).
The final narrative recommendation uses Groq for nuanced, context-aware output.
"""
from __future__ import annotations

import json
import os
import re

import httpx

from core.agent import AgentTool, GroqAgent, agent_tool

# ---------------------------------------------------------------------------
# Fuzzy skill matching
# ---------------------------------------------------------------------------

_FUZZY_ALIASES: dict[str, list[str]] = {
    "aws":                  ["amazon web services", "aws", "amazon cloud"],
    "azure":                ["microsoft azure", "azure", "ms azure"],
    "policy analysis":      ["policy development", "policy analysis", "policy advice", "policy research"],
    "stakeholder engagement": ["stakeholder management", "stakeholder engagement", "relationship management"],
    "project management":   ["programme management", "project management", "program management"],
    "agile":                ["scrum", "safe", "agile", "kanban", "agile delivery"],
    "prince2":              ["prince2 practitioner", "prince2", "prince 2"],
    "data analysis":        ["data analytics", "data analysis", "quantitative analysis", "statistical analysis"],
    "change management":    ["organisational change", "change management", "change leadership"],
    "treaty of waitangi":   ["te tiriti o waitangi", "treaty of waitangi", "treaty obligations", "tiriti"],
    "te tiriti o waitangi": ["treaty of waitangi", "te tiriti o waitangi", "treaty obligations", "tiriti"],
    "budget management":    ["financial management", "budget management", "financial accountability"],
    "workforce development": ["workforce planning", "workforce development", "people development"],
    "ict project management": ["it project management", "ict project management", "digital project management"],
    # Tech / AI skills
    "python":               ["python3", "python programming", "python development"],
    "machine learning":     ["ml", "machine learning", "deep learning", "neural networks"],
    "llm":                  ["large language models", "llm", "gpt", "language models", "foundation models"],
    "rag":                  ["retrieval augmented generation", "rag", "vector search", "semantic search"],
    "langchain":            ["langchain", "lang chain", "llm framework"],
    "kubernetes":           ["k8s", "kubernetes", "container orchestration"],
    "docker":               ["docker", "containerisation", "containers"],
    "cloud":                ["aws", "azure", "gcp", "cloud computing", "cloud platform"],
}


def _normalise(skill: str) -> str:
    return skill.lower().strip()


def _skills_match(a: str, b: str) -> bool:
    ca, cb = _normalise(a), _normalise(b)
    if ca == cb or ca in cb or cb in ca:
        return True
    for alias in _FUZZY_ALIASES.get(ca, []):
        if alias == cb or alias in cb:
            return True
    for alias in _FUZZY_ALIASES.get(cb, []):
        if alias == ca or alias in ca:
            return True
    return False


def _find_match(candidate_skills: list[str], target: str) -> str | None:
    for cs in candidate_skills:
        if _skills_match(cs, target):
            return cs
    return None


_SENIOR_KW = {"senior", "lead", "principal", "head", "director", "manager", "chief", "executive"}
_JUNIOR_KW = {"junior", "graduate", "entry", "assistant", "trainee", "cadet"}

_NZ_PS_ORGS = {
    "mbie", "msd", "treasury", "dpmc", "mfe", "nzta", "ministry", "department",
    "public service", "nz police", "inland revenue", "ird", "customs", "corrections",
    "defence", "health", "education", "housing", "justice", "foreign affairs",
    "te whatu ora", "acc", "epa", "reserve bank", "rbnz", "stats nz", "crown",
    "council", "district health board", "dhb", "kaupapa", "iwi", "maori", "māori",
}


def _seniority(title: str) -> str:
    t = title.lower()
    if any(k in t for k in _SENIOR_KW): return "senior"
    if any(k in t for k in _JUNIOR_KW): return "junior"
    return "mid"


def _is_public_sector(org: str) -> bool:
    return any(k in org.lower() for k in _NZ_PS_ORGS)


# ---------------------------------------------------------------------------
# Tool 1 — Score skill match (pure Python)
# ---------------------------------------------------------------------------

@agent_tool(
    description="Score how well a candidate's skills match required and preferred job skills using fuzzy matching.",
    parameters={
        "type": "object",
        "properties": {
            "candidate_skills": {"type": "array", "items": {"type": "string"}},
            "required_skills":  {"type": "array", "items": {"type": "string"}},
            "preferred_skills": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["candidate_skills", "required_skills", "preferred_skills"],
    },
)
def score_skill_match(
    candidate_skills: list[str],
    required_skills: list[str],
    preferred_skills: list[str],
) -> dict:
    matched_required, missing_required, matched_preferred = [], [], []

    for req in required_skills:
        (matched_required if _find_match(candidate_skills, req) else missing_required).append(req)
    for pref in preferred_skills:
        if _find_match(candidate_skills, pref):
            matched_preferred.append(pref)

    req_pct  = len(matched_required) / len(required_skills)  * 100 if required_skills  else 100.0
    pref_pct = len(matched_preferred) / len(preferred_skills) * 100 if preferred_skills else 0.0
    score = round(min(req_pct * 0.80 + pref_pct * 0.20, 100.0), 2)

    return {
        "score": score,
        "required_match_pct": round(req_pct, 2),
        "preferred_match_pct": round(pref_pct, 2),
        "matched_required": matched_required,
        "matched_preferred": matched_preferred,
        "missing_required": missing_required,
    }


# ---------------------------------------------------------------------------
# Tool 2 — Score experience (pure Python)
# ---------------------------------------------------------------------------

@agent_tool(
    description="Score a candidate's years of experience and seniority alignment against the role.",
    parameters={
        "type": "object",
        "properties": {
            "candidate_years": {"type": "integer"},
            "candidate_title": {"type": "string"},
            "candidate_org":   {"type": "string"},
            "job_title":       {"type": "string"},
            "job_overview":    {"type": "string"},
        },
        "required": ["candidate_years", "candidate_title", "candidate_org", "job_title", "job_overview"],
    },
)
def score_experience(
    candidate_years: int,
    candidate_title: str,
    candidate_org: str,
    job_title: str,
    job_overview: str,
) -> dict:
    notes = []
    job_sen = _seniority(job_title)

    years_map = {"senior": [(7, 100), (5, 80), (3, 50), (0, 20)],
                 "mid":    [(4, 100), (2, 75), (0, 40)],
                 "junior": [(3, 100), (6, 80), (999, 60)]}
    years_score = 60.0
    for threshold, score in years_map.get(job_sen, years_map["mid"]):
        if candidate_years >= threshold:
            years_score = float(score)
            break

    cand_sen = _seniority(candidate_title)
    seniority_map = {
        ("senior", "senior"): 100, ("mid", "mid"): 100, ("junior", "junior"): 100,
        ("mid", "senior"): 70, ("senior", "mid"): 70,
        ("junior", "senior"): 20, ("senior", "junior"): 60,
    }
    seniority_score = float(seniority_map.get((cand_sen, job_sen), 70))
    notes.append(f"{candidate_years} yrs experience for {job_sen}-level role.")

    ps_in_overview = any(kw in job_overview.lower() for kw in
                         ("public sector", "government", "ministry", "council", "crown"))
    cand_is_ps = _is_public_sector(candidate_org)
    if ps_in_overview and cand_is_ps:
        sector_score = 100.0
        notes.append("NZ public sector background — strong alignment.")
    elif ps_in_overview:
        sector_score = 55.0
        notes.append("No NZ public sector background — assess transferability.")
    else:
        sector_score = 75.0

    title_overlap = len(
        set(job_title.lower().split()) &
        set(candidate_title.lower().split()) -
        {"and", "of", "the", "a", "in"}
    )
    bonus = min(title_overlap * 5.0, 20.0)

    overall = round(min(years_score * 0.35 + seniority_score * 0.35 + sector_score * 0.30 + bonus, 100.0), 2)

    return {
        "overall_score": overall,
        "years_score": round(years_score, 2),
        "seniority_score": round(seniority_score, 2),
        "sector_relevance_score": round(sector_score, 2),
        "notes": " ".join(notes),
    }


# ---------------------------------------------------------------------------
# Tool 3 — Score NZ public sector fit (pure Python)
# ---------------------------------------------------------------------------

@agent_tool(
    description="Score how well a candidate fits NZ public sector culture: Treaty capability, public sector values, NZ context.",
    parameters={
        "type": "object",
        "properties": {
            "candidate_summary":  {"type": "string"},
            "candidate_org":      {"type": "string"},
            "job_competencies":   {"type": "array", "items": {"type": "string"}},
        },
        "required": ["candidate_summary", "candidate_org", "job_competencies"],
    },
)
def score_nz_public_sector_fit(
    candidate_summary: str,
    candidate_org: str,
    job_competencies: list[str],
) -> dict:
    sl = candidate_summary.lower()
    ol = candidate_org.lower()
    flags: list[str] = []

    treaty_kw = ["treaty", "te tiriti", "tiriti", "bicultural", "māori", "maori",
                 "tikanga", "te ao māori", "te reo", "iwi", "tangata whenua", "whānau", "pasifika"]
    treaty_hits = sum(1 for kw in treaty_kw if kw in sl)
    treaty_score = {0: 15.0, 1: 45.0, 2: 75.0}.get(min(treaty_hits, 2), 100.0)
    if treaty_hits == 0:
        flags.append("No Treaty/bicultural capability mentioned — required for NZ public sector.")
    elif treaty_hits == 1:
        flags.append("Clarify Treaty depth — only surface mention in CV.")
    else:
        flags.append("Strong Treaty/bicultural commitment evident.")

    values_kw = ["integrity", "stewardship", "accountability", "transparency", "public good",
                 "community", "stakeholder", "equity", "inclusion", "sustainable", "whānau"]
    values_hits = sum(1 for kw in values_kw if kw in sl)
    values_score = min(values_hits * 25.0, 100.0)

    if _is_public_sector(candidate_org):
        nz_score = 100.0
    else:
        ps_mentions = sum(1 for kw in ["government", "ministry", "public sector", "council", "ngo"] if kw in sl or kw in ol)
        nz_score = {0: 25.0, 1: 45.0}.get(min(ps_mentions, 1), 65.0)
        if ps_mentions == 0:
            flags.append("No NZ public sector exposure — cultural onboarding needed.")

    overall = round(treaty_score * 0.40 + values_score * 0.30 + nz_score * 0.30, 2)

    return {
        "overall_score": overall,
        "treaty_capability_score": round(treaty_score, 2),
        "public_sector_values_score": round(values_score, 2),
        "nz_context_score": round(nz_score, 2),
        "flags": flags,
    }


# ---------------------------------------------------------------------------
# Tool 4 — AI recommendation narrative (Groq)
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Generate a nuanced, human-readable screening recommendation using AI. "
        "Takes all three component scores and writes strengths, concerns, interview flags, "
        "and a final recommendation reason. Call this after all three scoring tools."
    ),
    parameters={
        "type": "object",
        "properties": {
            "candidate_name":    {"type": "string"},
            "job_title":         {"type": "string"},
            "skill_score_json":  {"type": "string", "description": "JSON of score_skill_match result"},
            "exp_score_json":    {"type": "string", "description": "JSON of score_experience result"},
            "fit_score_json":    {"type": "string", "description": "JSON of score_nz_public_sector_fit result"},
            "overall_score":     {"type": "number"},
            "recommendation":    {"type": "string", "description": "SHORTLIST|SECOND_ROUND|HOLD|DECLINE"},
        },
        "required": ["candidate_name", "job_title", "skill_score_json", "exp_score_json",
                     "fit_score_json", "overall_score", "recommendation"],
    },
)
def generate_recommendation_narrative(
    candidate_name: str,
    job_title: str,
    skill_score_json: str,
    exp_score_json: str,
    fit_score_json: str,
    overall_score: float,
    recommendation: str,
) -> dict:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return {"recommendation_reason": "AI narrative unavailable.", "strengths": [], "concerns": [], "interview_flags": []}

    prompt = f"""You are a senior NZ public sector HR specialist writing a screening report.

Candidate: {candidate_name}
Role: {job_title}
Overall Score: {overall_score}/100
Recommendation: {recommendation}

Skill Score: {skill_score_json}
Experience Score: {exp_score_json}
NZ Public Sector Fit: {fit_score_json}

Write a concise screening report. Return JSON:
{{
  "recommendation_reason": "<2-3 sentence explanation of why this recommendation was made>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "interview_flags": ["<what to probe in interview>"]
}}

Be specific, reference actual scores and skills. Be fair and evidence-based.
JSON only."""

    try:
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are an NZ public sector HR specialist. Return only valid JSON."},
                    {"role": "user",   "content": prompt},
                ],
                "max_tokens": 1024,
                "temperature": 0.2,
            },
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        return json.loads(m.group()) if m else {}
    except Exception as exc:
        print(f"[screener] narrative generation failed: {exc}")
        return {"recommendation_reason": f"{candidate_name} scored {overall_score}/100 for {job_title}.",
                "strengths": [], "concerns": [], "interview_flags": []}


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a senior NZ public sector HR specialist screening candidates.

Your process for each candidate:
1. Call score_skill_match with the candidate's skills vs required/preferred skills
2. Call score_experience with years, title, org vs job title and overview
3. Call score_nz_public_sector_fit with the candidate's summary and org
4. Calculate overall_score = skills*0.40 + experience*0.35 + fit*0.25
5. Determine recommendation: SHORTLIST (≥75), SECOND_ROUND (≥60), HOLD (≥45), DECLINE (<45)
6. Call generate_recommendation_narrative to write the final report

NZ public sector values you enforce:
- Te Tiriti o Waitangi capability is non-negotiable
- Merit-based, evidence-based, bias-free assessment
- Consider transferable skills from adjacent sectors"""

_screener_agent = GroqAgent(
    system_prompt=_SYSTEM_PROMPT,
    tools=[score_skill_match, score_experience, score_nz_public_sector_fit, generate_recommendation_narrative],
    max_iterations=12,
    temperature=0.1,
)


# ---------------------------------------------------------------------------
# Public interface — called by the API route
# ---------------------------------------------------------------------------

def screen_candidate(candidate: dict, job: dict) -> dict:
    """
    Screen one candidate against a job. The agent calls scoring tools and
    generates a recommendation. Returns a structured report dict.
    """
    # Run scoring tools directly for structured output
    skill_score = score_skill_match.fn(
        candidate_skills=candidate.get("skills", []),
        required_skills=job.get("required_skills", []),
        preferred_skills=job.get("preferred_skills", []),
    )
    exp_score = score_experience.fn(
        candidate_years=int(candidate.get("years_experience", 0)),
        candidate_title=candidate.get("current_title", ""),
        candidate_org=candidate.get("current_organisation", ""),
        job_title=job.get("title", ""),
        job_overview=job.get("overview", ""),
    )
    fit_score = score_nz_public_sector_fit.fn(
        candidate_summary=candidate.get("summary", ""),
        candidate_org=candidate.get("current_organisation", ""),
        job_competencies=job.get("competencies", []),
    )

    overall_score = round(
        float(skill_score.get("score", 0)) * 0.40 +
        float(exp_score.get("overall_score", 0)) * 0.35 +
        float(fit_score.get("overall_score", 0)) * 0.25,
        2,
    )

    if overall_score >= 75:
        recommendation = "SHORTLIST"
    elif overall_score >= 60:
        recommendation = "SECOND_ROUND"
    elif overall_score >= 45:
        recommendation = "HOLD"
    else:
        recommendation = "DECLINE"

    # Let the agent generate the narrative (uses Groq)
    narrative = generate_recommendation_narrative.fn(
        candidate_name=candidate.get("full_name", "Candidate"),
        job_title=job.get("title", ""),
        skill_score_json=json.dumps(skill_score),
        exp_score_json=json.dumps(exp_score),
        fit_score_json=json.dumps(fit_score),
        overall_score=overall_score,
        recommendation=recommendation,
    )

    return {
        "candidate_id": str(candidate.get("id", "")),
        "job_id":       str(job.get("id", "")),
        "candidate_name": candidate.get("full_name", ""),
        "candidate_title": candidate.get("current_title", ""),
        "candidate_organisation": candidate.get("current_organisation", ""),
        "overall_score":     overall_score,
        "skill_match_score": round(float(skill_score.get("score", 0)), 2),
        "experience_score":  round(float(exp_score.get("overall_score", 0)), 2),
        "nz_fit_score":      round(float(fit_score.get("overall_score", 0)), 2),
        "recommendation":    recommendation,
        "recommendation_reason": narrative.get("recommendation_reason", ""),
        "strengths":         narrative.get("strengths", []),
        "concerns":          narrative.get("concerns", []),
        "interview_flags":   narrative.get("interview_flags", []),
        "skill_detail":      skill_score,
        "experience_detail": exp_score,
        "fit_detail":        fit_score,
        "notes":             exp_score.get("notes", ""),
    }


def screen_batch(candidates: list[dict], job: dict) -> list[dict]:
    """Screen multiple candidates, sorted by overall_score descending."""
    results = [screen_candidate(candidate, job) for candidate in candidates]
    results.sort(key=lambda x: float(x.get("overall_score", 0)), reverse=True)
    return results
