"""CV enhancement and cover letter generation for NZ public sector candidates."""
from __future__ import annotations

import re


_SYSTEM_PROMPT = (
    "You are an expert NZ public sector career coach and CV writer. "
    "You help candidates tailor their CVs and cover letters for NZ government roles. "
    "You understand NZ public sector culture, Te Tiriti o Waitangi obligations, "
    "the NZ public service values, and demonstrated competency frameworks. "
    "Write in clear, professional New Zealand English. Be specific and avoid clichés."
)


def _call_llm(prompt: str) -> str:
    """Call Claude via Anthropic SDK (uses ANTHROPIC_API_KEY env var)."""
    try:
        import anthropic  # type: ignore[import]

        client = anthropic.Anthropic()
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception as exc:
        raise RuntimeError(f"LLM call failed: {exc}") from exc


def enhance_cv(
    cv_text: str,
    job_title: str,
    company: str,
    job_description: str,
) -> tuple[str, str]:
    """Enhance a CV for a specific role. Returns (enhanced_text, enhanced_html)."""
    at_company = f" at {company}" if company else ""
    jd_section = "JOB DESCRIPTION:\n" + job_description + "\n\n" if job_description.strip() else ""

    prompt = (
        f"Enhance and tailor the following CV for a {job_title} role{at_company}.\n\n"
        f"{jd_section}"
        f"ORIGINAL CV:\n{cv_text}\n\n"
        "Instructions:\n"
        "1. Restructure to highlight the most relevant experience for this role\n"
        "2. Use strong action verbs and quantify achievements where possible\n"
        "3. Mirror key terminology from the job description if provided\n"
        "4. Surface NZ public sector competencies where relevant (policy, stakeholder engagement, Treaty awareness, public service values)\n"
        "5. Ensure professional NZ English throughout\n"
        "6. Keep all facts accurate — do not invent experience\n\n"
        "Return ONLY the enhanced CV text ready to copy. Use clear section headings "
        "(PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION, SKILLS, KEY ACHIEVEMENTS). No commentary."
    )

    enhanced_text = _call_llm(prompt)
    return enhanced_text, _text_to_html(enhanced_text)


def generate_cover_letter(
    cv_text: str,
    job_title: str,
    company: str,
    job_description: str,
) -> tuple[str, str]:
    """Generate a tailored cover letter. Returns (text, html)."""
    at_company = f" at {company}" if company else ""
    jd_section = "JOB DESCRIPTION:\n" + job_description + "\n\n" if job_description.strip() else ""

    prompt = (
        f"Write a professional cover letter for a {job_title} role{at_company}.\n\n"
        f"{jd_section}"
        f"CANDIDATE CV:\n{cv_text}\n\n"
        "Requirements:\n"
        "- 3-4 paragraphs, professional but warm NZ tone\n"
        "- Opening paragraph: genuine interest in this specific role and organisation\n"
        "- Middle paragraphs: draw directly from the CV to demonstrate fit — be specific\n"
        "- Reference NZ public service values / Treaty obligations where genuinely relevant\n"
        "- Closing: confident, forward-looking call to action\n"
        "- Do NOT use 'I am writing to apply for' as opening\n"
        "- Professional NZ English, no jargon\n\n"
        "Return ONLY the cover letter text starting with 'Dear Hiring Manager,' "
        "and ending with a sign-off line '[Your Name]'. No commentary."
    )

    cl_text = _call_llm(prompt)
    return cl_text, _text_to_html(cl_text)


def _text_to_html(text: str) -> str:
    """Convert plain text CV/letter to simple styled HTML."""
    lines = text.split("\n")
    html_parts: list[str] = []
    in_list = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append("<br>")
            continue

        is_heading = re.match(r"^[A-Z][A-Z\s\/]{3,}$", stripped)
        is_bullet = stripped.startswith(("•", "-", "*"))

        if is_heading:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append(
                f'<h3 style="margin:14px 0 4px;font-size:13px;font-weight:700;'
                f'text-transform:uppercase;letter-spacing:.05em;color:#1e40af;'
                f'border-bottom:1px solid #e2e8f0;padding-bottom:4px;">{stripped}</h3>'
            )
        elif is_bullet:
            if not in_list:
                html_parts.append('<ul style="margin:4px 0;padding-left:20px;">')
                in_list = True
            html_parts.append(
                f'<li style="margin:2px 0;font-size:14px;">{stripped[1:].strip()}</li>'
            )
        else:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append(
                f'<p style="margin:4px 0;font-size:14px;line-height:1.6;">{stripped}</p>'
            )

    if in_list:
        html_parts.append("</ul>")

    return (
        '<div style="font-family:Arial,sans-serif;max-width:700px;color:#1a202c;">'
        + "".join(html_parts)
        + "</div>"
    )
