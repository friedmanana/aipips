from __future__ import annotations

import re

from strands import Agent, tool

from models.job import EmploymentType, JobStatus
from tools.jd_parser import (
    extract_text_from_pdf,
    extract_text_from_string,
    identify_jd_sections,
)

_SENIORITY_SALARY_MAP = [
    (r"(?i)(chief|secretary|deputy\s+secretary|tier\s*[12])", "Band 7: $170,000 - $250,000+"),
    (r"(?i)(general\s+manager|deputy\s+ce|director\s+general)", "Band 7: $170,000 - $250,000+"),
    (r"(?i)(director|head\s+of|principal|lead\b)", "Band 6: $130,000 - $170,000"),
    (r"(?i)(senior\s+manager|manager\b)", "Band 5: $110,000 - $135,000"),
    (r"(?i)(senior\b)", "Band 4: $95,000 - $115,000"),
    (r"(?i)(graduate|junior|entry)", "Band 1: $50,000 - $65,000"),
    (r"(?i)(analyst|advisor|coordinator|specialist)", "Band 3: $75,000 - $95,000"),
]

_NZ_CITIES = [
    "Wellington", "Auckland", "Christchurch", "Hamilton", "Tauranga",
    "Dunedin", "Palmerston North", "Nelson", "Rotorua", "New Plymouth",
    "Napier", "Hastings", "Invercargill", "Whangarei",
]

_TREATY_COMPETENCY = "Commitment to Te Tiriti o Waitangi"


def _lines_to_list(text: str) -> list[str]:
    items = []
    for line in text.splitlines():
        line = line.strip().lstrip("-•*·▪◦").strip()
        if line:
            items.append(line)
    return items


def _extract_field_from_text(text: str, patterns: list[str]) -> str:
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


@tool
def parse_job_description(raw_text: str, source_file: str = "") -> dict:
    """Parse raw JD text into a dict matching JobDescription fields.

    Calls identify_jd_sections to split the text, then extracts or infers
    each field. Returns sensible NZ public sector defaults for missing fields.
    """
    sections = identify_jd_sections(raw_text)

    title = _extract_field_from_text(
        raw_text,
        [
            r"(?i)position\s+title[:\s]+(.+)",
            r"(?i)role\s+title[:\s]+(.+)",
            r"(?i)job\s+title[:\s]+(.+)",
            r"(?im)^(?:title)[:\s]+(.+)$",
        ],
    )
    if not title:
        first_lines = [line.strip() for line in raw_text.strip().splitlines() if line.strip()]
        title = first_lines[0] if first_lines else "Untitled Role"

    organisation = _extract_field_from_text(
        raw_text,
        [
            r"(?i)organisation[:\s]+(.+)",
            r"(?i)organization[:\s]+(.+)",
            r"(?i)agency[:\s]+(.+)",
            r"(?i)employer[:\s]+(.+)",
        ],
    )

    department = _extract_field_from_text(
        raw_text,
        [
            r"(?i)department[:\s]+(.+)",
            r"(?i)team[:\s]+(.+)",
            r"(?i)division[:\s]+(.+)",
            r"(?i)group[:\s]+(.+)",
            r"(?i)unit[:\s]+(.+)",
        ],
    )

    location = _extract_field_from_text(
        raw_text,
        [
            r"(?i)location[:\s]+(.+)",
            r"(?i)based\s+in[:\s]+(.+)",
            r"(?i)office\s+location[:\s]+(.+)",
        ],
    )
    if not location:
        for city in _NZ_CITIES:
            if city.lower() in raw_text.lower():
                location = f"{city}, New Zealand"
                break
    if not location:
        location = "Wellington, New Zealand"

    salary_band = _extract_field_from_text(
        raw_text,
        [
            r"(?i)salary[:\s]+(.+)",
            r"(?i)remuneration[:\s]+(.+)",
            r"(?i)band\s*\d[:\s]+(.+)",
            r"(?i)\$([\d,]+\s*[-–]\s*\$[\d,]+)",
        ],
    )

    employment_type_raw = _extract_field_from_text(
        raw_text,
        [
            r"(?i)employment\s+type[:\s]+(.+)",
            r"(?i)contract\s+type[:\s]+(.+)",
            r"(?i)(permanent|fixed.term|casual)\s+(?:position|role|contract)",
            r"(?i)(?:this\s+is\s+a\s+)(permanent|fixed.term|casual)",
        ],
    )
    if re.search(r"(?i)fixed.term|contract", employment_type_raw or raw_text[:500]):
        employment_type = EmploymentType.FIXED_TERM.value
    elif re.search(r"(?i)casual", employment_type_raw or ""):
        employment_type = EmploymentType.CASUAL.value
    else:
        employment_type = EmploymentType.PERMANENT.value

    closing_date_raw = _extract_field_from_text(
        raw_text,
        [
            r"(?i)closing\s+date[:\s]+(.+)",
            r"(?i)applications?\s+close[:\s]+(.+)",
            r"(?i)apply\s+by[:\s]+(.+)",
            r"(?i)closes?[:\s]+(.+)",
        ],
    )

    overview = sections.get("overview", "").strip()
    if not overview:
        overview = raw_text[:500].strip()

    responsibilities = _lines_to_list(sections.get("responsibilities", ""))
    required_skills = _lines_to_list(sections.get("required_skills", ""))
    preferred_skills = _lines_to_list(sections.get("preferred_skills", ""))
    qualifications = _lines_to_list(sections.get("qualifications", ""))
    competencies = _lines_to_list(sections.get("competencies", ""))

    return {
        "title": title,
        "organisation": organisation,
        "department": department,
        "location": location,
        "salary_band": salary_band,
        "employment_type": employment_type,
        "closing_date": closing_date_raw,
        "overview": overview,
        "responsibilities": responsibilities,
        "required_skills": required_skills,
        "preferred_skills": preferred_skills,
        "qualifications": qualifications,
        "competencies": competencies,
        "status": JobStatus.DRAFT.value,
        "source_file": source_file,
    }


@tool
def validate_jd_completeness(jd_dict: dict) -> dict:
    """Check which required JD fields are missing or empty.

    Returns: {"is_complete": bool, "missing_fields": list[str], "warnings": list[str]}
    """
    required_fields = [
        "title", "organisation", "department", "location",
        "overview", "responsibilities", "required_skills",
    ]

    missing_fields: list[str] = []
    for field in required_fields:
        value = jd_dict.get(field)
        if not value or (isinstance(value, list) and len(value) == 0):
            missing_fields.append(field)

    warnings: list[str] = []

    if not jd_dict.get("salary_band"):
        warnings.append("No salary band specified — NZ public sector roles should include a salary band for transparency.")

    if not jd_dict.get("closing_date"):
        warnings.append("No closing date specified — NZ public sector JDs typically close 3–4 weeks after advertising.")

    competencies = jd_dict.get("competencies", [])
    has_treaty = any(
        re.search(r"(?i)te\s+tiriti|treaty\s+of\s+waitangi|waitangi", c)
        for c in (competencies if isinstance(competencies, list) else [competencies])
    )
    if not has_treaty:
        warnings.append(
            "Missing Treaty of Waitangi competency — this is a standard requirement in NZ public sector roles."
        )

    return {
        "is_complete": len(missing_fields) == 0,
        "missing_fields": missing_fields,
        "warnings": warnings,
    }


@tool
def enrich_jd_with_nz_context(jd_dict: dict) -> dict:
    """Enrich a JD dict with NZ public sector context.

    - Adds standard NZ public sector competencies if missing
    - Normalises location to include city + ", New Zealand"
    - Suggests salary band from title/seniority if missing
    Returns an enriched copy of jd_dict.
    """
    enriched = dict(jd_dict)

    location = enriched.get("location", "")
    if location and "New Zealand" not in location and "NZ" not in location:
        for city in _NZ_CITIES:
            if city.lower() in location.lower():
                enriched["location"] = f"{city}, New Zealand"
                break
        else:
            enriched["location"] = f"{location}, New Zealand"
    elif not location:
        enriched["location"] = "Wellington, New Zealand"

    competencies = enriched.get("competencies", [])
    if not isinstance(competencies, list):
        competencies = [competencies] if competencies else []

    has_treaty = any(
        re.search(r"(?i)te\s+tiriti|treaty\s+of\s+waitangi|waitangi", c)
        for c in competencies
    )
    if not has_treaty:
        competencies = [_TREATY_COMPETENCY] + competencies

    standard_competencies = [
        "Stakeholder engagement",
        "Delivering results",
        "Bicultural capability",
    ]
    existing_lower = {c.lower() for c in competencies}
    for comp in standard_competencies:
        if comp.lower() not in existing_lower:
            competencies.append(comp)

    enriched["competencies"] = competencies

    if not enriched.get("salary_band"):
        title = enriched.get("title", "")
        for pattern, band in _SENIORITY_SALARY_MAP:
            if re.search(pattern, title):
                enriched["salary_band"] = band
                break
        else:
            enriched["salary_band"] = "Band 3: $75,000 - $95,000"

    return enriched


job_analyst_agent = Agent(
    system_prompt="""You are a specialist NZ public sector HR advisor with deep expertise in:

- NZ Public Service Act 2020 standards and the State Services Commission (now Te Kawa Mataaho) frameworks
- MBIE, SSC/Te Kawa Mataaho, and Treasury JD conventions and writing standards
- Te Tiriti o Waitangi obligations in public sector employment — every NZ public sector JD must include a genuine Treaty commitment, not just token language
- NZ public sector salary bands: Band 1 (~$50k–$65k, entry/graduate), Band 2 (~$65k–$80k, junior professional), Band 3 (~$75k–$95k, analyst/advisor/coordinator), Band 4 (~$95k–$120k, senior analyst/senior advisor), Band 5 (~$110k–$135k, manager/senior manager), Band 6 (~$130k–$170k, director/principal), Band 7 ($170k+, GM/deputy secretary/chief)
- Closing date norms: NZ public sector roles typically advertise for 3–4 weeks; roles requiring security clearances may advertise longer
- The Leadership Success Profile (LSP) competency framework used across the public service
- SFIA (Skills Framework for the Information Age) for ICT roles in government
- Tikanga Māori, te ao Māori, and kaupapa Māori — genuine bicultural capability is non-negotiable, not an afterthought
- NZ government structure: central government agencies (MBIE, MSD, Treasury, DPMC, MfE, NZTA, MoH), Crown entities, Te Whatu Ora/Health NZ, and local authorities
- Equity and inclusion requirements — JDs must actively encourage Māori, Pasifika, tāngata whaikaha (disabled people), and other underrepresented groups to apply
- careers.govt.nz and SmartJobs.nz standards for public sector job advertising
- Employment Relations Act 2000 and Health and Safety at Work Act 2015 compliance considerations

When analysing a JD:
1. Parse it carefully to extract all structured fields
2. Validate completeness against NZ public sector standards
3. Enrich with missing context — especially Treaty obligations and standard competencies
4. Flag any language that may inadvertently exclude diverse candidates
5. Ensure location, salary band, and closing date are present and accurate
6. Check responsibilities and required skills are realistic and not inflated

Use the available tools systematically: parse first, then validate, then enrich.""",
    tools=[parse_job_description, validate_jd_completeness, enrich_jd_with_nz_context],
)


def analyse_job(raw_input: str, is_file_path: bool = False) -> dict:
    """Analyse a job description from text or PDF file path.

    Args:
        raw_input: Either raw JD text or a file path to a PDF.
        is_file_path: If True, raw_input is treated as a PDF file path.

    Returns:
        {"job_description": dict, "validation": dict, "enriched": bool}
    """
    if is_file_path:
        text = extract_text_from_pdf(raw_input)
        source_file = raw_input
    else:
        text = extract_text_from_string(raw_input)
        source_file = ""

    jd_dict = parse_job_description(text, source_file=source_file)
    validation = validate_jd_completeness(jd_dict)
    enriched_dict = enrich_jd_with_nz_context(jd_dict)

    return {
        "job_description": enriched_dict,
        "validation": validation,
        "enriched": True,
    }
