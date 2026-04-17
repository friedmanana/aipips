"""Candidate portal API routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from agents.cv_enhancement_agent import (
    enhance_cover_letter,
    enhance_cv,
    generate_cover_letter,
    generate_cv,
    generate_interview_qa,
)
from api.auth import get_current_user
from services import database as db

router = APIRouter(prefix="/api/v1/candidate", tags=["candidate-portal"])


class CreateApplicationRequest(BaseModel):
    job_title: str
    company: str = ""
    job_description_text: str = ""


class UpdateApplicationRequest(BaseModel):
    job_title: str | None = None
    company: str | None = None
    job_description_text: str | None = None
    status: str | None = None


class UpsertProfileRequest(BaseModel):
    full_name: str
    email: str = ""


class UploadCvRequest(BaseModel):
    content_text: str


class UpsertInterviewPrepRequest(BaseModel):
    interview_date: str = ""
    interview_format: str = ""
    focus_areas: str = ""
    interviewer_roles: str = ""


class GenerateInterviewQARequest(BaseModel):
    pass  # uses stored data


class GenerateCvRequest(BaseModel):
    background_text: str
    pages: str = "2"
    style: str = "professional"


class EnhanceCvRequest(BaseModel):
    pages: str = "2"
    style: str = "professional"


class EnhanceCoverLetterRequest(BaseModel):
    existing_letter: str
    length: str = "standard"
    tone: str = "professional"


class GenerateCoverLetterRequest(BaseModel):
    length: str = "standard"
    tone: str = "professional"


class SaveCoverLetterRequest(BaseModel):
    content_text: str


@router.get("/profile")
def get_profile(user: dict = Depends(get_current_user)) -> dict:
    profile = db.get_candidate_profile(user["user_id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/profile")
def upsert_profile(body: UpsertProfileRequest, user: dict = Depends(get_current_user)) -> dict:
    return db.upsert_candidate_profile({
        "id": user["user_id"],
        "full_name": body.full_name,
        "email": body.email or user["email"],
    })


@router.get("/applications")
def list_applications(user: dict = Depends(get_current_user)) -> list[dict]:
    return db.list_job_applications(user["user_id"])


@router.post("/applications")
def create_application(body: CreateApplicationRequest, user: dict = Depends(get_current_user)) -> dict:
    _ensure_profile(user)
    return db.create_job_application({
        "candidate_profile_id": user["user_id"],
        "job_title": body.job_title,
        "company": body.company,
        "job_description_text": body.job_description_text,
    })


@router.get("/applications/{app_id}")
def get_application(app_id: str, user: dict = Depends(get_current_user)) -> dict:
    app = db.get_job_application(app_id, user["user_id"])
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    app["original_cv"] = db.get_latest_cv(app_id, "ORIGINAL")
    app["enhanced_cv"] = db.get_latest_cv(app_id, "ENHANCED")
    app["cover_letter"] = db.get_cover_letter(app_id)
    return app


@router.patch("/applications/{app_id}")
def update_application(
    app_id: str, body: UpdateApplicationRequest, user: dict = Depends(get_current_user)
) -> dict:
    _verify_ownership(app_id, user["user_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return db.update_job_application(app_id, updates)


@router.delete("/applications/{app_id}")
def delete_application(app_id: str, user: dict = Depends(get_current_user)) -> dict:
    _verify_ownership(app_id, user["user_id"])
    db.delete_job_application(app_id)
    return {"deleted": True}


@router.post("/applications/{app_id}/cv")
def upload_cv(app_id: str, body: UploadCvRequest, user: dict = Depends(get_current_user)) -> dict:
    _verify_ownership(app_id, user["user_id"])
    from agents.cv_enhancement_agent import _text_to_html
    return db.save_cv_document({
        "application_id": app_id,
        "type": "ORIGINAL",
        "content_text": body.content_text,
        "content_html": _text_to_html(body.content_text),
    })


@router.post("/applications/{app_id}/generate-cv")
def generate_cv_route(app_id: str, body: GenerateCvRequest, user: dict = Depends(get_current_user)) -> dict:
    _verify_ownership(app_id, user["user_id"])
    app = db.get_job_application(app_id, user["user_id"])
    try:
        cv_text, cv_html = generate_cv(
            background_text=body.background_text,
            job_title=app.get("job_title", ""),
            company=app.get("company", ""),
            job_description=app.get("job_description_text", ""),
            pages=body.pages,
            style=body.style,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    result = db.save_cv_document({
        "application_id": app_id,
        "type": "ORIGINAL",
        "content_text": cv_text,
        "content_html": cv_html,
    })
    db.update_job_application(app_id, {"status": "IN_PROGRESS"})
    return result


@router.post("/applications/{app_id}/enhance-cv")
def enhance_cv_route(app_id: str, body: EnhanceCvRequest = EnhanceCvRequest(), user: dict = Depends(get_current_user)) -> dict:
    _verify_ownership(app_id, user["user_id"])
    app = db.get_job_application(app_id, user["user_id"])
    original = db.get_latest_cv(app_id, "ORIGINAL")
    if not original:
        raise HTTPException(status_code=400, detail="Upload a CV first before enhancing.")
    try:
        enhanced_text, enhanced_html = enhance_cv(
            cv_text=original["content_text"],
            job_title=app.get("job_title", ""),
            company=app.get("company", ""),
            job_description=app.get("job_description_text", ""),
            pages=body.pages,
            style=body.style,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    result = db.save_cv_document({
        "application_id": app_id,
        "type": "ENHANCED",
        "content_text": enhanced_text,
        "content_html": enhanced_html,
    })
    db.update_job_application(app_id, {"status": "IN_PROGRESS"})
    return result


@router.post("/applications/{app_id}/cover-letter")
def generate_cover_letter_route(app_id: str, body: GenerateCoverLetterRequest = GenerateCoverLetterRequest(), user: dict = Depends(get_current_user)) -> dict:
    _verify_ownership(app_id, user["user_id"])
    app = db.get_job_application(app_id, user["user_id"])
    cv = db.get_latest_cv(app_id, "ENHANCED") or db.get_latest_cv(app_id, "ORIGINAL")
    if not cv:
        raise HTTPException(status_code=400, detail="Upload a CV first.")
    try:
        cl_text, cl_html = generate_cover_letter(
            cv_text=cv["content_text"],
            job_title=app.get("job_title", ""),
            company=app.get("company", ""),
            job_description=app.get("job_description_text", ""),
            length=body.length,
            tone=body.tone,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return db.upsert_cover_letter({"application_id": app_id, "content_text": cl_text, "content_html": cl_html})


@router.post("/applications/{app_id}/enhance-cover-letter")
def enhance_cover_letter_route(app_id: str, body: EnhanceCoverLetterRequest, user: dict = Depends(get_current_user)) -> dict:
    app = _verify_ownership(app_id, user["user_id"])
    cv = db.get_latest_cv(app_id, "ENHANCED") or db.get_latest_cv(app_id, "ORIGINAL")
    try:
        cl_text, cl_html = enhance_cover_letter(
            existing_letter=body.existing_letter,
            job_title=app.get("job_title", ""),
            company=app.get("company", ""),
            job_description=app.get("job_description_text", ""),
            cv_text=cv["content_text"] if cv else "",
            length=body.length,
            tone=body.tone,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return db.upsert_cover_letter({"application_id": app_id, "content_text": cl_text, "content_html": cl_html})


@router.patch("/applications/{app_id}/cover-letter")
def save_cover_letter(app_id: str, body: SaveCoverLetterRequest, user: dict = Depends(get_current_user)) -> dict:
    """Save manually edited cover letter text."""
    _verify_ownership(app_id, user["user_id"])
    from agents.cv_enhancement_agent import _text_to_html
    return db.upsert_cover_letter({
        "application_id": app_id,
        "content_text": body.content_text,
        "content_html": _text_to_html(body.content_text),
    })


@router.get("/applications/{app_id}/interview-prep")
def get_interview_prep(app_id: str, user: dict = Depends(get_current_user)):
    _verify_ownership(app_id, user["user_id"])
    prep = db.get_interview_prep(app_id)
    return prep or {}


@router.post("/applications/{app_id}/interview-prep")
def upsert_interview_prep(app_id: str, req: UpsertInterviewPrepRequest, user: dict = Depends(get_current_user)):
    _verify_ownership(app_id, user["user_id"])
    return db.upsert_interview_prep(app_id, req.model_dump())


@router.post("/applications/{app_id}/generate-interview-qa")
def generate_interview_qa_endpoint(app_id: str, user: dict = Depends(get_current_user)):
    app = _verify_ownership(app_id, user["user_id"])
    cv = db.get_latest_cv(app_id, "ENHANCED") or db.get_latest_cv(app_id, "ORIGINAL")
    prep = db.get_interview_prep(app_id) or {}

    try:
        qa = generate_interview_qa(
            cv_text=cv["content_text"] if cv else "",
            job_title=app.get("job_title", ""),
            company=app.get("company", ""),
            job_description=app.get("job_description_text", ""),
            interview_format=prep.get("interview_format", ""),
            focus_areas=prep.get("focus_areas", ""),
            interviewer_roles=prep.get("interviewer_roles", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Save generated QA back to prep
    db.upsert_interview_prep(app_id, {"generated_qa": qa})
    return {"qa": qa}


def _verify_ownership(app_id: str, user_id: str) -> dict:
    app = db.get_job_application(app_id, user_id)
    if app is None:
        raise HTTPException(status_code=403, detail="Forbidden")
    return app


def _ensure_profile(user: dict) -> None:
    if db.get_candidate_profile(user["user_id"]) is None:
        db.upsert_candidate_profile({"id": user["user_id"], "full_name": "", "email": user["email"]})
