"""Google Calendar OAuth2 integration and calendar event creation."""

from __future__ import annotations

import os
import uuid
from datetime import datetime


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
    """Return the Google OAuth2 consent URL for the recruiter to authorise."""
    from google_auth_oauthlib.flow import Flow  # type: ignore[import]

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = redirect_uri()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state or "gcal",
    )
    return auth_url


def exchange_code(code: str) -> dict:
    """Exchange an OAuth2 code for credentials. Returns token dict."""
    from google_auth_oauthlib.flow import Flow  # type: ignore[import]
    import httpx

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = redirect_uri()
    flow.fetch_token(code=code)

    creds = flow.credentials

    # Fetch the authorised user's email via userinfo endpoint
    try:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=10,
        )
        user_email = resp.json().get("email", "") if resp.status_code == 200 else ""
    except Exception:
        user_email = ""

    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_expiry": creds.expiry.isoformat() if creds.expiry else None,
        "scope": " ".join(creds.scopes or SCOPES),
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
