from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from strands import tool


@tool
def extract_text_from_pdf(file_path: str) -> str:
    """Extract and return cleaned text from a CV PDF file at the given path."""
    import pypdf

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    reader = pypdf.PdfReader(str(path))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)

    raw = "\n".join(pages)
    return _clean_text(raw)


@tool
def extract_contact_info(text: str) -> dict:
    """Extract contact information from CV text.

    Returns a dict with keys: email, phone, linkedin_url.
    Values are empty strings when not found.
    """
    email_match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    email = email_match.group(0) if email_match else ""

    phone_match = re.search(
        r"(?:(?:\+64|0064)[\s\-]?)?(?:2[0-9]|4[0-9])[\s\-]?\d{3,4}[\s\-]?\d{3,4}",
        text,
    )
    phone = phone_match.group(0).strip() if phone_match else ""

    linkedin_match = re.search(
        r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?",
        text,
        re.IGNORECASE,
    )
    linkedin_url = linkedin_match.group(0) if linkedin_match else ""

    return {
        "email": email,
        "phone": phone,
        "linkedin_url": linkedin_url,
    }


@tool
def extract_cv_sections(text: str) -> dict:
    """Split raw CV text into sections using heuristic heading detection.

    Returns a dict with keys: summary, experience, education, skills, certifications.
    """
    section_patterns = {
        "summary": [
            r"(?i)(profile|summary|professional\s+summary|about\s+me|career\s+(objective|summary)|personal\s+statement|objective)",
        ],
        "experience": [
            r"(?i)(experience|work\s+experience|employment(\s+history)?|career\s+history|professional\s+experience|work\s+history)",
        ],
        "education": [
            r"(?i)(education|academic(\s+background)?|qualifications?|tertiary\s+education|study|training\s+and\s+education)",
        ],
        "skills": [
            r"(?i)(skills|technical\s+skills|key\s+skills|core\s+competencies|areas\s+of\s+expertise|capabilities)",
        ],
        "certifications": [
            r"(?i)(certifications?|licen[cs]es?|professional\s+(development|memberships?)|accreditations?|courses?)",
        ],
    }

    heading_re = re.compile(
        r"(?m)^[ \t]*([A-Z][A-Za-z /&\-]{2,60})\s*[:：]?\s*$"
    )

    headings_found: list[tuple[int, str]] = []
    for match in heading_re.finditer(text):
        headings_found.append((match.start(), match.group(1).strip()))

    def _classify_heading(heading: str) -> str | None:
        for section, patterns in section_patterns.items():
            for pat in patterns:
                if re.search(pat, heading):
                    return section
        return None

    classified: list[tuple[int, str, str]] = []
    for pos, heading in headings_found:
        section = _classify_heading(heading)
        if section:
            classified.append((pos, heading, section))

    result: dict[str, str] = {
        "summary": "",
        "experience": "",
        "education": "",
        "skills": "",
        "certifications": "",
    }

    for i, (pos, heading, section) in enumerate(classified):
        start = pos + len(heading)
        end = classified[i + 1][0] if i + 1 < len(classified) else len(text)
        content = text[start:end].strip(" \t:\n")
        if result[section]:
            result[section] += "\n" + content
        else:
            result[section] = content

    if not result["summary"]:
        first_classified_pos = classified[0][0] if classified else len(text)
        result["summary"] = text[:first_classified_pos].strip()

    return result


def _clean_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = re.sub(r"\r\n|\r", "\n", normalized)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()
