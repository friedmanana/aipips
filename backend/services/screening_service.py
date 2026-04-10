from __future__ import annotations

import json

from agents.candidate_screener_agent import screen_batch
from agents.candidate_sourcing_agent import run_sourcing

# ---------------------------------------------------------------------------
# Job analyst import — guarded so the service degrades gracefully if the
# job_analyst_agent module has not yet been created.
# ---------------------------------------------------------------------------

try:
    from agents.job_analyst_agent import analyse_job as _analyse_job  # type: ignore[import]

    def _run_analyse_job(raw_jd_text: str) -> dict:
        return _analyse_job(raw_jd_text)

except ImportError:

    def _run_analyse_job(raw_jd_text: str) -> dict:  # type: ignore[misc]
        """Fallback: return a minimal structured JD from raw text."""
        return {
            "title": "Unknown Role",
            "organisation": "Unknown Organisation",
            "department": "",
            "location": "New Zealand",
            "salary_band": "",
            "employment_type": "permanent",
            "overview": raw_jd_text,
            "responsibilities": [],
            "required_skills": [],
            "preferred_skills": [],
            "qualifications": [],
            "competencies": [],
        }


# ---------------------------------------------------------------------------
# CV parsing helper
# ---------------------------------------------------------------------------

def _parse_cv_text(cv_text: str, index: int = 0) -> dict:
    """Extract a minimal candidate dict from plain CV text.

    This is a lightweight heuristic parser — in production this would call
    an LLM-based extraction agent.
    """
    lines = [ln.strip() for ln in cv_text.strip().splitlines() if ln.strip()]

    # Attempt to extract a name from the first non-empty line
    full_name = lines[0] if lines else f"Candidate {index + 1}"

    # Look for a current title / role
    current_title = ""
    for line in lines[1:6]:
        if any(kw in line.lower() for kw in ("analyst", "manager", "director", "officer", "advisor", "specialist", "lead", "consultant")):
            current_title = line
            break
    if not current_title and len(lines) > 1:
        current_title = lines[1]

    # Extract skills — capture lines under a SKILLS/COMPETENCIES heading AND
    # bullet/comma lists elsewhere in the CV.
    skills: list[str] = []
    _skill_section = False
    _skill_headings = ("skill", "competenc", "expertise", "proficienc", "technical")
    _stop_headings = ("experience", "education", "qualification", "employment",
                      "responsibility", "responsibilit", "overview", "summary",
                      "reference", "award", "certification")
    for line in lines:
        lower = line.lower().rstrip(":")
        # Detect start of a skills section
        if any(h in lower for h in _skill_headings) and len(line) < 60:
            _skill_section = True
            continue
        # Detect end of skills section (new major heading)
        if _skill_section and any(h in lower for h in _stop_headings) and len(line) < 60:
            _skill_section = False
        # Collect items inside the skills section or bullet/comma items anywhere
        if _skill_section and line.startswith(("•", "-", "*", "·")):
            skills.append(line.lstrip("•-*· ").strip())
        elif _skill_section and "," in line:
            # No length limit inside a dedicated skills section
            skills.extend(p.strip() for p in line.split(",") if p.strip())
        elif not _skill_section:
            if "," in line and len(line) < 200:
                parts = [p.strip() for p in line.split(",") if p.strip()]
                if len(parts) >= 2:
                    skills.extend(parts)
            elif line.startswith(("•", "-", "*", "·")):
                skills.append(line.lstrip("•-*· ").strip())

    # Years of experience — look for patterns like "X years"
    import re
    years_experience = 0
    for line in lines:
        match = re.search(r"(\d+)\s+year", line, re.IGNORECASE)
        if match:
            years_experience = int(match.group(1))
            break

    # Organisation — prefer lines with known public sector / org keywords,
    # but exclude generic location lines like "Location: Wellington, New Zealand".
    current_organisation = ""
    _org_keywords = ("ministry", "department", "council", "limited", "ltd", "mbie", "treasury",
                     "health", "education", "justice", "defence", "corrections", "inland revenue",
                     "te whatu", "acc ", "nzta", "crown", "authority", "commission", "office of")
    for line in lines:
        lower = line.lower()
        if any(kw in lower for kw in _org_keywords) and not lower.startswith(("location", "address", "email", "phone")):
            current_organisation = line
            break

    # Email — extract first email address found in CV
    email = ""
    for line in lines:
        email_match = re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", line, re.IGNORECASE)
        if email_match:
            email = email_match.group(0).lower()
            break

    # Summary — concatenate the first 500 characters of meaningful content so that
    # treaty/bicultural keywords spread across multiple sentences are all captured.
    summary_parts: list[str] = []
    summary_len = 0
    for line in lines:
        if len(line) > 30 and summary_len < 500:
            summary_parts.append(line)
            summary_len += len(line)
            if summary_len >= 500:
                break
    summary = " ".join(summary_parts)[:600]

    return {
        "full_name": full_name,
        "current_title": current_title or "Unknown",
        "current_organisation": current_organisation or "Unknown",
        "location": "New Zealand",
        "years_experience": years_experience,
        "skills": list(dict.fromkeys(skills)),  # deduplicate preserving order
        "qualifications": [],
        "email": email,
        "summary": summary or cv_text[:300],
        "raw_cv_text": cv_text,
    }


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------


def run_full_pipeline(raw_jd_text: str) -> dict:
    """Full recruitment pipeline.

    Steps:
    1. Analyse job description → structured JobDescription dict
    2. Source candidates from LinkedIn X-Ray
    3. Screen all sourced candidates
    4. Return ranked shortlist with full reports

    Returns:
        {
            "job": dict,
            "validation": dict,
            "total_sourced": int,
            "shortlisted": list[dict],
            "second_round": list[dict],
            "all_screened": list[dict],
        }
    """
    # Step 1: Analyse JD
    # _analyse_job returns {"job_description": {...}, "validation": {...}, "enriched": bool}
    # Extract the flat job dict from the nested result.
    analyse_result = _run_analyse_job(raw_jd_text)
    if isinstance(analyse_result, dict) and "job_description" in analyse_result:
        job = analyse_result["job_description"]
    else:
        job = analyse_result  # fallback: already a flat dict
    validation = _validate_jd(job)

    # Step 2: Source candidates
    sourcing_result = run_sourcing(job)
    sourced_candidates = sourcing_result.get("all_scored", [])

    # Convert sourced candidate snippets into minimal candidate dicts for screening.
    # The sourcing agent returns dicts with keys: name, url, estimated_match_score,
    # reasoning, recommended_action.  We build a screening-compatible dict from them.
    candidate_dicts: list[dict] = []
    for sourced in sourced_candidates:
        candidate_dicts.append(
            {
                "full_name": sourced.get("name", "Unknown"),
                "current_title": sourced.get("title", ""),
                "current_organisation": "",
                "location": sourced.get("location_hint", "New Zealand"),
                "years_experience": 0,
                "skills": [],
                "qualifications": [],
                "summary": sourced.get("snippet", sourced.get("reasoning", "")),
                "linkedin_url": sourced.get("url", ""),
            }
        )

    # Step 3: Screen all candidates
    all_screened = screen_batch(candidate_dicts, job) if candidate_dicts else []

    # Step 4: Partition by recommendation
    shortlisted = [c for c in all_screened if c.get("recommendation") == "SHORTLIST"]
    second_round = [c for c in all_screened if c.get("recommendation") == "SECOND_ROUND"]

    return {
        "job": job,
        "validation": validation,
        "total_sourced": len(sourced_candidates),
        "shortlisted": shortlisted,
        "second_round": second_round,
        "all_screened": all_screened,
    }


# ---------------------------------------------------------------------------
# Uploaded CV pipeline
# ---------------------------------------------------------------------------


def screen_uploaded_candidates(candidates_text: list[str], raw_jd_text: str) -> dict:
    """Screen candidates who have uploaded their CVs directly (no sourcing step).

    Args:
        candidates_text: List of raw CV text strings, one per candidate.
        raw_jd_text: Raw job description text.

    Returns:
        {
            "job": dict,
            "validation": dict,
            "total_submitted": int,
            "shortlisted": list[dict],
            "second_round": list[dict],
            "all_screened": list[dict],
        }
    """
    # Analyse JD
    analyse_result = _run_analyse_job(raw_jd_text)
    if isinstance(analyse_result, dict) and "job_description" in analyse_result:
        job = analyse_result["job_description"]
    else:
        job = analyse_result
    validation = _validate_jd(job)

    # Parse each CV
    parsed_candidates = [_parse_cv_text(cv, idx) for idx, cv in enumerate(candidates_text)]

    # Screen
    all_screened = screen_batch(parsed_candidates, job) if parsed_candidates else []

    shortlisted = [c for c in all_screened if c.get("recommendation") == "SHORTLIST"]
    second_round = [c for c in all_screened if c.get("recommendation") == "SECOND_ROUND"]

    return {
        "job": job,
        "validation": validation,
        "total_submitted": len(candidates_text),
        "shortlisted": shortlisted,
        "second_round": second_round,
        "all_screened": all_screened,
    }


# ---------------------------------------------------------------------------
# JD validation helper
# ---------------------------------------------------------------------------


def _validate_jd(job: dict) -> dict:
    """Check a structured JD dict for completeness.

    Returns a validation summary dict with completeness_score and any missing fields.
    """
    required_fields = [
        "title", "organisation", "overview", "required_skills",
        "competencies", "qualifications",
    ]
    recommended_fields = [
        "department", "location", "salary_band", "employment_type",
        "closing_date", "preferred_skills", "responsibilities",
    ]

    missing_required = [f for f in required_fields if not job.get(f)]
    missing_recommended = [f for f in recommended_fields if not job.get(f)]

    filled = len(required_fields) - len(missing_required)
    completeness_score = round(filled / len(required_fields) * 100, 1)

    warnings: list[str] = []
    if "Treaty" not in " ".join(job.get("competencies", [])) and "treaty" not in " ".join(job.get("competencies", [])).lower():
        warnings.append("No Treaty of Waitangi competency listed — consider adding for NZ public sector roles.")
    if not job.get("salary_band"):
        warnings.append("No salary band specified — may deter qualified candidates.")
    if not job.get("closing_date"):
        warnings.append("No closing date — required for advertising on careers.govt.nz.")

    return {
        "completeness_score": completeness_score,
        "is_complete": not missing_required,
        "missing_required": missing_required,
        "missing_recommended": missing_recommended,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# Data loading utilities (for testing / demo use)
# ---------------------------------------------------------------------------


def load_example_jobs(path: str = "data/example_jobs.json") -> list[dict]:
    """Load example jobs from the data directory."""
    with open(path) as fh:
        return json.load(fh)


def load_example_candidates(path: str = "data/example_candidates.json") -> list[dict]:
    """Load example candidates from the data directory."""
    with open(path) as fh:
        return json.load(fh)
