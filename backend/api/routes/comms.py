"""Communications routes — send rejection/invite emails, list comms history."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import database as db
from services.email_service import send_phone_screen_invite, send_rejection, send_shortlist_invite

router = APIRouter(prefix="/api/v1/jobs", tags=["communications"])


def _job_or_404(job_id: str) -> dict:
    try:
        job = db.get_job(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class RejectBatchRequest(BaseModel):
    candidate_ids: list[str]


class InviteBatchRequest(BaseModel):
    candidate_ids: list[str]
    type: str = "SHORTLIST_INVITE"  # SHORTLIST_INVITE | PHONE_SCREEN_INVITE
    slot_ids: list[str] = []


# ---------------------------------------------------------------------------
# POST /api/v1/jobs/{job_id}/comms/reject-batch
# ---------------------------------------------------------------------------


@router.post("/{job_id}/comms/reject-batch")
def reject_batch(job_id: str, body: RejectBatchRequest) -> dict:
    """Send rejection emails to a batch of candidates."""
    job = _job_or_404(job_id)

    sent, errors = [], []
    for cid in body.candidate_ids:
        candidate = db.get_candidate(cid)
        if not candidate:
            errors.append({"candidate_id": cid, "error": "Candidate not found"})
            continue
        try:
            comm = send_rejection(candidate, job)
            sent.append(comm)
        except Exception as exc:  # noqa: BLE001
            errors.append({"candidate_id": cid, "error": str(exc)})

    return {"sent": len(sent), "errors": errors, "communications": sent}


# ---------------------------------------------------------------------------
# POST /api/v1/jobs/{job_id}/comms/invite-batch
# ---------------------------------------------------------------------------


@router.post("/{job_id}/comms/invite-batch")
def invite_batch(job_id: str, body: InviteBatchRequest) -> dict:
    """Send shortlist or phone-screen invitations."""
    job = _job_or_404(job_id)

    # Fetch slots once if needed
    slots: list[dict] = []
    if body.type == "PHONE_SCREEN_INVITE":
        try:
            all_slots = db.list_slots(job_id)
        except RuntimeError:
            all_slots = []
        if body.slot_ids:
            slots = [s for s in all_slots if s["id"] in body.slot_ids]
        else:
            slots = [s for s in all_slots if not s.get("is_booked")]

    sent, errors = [], []
    for cid in body.candidate_ids:
        candidate = db.get_candidate(cid)
        if not candidate:
            errors.append({"candidate_id": cid, "error": "Candidate not found"})
            continue
        try:
            if body.type == "PHONE_SCREEN_INVITE":
                comm = send_phone_screen_invite(candidate, job, slots)
            else:
                comm = send_shortlist_invite(candidate, job)
            sent.append(comm)
        except Exception as exc:  # noqa: BLE001
            errors.append({"candidate_id": cid, "error": str(exc)})

    return {"sent": len(sent), "errors": errors, "communications": sent}


# ---------------------------------------------------------------------------
# GET /api/v1/jobs/{job_id}/comms
# ---------------------------------------------------------------------------


@router.get("/{job_id}/comms")
def list_comms(job_id: str) -> list[dict]:
    """Return all communications for a job, newest first."""
    _job_or_404(job_id)
    try:
        return db.list_communications(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
