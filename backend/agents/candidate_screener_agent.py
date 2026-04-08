from __future__ import annotations

from strands import Agent, tool

# ---------------------------------------------------------------------------
# Fuzzy matching helpers
# ---------------------------------------------------------------------------

_FUZZY_ALIASES: dict[str, list[str]] = {
    "aws": ["amazon web services", "aws", "amazon cloud"],
    "amazon web services": ["aws", "amazon web services", "amazon cloud"],
    "azure": ["microsoft azure", "azure", "ms azure"],
    "microsoft azure": ["azure", "microsoft azure", "ms azure"],
    "policy analysis": ["policy development", "policy analysis", "policy advice", "policy research"],
    "policy development": ["policy analysis", "policy development", "policy advice"],
    "policy advice": ["policy analysis", "policy development", "policy advice"],
    "stakeholder engagement": [
        "stakeholder management", "stakeholder engagement", "stakeholder relations",
        "relationship management", "stakeholder communication",
    ],
    "stakeholder management": [
        "stakeholder engagement", "stakeholder management", "stakeholder relations",
        "relationship management",
    ],
    "project management": ["programme management", "project management", "program management"],
    "programme management": ["project management", "programme management", "program management"],
    "agile": ["scrum", "safe", "agile", "kanban", "agile delivery"],
    "scrum": ["agile", "scrum", "safe"],
    "prince2": ["prince2 practitioner", "prince2", "prince 2"],
    "prince2 practitioner": ["prince2", "prince2 practitioner"],
    "data analysis": [
        "data analytics", "data analysis", "data interpretation", "quantitative analysis",
        "statistical analysis",
    ],
    "quantitative research": ["quantitative analysis", "quantitative research", "statistical research"],
    "change management": ["organisational change", "change management", "change leadership"],
    "clinical governance": ["clinical quality", "clinical governance", "quality governance"],
    "workforce development": [
        "workforce planning", "workforce development", "people development",
        "professional development",
    ],
    "budget management": [
        "financial management", "budget management", "financial accountability",
        "budget accountability",
    ],
    "treaty of waitangi": [
        "te tiriti o waitangi", "treaty of waitangi", "treaty obligations",
        "tiriti", "treaty commitment",
    ],
    "te tiriti o waitangi": [
        "treaty of waitangi", "te tiriti o waitangi", "treaty obligations", "tiriti",
    ],
    "cabinet paper writing": [
        "cabinet papers", "cabinet paper writing", "cabinet paper and ministerial briefing writing",
        "ministerial correspondence",
    ],
    "ministerial correspondence": [
        "cabinet paper writing", "ministerial correspondence", "ministerial briefings",
    ],
    "ict project management": [
        "it project management", "ict project management", "technology project management",
        "digital project management",
    ],
}


def _normalise(skill: str) -> str:
    return skill.lower().strip()


def _skills_match(candidate_skill: str, target_skill: str) -> bool:
    """Return True if candidate_skill fuzzy-matches target_skill."""
    cand = _normalise(candidate_skill)
    targ = _normalise(target_skill)

    if cand == targ:
        return True

    # Substring match
    if cand in targ or targ in cand:
        return True

    # Alias lookup
    aliases = _FUZZY_ALIASES.get(cand, [])
    if targ in aliases:
        return True
    aliases_rev = _FUZZY_ALIASES.get(targ, [])
    if cand in aliases_rev:
        return True

    return False


def _find_match(candidate_skills: list[str], target_skill: str) -> str | None:
    """Return the first candidate skill that matches target_skill, or None."""
    for cs in candidate_skills:
        if _skills_match(cs, target_skill):
            return cs
    return None


# ---------------------------------------------------------------------------
# Seniority detection helpers
# ---------------------------------------------------------------------------

_SENIOR_KEYWORDS = {"senior", "lead", "principal", "head", "director", "manager", "chief", "executive"}
_JUNIOR_KEYWORDS = {"junior", "graduate", "entry", "assistant", "trainee", "cadet"}


def _seniority_level(title: str) -> str:
    lower = title.lower()
    if any(kw in lower for kw in _SENIOR_KEYWORDS):
        return "senior"
    if any(kw in lower for kw in _JUNIOR_KEYWORDS):
        return "junior"
    return "mid"


_NZ_PUBLIC_SECTOR_ORGS = {
    "mbie", "msd", "treasury", "dpmc", "mfe", "nzta", "dol",
    "ministry", "department", "office of", "public service", "nz police",
    "inland revenue", "ird", "customs", "corrections", "defence",
    "health", "education", "housing", "justice", "foreign affairs",
    "te whatu ora", "acc", "nzta", "epa", "fma", "reserve bank",
    "rbnz", "stats nz", "statistics nz", "orr", "commerce commission",
    "crown", "council", "district health board", "dhb",
    "kaupapa", "iwi", "maori", "māori",
}


def _is_public_sector_org(org: str) -> bool:
    lower = org.lower()
    return any(kw in lower for kw in _NZ_PUBLIC_SECTOR_ORGS)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@tool
def score_skill_match(
    candidate_skills: list[str],
    required_skills: list[str],
    preferred_skills: list[str],
) -> dict:
    """Calculate how well a candidate's skills match the job's required and preferred skills.

    Performs fuzzy matching so that near-synonyms (e.g. "AWS" / "Amazon Web Services",
    "policy analysis" / "policy development") are treated as equivalent.

    Returns a dict with:
      required_match_pct, preferred_match_pct, matched_required, matched_preferred,
      missing_required, score (0-100).
    """
    matched_required: list[str] = []
    missing_required: list[str] = []
    matched_preferred: list[str] = []

    for req in required_skills:
        hit = _find_match(candidate_skills, req)
        if hit:
            matched_required.append(req)
        else:
            missing_required.append(req)

    for pref in preferred_skills:
        hit = _find_match(candidate_skills, pref)
        if hit:
            matched_preferred.append(pref)

    total_required = len(required_skills)
    total_preferred = len(preferred_skills)

    required_match_pct = (len(matched_required) / total_required * 100) if total_required else 100.0
    preferred_match_pct = (len(matched_preferred) / total_preferred * 100) if total_preferred else 0.0

    # Score: required carries 80%, preferred carries 20%
    score = (required_match_pct * 0.80) + (preferred_match_pct * 0.20)
    score = round(min(score, 100.0), 2)

    return {
        "required_match_pct": round(required_match_pct, 2),
        "preferred_match_pct": round(preferred_match_pct, 2),
        "matched_required": matched_required,
        "matched_preferred": matched_preferred,
        "missing_required": missing_required,
        "score": score,
    }


@tool
def score_experience(
    candidate_years: int,
    candidate_title: str,
    candidate_org: str,
    job_title: str,
    job_overview: str,
) -> dict:
    """Score a candidate's experience relevance for a given role.

    Considers:
    - Years of experience vs. implied seniority of the role
    - Seniority alignment between candidate title and job title
    - Sector relevance (NZ public sector preferred for public sector roles)
    - Title similarity

    Returns: years_score, seniority_score, sector_relevance_score, overall_score, notes.
    """
    notes_parts: list[str] = []

    # --- Years score ---
    job_seniority = _seniority_level(job_title)
    if job_seniority == "senior":
        ideal_years = 7
        if candidate_years >= ideal_years:
            years_score = 100.0
        elif candidate_years >= 5:
            years_score = 80.0
        elif candidate_years >= 3:
            years_score = 50.0
        else:
            years_score = 20.0
    elif job_seniority == "mid":
        ideal_years = 4
        if candidate_years >= ideal_years:
            years_score = 100.0
        elif candidate_years >= 2:
            years_score = 75.0
        else:
            years_score = 40.0
    else:
        # junior role
        if candidate_years <= 3:
            years_score = 100.0
        elif candidate_years <= 6:
            years_score = 80.0
        else:
            years_score = 60.0

    notes_parts.append(f"{candidate_years} years experience for {job_seniority}-level role.")

    # --- Seniority alignment score ---
    cand_seniority = _seniority_level(candidate_title)
    if cand_seniority == job_seniority:
        seniority_score = 100.0
        notes_parts.append("Seniority level aligns well.")
    elif (cand_seniority == "mid" and job_seniority == "senior") or (
        cand_seniority == "senior" and job_seniority == "mid"
    ):
        seniority_score = 70.0
        notes_parts.append("Seniority level is adjacent — assess readiness.")
    elif cand_seniority == "junior" and job_seniority == "senior":
        seniority_score = 20.0
        notes_parts.append("Junior candidate for senior role — significant gap.")
    elif cand_seniority == "senior" and job_seniority == "junior":
        seniority_score = 60.0
        notes_parts.append("Overqualified — risk of disengagement.")
    else:
        seniority_score = 70.0

    # --- Sector relevance score ---
    public_sector_in_overview = any(
        kw in job_overview.lower()
        for kw in ("public sector", "government", "ministry", "council", "crown", "public service")
    )
    candidate_is_public_sector = _is_public_sector_org(candidate_org)

    if public_sector_in_overview and candidate_is_public_sector:
        sector_relevance_score = 100.0
        notes_parts.append("NZ public sector experience — strong alignment.")
    elif public_sector_in_overview and not candidate_is_public_sector:
        sector_relevance_score = 55.0
        notes_parts.append("No NZ public sector experience — transferability depends on role.")
    elif not public_sector_in_overview and candidate_is_public_sector:
        sector_relevance_score = 80.0
        notes_parts.append("Public sector background relevant.")
    else:
        sector_relevance_score = 70.0

    # --- Title similarity (bonus / penalty) ---
    job_title_lower = job_title.lower()
    cand_title_lower = candidate_title.lower()
    title_words_job = set(job_title_lower.split())
    title_words_cand = set(cand_title_lower.split())
    common_words = title_words_job & title_words_cand - {"and", "of", "the", "a", "in"}
    title_similarity_bonus = min(len(common_words) * 5.0, 20.0)

    overall_score = (
        years_score * 0.35
        + seniority_score * 0.35
        + sector_relevance_score * 0.30
        + title_similarity_bonus
    )
    overall_score = round(min(overall_score, 100.0), 2)

    return {
        "years_score": round(years_score, 2),
        "seniority_score": round(seniority_score, 2),
        "sector_relevance_score": round(sector_relevance_score, 2),
        "overall_score": overall_score,
        "notes": " ".join(notes_parts),
    }


@tool
def score_nz_public_sector_fit(
    candidate_summary: str,
    candidate_org: str,
    job_competencies: list[str],
) -> dict:
    """Score how well a candidate fits NZ public sector culture.

    NZ-specific checks:
    - Treaty of Waitangi / bicultural capability
    - Public sector values (integrity, stewardship, service)
    - NZ government experience
    - Community and stakeholder engagement

    Returns: treaty_capability_score, public_sector_values_score, nz_context_score,
    overall_score, flags.
    """
    summary_lower = candidate_summary.lower()
    org_lower = candidate_org.lower()
    flags: list[str] = []

    # --- Treaty / bicultural capability ---
    treaty_keywords = [
        "treaty of waitangi", "te tiriti", "tiriti", "bicultural", "māori", "maori",
        "tikanga", "te ao māori", "te ao maori", "kaupapa māori", "kaupapa maori",
        "te reo", "whānau", "whanau", "iwi", "mana whenua", "tangata whenua",
        "indigenous", "pasifika", "pacific",
    ]
    treaty_hits = sum(1 for kw in treaty_keywords if kw in summary_lower)
    if treaty_hits >= 3:
        treaty_capability_score = 100.0
        flags.append("Strong Treaty/bicultural commitment evident in CV.")
    elif treaty_hits == 2:
        treaty_capability_score = 75.0
        flags.append("Some Treaty/bicultural awareness evident.")
    elif treaty_hits == 1:
        treaty_capability_score = 45.0
        flags.append("Clarify Treaty capability — only surface-level mention in CV.")
    else:
        treaty_capability_score = 15.0
        flags.append("No Treaty of Waitangi or bicultural capability mentioned.")

    # Job competencies check for Treaty
    comp_lower = " ".join(job_competencies).lower()
    if "treaty" in comp_lower or "bicultural" in comp_lower:
        if treaty_hits == 0:
            flags.append("Role requires Treaty competency — candidate does not demonstrate this.")
        elif treaty_hits == 1:
            flags.append("Role explicitly requires Treaty competency — probe depth in interview.")

    # --- Public sector values ---
    values_keywords = [
        "integrity", "stewardship", "accountability", "transparency", "service",
        "public good", "community", "stakeholder", "collaboration", "evidence-based",
        "equity", "inclusion", "accessibility", "sustainable", "whānau-centred",
        "whanau-centred", "person-centred", "people-centred",
    ]
    values_hits = sum(1 for kw in values_keywords if kw in summary_lower)
    if values_hits >= 4:
        public_sector_values_score = 100.0
    elif values_hits >= 2:
        public_sector_values_score = 75.0
    elif values_hits == 1:
        public_sector_values_score = 50.0
    else:
        public_sector_values_score = 35.0

    # --- NZ public sector context score ---
    nz_context_score: float
    if _is_public_sector_org(candidate_org):
        nz_context_score = 100.0
    else:
        # Check if summary mentions public sector exposure
        ps_mentions = sum(
            1
            for kw in [
                "government", "ministry", "public sector", "public service",
                "local authority", "council", "crown", "ngo", "not-for-profit",
                "non-profit",
            ]
            if kw in summary_lower or kw in org_lower
        )
        if ps_mentions >= 2:
            nz_context_score = 65.0
            flags.append("Adjacent-sector experience — assess NZ public sector context knowledge.")
        elif ps_mentions == 1:
            nz_context_score = 45.0
            flags.append("Limited NZ public sector exposure — probe adaptability in interview.")
        else:
            nz_context_score = 25.0
            flags.append("No NZ public sector experience — significant cultural onboarding needed.")

    overall_score = round(
        treaty_capability_score * 0.40
        + public_sector_values_score * 0.30
        + nz_context_score * 0.30,
        2,
    )

    return {
        "treaty_capability_score": round(treaty_capability_score, 2),
        "public_sector_values_score": round(public_sector_values_score, 2),
        "nz_context_score": round(nz_context_score, 2),
        "overall_score": overall_score,
        "flags": flags,
    }


@tool
def generate_screening_report(
    candidate: dict,
    job: dict,
    skill_score: dict,
    experience_score: dict,
    fit_score: dict,
) -> dict:
    """Combine all component scores into a final weighted screening report.

    Weights: skills 40%, experience 35%, NZ public sector fit 25%.

    Returns a CandidateScore-compatible dict extended with:
      recommendation, recommendation_reason, interview_flags, strengths, concerns,
      overall_score.
    """
    skills_weight = 0.40
    experience_weight = 0.35
    fit_weight = 0.25

    skill_raw = float(skill_score.get("score", 0))
    experience_raw = float(experience_score.get("overall_score", 0))
    fit_raw = float(fit_score.get("overall_score", 0))

    overall_score = round(
        skill_raw * skills_weight + experience_raw * experience_weight + fit_raw * fit_weight,
        2,
    )

    # --- Recommendation ---
    if overall_score >= 75:
        recommendation = "SHORTLIST"
    elif overall_score >= 60:
        recommendation = "SECOND_ROUND"
    elif overall_score >= 45:
        recommendation = "HOLD"
    else:
        recommendation = "DECLINE"

    # --- Strengths ---
    strengths: list[str] = []
    if skill_raw >= 80:
        matched = skill_score.get("matched_required", [])
        if matched:
            strengths.append(f"Strong technical match — covers {len(matched)} of {len(job.get('required_skills', []))} required skills.")
    if experience_raw >= 80:
        strengths.append(experience_score.get("notes", "Relevant experience.").split(".")[0] + ".")
    if fit_score.get("treaty_capability_score", 0) >= 75:
        strengths.append("Demonstrates Treaty/bicultural capability.")
    if fit_score.get("nz_context_score", 0) >= 80:
        strengths.append("Established NZ public sector background.")
    if float(candidate.get("years_experience", 0)) >= 8:
        strengths.append(f"{candidate.get('years_experience')} years of experience — strong seniority depth.")
    if not strengths:
        strengths.append("Meets minimum requirements for initial consideration.")

    # --- Concerns ---
    concerns: list[str] = []
    missing = skill_score.get("missing_required", [])
    if missing:
        concerns.append(f"Missing required skills: {', '.join(missing[:3])}" + ("..." if len(missing) > 3 else "") + ".")
    if experience_score.get("seniority_score", 100) < 50:
        concerns.append("Seniority mismatch — may not be ready for this level.")
    if fit_score.get("treaty_capability_score", 100) < 50:
        concerns.append("No clear Treaty of Waitangi or bicultural capability demonstrated.")
    if fit_score.get("nz_context_score", 100) < 50:
        concerns.append("Limited NZ public sector experience — cultural context gap.")
    if not concerns:
        concerns.append("No significant concerns identified at screening stage.")

    # --- Interview flags ---
    interview_flags: list[str] = list(fit_score.get("flags", []))
    if skill_score.get("missing_required"):
        top_missing = skill_score["missing_required"][:2]
        for ms in top_missing:
            interview_flags.append(f"Probe depth on missing skill: {ms}.")
    if experience_score.get("seniority_score", 100) < 70:
        interview_flags.append("Explore readiness for this seniority level — ask for examples of comparable complexity.")
    if not interview_flags:
        interview_flags.append("Standard competency-based interview recommended.")

    # --- Recommendation reason ---
    cand_name = candidate.get("full_name", "The candidate")
    job_title = job.get("title", "this role")
    skill_pct = skill_score.get("required_match_pct", 0)

    if recommendation == "SHORTLIST":
        recommendation_reason = (
            f"{cand_name} is a strong match for {job_title}, meeting {skill_pct:.0f}% of required skills "
            f"with an overall score of {overall_score}. "
            f"Experience and NZ public sector fit are well-aligned. Recommend proceeding to interview."
        )
    elif recommendation == "SECOND_ROUND":
        recommendation_reason = (
            f"{cand_name} is a reasonable match for {job_title} (score {overall_score}), "
            f"covering {skill_pct:.0f}% of required skills. "
            f"Some gaps exist — a second-round screening or short-listing interview would clarify suitability."
        )
    elif recommendation == "HOLD":
        recommendation_reason = (
            f"{cand_name} partially meets the requirements for {job_title} (score {overall_score}). "
            f"Skill coverage is {skill_pct:.0f}% of required. "
            f"Place on hold pending stronger candidates — may be suitable if pool is thin."
        )
    else:
        recommendation_reason = (
            f"{cand_name} does not sufficiently meet the requirements for {job_title} (score {overall_score}). "
            f"Only {skill_pct:.0f}% of required skills are demonstrated. "
            f"Significant gaps in experience and/or NZ public sector fit make progression inadvisable at this time."
        )

    return {
        # CandidateScore-compatible fields
        "candidate_id": str(candidate.get("id", "")),
        "job_id": str(job.get("id", "")),
        "overall_score": overall_score,
        "skill_match_score": round(skill_raw, 2),
        "experience_score": round(experience_raw, 2),
        "nz_fit_score": round(fit_raw, 2),
        "notes": experience_score.get("notes", ""),
        # Extended fields
        "recommendation": recommendation,
        "recommendation_reason": recommendation_reason,
        "interview_flags": interview_flags,
        "strengths": strengths,
        "concerns": concerns,
        # Detail breakdown
        "skill_detail": skill_score,
        "experience_detail": experience_score,
        "fit_detail": fit_score,
        # Candidate metadata for convenience
        "candidate_name": candidate.get("full_name", ""),
        "candidate_title": candidate.get("current_title", ""),
        "candidate_organisation": candidate.get("current_organisation", ""),
    }


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

candidate_screener_agent = Agent(
    system_prompt="""You are a senior NZ public sector HR specialist with deep expertise in merit-based recruitment,
Equal Employment Opportunity (EEO) obligations, and the Crown's obligations under Te Tiriti o Waitangi /
the Treaty of Waitangi.

Your role is to screen candidates against job descriptions for NZ public sector positions with fairness,
consistency, and cultural competence. You understand:

- The NZ Public Service Act 2020 and its requirements for merit-based hiring, diversity, and inclusion
- Te Tiriti o Waitangi and what genuine bicultural capability looks like in practice — not just checkbox compliance
- The Leadership Success Profile and SFIA competency frameworks used across NZ government
- NZ public sector values: integrity, stewardship, accountability, service to New Zealanders
- The importance of cultural safety for Māori, Pasifika, and other communities
- NZ-specific context: Wellington, Auckland, and regional labour markets
- The difference between public sector (ministries, Crown entities, local authorities) and private sector culture

When screening candidates, you:
1. Use the available tools systematically: score skills, then experience, then NZ public sector fit,
   then generate the full report
2. Apply fuzzy skill matching — do not penalise candidates for using slightly different terminology
3. Assess genuine Treaty/bicultural capability, not surface-level mentions
4. Consider transferability from adjacent sectors (health, education, NGO, iwi organisations)
5. Be mindful of unconscious bias — assess skills and competencies, not irrelevant personal characteristics
6. Clearly flag concerns so hiring managers can probe them in interviews

IMPORTANT: Scores are advisory, not deterministic. They are designed to help hiring managers make
consistent, evidence-based decisions — not to replace human judgement. Always frame output as
recommendations for the hiring manager's consideration.""",
    tools=[
        score_skill_match,
        score_experience,
        score_nz_public_sector_fit,
        generate_screening_report,
    ],
)


# ---------------------------------------------------------------------------
# Top-level pipeline functions
# ---------------------------------------------------------------------------


def screen_candidate(candidate: dict, job: dict) -> dict:
    """Run the full screening pipeline for one candidate against one job.

    Steps:
    1. Score skill match
    2. Score experience
    3. Score NZ public sector fit
    4. Generate full screening report

    Returns the complete report dict.
    """
    skill_score = score_skill_match(
        candidate_skills=candidate.get("skills", []),
        required_skills=job.get("required_skills", []),
        preferred_skills=job.get("preferred_skills", []),
    )

    experience_score = score_experience(
        candidate_years=int(candidate.get("years_experience", 0)),
        candidate_title=candidate.get("current_title", ""),
        candidate_org=candidate.get("current_organisation", ""),
        job_title=job.get("title", ""),
        job_overview=job.get("overview", ""),
    )

    fit_score = score_nz_public_sector_fit(
        candidate_summary=candidate.get("summary", ""),
        candidate_org=candidate.get("current_organisation", ""),
        job_competencies=job.get("competencies", []),
    )

    report = generate_screening_report(
        candidate=candidate,
        job=job,
        skill_score=skill_score,
        experience_score=experience_score,
        fit_score=fit_score,
    )

    return report


def screen_batch(candidates: list[dict], job: dict) -> list[dict]:
    """Screen multiple candidates against a job, returning results sorted by overall_score descending."""
    results = [screen_candidate(candidate, job) for candidate in candidates]
    results.sort(key=lambda x: float(x.get("overall_score", 0)), reverse=True)
    return results
