"""Email service — Resend integration, booking token generation, DB persistence."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from agents.email_composer_agent import (
    compose_booking_confirmation_email,
    compose_phone_screen_invite_email,
    compose_rejection_email,
    compose_shortlist_invite_email,
)
from services import database as db


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------


def _get_resend():
    """Lazy-import resend and configure API key."""
    import resend  # type: ignore[import]

    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY environment variable is not set.")
    resend.api_key = api_key
    return resend


def _from_address() -> str:
    return os.getenv("RESEND_FROM", "recruitment@pubsec-recruiter.nz")


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


# ---------------------------------------------------------------------------
# Core send
# ---------------------------------------------------------------------------


def _send(to: str, subject: str, body_html: str, body_text: str) -> str | None:
    """Send via Resend.  Returns message_id, or None when key not configured (dev)."""
    if not to:
        return None
    try:
        resend = _get_resend()
        resp = resend.Emails.send(
            {
                "from": _from_address(),
                "to": [to],
                "subject": subject,
                "html": body_html,
                "text": body_text,
            }
        )
        return resp.get("id")
    except RuntimeError as exc:
        print(f"[email_service] skipping send (no API key): {exc}")
        return None


def _status(email: str | None, message_id: str | None) -> str:
    if not email:
        return "NO_EMAIL"
    if message_id:
        return "SENT"
    return "FAILED"


# ---------------------------------------------------------------------------
# Public send functions
# ---------------------------------------------------------------------------


def send_rejection(candidate: dict, job: dict) -> dict:
    """Send a rejection email and persist the communication record."""
    email = candidate.get("email") or ""
    composed = compose_rejection_email(candidate, job)
    mid = _send(email, composed["subject"], composed["body_html"], composed["body_text"])

    return db.save_communication(
        {
            "job_id": job["id"],
            "candidate_id": candidate["id"],
            "type": "REJECTION",
            "subject": composed["subject"],
            "body_html": composed["body_html"],
            "body_text": composed["body_text"],
            "sent_at": datetime.now(timezone.utc).isoformat() if email else None,
            "status": _status(email, mid),
            "resend_message_id": mid,
        }
    )


def send_shortlist_invite(candidate: dict, job: dict) -> dict:
    """Send a shortlist invitation email."""
    email = candidate.get("email") or ""
    composed = compose_shortlist_invite_email(candidate, job)
    mid = _send(email, composed["subject"], composed["body_html"], composed["body_text"])

    return db.save_communication(
        {
            "job_id": job["id"],
            "candidate_id": candidate["id"],
            "type": "SHORTLIST_INVITE",
            "subject": composed["subject"],
            "body_html": composed["body_html"],
            "body_text": composed["body_text"],
            "sent_at": datetime.now(timezone.utc).isoformat() if email else None,
            "status": _status(email, mid),
            "resend_message_id": mid,
        }
    )


def send_phone_screen_invite(candidate: dict, job: dict, slots: list[dict]) -> dict:
    """Generate a booking token, send a phone-screen invite, and persist."""
    email = candidate.get("email") or ""
    token = secrets.token_hex(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    booking_url = f"{_frontend_url()}/book/{token}"

    composed = compose_phone_screen_invite_email(candidate, job, slots, booking_url)
    mid = _send(email, composed["subject"], composed["body_html"], composed["body_text"])

    comm = db.save_communication(
        {
            "job_id": job["id"],
            "candidate_id": candidate["id"],
            "type": "PHONE_SCREEN_INVITE",
            "subject": composed["subject"],
            "body_html": composed["body_html"],
            "body_text": composed["body_text"],
            "sent_at": datetime.now(timezone.utc).isoformat() if email else None,
            "status": _status(email, mid),
            "resend_message_id": mid,
        }
    )

    db.save_booking_token(
        {
            "communication_id": comm["id"],
            "token": token,
            "expires_at": expires_at,
        }
    )

    return {**comm, "booking_url": booking_url, "token": token}


def send_booking_confirmation(candidate: dict, job: dict, slot: dict) -> dict:
    """Send a booking confirmation email after a candidate selects a slot."""
    email = candidate.get("email") or ""
    composed = compose_booking_confirmation_email(candidate, job, slot)
    mid = _send(email, composed["subject"], composed["body_html"], composed["body_text"])

    return db.save_communication(
        {
            "job_id": job["id"],
            "candidate_id": candidate["id"],
            "type": "BOOKING_CONFIRMATION",
            "subject": composed["subject"],
            "body_html": composed["body_html"],
            "body_text": composed["body_text"],
            "sent_at": datetime.now(timezone.utc).isoformat() if email else None,
            "status": _status(email, mid),
            "resend_message_id": mid,
            "slot_id": slot.get("id"),
        }
    )
