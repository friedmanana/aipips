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


def _cv_length_instruction(pages: str) -> str:
    if pages == "1":
        return "LENGTH: Exactly 1 page — be ruthlessly concise, keep only the most impactful points, no filler."
    if pages == "3+":
        return "LENGTH: 3 or more pages — include full detail on every role, comprehensive skills, and all achievements."
    return "LENGTH: 2 pages — balance detail with conciseness."


def _cv_style_instruction(style: str) -> str:
    if style == "concise":
        return "STYLE: Concise and punchy — short bullet points, minimal prose, scannable."
    if style == "detailed":
        return "STYLE: Detailed and thorough — explain context, impact, and scope for each role."
    return "STYLE: Professional and polished — clear, confident language with strong action verbs."


def _cl_length_instruction(length: str) -> str:
    if length == "short":
        return "LENGTH: Short — 2-3 tight paragraphs, no more than half a page."
    if length == "detailed":
        return "LENGTH: Detailed — 5-6 paragraphs with specific examples and context."
    return "LENGTH: Standard — 3-4 paragraphs, one page."


def _cl_tone_instruction(tone: str) -> str:
    if tone == "conversational":
        return "TONE: Warm and conversational — friendly, personable, genuine; avoid stiff formal language."
    if tone == "formal":
        return "TONE: Formal — traditional business letter style, measured and authoritative."
    return "TONE: Professional — confident and warm NZ public sector style."


def generate_cv(
    background_text: str,
    job_title: str,
    company: str,
    job_description: str,
    pages: str = "2",
    style: str = "professional",
) -> tuple[str, str]:
    """Generate a structured CV from raw background information. Returns (text, html)."""
    at_company = f" at {company}" if company else ""
    jd_section = "JOB DESCRIPTION:\n" + job_description + "\n\n" if job_description.strip() else ""
    length_instr = _cv_length_instruction(pages)
    style_instr = _cv_style_instruction(style)

    prompt = (
        f"Write a professional, well-structured CV for a {job_title} role{at_company} "
        "based on the background information below.\n\n"
        f"{length_instr}\n{style_instr}\n\n"
        f"{jd_section}"
        f"CANDIDATE BACKGROUND:\n{background_text}\n\n"
        "Instructions:\n"
        "1. Organise into clear sections: PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION, SKILLS, KEY ACHIEVEMENTS\n"
        "2. Write a compelling professional summary tailored to this role\n"
        "3. Format each role with: job title, organisation, dates, and bullet points of accomplishments\n"
        "4. Use strong action verbs and quantify achievements wherever the background info allows\n"
        "5. Mirror key terminology from the job description if provided\n"
        "6. Surface NZ public sector competencies where relevant (policy, stakeholder engagement, Treaty awareness, public service values)\n"
        "7. Do not invent facts not present in the background info\n\n"
        "Return ONLY the CV text, no preamble or commentary."
    )

    cv_text = _call_llm(prompt)
    return cv_text, _text_to_html(cv_text)


def enhance_cv(
    cv_text: str,
    job_title: str,
    company: str,
    job_description: str,
    pages: str = "2",
    style: str = "professional",
) -> tuple[str, str]:
    """Enhance a CV for a specific role. Returns (enhanced_text, enhanced_html)."""
    at_company = f" at {company}" if company else ""
    jd_section = "JOB DESCRIPTION:\n" + job_description + "\n\n" if job_description.strip() else ""
    length_instr = _cv_length_instruction(pages)
    style_instr = _cv_style_instruction(style)

    prompt = (
        f"Enhance and tailor the following CV for a {job_title} role{at_company}.\n\n"
        f"{length_instr}\n{style_instr}\n\n"
        f"{jd_section}"
        f"ORIGINAL CV:\n{cv_text}\n\n"
        "Instructions:\n"
        "1. Restructure to highlight the most relevant experience for this role\n"
        "2. Use strong action verbs and quantify achievements where possible\n"
        "3. Mirror key terminology from the job description if provided\n"
        "4. Surface NZ public sector competencies where relevant (policy, stakeholder engagement, Treaty awareness, public service values)\n"
        "5. Keep all facts accurate — do not invent experience\n\n"
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
    length: str = "standard",
    tone: str = "professional",
) -> tuple[str, str]:
    """Generate a tailored cover letter. Returns (text, html)."""
    at_company = f" at {company}" if company else ""
    jd_section = "JOB DESCRIPTION:\n" + job_description + "\n\n" if job_description.strip() else ""
    length_instr = _cl_length_instruction(length)
    tone_instr = _cl_tone_instruction(tone)

    prompt = (
        f"Write a cover letter for a {job_title} role{at_company}.\n\n"
        f"{length_instr}\n{tone_instr}\n\n"
        f"{jd_section}"
        f"CANDIDATE CV:\n{cv_text}\n\n"
        "Requirements:\n"
        "- Opening paragraph: genuine interest in this specific role and organisation\n"
        "- Middle paragraphs: draw directly from the CV to demonstrate fit — be specific\n"
        "- Reference NZ public service values / Treaty obligations where genuinely relevant\n"
        "- Closing: confident, forward-looking call to action\n"
        "- Do NOT use 'I am writing to apply for' as opening\n\n"
        "Return ONLY the cover letter text starting with 'Dear Hiring Manager,' "
        "and ending with a sign-off line '[Your Name]'. No commentary."
    )

    cl_text = _call_llm(prompt)
    return cl_text, _text_to_html(cl_text)


def enhance_cover_letter(
    existing_letter: str,
    job_title: str,
    company: str,
    job_description: str,
    cv_text: str,
    length: str = "standard",
    tone: str = "professional",
) -> tuple[str, str]:
    """Enhance a candidate's existing cover letter. Returns (text, html)."""
    at_company = f" at {company}" if company else ""
    jd_section = "JOB DESCRIPTION:\n" + job_description + "\n\n" if job_description.strip() else ""
    cv_section = "CANDIDATE CV (for context):\n" + cv_text + "\n\n" if cv_text.strip() else ""
    length_instr = _cl_length_instruction(length)
    tone_instr = _cl_tone_instruction(tone)

    prompt = (
        f"Enhance and improve the following cover letter for a {job_title} role{at_company}.\n\n"
        f"{length_instr}\n{tone_instr}\n\n"
        f"{jd_section}"
        f"{cv_section}"
        f"EXISTING COVER LETTER:\n{existing_letter}\n\n"
        "Instructions:\n"
        "- Keep the candidate's own voice and personal details — do not invent new experience\n"
        "- Strengthen the opening to be more compelling and specific\n"
        "- Tighten the language — remove clichés, passive voice, and filler phrases\n"
        "- Better align with the job description keywords if provided\n"
        "- Ensure a confident, forward-looking closing\n\n"
        "Return ONLY the enhanced cover letter text, starting with the salutation and ending with the sign-off. No commentary."
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
    interviewer_roles: str = "",
    num_questions: int = 12,
) -> list[dict]:
    """Generate interview Q&A. Returns list of {question, answer, category, tip} dicts."""
    import json
    import re as _re

    context_parts = []
    if job_description.strip():
        context_parts.append("JOB DESCRIPTION:\n" + job_description)
    if cv_text.strip():
        context_parts.append("CANDIDATE CV:\n" + cv_text)
    if interview_format.strip():
        context_parts.append("INTERVIEW FORMAT: " + interview_format)
    if interviewer_roles.strip():
        context_parts.append("INTERVIEWERS: " + interviewer_roles)
    if focus_areas.strip():
        context_parts.append("CANDIDATE NOTES ON FOCUS AREAS: " + focus_areas)

    context = "\n\n".join(context_parts)
    at_company = f" at {company}" if company else ""

    interviewer_guidance = ""
    if interviewer_roles.strip():
        interviewer_guidance = (
            f"\nThe interviewers are: {interviewer_roles}. "
            "Tailor each question to what those specific people would care about most. "
            "For the 'tip' field, give specific advice on how to frame the answer for that interviewer's "
            "perspective — what they prioritise, what impresses them, and what to avoid.\n"
        )
    else:
        interviewer_guidance = (
            "\nFor the 'tip' field, give practical coaching advice: "
            "what the interviewer is really trying to assess with this question, "
            "what a strong answer looks like, and one common mistake to avoid.\n"
        )

    prompt = (
        f"Generate exactly {num_questions} likely interview questions for a {job_title} role{at_company}, "
        "with strong suggested answers and coaching tips tailored to this candidate.\n\n"
        f"{context}\n"
        f"{interviewer_guidance}\n"
        "For each question provide:\n"
        "- category: one of 'Behavioural', 'Technical', 'Situational', 'Motivation', 'Values'\n"
        "- question: the interview question exactly as the interviewer would ask it\n"
        "- answer: a strong 180-250 word suggested answer using STAR method where appropriate, "
        "referencing specific details from the CV, written in first person as the candidate. "
        "Be specific — generic answers score poorly.\n"
        "- tip: 2-3 sentences of coaching insight specific to this question — "
        "what the interviewer is probing for, how to frame the answer for maximum impact, "
        "and one thing to watch out for.\n\n"
        "Return ONLY a JSON array, no other text:\n"
        '[{"category": "...", "question": "...", "answer": "...", "tip": "..."}, ...]\n\n'
        "Spread across NZ public sector competencies: policy analysis, stakeholder engagement, "
        "Te Tiriti o Waitangi obligations, public service values, evidence-based decision making, "
        "change management, relationship management, leadership."
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
    return [{"category": "General", "question": "Tell me about yourself.", "answer": raw, "tip": ""}]


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
