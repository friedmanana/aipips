"""Basic tests for Pydantic models."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from models import (
    Candidate,
    CandidateScore,
    CandidateSource,
    EmploymentType,
    JobDescription,
    JobStatus,
)

# ---------------------------------------------------------------------------
# JobDescription tests
# ---------------------------------------------------------------------------


class TestJobDescription:
    """Tests for the JobDescription model."""

    def test_instantiation_with_valid_data(self):
        """JobDescription can be created from valid data matching example_jobs.json."""
        job = JobDescription(
            id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            title="Senior Policy Analyst",
            organisation="Ministry of Business, Innovation and Employment",
            department="Labour Market Policy",
            location="Wellington",
            salary_band="Band 4: $100,000 - $120,000",
            employment_type=EmploymentType.PERMANENT,
            closing_date=datetime(2026, 5, 15, 23, 59, 0),
            overview="The Ministry of Business, Innovation and Employment is seeking an experienced Senior Policy Analyst.",
            responsibilities=["Lead the development of policy advice"],
            required_skills=["Policy analysis and development"],
            preferred_skills=["Experience with te reo Māori"],
            qualifications=["Tertiary qualification in Economics"],
            competencies=["Strategic thinking"],
            status=JobStatus.OPEN,
        )

        assert job.title == "Senior Policy Analyst"
        assert job.organisation == "Ministry of Business, Innovation and Employment"
        assert job.department == "Labour Market Policy"
        assert job.location == "Wellington"
        assert job.salary_band == "Band 4: $100,000 - $120,000"
        assert job.employment_type == EmploymentType.PERMANENT.value
        assert job.status == JobStatus.OPEN.value

    def test_default_status_is_draft(self):
        """JobDescription status defaults to DRAFT when not provided."""
        job = JobDescription(
            title="Policy Analyst",
            organisation="MBIE",
            department="Labour",
            location="Wellington",
            salary_band="Band 3: $80,000 - $100,000",
            employment_type=EmploymentType.PERMANENT,
            closing_date=datetime(2026, 6, 1),
            overview="Overview text",
            responsibilities=["Responsibility 1"],
            required_skills=["Skill 1"],
            preferred_skills=[],
            qualifications=["Degree"],
            competencies=["Communication"],
        )

        assert job.status == JobStatus.DRAFT.value

    def test_id_is_auto_generated(self):
        """JobDescription auto-generates a UUID id when not provided."""
        job = JobDescription(
            title="Policy Analyst",
            organisation="MBIE",
            department="Labour",
            location="Wellington",
            salary_band="Band 3",
            employment_type=EmploymentType.FIXED_TERM,
            closing_date=datetime(2026, 6, 1),
            overview="Overview",
            responsibilities=[],
            required_skills=[],
            preferred_skills=[],
            qualifications=[],
            competencies=[],
        )

        assert job.id is not None


# ---------------------------------------------------------------------------
# Candidate tests
# ---------------------------------------------------------------------------


class TestCandidate:
    """Tests for the Candidate model."""

    def test_instantiation_with_valid_data(self):
        """Candidate can be created with all required fields."""
        candidate = Candidate(
            full_name="Jane Smith",
            location="Wellington",
            source=CandidateSource.DIRECT_APPLY,
            current_title="Policy Analyst",
            current_organisation="Ministry of Social Development",
            years_experience=5,
            skills=["Policy analysis", "Stakeholder engagement"],
            qualifications=["Bachelor of Arts (Political Science)"],
            summary="Experienced policy analyst with 5 years in central government.",
        )

        assert candidate.full_name == "Jane Smith"
        assert candidate.location == "Wellington"
        assert candidate.source == CandidateSource.DIRECT_APPLY.value
        assert candidate.years_experience == 5
        assert len(candidate.skills) == 2

    def test_optional_fields_default_to_none(self):
        """Optional fields on Candidate default to None."""
        candidate = Candidate(
            full_name="John Doe",
            location="Auckland",
            source=CandidateSource.SEEK,
            current_title="Analyst",
            current_organisation="Dept of Conservation",
            years_experience=3,
            skills=["Research"],
            qualifications=["Bachelor of Science"],
            summary="Analyst with 3 years experience.",
        )

        assert candidate.email is None
        assert candidate.phone is None
        assert candidate.linkedin_url is None
        assert candidate.raw_cv_text is None

    def test_id_is_auto_generated(self):
        """Candidate auto-generates a UUID id when not provided."""
        candidate = Candidate(
            full_name="Alice Brown",
            location="Christchurch",
            source=CandidateSource.LINKEDIN_XRAY,
            current_title="Senior Analyst",
            current_organisation="NZTA",
            years_experience=7,
            skills=["Data analysis"],
            qualifications=["Master of Public Policy"],
            summary="Senior analyst with transport policy expertise.",
        )

        assert candidate.id is not None


# ---------------------------------------------------------------------------
# CandidateScore tests
# ---------------------------------------------------------------------------


class TestCandidateScore:
    """Tests for the CandidateScore model including score validation."""

    def _valid_score(self, **overrides):
        """Return a dict of valid CandidateScore data, with optional overrides."""
        data = {
            "candidate_id": uuid4(),
            "job_id": uuid4(),
            "overall_score": 75.0,
            "skill_match_score": 80.0,
            "experience_score": 70.0,
            "qualification_score": 75.0,
            "notes": "Strong candidate with relevant policy experience.",
        }
        data.update(overrides)
        return data

    def test_instantiation_with_valid_scores(self):
        """CandidateScore can be created with scores in valid range [0, 100]."""
        score = CandidateScore(**self._valid_score())

        assert score.overall_score == 75.0
        assert score.skill_match_score == 80.0

    def test_boundary_scores_accepted(self):
        """CandidateScore accepts boundary values 0 and 100."""
        score_zero = CandidateScore(**self._valid_score(overall_score=0.0, skill_match_score=0.0,
                                                        experience_score=0.0, qualification_score=0.0))
        score_hundred = CandidateScore(**self._valid_score(overall_score=100.0, skill_match_score=100.0,
                                                           experience_score=100.0, qualification_score=100.0))

        assert score_zero.overall_score == 0.0
        assert score_hundred.overall_score == 100.0

    def test_overall_score_above_100_rejected(self):
        """CandidateScore rejects overall_score greater than 100."""
        with pytest.raises(ValidationError):
            CandidateScore(**self._valid_score(overall_score=101.0))

    def test_overall_score_below_0_rejected(self):
        """CandidateScore rejects overall_score less than 0."""
        with pytest.raises(ValidationError):
            CandidateScore(**self._valid_score(overall_score=-1.0))

    def test_skill_match_score_above_100_rejected(self):
        """CandidateScore rejects skill_match_score greater than 100."""
        with pytest.raises(ValidationError):
            CandidateScore(**self._valid_score(skill_match_score=100.1))

    def test_experience_score_below_0_rejected(self):
        """CandidateScore rejects experience_score less than 0."""
        with pytest.raises(ValidationError):
            CandidateScore(**self._valid_score(experience_score=-0.1))

    def test_qualification_score_above_100_rejected(self):
        """CandidateScore rejects qualification_score greater than 100."""
        with pytest.raises(ValidationError):
            CandidateScore(**self._valid_score(qualification_score=200.0))


# ---------------------------------------------------------------------------
# JobStatus enum tests
# ---------------------------------------------------------------------------


class TestJobStatusEnum:
    """Tests for the JobStatus enum."""

    def test_enum_values_exist(self):
        """JobStatus has all expected string values."""
        assert JobStatus.DRAFT.value == "DRAFT"
        assert JobStatus.OPEN.value == "OPEN"
        assert JobStatus.CLOSED.value == "CLOSED"
        assert JobStatus.FILLED.value == "FILLED"

    def test_all_members_present(self):
        """JobStatus enum contains exactly the expected members."""
        members = {member.value for member in JobStatus}
        assert members == {"DRAFT", "OPEN", "CLOSED", "FILLED"}

    def test_is_string_enum(self):
        """JobStatus is a string enum (inherits from str)."""
        assert isinstance(JobStatus.OPEN, str)
        assert JobStatus.OPEN == "OPEN"
