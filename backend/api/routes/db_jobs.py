from __future__ import annotations

from fastapi import APIRouter, HTTPException

from agents.candidate_screener_agent import screen_batch
from agents.candidate_sourcing_agent import run_sourcing
from api.schemas import (
    AnalyseJobRequest,
    FullPipelineResponse,
    JobAnalysisResponse,
    RunFullPipelineRequest,
    ScreeningResponse,
    SourcingResponse,
)
from services import database as db
from services.screening_service import run_full_pipeline

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs-persistent"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _handle_runtime_error(exc: RuntimeError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /api/v1/jobs — analyse JD and persist
# ---------------------------------------------------------------------------


@router.post("", response_model=JobAnalysisResponse)
def create_job(body: AnalyseJobRequest) -> JobAnalysisResponse:
    """Analyse a raw JD text, persist the job to Supabase, and return it."""
    try:
        from agents.job_analyst_agent import analyse_job  # type: ignore[import]

        result = analyse_job(body.raw_text, is_file_path=False)
    except ImportError as exc:
        raise HTTPException(
            status_code=422, detail=f"Job analyst agent unavailable: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    job_dict = result.get("job_description", result.get("job", {}))

    try:
        saved = db.save_job(job_dict)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    return JobAnalysisResponse(
        job=saved,
        validation=result.get("validation", {}),
        enriched=bool(result.get("enriched", False)),
    )


# ---------------------------------------------------------------------------
# GET /api/v1/jobs — list jobs
# ---------------------------------------------------------------------------


@router.get("")
def list_jobs(status: str | None = None) -> list[dict]:
    """Return all persisted jobs, optionally filtered by status."""
    try:
        return db.list_jobs(status=status)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc


# ---------------------------------------------------------------------------
# GET /api/v1/jobs/{job_id} — fetch single job
# ---------------------------------------------------------------------------


@router.get("/{job_id}")
def get_job(job_id: str) -> dict:
    """Return a single job by ID, or 404 if not found."""
    try:
        job = db.get_job(job_id)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


# ---------------------------------------------------------------------------
# POST /api/v1/jobs/{job_id}/source — run sourcing and persist candidates
# ---------------------------------------------------------------------------


@router.post("/{job_id}/source", response_model=SourcingResponse)
def source_candidates(job_id: str) -> SourcingResponse:
    """Run candidate sourcing for a persisted job and save candidates to Supabase."""
    try:
        job = db.get_job(job_id)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    result = run_sourcing(job)

    # Persist each sourced candidate
    try:
        for candidate in result.get("all_scored", []):
            candidate_dict = {
                "full_name": candidate.get("name", "Unknown"),
                "current_title": candidate.get("title", ""),
                "current_organisation": "",
                "location": candidate.get("location_hint", "New Zealand"),
                "years_experience": 0,
                "skills": [],
                "qualifications": [],
                "summary": candidate.get("snippet", candidate.get("reasoning", "")),
                "linkedin_url": candidate.get("url", ""),
                "source": "LINKEDIN_XRAY",
            }
            db.save_candidate(candidate_dict)

        # Record the sourcing run
        db.get_client().table("sourcing_runs").insert(
            {
                "job_id": job_id,
                "total_found": result.get("total_found", 0),
                "total_scored": result.get("total_scored", 0),
            }
        ).execute()
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    return SourcingResponse(**result)


# ---------------------------------------------------------------------------
# POST /api/v1/jobs/{job_id}/screen — screen candidates and persist results
# ---------------------------------------------------------------------------


@router.post("/{job_id}/screen", response_model=ScreeningResponse)
def screen_candidates(job_id: str) -> ScreeningResponse:
    """Screen all sourced candidates for a job and save results to Supabase."""
    try:
        job = db.get_job(job_id)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    try:
        candidates = db.list_candidates_for_job(job_id)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    all_screened = screen_batch(candidates, job) if candidates else []

    # Persist each screening result
    try:
        for screened in all_screened:
            result_dict = {
                "job_id": job_id,
                "candidate_id": screened.get("candidate_id") or screened.get("id"),
                "overall_score": screened.get("overall_score", 0),
                "skill_match_score": screened.get("skill_match_score", 0),
                "experience_score": screened.get("experience_score", 0),
                "qualification_score": screened.get("qualification_score", 0),
                "nz_fit_score": screened.get("nz_fit_score", 0),
                "recommendation": screened.get("recommendation", "HOLD"),
                "recommendation_reason": screened.get("recommendation_reason"),
                "strengths": screened.get("strengths", []),
                "concerns": screened.get("concerns", []),
                "interview_flags": screened.get("interview_flags", []),
                "notes": screened.get("notes"),
            }
            db.save_screening_result(result_dict)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    shortlisted = [c for c in all_screened if c.get("recommendation") == "SHORTLIST"]
    second_round = [c for c in all_screened if c.get("recommendation") == "SECOND_ROUND"]
    hold = [c for c in all_screened if c.get("recommendation") == "HOLD"]
    declined = [c for c in all_screened if c.get("recommendation") == "DECLINE"]

    return ScreeningResponse(
        total_screened=len(all_screened),
        shortlisted=shortlisted,
        second_round=second_round,
        hold=hold,
        declined=declined,
        all_screened=all_screened,
    )


# ---------------------------------------------------------------------------
# GET /api/v1/jobs/{job_id}/shortlist — retrieve shortlist
# ---------------------------------------------------------------------------


@router.get("/{job_id}/shortlist")
def get_shortlist(job_id: str) -> list[dict]:
    """Return the shortlisted candidates for a job from Supabase."""
    try:
        job = db.get_job(job_id)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    try:
        return db.get_shortlist(job_id)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc


# ---------------------------------------------------------------------------
# POST /api/v1/jobs/pipeline — run full pipeline and persist everything
# ---------------------------------------------------------------------------


@router.post("/pipeline", response_model=FullPipelineResponse)
def run_pipeline(body: RunFullPipelineRequest) -> FullPipelineResponse:
    """Run the full recruitment pipeline and persist all data to Supabase."""
    try:
        result = run_full_pipeline(body.raw_jd_text)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Pipeline failed: {exc}") from exc

    job_dict = result.get("job", {})

    try:
        saved_job = db.save_job(job_dict)
        job_id = saved_job.get("id")

        for candidate in result.get("all_screened", []):
            candidate_dict = {
                "full_name": candidate.get("full_name", "Unknown"),
                "current_title": candidate.get("current_title", ""),
                "current_organisation": candidate.get("current_organisation", ""),
                "location": candidate.get("location", "New Zealand"),
                "years_experience": candidate.get("years_experience", 0),
                "skills": candidate.get("skills", []),
                "qualifications": candidate.get("qualifications", []),
                "summary": candidate.get("summary", ""),
                "linkedin_url": candidate.get("linkedin_url"),
                "source": "LINKEDIN_XRAY",
            }
            saved_candidate = db.save_candidate(candidate_dict)
            candidate_id = saved_candidate.get("id")

            result_dict = {
                "job_id": job_id,
                "candidate_id": candidate_id,
                "overall_score": candidate.get("overall_score", 0),
                "skill_match_score": candidate.get("skill_match_score", 0),
                "experience_score": candidate.get("experience_score", 0),
                "qualification_score": candidate.get("qualification_score", 0),
                "nz_fit_score": candidate.get("nz_fit_score", 0),
                "recommendation": candidate.get("recommendation", "HOLD"),
                "recommendation_reason": candidate.get("recommendation_reason"),
                "strengths": candidate.get("strengths", []),
                "concerns": candidate.get("concerns", []),
                "interview_flags": candidate.get("interview_flags", []),
                "notes": candidate.get("notes"),
            }
            db.save_screening_result(result_dict)

    except RuntimeError as exc:
        raise _handle_runtime_error(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to persist results: {exc}") from exc

    return FullPipelineResponse(
        job=result.get("job", {}),
        validation=result.get("validation", {}),
        total_sourced=result.get("total_sourced", 0),
        shortlisted=result.get("shortlisted", []),
        second_round=result.get("second_round", []),
        all_screened=result.get("all_screened", []),
    )
