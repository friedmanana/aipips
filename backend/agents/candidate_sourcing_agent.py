from __future__ import annotations

import json
import re

from duckduckgo_search import DDGS
from strands import Agent, tool


@tool
def search_linkedin_profiles(
    job_title: str,
    skills: list[str],
    location: str = "New Zealand",
    max_results: int = 10,
) -> list[dict]:
    """Search for LinkedIn profiles matching a job title and skills using DuckDuckGo X-Ray search."""
    skills_query = " ".join(f'"{s}"' for s in skills[:4])
    query = f'site:linkedin.com/in/ "{job_title}" "{location}" {skills_query}'

    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_results):
            name, title = _parse_linkedin_title(r.get("title", ""))
            location_hint = _extract_location_hint(r.get("body", ""))
            results.append(
                {
                    "name": name,
                    "title": title,
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                    "location_hint": location_hint,
                }
            )

    return results


@tool
def refine_candidate_search(
    job_description: str,
    existing_results: list[dict],
) -> list[dict]:
    """Run a second targeted DuckDuckGo X-Ray search using specific skills from the JD, deduplicating against existing results."""
    existing_urls = {r.get("url", "") for r in existing_results}

    skills = _extract_skills_from_text(job_description)
    if not skills:
        return []

    refined_query = f'site:linkedin.com/in/ "New Zealand" {" ".join(skills[:5])}'

    new_results = []
    with DDGS() as ddgs:
        for r in ddgs.text(refined_query, max_results=10):
            url = r.get("href", "")
            if url in existing_urls:
                continue
            name, title = _parse_linkedin_title(r.get("title", ""))
            location_hint = _extract_location_hint(r.get("body", ""))
            new_results.append(
                {
                    "name": name,
                    "title": title,
                    "url": url,
                    "snippet": r.get("body", ""),
                    "location_hint": location_hint,
                }
            )
            existing_urls.add(url)

    return new_results


@tool
def score_candidate_from_snippet(
    candidate_snippet: dict,
    job_requirements: dict,
) -> dict:
    """Use the LLM to score a candidate based on their LinkedIn snippet against job requirements.

    Returns name, url, estimated_match_score (0-100), reasoning, and recommended_action.
    """
    prompt = f"""You are a NZ public sector recruitment specialist. Score this candidate against the job requirements.

Candidate:
Name: {candidate_snippet.get('name', 'Unknown')}
Title: {candidate_snippet.get('title', 'Unknown')}
LinkedIn: {candidate_snippet.get('url', '')}
Snippet: {candidate_snippet.get('snippet', '')}
Location hint: {candidate_snippet.get('location_hint', '')}

Job Requirements:
{json.dumps(job_requirements, indent=2)}

Respond with a JSON object containing:
- estimated_match_score: integer 0-100
- reasoning: 2-3 sentence assessment referencing NZ public sector fit
- recommended_action: one of SHORTLIST, REVIEW, or SKIP

JSON only, no other text."""

    scoring_agent = Agent(
        system_prompt="You are a NZ public sector recruitment specialist. Return only valid JSON."
    )
    response = scoring_agent(prompt)
    response_text = str(response)

    try:
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            scored = json.loads(json_match.group())
        else:
            scored = {
                "estimated_match_score": 0,
                "reasoning": "Unable to parse scoring response.",
                "recommended_action": "REVIEW",
            }
    except (json.JSONDecodeError, AttributeError):
        scored = {
            "estimated_match_score": 0,
            "reasoning": "Unable to parse scoring response.",
            "recommended_action": "REVIEW",
        }

    return {
        "name": candidate_snippet.get("name", "Unknown"),
        "url": candidate_snippet.get("url", ""),
        "estimated_match_score": scored.get("estimated_match_score", 0),
        "reasoning": scored.get("reasoning", ""),
        "recommended_action": scored.get("recommended_action", "REVIEW"),
    }


def _parse_linkedin_title(raw_title: str) -> tuple[str, str]:
    """Parse 'Name - Title - Company | LinkedIn' into (name, title)."""
    cleaned = re.sub(r"\s*\|.*$", "", raw_title).strip()
    parts = [p.strip() for p in cleaned.split(" - ")]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return cleaned, ""


def _extract_location_hint(snippet: str) -> str:
    nz_cities = [
        "Wellington", "Auckland", "Christchurch", "Hamilton", "Tauranga",
        "Dunedin", "Palmerston North", "Nelson", "Rotorua", "New Plymouth",
        "Napier", "Hastings", "Invercargill", "Whangarei", "New Zealand",
    ]
    for city in nz_cities:
        if city.lower() in snippet.lower():
            return city
    return ""


def _extract_skills_from_text(text: str) -> list[str]:
    common_skills = [
        "policy analysis", "project management", "stakeholder engagement",
        "agile", "PRINCE2", "PMP", "cloud", "Azure", "AWS", "data analysis",
        "clinical governance", "workforce development", "budget management",
        "change management", "procurement", "Treaty of Waitangi",
    ]
    found = []
    text_lower = text.lower()
    for skill in common_skills:
        if skill.lower() in text_lower:
            found.append(f'"{skill}"')
    return found


candidate_sourcing_agent = Agent(
    system_prompt="""You are an expert NZ public sector recruitment specialist with deep knowledge of:

- New Zealand government structure including central government agencies (e.g. MBIE, MSD, Treasury, DPMC, MfE, NZTA), Crown entities, DHBs/Te Whatu Ora, and local authorities (Auckland Council, Wellington City Council, Christchurch City Council)
- Te Tiriti o Waitangi and its implications for public sector employment, including the Crown's obligations and what genuine bicultural capability looks like in practice
- NZ public sector competency frameworks including the Leadership Success Profile and SFIA for ICT roles
- The Wellington, Auckland, and Christchurch labour markets for professional and technical roles
- NZ-specific employment platforms: Seek NZ, Trade Me Jobs, LinkedIn, and government job boards (careers.govt.nz, smartjobs.nz)
- NZ public sector values: integrity, accountability, stewardship, transparency, and service to New Zealanders
- Tikanga Māori, te ao Māori, and kaupapa Māori principles as they apply to public sector recruitment
- Salary bands and remuneration norms for NZ public sector roles at different levels
- The importance of community connection and local knowledge in regional NZ roles

When sourcing candidates:
1. Always consider cultural capability alongside technical skills — Te Tiriti commitment is non-negotiable in NZ public sector
2. Look for evidence of public sector values even in private sector candidates
3. Prioritise candidates with NZ experience and understanding of the NZ context
4. Consider transferability of skills from adjacent sectors (health, education, not-for-profit, iwi organisations)
5. Be mindful of equity — actively look for Māori, Pasifika, and diverse candidates
6. Assess whether candidates understand NZ-specific frameworks (Whānau Ora, Enabling Good Lives, etc.) where relevant

Use the available tools systematically: start with a broad LinkedIn X-Ray search, refine with targeted skill searches, then score each candidate against the specific role requirements.""",
    tools=[search_linkedin_profiles, refine_candidate_search, score_candidate_from_snippet],
)


def _score_platform_candidate(candidate: dict, job_requirements: dict) -> dict:
    """Score an internal platform candidate using their actual CV text."""
    cv_preview = candidate.get("cv_text", "")[:2500]

    prompt = f"""You are a recruitment specialist. Score this candidate against the job requirements.
You have their actual CV — use it for an accurate assessment.

Candidate:
Name: {candidate.get('full_name', 'Unknown')}
Target/Current Title: {candidate.get('current_title', 'Not specified')}

CV:
{cv_preview}

Job Requirements:
{json.dumps(job_requirements, indent=2)}

Respond with a JSON object:
- estimated_match_score: integer 0-100
- reasoning: 2-3 sentence assessment of fit for this specific role
- recommended_action: SHORTLIST, REVIEW, or SKIP
- extracted_skills: list of up to 10 relevant skills found in the CV
- years_experience: estimated years of relevant experience (integer)

JSON only, no other text."""

    scoring_agent = Agent(
        system_prompt="You are a recruitment specialist. Return only valid JSON."
    )
    response_text = str(scoring_agent(prompt))

    try:
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        scored = json.loads(json_match.group()) if json_match else {}
    except (json.JSONDecodeError, AttributeError):
        scored = {}

    return {
        "profile_id": candidate.get("profile_id", ""),
        "name": candidate.get("full_name", "Unknown"),
        "email": candidate.get("email", ""),
        "current_title": candidate.get("current_title", ""),
        "cv_text": candidate.get("cv_text", ""),
        "source": "PLATFORM",
        "url": "",
        "estimated_match_score": scored.get("estimated_match_score", 50),
        "reasoning": scored.get("reasoning", "Platform member — manual review recommended."),
        "recommended_action": scored.get("recommended_action", "REVIEW"),
        "extracted_skills": scored.get("extracted_skills", []),
        "years_experience": scored.get("years_experience", 0),
    }


def run_sourcing(job: dict) -> dict:
    """Source and score candidates from both external (LinkedIn) and internal (platform) sources."""
    job_title = job.get("title", "")
    required_skills = job.get("required_skills", [])
    location = job.get("location", "New Zealand")
    organisation = job.get("organisation", "")

    job_requirements = {
        "title": job_title,
        "organisation": organisation,
        "location": location,
        "required_skills": required_skills,
        "preferred_skills": job.get("preferred_skills", []),
        "qualifications": job.get("qualifications", []),
        "competencies": job.get("competencies", []),
        "years_experience_context": job.get("overview", ""),
    }

    # ------------------------------------------------------------------ #
    # 1. External sourcing — LinkedIn X-Ray via DuckDuckGo                #
    # ------------------------------------------------------------------ #
    initial_results = search_linkedin_profiles(
        job_title=job_title,
        skills=required_skills,
        location=location,
        max_results=10,
    )

    job_description_text = (
        f"{job_title} at {organisation}. "
        f"Required skills: {', '.join(required_skills)}. "
        f"Preferred skills: {', '.join(job.get('preferred_skills', []))}."
    )
    refined_results = refine_candidate_search(
        job_description=job_description_text,
        existing_results=initial_results,
    )

    external_candidates = initial_results + refined_results
    external_scored: list[dict] = []
    for candidate in external_candidates:
        if not candidate.get("url"):
            continue
        score = score_candidate_from_snippet(
            candidate_snippet=candidate,
            job_requirements=job_requirements,
        )
        score["source"] = "LINKEDIN_XRAY"
        external_scored.append(score)

    # ------------------------------------------------------------------ #
    # 2. Internal sourcing — AI Pips platform job seekers with CVs        #
    # ------------------------------------------------------------------ #
    internal_scored: list[dict] = []
    try:
        from services.database import get_platform_candidates_with_cvs
        platform_candidates = get_platform_candidates_with_cvs()
        print(f"[sourcing] platform candidates from DB: {len(platform_candidates)}")
        for candidate in platform_candidates:
            try:
                score = _score_platform_candidate(candidate, job_requirements)
            except Exception as score_err:
                print(f"[sourcing] scoring failed for {candidate.get('full_name')}: {score_err}")
                # Still include candidate with a default score if AI scoring fails
                score = {
                    "profile_id": candidate.get("profile_id", ""),
                    "name": candidate.get("full_name", "Unknown"),
                    "email": candidate.get("email", ""),
                    "current_title": candidate.get("current_title", ""),
                    "cv_text": candidate.get("cv_text", ""),
                    "source": "PLATFORM",
                    "url": "",
                    "estimated_match_score": 50,
                    "reasoning": "AI scoring unavailable — manual review recommended.",
                    "recommended_action": "REVIEW",
                    "extracted_skills": [],
                    "years_experience": 0,
                }
            if score.get("recommended_action") != "SKIP":
                internal_scored.append(score)
    except Exception as db_err:
        print(f"[sourcing] platform sourcing DB error: {db_err}")  # visible in Render logs

    # ------------------------------------------------------------------ #
    # 3. Merge, sort, split                                               #
    # ------------------------------------------------------------------ #
    all_scored = internal_scored + external_scored  # platform candidates first
    all_scored.sort(key=lambda x: x.get("estimated_match_score", 0), reverse=True)

    shortlisted = [c for c in all_scored if c.get("recommended_action") == "SHORTLIST"]
    for_review = [c for c in all_scored if c.get("recommended_action") == "REVIEW"]

    return {
        "job_title": job_title,
        "organisation": organisation,
        "total_found": len(external_candidates) + len(internal_scored),
        "total_scored": len(all_scored),
        "total_platform": len(internal_scored),
        "total_external": len(external_scored),
        "shortlisted": shortlisted,
        "for_review": for_review,
        "all_scored": all_scored,
    }
