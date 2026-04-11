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
    """Confirm a slot — marks token used, books slot, sends email, creates Google Calendar event."""
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
        pass

    meet_link: str | None = None
    calendar_event_url: str | None = None

    if job_id and candidate_id:
        job = db.get_job(job_id) or {}
        candidate = db.get_candidate(candidate_id) or {}

        # Send confirmation email
        if job and candidate:
            try:
                send_booking_confirmation(candidate, job, slot)
            except Exception:  # noqa: BLE001
                pass

        # Create Google Calendar event
        if job and candidate:
            gcal_result = _create_calendar_event(job, candidate, slot)
            meet_link = gcal_result.get("meet_link")
            calendar_event_url = gcal_result.get("html_link")

            # Persist meet link on the slot for future reference
            if meet_link or calendar_event_url:
                try:
                    db.update_slot_calendar(
                        slot["id"],
                        calendar_event_id=gcal_result.get("event_id"),
                        meet_link=meet_link,
                    )
                except Exception:  # noqa: BLE001
                    pass

    return {
        "confirmed": True,
        "slot": slot,
        "meet_link": meet_link,
        "calendar_event_url": calendar_event_url,
        "job": {
            "title": (db.get_job(job_id) or {}).get("title", "") if job_id else "",
            "organisation": (db.get_job(job_id) or {}).get("organisation", "") if job_id else "",
        },
    }


# ---------------------------------------------------------------------------
# Internal helper — Google Calendar event creation (fire-and-forget)
# ---------------------------------------------------------------------------


def _create_calendar_event(job: dict, candidate: dict, slot: dict) -> dict:
    """Try to create a Google Calendar event. Returns {} silently if not configured."""
    try:
        from services import google_calendar_service as gcal  # noqa: PLC0415

        integration = db.get_integration("google_calendar")
        if not integration:
            return {}

        service = gcal.get_calendar_service(
            access_token=integration["access_token"],
            refresh_token=integration["refresh_token"],
            token_expiry=integration.get("token_expiry"),
        )

        interviewer_email = integration.get("user_email", "")
        candidate_email = candidate.get("email", "")

        attendees = [e for e in [interviewer_email, candidate_email] if e]

        title = f"Phone Screen — {job.get('title', 'Interview')} with {candidate.get('full_name', 'Candidate')}"
        description = (
            f"Phone screening interview for the {job.get('title', '')} position "
            f"at {job.get('organisation', '')}.\n\n"
            f"Candidate: {candidate.get('full_name', '')} ({candidate_email})"
        )

        return gcal.create_interview_event(
            service=service,
            title=title,
            description=description,
            start_iso=slot["starts_at"],
            end_iso=slot["ends_at"],
            attendee_emails=attendees,
        )
    except Exception:  # noqa: BLE001
        return {}
