"""Public booking endpoint — candidates use a one-time token to pick an interview slot."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import database as db
from services.email_service import send_booking_confirmation

router = APIRouter(prefix="/api/v1/book", tags=["booking"])


def _validate_token(token: str) -> dict:
    """Fetch and validate a booking token; raise 404/410 if invalid."""
    token_row = db.get_booking_token(token)
    if not token_row:
        raise HTTPException(status_code=404, detail="Booking link not found.")

    expires_at = datetime.fromisoformat(token_row["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="This booking link has expired.")

    if token_row.get("used_at"):
        raise HTTPException(status_code=410, detail="This booking link has already been used.")

    return token_row


# ---------------------------------------------------------------------------
# GET /api/v1/book/{token}
# ---------------------------------------------------------------------------


@router.get("/{token}")
def get_booking_info(token: str) -> dict:
    """Return job info, candidate name, and available slots for the booking page."""
    token_row = _validate_token(token)

    comm_info = token_row.get("communications") or {}
    job_id = comm_info.get("job_id")
    candidate_id = comm_info.get("candidate_id")

    if not job_id:
        raise HTTPException(status_code=404, detail="Invalid booking link.")

    job = db.get_job(job_id) or {}
    candidate = db.get_candidate(candidate_id) if candidate_id else {}
    slots = db.list_slots(job_id, available_only=True)

    return {
        "token_id": token_row["id"],
        "job": {
            "title": job.get("title", ""),
            "organisation": job.get("organisation", ""),
        },
        "candidate_name": (candidate or {}).get("full_name"),
        "slots": slots,
        "expires_at": token_row["expires_at"],
    }


# ---------------------------------------------------------------------------
# POST /api/v1/book/{token}/confirm
# ---------------------------------------------------------------------------


class ConfirmBookingRequest(BaseModel):
    slot_id: str


@router.post("/{token}/confirm")
def confirm_booking(token: str, body: ConfirmBookingRequest) -> dict:
    """Confirm a slot selection — marks token used, books slot, sends confirmation email."""
    token_row = _validate_token(token)

    comm_info = token_row.get("communications") or {}
    job_id = comm_info.get("job_id")
    candidate_id = comm_info.get("candidate_id")

    # Book the slot (marks is_booked=True)
    try:
        slot = db.book_slot(body.slot_id, candidate_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Consume the token
    try:
        db.use_booking_token(token_row["id"])
    except RuntimeError:
        pass  # Non-fatal

    # Send confirmation email — fire-and-forget (don't fail the booking if email fails)
    if job_id and candidate_id:
        job = db.get_job(job_id) or {}
        candidate = db.get_candidate(candidate_id) or {}
        if job and candidate:
            try:
                send_booking_confirmation(candidate, job, slot)
            except Exception:  # noqa: BLE001
                pass

    return {
        "confirmed": True,
        "slot": slot,
        "job": {
            "title": (db.get_job(job_id) or {}).get("title", "") if job_id else "",
            "organisation": (db.get_job(job_id) or {}).get("organisation", "") if job_id else "",
        },
    }
