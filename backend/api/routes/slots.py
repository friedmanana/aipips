"""Interview slots routes — CRUD for recruiter-managed availability windows."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import database as db

router = APIRouter(prefix="/api/v1/jobs", tags=["slots"])


def _503(exc: RuntimeError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------------------------
# GET /api/v1/jobs/{job_id}/slots
# ---------------------------------------------------------------------------


@router.get("/{job_id}/slots")
def list_slots(job_id: str, available_only: bool = False) -> list[dict]:
    """Return all interview slots for a job (optionally filter to unbooked only)."""
    try:
        return db.list_slots(job_id, available_only=available_only)
    except RuntimeError as exc:
        raise _503(exc) from exc


# ---------------------------------------------------------------------------
# POST /api/v1/jobs/{job_id}/slots
# ---------------------------------------------------------------------------


class CreateSlotRequest(BaseModel):
    starts_at: str   # ISO-8601 datetime string, e.g. "2025-05-01T10:00:00+12:00"
    ends_at: str
    duration_mins: int = 30


@router.post("/{job_id}/slots")
def create_slot(job_id: str, body: CreateSlotRequest) -> dict:
    """Create a new interview slot for a job."""
    try:
        return db.save_slot(
            {
                "job_id": job_id,
                "starts_at": body.starts_at,
                "ends_at": body.ends_at,
                "duration_mins": body.duration_mins,
                "is_booked": False,
            }
        )
    except RuntimeError as exc:
        raise _503(exc) from exc


# ---------------------------------------------------------------------------
# DELETE /api/v1/jobs/{job_id}/slots/{slot_id}
# ---------------------------------------------------------------------------


@router.delete("/{job_id}/slots/{slot_id}")
def delete_slot(job_id: str, slot_id: str) -> dict:
    """Delete an interview slot."""
    try:
        db.delete_slot(slot_id)
    except RuntimeError as exc:
        raise _503(exc) from exc
    return {"deleted": True}
