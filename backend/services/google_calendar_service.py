"""Google Calendar OAuth2 integration and calendar event creation."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_URI = "https://oauth2.googleapis.com/token"
AUTH_URI = "https://accounts.google.com/o/oauth2/auth"


def _client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "")


def _client_secret() -> str:
    return os.getenv("GOOGLE_CLIENT_SECRET", "")


def _backend_url() -> str:
    return os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def redirect_uri() -> str:
    return f"{_backend_url()}/api/v1/integrations/google/callback"


def _client_config() -> dict:
    return {
        "web": {
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "auth_uri": AUTH_URI,
            "token_uri": TOKEN_URI,
            "redirect_uris": [redirect_uri()],
        }
    }


# ---------------------------------------------------------------------------
# OAuth2 helpers
# ---------------------------------------------------------------------------


def get_auth_url(state: str = "") -> str:
    """Return the Google OAuth2 consent URL (no PKCE — server-side flow)."""
    from urllib.parse import urlencode

    params = {
        "client_id": _client_id(),
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state or "gcal",
        "include_granted_scopes": "true",
    }
    return f"{AUTH_URI}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Exchange an OAuth2 authorisation code for tokens via direct POST (no PKCE)."""
    import httpx
    from datetime import timedelta

    resp = httpx.post(
        TOKEN_URI,
        data={
            "code": code,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    resp.raise_for_status()
    token_data = resp.json()

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)
    expiry = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    # Fetch user email
    try:
        user_resp = httpx.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        user_email = user_resp.json().get("email", "") if user_resp.status_code == 200 else ""
    except Exception:
        user_email = ""

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expiry": expiry,
        "scope": token_data.get("scope", " ".join(SCOPES)),
        "user_email": user_email,
    }


# ---------------------------------------------------------------------------
# Calendar service factory
# ---------------------------------------------------------------------------


def get_calendar_service(access_token: str, refresh_token: str, token_expiry: str | None = None):
    """Return an authenticated Google Calendar API service client."""
    from google.auth.transport.requests import Request  # type: ignore[import]
    from google.oauth2.credentials import Credentials  # type: ignore[import]
    from googleapiclient.discovery import build  # type: ignore[import]

    expiry: datetime | None = None
    if token_expiry:
        try:
            expiry = datetime.fromisoformat(token_expiry.replace("Z", "+00:00"))
        except Exception:
            pass

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=TOKEN_URI,
        client_id=_client_id(),
        client_secret=_client_secret(),
        scopes=SCOPES,
        expiry=expiry,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    return build("calendar", "v3", credentials=creds, cache_discovery=False)


# ---------------------------------------------------------------------------
# Calendar operations
# ---------------------------------------------------------------------------


def create_interview_event(
    service,
    title: str,
    description: str,
    start_iso: str,
    end_iso: str,
    attendee_emails: list[str],
    timezone: str = "Pacific/Auckland",
) -> dict:
    """Create a Google Calendar event with Google Meet link + email reminders.

    Returns dict with event_id, html_link, meet_link.
    """
    event_body = {
        "summary": title,
        "description": description,
        "start": {"dateTime": start_iso, "timeZone": timezone},
        "end": {"dateTime": end_iso, "timeZone": timezone},
        "attendees": [{"email": email} for email in attendee_emails if email],
        "conferenceData": {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 24 * 60},  # Day-before email
                {"method": "popup", "minutes": 30},        # 30-min popup
            ],
        },
    }

    created = (
        service.events()
        .insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=1,
            sendNotifications=True,
        )
        .execute()
    )

    meet_link = None
    entry_points = (
        created.get("conferenceData", {}).get("entryPoints", [])
    )
    for ep in entry_points:
        if ep.get("entryPointType") == "video":
            meet_link = ep.get("uri")
            break

    return {
        "event_id": created.get("id"),
        "html_link": created.get("htmlLink"),
        "meet_link": meet_link,
        "status": created.get("status"),
    }
