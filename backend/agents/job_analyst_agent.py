"""
Job Description Analyst Agent — agentic, Groq-powered.

The agent autonomously:
  1. Parses the raw JD text into structured fields (regex-based, fast)
  2. Validates completeness against NZ public sector standards
  3. Enriches missing fields using NZ context rules
  4. Uses Groq (Llama 3.3 70B) to fill gaps that regex can't handle —
     e.g. inferring skills from a vague JD, writing a missing overview, etc.

Tools are registered with @agent_tool so the agent can call them in any order
and decide whether to invoke the AI enrichment step.
"""
from __future__ import annotations

import re

from core.agent import AgentTool, GroqAgent, agent_tool
from models.job import EmploymentType, JobStatus
from tools.jd_parser import (
    extract_text_from_pdf,
    extract_text_from_string,
    identify_jd_sections,
)

# ---------------------------------------------------------------------------
# NZ salary / location / competency data
# ---------------------------------------------------------------------------

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

_STANDARD_COMPETENCIES = [
    "Stakeholder engagement",
    "Delivering results",
    "Bicultural capability",
]


def _lines_to_list(text: str) -> list[str]:
    items = []
    for line in text.splitlines():
        line = line.strip().lstrip("-•*·▪◦").strip()
        if line:
            items.append(line)
    return items


def _extract_field(text: str, patterns: list[str]) -> str:
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


# ---------------------------------------------------------------------------
# Tool 1 — Parse JD (regex-based, no LLM)
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Parse raw job description text into structured fields: title, organisation, "
        "department, location, salary, employment type, closing date, overview, "
        "responsibilities, required_skills, preferred_skills, qualifications, competencies. "
        "Call this first on any JD."
    ),
    parameters={
        "type": "object",
        "properties": {
            "raw_text":    {"type": "string", "description": "The full raw JD text"},
            "source_file": {"type": "string", "description": "Optional source filename"},
        },
        "required": ["raw_text"],
    },
)
def parse_job_description(raw_text: str, source_file: str = "") -> dict:
    sections = identify_jd_sections(raw_text)

    title = _extract_field(raw_text, [
        r"(?i)position\s+title[:\s]+(.+)",
        r"(?i)role\s+title[:\s]+(.+)",
        r"(?i)job\s+title[:\s]+(.+)",
        r"(?im)^(?:title)[:\s]+(.+)$",
    ])
    if not title:
        first_lines = [l.strip() for l in raw_text.strip().splitlines() if l.strip()]
        title = first_lines[0] if first_lines else "Untitled Role"

    organisation = _extract_field(raw_text, [
        r"(?i)organisation[:\s]+(.+)",
        r"(?i)organization[:\s]+(.+)",
        r"(?i)agency[:\s]+(.+)",
        r"(?i)employer[:\s]+(.+)",
    ])

    department = _extract_field(raw_text, [
        r"(?i)department[:\s]+(.+)",
        r"(?i)division[:\s]+(.+)",
        r"(?i)group[:\s]+(.+)",
        r"(?i)team[:\s]+(.+)",
    ])

    location = _extract_field(raw_text, [
        r"(?i)location[:\s]+(.+)",
        r"(?i)based\s+in[:\s]+(.+)",
    ])
    if not location:
        for city in _NZ_CITIES:
            if city.lower() in raw_text.lower():
                location = f"{city}, New Zealand"
                break
    location = location or "Wellington, New Zealand"

    salary_band = _extract_field(raw_text, [
        r"(?i)salary[:\s]+(.+)",
        r"(?i)remuneration[:\s]+(.+)",
        r"(?i)\$([\d,]+\s*[-–]\s*\$[\d,]+)",
    ])

    employment_type_raw = _extract_field(raw_text, [
        r"(?i)employment\s+type[:\s]+(.+)",
        r"(?i)(permanent|fixed.term|casual)\s+(?:position|role|contract)",
    ])
    if re.search(r"(?i)fixed.term|contract", employment_type_raw or raw_text[:500]):
        employment_type = EmploymentType.FIXED_TERM.value
    elif re.search(r"(?i)casual", employment_type_raw or ""):
        employment_type = EmploymentType.CASUAL.value
    else:
        employment_type = EmploymentType.PERMANENT.value

    closing_date_raw = _extract_field(raw_text, [
        r"(?i)closing\s+date[:\s]+(.+)",
        r"(?i)applications?\s+close[:\s]+(.+)",
        r"(?i)apply\s+by[:\s]+(.+)",
        r"(?i)closes?[:\s]+(.+)",
    ])

    overview = sections.get("overview", "").strip() or raw_text[:500].strip()

    return {
        "title": title,
        "organisation": organisation,
        "department": department,
        "location": location,
        "salary_band": salary_band,
        "employment_type": employment_type,
        "closing_date": closing_date_raw,
        "overview": overview,
        "responsibilities": _lines_to_list(sections.get("responsibilities", "")),
        "required_skills":  _lines_to_list(sections.get("required_skills", "")),
        "preferred_skills": _lines_to_list(sections.get("preferred_skills", "")),
        "qualifications":   _lines_to_list(sections.get("qualifications", "")),
        "competencies":     _lines_to_list(sections.get("competencies", "")),
        "status":      JobStatus.DRAFT.value,
        "source_file": source_file,
    }


# ---------------------------------------------------------------------------
# Tool 2 — Validate completeness
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Validate a parsed JD dict for completeness against NZ public sector standards. "
        "Returns missing_fields and warnings. Call after parse_job_description."
    ),
    parameters={
        "type": "object",
        "properties": {
            "jd_json": {"type": "string", "description": "JSON string of the parsed JD dict"},
        },
        "required": ["jd_json"],
    },
)
def validate_jd_completeness(jd_json: str) -> dict:
    import json
    jd_dict = json.loads(jd_json)

    required_fields = ["title", "organisation", "location", "overview", "responsibilities", "required_skills"]
    missing_fields = [
        f for f in required_fields
        if not jd_dict.get(f) or (isinstance(jd_dict[f], list) and not jd_dict[f])
    ]

    warnings: list[str] = []
    if not jd_dict.get("salary_band"):
        warnings.append("No salary band — NZ public sector roles should include a salary band.")
    if not jd_dict.get("closing_date"):
        warnings.append("No closing date — NZ public sector JDs typically close 3–4 weeks after advertising.")

    competencies = jd_dict.get("competencies", [])
    has_treaty = any(re.search(r"(?i)te\s+tiriti|treaty|waitangi|bicultural", c) for c in competencies)
    if not has_treaty:
        warnings.append("Missing Treaty of Waitangi competency — standard in NZ public sector.")

    return {
        "is_complete": not missing_fields,
        "missing_fields": missing_fields,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# Tool 3 — Enrich with NZ context (rule-based)
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Enrich a parsed JD dict with NZ public sector context: normalise location, "
        "add Treaty of Waitangi competency, suggest salary band from title if missing. "
        "Call after validate_jd_completeness."
    ),
    parameters={
        "type": "object",
        "properties": {
            "jd_json": {"type": "string", "description": "JSON string of the parsed JD dict"},
        },
        "required": ["jd_json"],
    },
)
def enrich_jd_with_nz_context(jd_json: str) -> dict:
    import json
    jd_dict = json.loads(jd_json)
    enriched = dict(jd_dict)

    # Normalise location
    loc = enriched.get("location", "")
    if loc and "New Zealand" not in loc and "NZ" not in loc:
        for city in _NZ_CITIES:
            if city.lower() in loc.lower():
                enriched["location"] = f"{city}, New Zealand"
                break
        else:
            enriched["location"] = f"{loc}, New Zealand"
    elif not loc:
        enriched["location"] = "Wellington, New Zealand"

    # Ensure Treaty competency
    competencies = list(enriched.get("competencies", []))
    has_treaty = any(re.search(r"(?i)te\s+tiriti|treaty|waitangi|bicultural", c) for c in competencies)
    if not has_treaty:
        competencies = [_TREATY_COMPETENCY] + competencies
    existing_lower = {c.lower() for c in competencies}
    for comp in _STANDARD_COMPETENCIES:
        if comp.lower() not in existing_lower:
            competencies.append(comp)
    enriched["competencies"] = competencies

    # Suggest salary band from title seniority
    if not enriched.get("salary_band"):
        title = enriched.get("title", "")
        for pattern, band in _SENIORITY_SALARY_MAP:
            if re.search(pattern, title):
                enriched["salary_band"] = band
                break
        else:
            enriched["salary_band"] = "Band 3: $75,000 - $95,000"

    return enriched


# ---------------------------------------------------------------------------
# Tool 4 — AI gap-fill (Groq) for hard-to-parse JDs
# ---------------------------------------------------------------------------

@agent_tool(
    description=(
        "Use AI to extract or infer fields that regex couldn't parse — e.g. skills buried "
        "in prose, a missing overview summary, or ambiguous competencies. "
        "Call this only when parse_job_description left important fields empty."
    ),
    parameters={
        "type": "object",
        "properties": {
            "raw_text":      {"type": "string", "description": "The original raw JD text"},
            "missing_fields": {"type": "array", "items": {"type": "string"},
                               "description": "List of field names that are empty"},
        },
        "required": ["raw_text", "missing_fields"],
    },
)
def ai_fill_missing_fields(raw_text: str, missing_fields: list[str]) -> dict:
    import json, os, httpx
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return {}

    prompt = f"""You are an NZ public sector HR specialist.
Extract the following fields from this job description.
If a field isn't explicitly stated, make a reasonable inference from context.
Fields needed: {missing_fields}

Job Description:
{raw_text[:4000]}

Return a JSON object with only the requested fields.
For list fields (responsibilities, required_skills, etc.) return an array of strings.
JSON only."""

    resp = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": "You are an NZ public sector HR specialist. Return only valid JSON."},
                {"role": "user",   "content": prompt},
            ],
            "max_tokens": 2048,
            "temperature": 0.1,
        },
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"]
    try:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        return json.loads(m.group()) if m else {}
    except (json.JSONDecodeError, AttributeError):
        return {}


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are an expert NZ public sector HR advisor who analyses job descriptions.

Your process:
1. Call parse_job_description to extract structured fields from the raw text
2. Call validate_jd_completeness to find what's missing
3. If important fields are missing (required_skills, overview, organisation) → call ai_fill_missing_fields
4. Call enrich_jd_with_nz_context to apply NZ public sector standards
5. Return the final enriched JD

NZ public sector standards you enforce:
- Every JD must include Treaty of Waitangi / Te Tiriti commitment
- Salary bands must reflect NZ government bands (not private sector)
- Location must reference a NZ city
- Required skills must be realistic and achievable
- Competencies must align with the Leadership Success Profile

Always call enrich_jd_with_nz_context as the final step."""

_analyst_agent = GroqAgent(
    system_prompt=_SYSTEM_PROMPT,
    tools=[parse_job_description, validate_jd_completeness, enrich_jd_with_nz_context, ai_fill_missing_fields],
    max_iterations=8,
    temperature=0.1,
)


# ---------------------------------------------------------------------------
# Public interface — called by the API route
# ---------------------------------------------------------------------------

def analyse_job(raw_input: str, is_file_path: bool = False) -> dict:
    """
    Analyse a job description. The agent parses, validates, AI-fills gaps,
    and enriches — deciding autonomously which steps are needed.
    """
    if is_file_path:
        text = extract_text_from_pdf(raw_input)
        source_file = raw_input
    else:
        text = extract_text_from_string(raw_input)
        source_file = ""

    import json

    # Run the agent — it decides the tool sequence
    _analyst_agent.run(
        f"Analyse this job description and return a complete, enriched JD:\n\n{text[:6000]}"
    )

    # Collect results via direct tool calls for structured output
    jd_dict = parse_job_description.fn(raw_text=text, source_file=source_file)
    validation = json.loads(validate_jd_completeness.fn(jd_json=json.dumps(jd_dict)))

    # AI gap-fill if needed
    if validation.get("missing_fields"):
        filled = ai_fill_missing_fields.fn(raw_text=text, missing_fields=validation["missing_fields"])
        for field, value in filled.items():
            if value and not jd_dict.get(field):
                jd_dict[field] = value

    enriched_dict = enrich_jd_with_nz_context.fn(jd_json=json.dumps(jd_dict))

    return {
        "job_description": enriched_dict,
        "validation": validation,
        "enriched": True,
    }
