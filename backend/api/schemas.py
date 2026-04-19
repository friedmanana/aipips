from __future__ import annotations

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class AnalyseJobRequest(BaseModel):
    raw_text: str
    source_file: str = ""


class SourceCandidatesRequest(BaseModel):
    job: dict
    max_results: int = 10


class ScreenCandidatesRequest(BaseModel):
    candidates: list[dict]
    job: dict


class ScreenUploadedCVsRequest(BaseModel):
    cv_texts: list[str]
    raw_jd_text: str


class UploadCVsRequest(BaseModel):
    cv_texts: list[str]


class RunFullPipelineRequest(BaseModel):
    raw_jd_text: str


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class JobAnalysisResponse(BaseModel):
    job: dict
    validation: dict
    enriched: bool


class SourcingResponse(BaseModel):
    job_title: str
    organisation: str
    total_found: int
    total_scored: int
    total_platform: int = 0
    total_external: int = 0
    shortlisted: list[dict]
    for_review: list[dict]
    all_scored: list[dict]


class ScreeningResponse(BaseModel):
    total_screened: int
    shortlisted: list[dict]
    second_round: list[dict]
    hold: list[dict]
    declined: list[dict]
    all_screened: list[dict]


class FullPipelineResponse(BaseModel):
    job: dict
    validation: dict
    total_sourced: int
    shortlisted: list[dict]
    second_round: list[dict]
    all_screened: list[dict]


class HealthResponse(BaseModel):
    status: str
    version: str
