from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import TYPE_CHECKING, Any, Callable, TypeVar

import httpx
from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from supabase import create_client  # type: ignore[attr-defined]

_F = TypeVar("_F", bound=Callable[..., Any])

if TYPE_CHECKING:
    from supabase._sync.client import SyncClient as Client  # noqa: F401

# ---------------------------------------------------------------------------
# Force HTTP/1.1 for all httpx.Client instances
#
# postgrest-py >= 0.16 creates its internal httpx.Client with http2=True.
# On Render free tier Supabase's PostgREST endpoint resets every HTTP/2
# stream with PROTOCOL_ERROR (error_code=1).  Patching httpx.Client.__init__
# globally to inject http2=False is the most robust fix — it works regardless
# of the postgrest-py version or internal method names.
# ---------------------------------------------------------------------------
_orig_httpx_client_init = httpx.Client.__init__


def _force_http1_client(self: Any, *args: Any, **kwargs: Any) -> None:
    kwargs["http2"] = False
    _orig_httpx_client_init(self, *args, **kwargs)


httpx.Client.__init__ = _force_http1_client  # type: ignore[method-assign]

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""

    model_config = ConfigDict(env_file=".env", extra="ignore")


settings = Settings()


# ---------------------------------------------------------------------------
# Retry helper — handles transient HTTP/2 StreamReset errors from Supabase
# ---------------------------------------------------------------------------

_TRANSIENT_ERRORS = ("StreamReset", "RemoteProtocolError", "ConnectError", "ConnectionResetError")


def _retryable(func: _F) -> _F:
    """Retry a Supabase call up to 3 times on transient connection errors."""

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                return func(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001
                if any(kw in str(exc) for kw in _TRANSIENT_ERRORS):
                    last_exc = exc
                    time.sleep(0.5 * (attempt + 1))
                else:
                    raise
        raise last_exc  # type: ignore[misc]

    return wrapper  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------


def get_client() -> Any:
    """Return a configured Supabase client.

    Raises:
        RuntimeError: if SUPABASE_URL or SUPABASE_KEY environment variables
                      are not set.
    """
    if not settings.supabase_url or not settings.supabase_key:
        raise RuntimeError(
            "Supabase not configured. "
            "Please set SUPABASE_URL and SUPABASE_KEY environment variables."
        )
    return create_client(settings.supabase_url, settings.supabase_key)


# ---------------------------------------------------------------------------
# Jobs CRUD
# ---------------------------------------------------------------------------


def _sanitise_job(job_dict: dict) -> dict:
    """Coerce a job dict into a shape Supabase will accept."""
    job = dict(job_dict)

    # Ensure id is a string UUID
    if not job.get("id"):
        job["id"] = str(uuid.uuid4())
    else:
        job["id"] = str(job["id"])

    # closing_date must be a valid ISO timestamp
    raw_date = job.get("closing_date", "")
    if not raw_date or raw_date in ("", "null", None):
        job["closing_date"] = (
            datetime.now(timezone.utc) + timedelta(days=28)
        ).isoformat()
    elif isinstance(raw_date, datetime):
        job["closing_date"] = raw_date.isoformat()

    # Strip common label prefixes that JD parsers leave in the title
    # e.g. "Position: Senior Policy Advisor" → "Senior Policy Advisor"
    raw_title = str(job.get("title", "")).strip()
    for prefix in ("Position:", "Job Title:", "Role:", "Title:", "Post:"):
        if raw_title.lower().startswith(prefix.lower()):
            raw_title = raw_title[len(prefix):].strip()
            break
    if raw_title:
        job["title"] = raw_title

    # Truncate overview if it looks like the raw JD was dumped in (> 500 chars)
    # Keep only the first meaningful paragraph (up to 400 chars)
    raw_overview = str(job.get("overview", "")).strip()
    if len(raw_overview) > 500:
        # Take first non-empty paragraph only
        first_para = next(
            (p.strip() for p in raw_overview.split("\n") if len(p.strip()) > 30),
            raw_overview[:400],
        )
        job["overview"] = first_para[:400]

    # required NOT NULL fields with defaults
    for field, default in (
        ("title", "Untitled Role"),
        ("organisation", "Unknown Organisation"),
        ("department", ""),
        ("location", "New Zealand"),
        ("salary_band", ""),
        ("employment_type", "permanent"),
        ("overview", ""),
    ):
        if not job.get(field):
            job[field] = default

    # JSONB list fields — ensure they are plain lists, not other types
    for field in (
        "responsibilities", "required_skills", "preferred_skills",
        "qualifications", "competencies",
    ):
        val = job.get(field, [])
        job[field] = list(val) if val else []

    # status default
    if not job.get("status"):
        job["status"] = "DRAFT"

    # Remove any keys not in the jobs table schema
    allowed = {
        "id", "title", "organisation", "department", "location",
        "salary_band", "employment_type", "closing_date", "overview",
        "responsibilities", "required_skills", "preferred_skills",
        "qualifications", "competencies", "status", "raw_jd_text",
    }
    return {k: v for k, v in job.items() if k in allowed}


@_retryable
def save_job(job_dict: dict) -> dict:
    """Upsert a job record into the jobs table and return the saved record.

    Args:
        job_dict: A dict matching the jobs table schema.  If ``id`` is present
                  the row will be updated; otherwise a new row is inserted.

    Returns:
        The saved record dict (including any server-generated fields).

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("jobs")
        .upsert(_sanitise_job(job_dict), on_conflict="id")
        .execute()
    )
    return response.data[0]


@_retryable
def get_job(job_id: str) -> dict | None:
    """Fetch a single job by its UUID.

    Args:
        job_id: The job's UUID string.

    Returns:
        The job dict, or ``None`` if not found.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("jobs")
        .select("*")
        .eq("id", job_id)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


@_retryable
def list_jobs(status: str | None = None) -> list[dict]:
    """Return all jobs, optionally filtered by status.

    Args:
        status: Optional job status string (e.g. ``'OPEN'``).

    Returns:
        A list of job dicts ordered by ``created_at`` descending.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    query = client.table("jobs").select("*").order("created_at", desc=True)
    if status is not None:
        query = query.eq("status", status)
    response = query.execute()
    return response.data


@_retryable
def update_job_status(job_id: str, status: str) -> dict:
    """Update the status field of a job.

    Args:
        job_id: The job's UUID string.
        status: The new status value (must pass the DB CHECK constraint).

    Returns:
        The updated job dict.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("jobs")
        .update({"status": status})
        .eq("id", job_id)
        .execute()
    )
    return response.data[0]


# ---------------------------------------------------------------------------
# Candidates CRUD
# ---------------------------------------------------------------------------


@_retryable
def save_candidate(candidate_dict: dict) -> dict:
    """Upsert a candidate record and return the saved record.

    Args:
        candidate_dict: A dict matching the candidates table schema.

    Returns:
        The saved record dict.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("candidates")
        .upsert(candidate_dict, on_conflict="id")
        .execute()
    )
    return response.data[0]


@_retryable
def get_candidate(candidate_id: str) -> dict | None:
    """Fetch a single candidate by UUID.

    Args:
        candidate_id: The candidate's UUID string.

    Returns:
        The candidate dict, or ``None`` if not found.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("candidates")
        .select("*")
        .eq("id", candidate_id)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


@_retryable
def update_candidate_contact(candidate_id: str, updates: dict) -> dict:
    """Update email and/or phone on a candidate record."""
    client = get_client()
    response = (
        client.table("candidates")
        .update(updates)
        .eq("id", candidate_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"Candidate '{candidate_id}' not found")
    return response.data[0]


@_retryable
def update_candidate_email(candidate_id: str, email: str) -> dict:
    """Update the email address of a candidate."""
    client = get_client()
    response = (
        client.table("candidates")
        .update({"email": email})
        .eq("id", candidate_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"Candidate '{candidate_id}' not found")
    return response.data[0]


@_retryable
def list_candidates_for_job(job_id: str) -> list[dict]:
    """Return all candidates linked to a job via screening_results.

    Args:
        job_id: The job's UUID string.

    Returns:
        A list of candidate dicts (joined through screening_results).

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("screening_results")
        .select("candidate_id, candidates(*)")
        .eq("job_id", job_id)
        .execute()
    )
    candidates = []
    for row in response.data:
        if row.get("candidates"):
            candidates.append(row["candidates"])
    return candidates


# ---------------------------------------------------------------------------
# Screening results CRUD
# ---------------------------------------------------------------------------


@_retryable
def save_screening_result(result_dict: dict) -> dict:
    """Upsert a screening result (job_id + candidate_id is unique).

    Args:
        result_dict: A dict matching the screening_results table schema.

    Returns:
        The saved record dict.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("screening_results")
        .upsert(result_dict, on_conflict="job_id,candidate_id")
        .execute()
    )
    return response.data[0]


@_retryable
def get_shortlist(job_id: str) -> list[dict]:
    """Return shortlisted screening results for a job, joined with candidate info.

    Results are ordered by ``overall_score`` descending.

    Args:
        job_id: The job's UUID string.

    Returns:
        A list of dicts each containing screening result fields merged with
        the candidate's profile fields.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("screening_results")
        .select("*, candidates(*)")
        .eq("job_id", job_id)
        .eq("recommendation", "SHORTLIST")
        .order("overall_score", desc=True)
        .execute()
    )
    results = []
    for row in response.data:
        candidate_info = row.pop("candidates", {}) or {}
        results.append({**candidate_info, **row})
    return results


@_retryable
def get_all_results_for_job(job_id: str) -> list[dict]:
    """Return all screening results for a job ordered by overall_score descending.

    Args:
        job_id: The job's UUID string.

    Returns:
        A list of screening result dicts joined with candidate info.

    Raises:
        RuntimeError: if Supabase is not configured.
    """
    client = get_client()
    response = (
        client.table("screening_results")
        .select("*, candidates(*)")
        .eq("job_id", job_id)
        .order("overall_score", desc=True)
        .execute()
    )
    results = []
    for row in response.data:
        candidate_info = row.pop("candidates", {}) or {}
        results.append({**candidate_info, **row})
    return results


@_retryable
def clear_screening_results(job_id: str) -> int:
    """Delete all screening results for a job. Returns number of deleted rows."""
    client = get_client()
    response = (
        client.table("screening_results")
        .delete()
        .eq("job_id", job_id)
        .execute()
    )
    return len(response.data)


@_retryable
def update_result_recommendation(result_id: str, recommendation: str) -> dict:
    """Update the recommendation for a single screening result (manual override)."""
    client = get_client()
    response = (
        client.table("screening_results")
        .update({"recommendation": recommendation})
        .eq("id", result_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"Result '{result_id}' not found.")
    return response.data[0]


@_retryable
def delete_result(result_id: str) -> bool:
    """Delete a single screening result by ID."""
    client = get_client()
    client.table("screening_results").delete().eq("id", result_id).execute()
    return True


# ---------------------------------------------------------------------------
# Interview slots CRUD
# ---------------------------------------------------------------------------


@_retryable
def save_slot(slot_dict: dict) -> dict:
    """Insert or upsert an interview slot."""
    client = get_client()
    if slot_dict.get("id"):
        response = (
            client.table("interview_slots")
            .upsert(slot_dict, on_conflict="id")
            .execute()
        )
    else:
        response = client.table("interview_slots").insert(slot_dict).execute()
    return response.data[0]


@_retryable
def list_slots(job_id: str, available_only: bool = False) -> list[dict]:
    """Return interview slots for a job, ordered by start time."""
    client = get_client()
    query = (
        client.table("interview_slots")
        .select("*")
        .eq("job_id", job_id)
        .order("starts_at")
    )
    if available_only:
        query = query.eq("is_booked", False)
    return query.execute().data


@_retryable
def delete_slot(slot_id: str) -> bool:
    """Delete an interview slot by ID."""
    client = get_client()
    client.table("interview_slots").delete().eq("id", slot_id).execute()
    return True


@_retryable
def book_slot(slot_id: str, candidate_id: str | None) -> dict:
    """Mark a slot as booked and record which candidate booked it."""
    client = get_client()
    update: dict = {"is_booked": True}
    if candidate_id:
        update["booked_by"] = candidate_id
    response = (
        client.table("interview_slots")
        .update(update)
        .eq("id", slot_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"Slot '{slot_id}' not found.")
    return response.data[0]


# ---------------------------------------------------------------------------
# Communications CRUD
# ---------------------------------------------------------------------------


@_retryable
def save_communication(comm_dict: dict) -> dict:
    """Insert a new communication record."""
    client = get_client()
    response = client.table("communications").insert(comm_dict).execute()
    return response.data[0]


@_retryable
def list_communications(job_id: str) -> list[dict]:
    """Return all communications for a job with candidate + slot info, newest first."""
    client = get_client()
    response = (
        client.table("communications")
        .select("*, candidates(full_name, email), interview_slots(starts_at, ends_at)")
        .eq("job_id", job_id)
        .order("created_at", desc=True)
        .execute()
    )
    results = []
    for row in response.data:
        candidate_info = row.pop("candidates", {}) or {}
        slot_info = row.pop("interview_slots", {}) or {}
        merged = {**candidate_info, **row}
        if slot_info.get("starts_at"):
            merged["booked_slot_starts_at"] = slot_info["starts_at"]
            merged["booked_slot_ends_at"] = slot_info.get("ends_at")
        results.append(merged)
    return results


# ---------------------------------------------------------------------------
# Booking tokens CRUD
# ---------------------------------------------------------------------------


@_retryable
def save_booking_token(token_dict: dict) -> dict:
    """Insert a new booking token."""
    client = get_client()
    response = client.table("booking_tokens").insert(token_dict).execute()
    return response.data[0]


@_retryable
def get_booking_token(token: str) -> dict | None:
    """Fetch a booking token by its token string, joined with communication info."""
    client = get_client()
    response = (
        client.table("booking_tokens")
        .select("*, communications(job_id, candidate_id, type)")
        .eq("token", token)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


@_retryable
def use_booking_token(token_id: str) -> dict:
    """Mark a booking token as used (set used_at to now)."""
    client = get_client()
    response = (
        client.table("booking_tokens")
        .update({"used_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", token_id)
        .execute()
    )
    return response.data[0] if response.data else {}


# ---------------------------------------------------------------------------
# Slot calendar fields
# ---------------------------------------------------------------------------


@_retryable
def update_slot_calendar(slot_id: str, calendar_event_id: str | None, meet_link: str | None) -> dict:
    """Persist Google Calendar event ID and Meet link on an interview slot."""
    client = get_client()
    update: dict = {}
    if calendar_event_id:
        update["calendar_event_id"] = calendar_event_id
    if meet_link:
        update["meet_link"] = meet_link
    if not update:
        return {}
    response = (
        client.table("interview_slots")
        .update(update)
        .eq("id", slot_id)
        .execute()
    )
    return response.data[0] if response.data else {}


# ---------------------------------------------------------------------------
# Integrations CRUD  (Google Calendar OAuth tokens etc.)
# ---------------------------------------------------------------------------


@_retryable
def save_integration(integration_dict: dict) -> dict:
    """Upsert an integration record (keyed on provider)."""
    client = get_client()
    response = (
        client.table("integrations")
        .upsert(integration_dict, on_conflict="provider")
        .execute()
    )
    return response.data[0]


@_retryable
def get_integration(provider: str) -> dict | None:
    """Fetch an integration by provider name, or None if not connected."""
    client = get_client()
    response = (
        client.table("integrations")
        .select("*")
        .eq("provider", provider)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


@_retryable
def delete_integration(provider: str) -> bool:
    """Remove an integration record."""
    client = get_client()
    client.table("integrations").delete().eq("provider", provider).execute()
    return True


# ---------------------------------------------------------------------------
# Candidate portal DB functions
# ---------------------------------------------------------------------------


@_retryable
def get_candidate_profile(user_id: str) -> dict | None:
    """Fetch a candidate profile by user UUID."""
    client = get_client()
    response = (
        client.table("candidate_profiles")
        .select("*")
        .eq("id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


@_retryable
def upsert_candidate_profile(profile_dict: dict) -> dict:
    """Insert or update a candidate profile."""
    client = get_client()
    response = (
        client.table("candidate_profiles")
        .upsert(profile_dict, on_conflict="id")
        .execute()
    )
    return response.data[0]


@_retryable
def list_job_applications(user_id: str) -> list[dict]:
    """Return all job applications for a candidate, newest first."""
    client = get_client()
    response = (
        client.table("job_applications")
        .select("*")
        .eq("candidate_profile_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@_retryable
def create_job_application(app_dict: dict) -> dict:
    """Insert a new job application."""
    client = get_client()
    response = client.table("job_applications").insert(app_dict).execute()
    return response.data[0]


@_retryable
def get_job_application(app_id: str, user_id: str) -> dict | None:
    """Fetch a job application, enforcing ownership."""
    client = get_client()
    response = (
        client.table("job_applications")
        .select("*")
        .eq("id", app_id)
        .eq("candidate_profile_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


@_retryable
def update_job_application(app_id: str, updates: dict) -> dict:
    """Update fields on a job application."""
    from datetime import datetime, timezone
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    client = get_client()
    response = (
        client.table("job_applications")
        .update(updates)
        .eq("id", app_id)
        .execute()
    )
    return response.data[0]


@_retryable
def delete_job_application(app_id: str) -> None:
    """Delete a job application and all related documents."""
    client = get_client()
    client.table("job_applications").delete().eq("id", app_id).execute()


@_retryable
def save_cv_document(doc_dict: dict) -> dict:
    """Insert a CV document (original or enhanced)."""
    client = get_client()
    response = client.table("cv_documents").insert(doc_dict).execute()
    return response.data[0]


@_retryable
def get_latest_cv(app_id: str, cv_type: str) -> dict | None:
    """Return the most recent CV of given type for an application."""
    client = get_client()
    response = (
        client.table("cv_documents")
        .select("*")
        .eq("application_id", app_id)
        .eq("type", cv_type)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


@_retryable
def upsert_cover_letter(cl_dict: dict) -> dict:
    """Replace existing cover letter for an application (delete + insert)."""
    client = get_client()
    client.table("cover_letters").delete().eq("application_id", cl_dict["application_id"]).execute()
    response = client.table("cover_letters").insert(cl_dict).execute()
    return response.data[0]


@_retryable
def get_cover_letter(app_id: str) -> dict | None:
    """Return the cover letter for an application."""
    client = get_client()
    response = (
        client.table("cover_letters")
        .select("*")
        .eq("application_id", app_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


@_retryable
def get_interview_prep(application_id: str) -> dict | None:
    """Return the interview prep record for an application, or None."""
    try:
        resp = (
            get_client()
            .table("interview_preps")
            .select("*")
            .eq("application_id", application_id)
            .maybe_single()
            .execute()
        )
        return resp.data
    except Exception:
        return None


@_retryable
def upsert_interview_prep(application_id: str, data: dict) -> dict:
    """Insert or update interview prep data for an application."""
    existing = get_interview_prep(application_id)
    if existing:
        resp = (
            get_client()
            .table("interview_preps")
            .update({**data, "updated_at": "now()"})
            .eq("application_id", application_id)
            .execute()
        )
    else:
        resp = (
            get_client()
            .table("interview_preps")
            .insert({"application_id": application_id, **data})
            .execute()
        )
    return resp.data[0]
