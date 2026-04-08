from __future__ import annotations

import json
import os

import pytest

from agents.candidate_screener_agent import (
    generate_screening_report,
    score_experience,
    score_nz_public_sector_fit,
    score_skill_match,
    screen_batch,
)

# ---------------------------------------------------------------------------
# Fixtures — load example data
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


@pytest.fixture(scope="module")
def example_jobs() -> list[dict]:
    with open(os.path.join(DATA_DIR, "example_jobs.json")) as fh:
        return json.load(fh)


@pytest.fixture(scope="module")
def example_candidates() -> list[dict]:
    with open(os.path.join(DATA_DIR, "example_candidates.json")) as fh:
        return json.load(fh)


@pytest.fixture(scope="module")
def policy_job(example_jobs: list[dict]) -> dict:
    """Senior Policy Analyst job (first entry in example_jobs.json)."""
    return example_jobs[0]


@pytest.fixture(scope="module")
def ict_job(example_jobs: list[dict]) -> dict:
    """ICT Project Manager job (second entry)."""
    return example_jobs[1]


# ---------------------------------------------------------------------------
# score_skill_match tests
# ---------------------------------------------------------------------------


class TestScoreSkillMatch:
    def test_score_skill_match_perfect(self, policy_job: dict) -> None:
        """Candidate who has all required skills should score close to 100."""
        required = policy_job["required_skills"]
        result = score_skill_match(
            candidate_skills=required,
            required_skills=required,
            preferred_skills=[],
        )
        assert result["required_match_pct"] == pytest.approx(100.0)
        assert result["score"] >= 80.0
        assert result["missing_required"] == []

    def test_score_skill_match_partial(self, policy_job: dict) -> None:
        """Candidate with ~50% of required skills should score in lower range."""
        required = policy_job["required_skills"]
        half = required[: len(required) // 2]
        result = score_skill_match(
            candidate_skills=half,
            required_skills=required,
            preferred_skills=[],
        )
        # Required match pct should be around 50% (allow rounding)
        assert result["required_match_pct"] <= 60.0
        assert result["score"] < 60.0
        assert len(result["missing_required"]) > 0

    def test_score_skill_match_fuzzy(self) -> None:
        """'AWS' in candidate skills should match 'Amazon Web Services' in required skills."""
        result = score_skill_match(
            candidate_skills=["AWS", "Project management"],
            required_skills=["Amazon Web Services", "Project management"],
            preferred_skills=[],
        )
        assert "Amazon Web Services" in result["matched_required"]
        assert result["required_match_pct"] == pytest.approx(100.0)

    def test_score_skill_match_empty_candidate(self, policy_job: dict) -> None:
        """Candidate with no skills should score 0."""
        result = score_skill_match(
            candidate_skills=[],
            required_skills=policy_job["required_skills"],
            preferred_skills=policy_job["preferred_skills"],
        )
        assert result["required_match_pct"] == pytest.approx(0.0)
        assert result["score"] == pytest.approx(0.0)
        assert result["matched_required"] == []
        assert len(result["missing_required"]) == len(policy_job["required_skills"])


# ---------------------------------------------------------------------------
# score_experience tests
# ---------------------------------------------------------------------------


class TestScoreExperience:
    def test_score_experience_senior_match(self, policy_job: dict) -> None:
        """Senior candidate (7 years, senior title, public sector) for senior role — high score."""
        result = score_experience(
            candidate_years=7,
            candidate_title="Senior Policy Analyst",
            candidate_org="Ministry of Social Development",
            job_title=policy_job["title"],
            job_overview=policy_job["overview"],
        )
        assert result["overall_score"] >= 75.0
        assert result["seniority_score"] >= 80.0

    def test_score_experience_junior_for_senior(self, policy_job: dict) -> None:
        """Candidate with 1 year experience for a senior role should score low."""
        result = score_experience(
            candidate_years=1,
            candidate_title="Graduate Policy Analyst",
            candidate_org="Ministry for the Environment",
            job_title=policy_job["title"],
            job_overview=policy_job["overview"],
        )
        assert result["years_score"] <= 25.0
        assert result["overall_score"] < 55.0


# ---------------------------------------------------------------------------
# score_nz_public_sector_fit tests
# ---------------------------------------------------------------------------


class TestScoreNzFit:
    def test_nz_fit_strong_public_sector(self, policy_job: dict) -> None:
        """Candidate with NZ public sector org and Treaty/bicultural language — high scores."""
        result = score_nz_public_sector_fit(
            candidate_summary=(
                "Seven years in NZ public sector policy with strong commitment to Treaty of Waitangi "
                "obligations and kaupapa Māori approaches. Skilled in stakeholder engagement and "
                "equity-focused policy development with iwi and Pasifika communities."
            ),
            candidate_org="Ministry of Social Development",
            job_competencies=policy_job["competencies"],
        )
        assert result["treaty_capability_score"] >= 75.0
        assert result["nz_context_score"] >= 90.0
        assert result["overall_score"] >= 75.0

    def test_nz_fit_private_sector_only(self, ict_job: dict) -> None:
        """Private sector only candidate — lower nz_context_score."""
        result = score_nz_public_sector_fit(
            candidate_summary=(
                "Experienced digital programme manager in financial services. "
                "Led large-scale cloud migrations for ANZ Bank. "
                "Strong delivery credentials and executive stakeholder skills."
            ),
            candidate_org="ANZ Bank New Zealand",
            job_competencies=ict_job["competencies"],
        )
        assert result["nz_context_score"] < 70.0
        # Flags should mention public sector experience gap
        flags_text = " ".join(result["flags"]).lower()
        assert any(
            phrase in flags_text
            for phrase in ("public sector", "private sector", "no nz public sector", "no treaty")
        )


# ---------------------------------------------------------------------------
# generate_screening_report tests
# ---------------------------------------------------------------------------


class TestGenerateScreeningReport:
    def _mock_skill_score(self, score: float = 80.0) -> dict:
        return {
            "score": score,
            "required_match_pct": score,
            "preferred_match_pct": 50.0,
            "matched_required": ["Policy analysis", "Stakeholder engagement"],
            "matched_preferred": ["Te reo Māori"],
            "missing_required": ["Cabinet paper writing"] if score < 100 else [],
        }

    def _mock_experience_score(self, overall: float = 80.0) -> dict:
        return {
            "overall_score": overall,
            "years_score": 100.0,
            "seniority_score": overall,
            "sector_relevance_score": 90.0,
            "notes": "7 years experience for senior-level role. Seniority level aligns well.",
        }

    def _mock_fit_score(self, overall: float = 75.0) -> dict:
        return {
            "overall_score": overall,
            "treaty_capability_score": 80.0,
            "public_sector_values_score": 70.0,
            "nz_context_score": 90.0,
            "flags": ["Strong Treaty/bicultural commitment evident in CV."],
        }

    def test_generate_screening_report_structure(self, policy_job: dict, example_candidates: list[dict]) -> None:
        """Report dict has all required keys."""
        candidate = example_candidates[0]  # Aroha Ngata
        skill_score = self._mock_skill_score()
        experience_score = self._mock_experience_score()
        fit_score = self._mock_fit_score()

        report = generate_screening_report(
            candidate=candidate,
            job=policy_job,
            skill_score=skill_score,
            experience_score=experience_score,
            fit_score=fit_score,
        )

        required_keys = [
            "overall_score",
            "recommendation",
            "recommendation_reason",
            "interview_flags",
            "strengths",
            "concerns",
        ]
        for key in required_keys:
            assert key in report, f"Missing key: {key}"

        assert isinstance(report["overall_score"], float)
        assert report["recommendation"] in ("SHORTLIST", "SECOND_ROUND", "HOLD", "DECLINE")
        assert isinstance(report["recommendation_reason"], str)
        assert len(report["recommendation_reason"]) > 10
        assert isinstance(report["interview_flags"], list)
        assert isinstance(report["strengths"], list)
        assert isinstance(report["concerns"], list)

    def test_generate_screening_report_high_score_shortlists(self, policy_job: dict, example_candidates: list[dict]) -> None:
        """High component scores produce a SHORTLIST recommendation."""
        candidate = example_candidates[0]
        report = generate_screening_report(
            candidate=candidate,
            job=policy_job,
            skill_score=self._mock_skill_score(score=90.0),
            experience_score=self._mock_experience_score(overall=90.0),
            fit_score=self._mock_fit_score(overall=90.0),
        )
        assert report["recommendation"] == "SHORTLIST"
        assert report["overall_score"] >= 75.0

    def test_generate_screening_report_low_score_declines(self, policy_job: dict, example_candidates: list[dict]) -> None:
        """Low component scores produce a DECLINE recommendation."""
        candidate = example_candidates[3]  # Connor Walsh — junior
        report = generate_screening_report(
            candidate=candidate,
            job=policy_job,
            skill_score=self._mock_skill_score(score=20.0),
            experience_score=self._mock_experience_score(overall=25.0),
            fit_score=self._mock_fit_score(overall=20.0),
        )
        assert report["recommendation"] == "DECLINE"
        assert report["overall_score"] < 45.0


# ---------------------------------------------------------------------------
# screen_batch integration test
# ---------------------------------------------------------------------------


class TestScreenBatch:
    def test_screen_batch_sorted(self, policy_job: dict) -> None:
        """Batch screening returns results sorted by overall_score descending."""
        strong_candidate = {
            "id": "00000000-0000-0000-0000-000000000001",
            "full_name": "Strong Candidate",
            "current_title": "Senior Policy Analyst",
            "current_organisation": "Ministry of Social Development",
            "years_experience": 8,
            "skills": [
                "Policy analysis and development",
                "Stakeholder engagement",
                "Cabinet paper writing",
                "Quantitative research",
                "Labour market economics or industrial relations knowledge",
                "Project management",
                "Data analysis",
                "Treaty of Waitangi policy",
            ],
            "qualifications": ["Master of Public Policy"],
            "summary": (
                "Senior policy analyst with 8 years in NZ public sector. Deep commitment to "
                "Treaty of Waitangi obligations, tikanga Māori, and kaupapa Māori policy approaches. "
                "Expert in Cabinet papers, stakeholder engagement, equity, and stewardship."
            ),
        }

        moderate_candidate = {
            "id": "00000000-0000-0000-0000-000000000002",
            "full_name": "Moderate Candidate",
            "current_title": "Policy Analyst",
            "current_organisation": "Department of Conservation",
            "years_experience": 4,
            "skills": [
                "Policy analysis and development",
                "Stakeholder engagement",
                "Data analysis",
            ],
            "qualifications": ["Bachelor of Arts"],
            "summary": (
                "Mid-level policy analyst with 4 years experience in environmental policy. "
                "Some stakeholder engagement experience."
            ),
        }

        weak_candidate = {
            "id": "00000000-0000-0000-0000-000000000003",
            "full_name": "Weak Candidate",
            "current_title": "Sales Representative",
            "current_organisation": "Retail NZ Ltd",
            "years_experience": 1,
            "skills": ["Customer service", "Microsoft Word"],
            "qualifications": ["NCEA Level 3"],
            "summary": "One year in retail sales. Looking for a career change.",
        }

        results = screen_batch([weak_candidate, strong_candidate, moderate_candidate], policy_job)

        assert len(results) == 3

        # Check sorted descending
        scores = [r["overall_score"] for r in results]
        assert scores == sorted(scores, reverse=True), "Results not sorted by overall_score descending."

        # Strong candidate should be first
        assert results[0]["candidate_name"] == "Strong Candidate"

        # Weak candidate should be last
        assert results[-1]["candidate_name"] == "Weak Candidate"
