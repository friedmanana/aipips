from __future__ import annotations

from agents.job_analyst_agent import (
    enrich_jd_with_nz_context,
    parse_job_description,
    validate_jd_completeness,
)
from tools.jd_parser import identify_jd_sections

_SAMPLE_JD = """
Senior Policy Analyst

Organisation: Ministry of Business, Innovation and Employment
Department: Labour Market Policy
Location: Wellington
Employment Type: Permanent

Overview

MBIE is seeking a Senior Policy Analyst to join the Labour Market Policy team.
You will develop high-quality, evidence-based policy advice for Ministers and senior officials.

Key Responsibilities

- Lead development of policy advice on complex labour market issues
- Undertake quantitative and qualitative research
- Engage with Māori and Pasifika communities and industry stakeholders
- Prepare Cabinet papers, briefing notes, and ministerial correspondence
- Represent MBIE at cross-agency working groups

Required Skills

- Policy analysis and development
- Stakeholder engagement and relationship management
- Cabinet paper writing
- Data analysis and interpretation
- Project management

Preferred Skills

- Experience with te reo Māori or tikanga Māori
- Knowledge of immigration policy
- Familiarity with Stats NZ datasets

Qualifications

- Tertiary qualification in Economics, Public Policy, Law, or Social Sciences
- Postgraduate qualification preferred

Competencies

- Strategic thinking
- Delivering results
- Written and oral communication
""".strip()


class TestIdentifyJdSections:
    def test_returns_expected_keys(self):
        sections = identify_jd_sections(_SAMPLE_JD)
        expected_keys = {
            "overview",
            "responsibilities",
            "required_skills",
            "preferred_skills",
            "qualifications",
            "competencies",
        }
        assert set(sections.keys()) == expected_keys

    def test_overview_is_populated(self):
        sections = identify_jd_sections(_SAMPLE_JD)
        assert sections["overview"]

    def test_responsibilities_is_populated(self):
        sections = identify_jd_sections(_SAMPLE_JD)
        assert sections["responsibilities"]

    def test_required_skills_is_populated(self):
        sections = identify_jd_sections(_SAMPLE_JD)
        assert sections["required_skills"]

    def test_qualifications_is_populated(self):
        sections = identify_jd_sections(_SAMPLE_JD)
        assert sections["qualifications"]


class TestParseJobDescriptionFromText:
    def test_returns_title(self):
        result = parse_job_description(_SAMPLE_JD)
        assert result["title"]
        assert isinstance(result["title"], str)

    def test_returns_responsibilities_list(self):
        result = parse_job_description(_SAMPLE_JD)
        assert isinstance(result["responsibilities"], list)
        assert len(result["responsibilities"]) > 0

    def test_returns_required_skills_list(self):
        result = parse_job_description(_SAMPLE_JD)
        assert isinstance(result["required_skills"], list)
        assert len(result["required_skills"]) > 0

    def test_location_defaults_when_found(self):
        result = parse_job_description(_SAMPLE_JD)
        assert "Wellington" in result["location"]

    def test_employment_type_defaults_to_permanent(self):
        minimal_jd = "Policy Analyst\nThis is a great role in government."
        result = parse_job_description(minimal_jd)
        assert result["employment_type"] == "permanent"

    def test_location_defaults_to_wellington_when_missing(self):
        minimal_jd = "Policy Analyst\nA challenging and rewarding opportunity."
        result = parse_job_description(minimal_jd)
        assert result["location"] == "Wellington, New Zealand"


class TestValidateJdCompletenessMissingFields:
    def test_incomplete_jd_returns_false(self):
        incomplete = {
            "title": "Policy Analyst",
            "organisation": "",
            "department": "",
            "location": "Wellington",
            "overview": "",
            "responsibilities": [],
            "required_skills": [],
        }
        result = validate_jd_completeness(incomplete)
        assert result["is_complete"] is False

    def test_missing_fields_list_is_populated(self):
        incomplete = {
            "title": "Policy Analyst",
            "organisation": "",
            "department": "",
            "location": "Wellington",
            "overview": "Some overview",
            "responsibilities": ["Do some work"],
            "required_skills": [],
        }
        result = validate_jd_completeness(incomplete)
        assert "organisation" in result["missing_fields"] or "required_skills" in result["missing_fields"]

    def test_complete_jd_returns_true(self):
        complete = {
            "title": "Policy Analyst",
            "organisation": "MBIE",
            "department": "Labour Market Policy",
            "location": "Wellington, New Zealand",
            "overview": "Great role at MBIE.",
            "responsibilities": ["Lead policy advice"],
            "required_skills": ["Policy analysis"],
            "salary_band": "Band 4: $95,000 - $115,000",
            "closing_date": "1 May 2026",
            "competencies": ["Commitment to Te Tiriti o Waitangi"],
        }
        result = validate_jd_completeness(complete)
        assert result["is_complete"] is True
        assert result["missing_fields"] == []

    def test_missing_salary_band_adds_warning(self):
        jd = {
            "title": "Analyst",
            "organisation": "MSD",
            "department": "Policy",
            "location": "Wellington",
            "overview": "Overview",
            "responsibilities": ["Task 1"],
            "required_skills": ["Skill 1"],
            "salary_band": "",
            "closing_date": "",
            "competencies": [],
        }
        result = validate_jd_completeness(jd)
        assert any("salary" in w.lower() for w in result["warnings"])

    def test_missing_treaty_adds_warning(self):
        jd = {
            "title": "Analyst",
            "organisation": "MSD",
            "department": "Policy",
            "location": "Wellington",
            "overview": "Overview",
            "responsibilities": ["Task 1"],
            "required_skills": ["Skill 1"],
            "salary_band": "Band 3",
            "closing_date": "1 May 2026",
            "competencies": ["Communication"],
        }
        result = validate_jd_completeness(jd)
        assert any("treaty" in w.lower() or "waitangi" in w.lower() for w in result["warnings"])


class TestEnrichAddsTreatyCompetency:
    def test_adds_treaty_when_missing(self):
        jd_without_treaty = {
            "title": "Senior Advisor",
            "organisation": "Treasury",
            "department": "Fiscal Strategy",
            "location": "Wellington",
            "overview": "Senior advisory role at Treasury.",
            "responsibilities": ["Provide fiscal advice"],
            "required_skills": ["Economic analysis"],
            "preferred_skills": [],
            "qualifications": ["Economics degree"],
            "competencies": ["Stakeholder engagement", "Delivering results"],
            "salary_band": "",
            "closing_date": "",
            "employment_type": "permanent",
            "status": "DRAFT",
        }
        enriched = enrich_jd_with_nz_context(jd_without_treaty)
        competencies = enriched.get("competencies", [])
        has_treaty = any(
            "tiriti" in c.lower() or "waitangi" in c.lower()
            for c in competencies
        )
        assert has_treaty, f"Treaty competency not found in: {competencies}"

    def test_does_not_duplicate_treaty(self):
        jd_with_treaty = {
            "title": "Policy Analyst",
            "organisation": "MBIE",
            "department": "Labour",
            "location": "Wellington, New Zealand",
            "overview": "Policy role.",
            "responsibilities": ["Policy work"],
            "required_skills": ["Analysis"],
            "preferred_skills": [],
            "qualifications": [],
            "competencies": ["Commitment to Te Tiriti o Waitangi", "Communication"],
            "salary_band": "Band 3",
            "closing_date": "1 May 2026",
            "employment_type": "permanent",
            "status": "DRAFT",
        }
        enriched = enrich_jd_with_nz_context(jd_with_treaty)
        treaty_count = sum(
            1 for c in enriched.get("competencies", [])
            if "tiriti" in c.lower() or "waitangi" in c.lower()
        )
        assert treaty_count == 1

    def test_normalises_location_to_include_new_zealand(self):
        jd = {
            "title": "Manager",
            "organisation": "MSD",
            "department": "Operations",
            "location": "Auckland",
            "overview": "Management role.",
            "responsibilities": [],
            "required_skills": [],
            "preferred_skills": [],
            "qualifications": [],
            "competencies": [],
            "salary_band": "",
            "closing_date": "",
            "employment_type": "permanent",
            "status": "DRAFT",
        }
        enriched = enrich_jd_with_nz_context(jd)
        assert "New Zealand" in enriched["location"]

    def test_suggests_salary_band_from_title(self):
        jd = {
            "title": "Senior Policy Analyst",
            "organisation": "MfE",
            "department": "Policy",
            "location": "Wellington, New Zealand",
            "overview": "Senior role.",
            "responsibilities": [],
            "required_skills": [],
            "preferred_skills": [],
            "qualifications": [],
            "competencies": [],
            "salary_band": "",
            "closing_date": "",
            "employment_type": "permanent",
            "status": "DRAFT",
        }
        enriched = enrich_jd_with_nz_context(jd)
        assert enriched["salary_band"]
        assert "$" in enriched["salary_band"] or "Band" in enriched["salary_band"]
