"""Email composer — builds subject, body_text and body_html for each communication type.

These are professional NZ public sector–toned templates with te reo greetings.
No LLM call needed for standard templates; custom type can be extended later.
"""

from __future__ import annotations

from datetime import datetime


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _first_name(full_name: str | None) -> str:
    if full_name and full_name.strip() and full_name.strip().lower() not in ("unknown", "candidate"):
        return full_name.strip().split()[0]
    return "there"


def _fmt_nz(dt: datetime) -> str:
    """Format a datetime as '14 April 2025 at 2:30 PM NZST'."""
    return dt.strftime("%-d %B %Y at %-I:%M %p")


# ---------------------------------------------------------------------------
# Rejection
# ---------------------------------------------------------------------------


def compose_rejection_email(candidate: dict, job: dict) -> dict:
    name = _first_name(candidate.get("full_name"))
    title = job.get("title", "the role")
    org = job.get("organisation", "the organisation")
    subject = f"Your Application — {title} at {org}"

    body_text = f"""Kia ora {name},

Thank you for taking the time to apply for the {title} position at {org}.

After careful consideration we regret to inform you that your application has not been progressed to the next stage. We received a high volume of applications from strong candidates, and the selection process was very competitive.

We appreciate your interest in {org} and the effort you invested in your application. We encourage you to keep an eye on future vacancies advertised on careers.govt.nz.

Ngā mihi,
The Recruitment Team
{org}"""

    body_html = f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <p>Kia ora {name},</p>
  <p>Thank you for taking the time to apply for the <strong>{title}</strong> position at {org}.</p>
  <p>After careful consideration we regret to inform you that your application has not been progressed to the next stage. We received a high volume of applications from strong candidates, and the selection process was very competitive.</p>
  <p>We appreciate your interest in {org} and the effort you invested in your application. We encourage you to keep an eye on future vacancies advertised on <a href="https://careers.govt.nz">careers.govt.nz</a>.</p>
  <p>Ngā mihi,<br><strong>The Recruitment Team</strong><br>{org}</p>
</body>
</html>"""

    return {"subject": subject, "body_text": body_text, "body_html": body_html}


# ---------------------------------------------------------------------------
# Shortlist invite
# ---------------------------------------------------------------------------


def compose_shortlist_invite_email(candidate: dict, job: dict) -> dict:
    name = _first_name(candidate.get("full_name"))
    title = job.get("title", "the role")
    org = job.get("organisation", "the organisation")
    subject = f"Congratulations — You've Been Shortlisted for {title}"

    body_text = f"""Kia ora {name},

We are pleased to inform you that following a review of applications for the {title} position at {org}, you have been shortlisted for the next stage of our recruitment process.

Your background and experience stood out, and we look forward to progressing your application further. A member of our team will be in touch shortly with details about the next steps.

If you have any questions in the meantime, please feel free to reply to this email.

Ngā mihi,
The Recruitment Team
{org}"""

    body_html = f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
    <strong style="color:#065f46;">&#10003; You have been shortlisted</strong>
  </div>
  <p>Kia ora {name},</p>
  <p>We are pleased to inform you that following a review of applications for the <strong>{title}</strong> position at {org}, you have been shortlisted for the next stage of our recruitment process.</p>
  <p>Your background and experience stood out, and we look forward to progressing your application further. A member of our team will be in touch shortly with details about the next steps.</p>
  <p>If you have any questions in the meantime, please feel free to reply to this email.</p>
  <p>Ngā mihi,<br><strong>The Recruitment Team</strong><br>{org}</p>
</body>
</html>"""

    return {"subject": subject, "body_text": body_text, "body_html": body_html}


# ---------------------------------------------------------------------------
# Phone screen invite (with booking link)
# ---------------------------------------------------------------------------


def compose_phone_screen_invite_email(
    candidate: dict,
    job: dict,
    slots: list[dict],
    booking_url: str,
) -> dict:
    name = _first_name(candidate.get("full_name"))
    title = job.get("title", "the role")
    org = job.get("organisation", "the organisation")
    subject = f"Phone Screening Invitation — {title} at {org}"

    # Build plain-text slot list
    slot_lines: list[str] = []
    for slot in slots[:6]:
        try:
            start = datetime.fromisoformat(slot["starts_at"].replace("Z", "+00:00"))
            slot_lines.append(f"  • {_fmt_nz(start)}")
        except Exception:
            slot_lines.append(f"  • {slot.get('starts_at', '')}")
    slots_text = "\n".join(slot_lines) if slot_lines else "  • Times to be confirmed"

    body_text = f"""Kia ora {name},

Congratulations — we would like to invite you to a phone screening interview for the {title} position at {org}.

The phone screen will take approximately 30 minutes. It is an opportunity for us to learn more about your experience and for you to ask questions about the role.

Please select a convenient time using the link below:

  {booking_url}

Available time slots:
{slots_text}

If none of these times work for you, please reply to this email and we will find an alternative.

We look forward to speaking with you.

Ngā mihi,
The Recruitment Team
{org}"""

    # Build HTML slot list
    slot_html = "".join(
        f"<li style='line-height:1.8;'>{_fmt_nz(datetime.fromisoformat(s['starts_at'].replace('Z','+00:00')))}</li>"
        if True else f"<li style='line-height:1.8;'>{s.get('starts_at','')}</li>"
        for s in slots[:6]
    )
    if not slot_html:
        slot_html = "<li>Times to be confirmed</li>"

    # Rebuild slot_html safely
    slot_html_items = []
    for slot in slots[:6]:
        try:
            start = datetime.fromisoformat(slot["starts_at"].replace("Z", "+00:00"))
            slot_html_items.append(f"<li style='line-height:1.8;'>{_fmt_nz(start)}</li>")
        except Exception:
            slot_html_items.append(f"<li style='line-height:1.8;'>{slot.get('starts_at','')}</li>")
    slot_html = "".join(slot_html_items) if slot_html_items else "<li>Times to be confirmed</li>"

    body_html = f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
    <strong style="color:#1e40af;">Phone Screening Invitation</strong>
  </div>
  <p>Kia ora {name},</p>
  <p>Congratulations — we would like to invite you to a <strong>phone screening interview</strong> for the <strong>{title}</strong> position at {org}.</p>
  <p>The phone screen will take approximately <strong>30 minutes</strong>. It is an opportunity for us to learn more about your experience and for you to ask questions about the role.</p>
  <p>Please select a convenient time using the button below:</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{booking_url}"
       style="background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
      Select Your Interview Time &rarr;
    </a>
  </p>
  <p><strong>Available time slots:</strong></p>
  <ul style="padding-left:20px;">{slot_html}</ul>
  <p>If none of these times work for you, please reply to this email and we will find an alternative.</p>
  <p>We look forward to speaking with you.</p>
  <p>Ngā mihi,<br><strong>The Recruitment Team</strong><br>{org}</p>
</body>
</html>"""

    return {"subject": subject, "body_text": body_text, "body_html": body_html}


# ---------------------------------------------------------------------------
# Booking confirmation
# ---------------------------------------------------------------------------


def compose_booking_confirmation_email(
    candidate: dict,
    job: dict,
    slot: dict,
) -> dict:
    name = _first_name(candidate.get("full_name"))
    title = job.get("title", "the role")
    org = job.get("organisation", "the organisation")
    subject = f"Interview Confirmed — {title} at {org}"

    try:
        start = datetime.fromisoformat(slot["starts_at"].replace("Z", "+00:00"))
        time_str = _fmt_nz(start)
    except Exception:
        time_str = str(slot.get("starts_at", "the scheduled time"))

    body_text = f"""Kia ora {name},

Your phone screening interview has been confirmed.

  Role:           {title}
  Organisation:   {org}
  Date & Time:    {time_str}
  Duration:       30 minutes

A member of our team will call you at the scheduled time. Please make sure you are available and in a quiet location.

If you need to reschedule, please reply to this email as soon as possible.

Ngā mihi,
The Recruitment Team
{org}"""

    body_html = f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
    <strong style="color:#065f46;">&#10003; Your interview is confirmed</strong>
  </div>
  <p>Kia ora {name},</p>
  <p>Your phone screening interview has been confirmed.</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin:20px 0;">
    <p style="margin:0 0 8px;"><strong>Role:</strong> {title}</p>
    <p style="margin:0 0 8px;"><strong>Organisation:</strong> {org}</p>
    <p style="margin:0 0 8px;"><strong>Date &amp; Time:</strong> {time_str}</p>
    <p style="margin:0;"><strong>Duration:</strong> 30 minutes</p>
  </div>
  <p>A member of our team will call you at the scheduled time. Please make sure you are available and in a quiet location.</p>
  <p>If you need to reschedule, please reply to this email as soon as possible.</p>
  <p>Ngā mihi,<br><strong>The Recruitment Team</strong><br>{org}</p>
</body>
</html>"""

    return {"subject": subject, "body_text": body_text, "body_html": body_html}
