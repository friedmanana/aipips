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
    """Call Llama 3.3 70B via Groq API (uses GROQ_API_KEY env var, free tier)."""
    import os

    import httpx

    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set — add it in Render environment variables")

    url = "https://api.groq.com/openai/v1/chat/completions"
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 4096,
        "temperature": 0.7,
    }
    try:
        resp = httpx.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
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


def generate_interview_qa(
    cv_text: str,
    job_title: str,
    company: str,
    job_description: str,
    interview_format: str,
    focus_areas: str,
) -> list[dict]:
    """Generate interview Q&A. Returns list of {question, answer, category} dicts."""
    import json
    import re as _re

    context_parts = []
    if job_description.strip():
        context_parts.append("JOB DESCRIPTION:\n" + job_description)
    if cv_text.strip():
        context_parts.append("CANDIDATE CV:\n" + cv_text)
    if interview_format.strip():
        context_parts.append("INTERVIEW FORMAT: " + interview_format)
    if focus_areas.strip():
        context_parts.append("CANDIDATE NOTES ON FOCUS AREAS: " + focus_areas)

    context = "\n\n".join(context_parts)
    at_company = f" at {company}" if company else ""

    prompt = (
        f"Generate 10 likely interview questions for a {job_title} role{at_company}, "
        "along with strong suggested answers tailored to this candidate.\n\n"
        f"{context}\n\n"
        "For each question provide:\n"
        "- category: one of 'Behavioural', 'Technical', 'Situational', 'Motivation', 'Values'\n"
        "- question: the interview question\n"
        "- answer: a strong 150-250 word suggested answer using STAR method where appropriate, "
        "referencing specific details from the CV, written in first person\n\n"
        "Return ONLY a JSON array with exactly this structure, no other text:\n"
        '[{"category": "...", "question": "...", "answer": "..."}, ...]\n\n'
        "Focus on NZ public sector competencies: policy analysis, stakeholder engagement, "
        "Treaty of Waitangi obligations, public service values, evidence-based decision making."
    )

    raw = _call_llm(prompt)

    # Extract JSON array from response
    match = _re.search(r'\[.*\]', raw, _re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # Fallback: return raw as single item
    return [{"category": "General", "question": "Tell me about yourself.", "answer": raw}]


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
