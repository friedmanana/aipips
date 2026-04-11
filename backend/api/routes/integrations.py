"""Google Calendar OAuth2 integration routes."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from services import database as db
from services import google_calendar_service as gcal

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


# ---------------------------------------------------------------------------
# GET /api/v1/integrations/google/auth-url
# ---------------------------------------------------------------------------


@router.get("/google/auth-url")
def get_auth_url() -> dict:
    """Return the Google OAuth2 consent URL so the frontend can redirect the user."""
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_CLIENT_ID is not configured. Add it in Render environment variables.",
        )
    try:
        url = gcal.get_auth_url()
        return {"url": url}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# GET /api/v1/integrations/google/callback  (Google redirects here)
# ---------------------------------------------------------------------------


@router.get("/google/callback")
def google_callback(
    code: str = Query(default=""),
    error: str = Query(default=""),
    state: str = Query(default=""),
):
    """Handle Google OAuth2 callback: exchange code, persist tokens, redirect to frontend."""
    frontend = _frontend_url()

    if error:
        return RedirectResponse(f"{frontend}/settings?error={error}")

    if not code:
        return RedirectResponse(f"{frontend}/settings?error=no_code")

    try:
        token_data = gcal.exchange_code(code)
        db.save_integration(
            {
                "provider": "google_calendar",
                "user_email": token_data["user_email"],
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "token_expiry": token_data["token_expiry"],
                "scope": token_data["scope"],
            }
        )
        return RedirectResponse(
            f"{frontend}/settings?connected=google&email={token_data['user_email']}"
        )
    except Exception as exc:
        return RedirectResponse(f"{frontend}/settings?error={str(exc)[:120]}")


# ---------------------------------------------------------------------------
# GET /api/v1/integrations/google/status
# ---------------------------------------------------------------------------


@router.get("/google/status")
def google_status() -> dict:
    """Return whether Google Calendar is connected and which account."""
    integration = db.get_integration("google_calendar")
    if not integration:
        return {"connected": False}
    return {
        "connected": True,
        "user_email": integration.get("user_email"),
        "connected_at": integration.get("created_at"),
    }


# ---------------------------------------------------------------------------
# DELETE /api/v1/integrations/google
# ---------------------------------------------------------------------------


@router.delete("/google")
def disconnect_google() -> dict:
    """Remove the stored Google Calendar tokens."""
    db.delete_integration("google_calendar")
    return {"disconnected": True}
