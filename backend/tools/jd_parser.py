from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from strands import tool


@tool
def extract_text_from_pdf(file_path: str) -> str:
    """Extract and return cleaned text from a PDF file at the given path."""
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
def extract_text_from_string(raw_text: str) -> str:
    """Clean and normalise raw JD text: strip excess whitespace and normalize unicode."""
    return _clean_text(raw_text)


@tool
def identify_jd_sections(text: str) -> dict:
    """Split raw JD text into sections using regex heuristics.

    Returns a dict with keys: overview, responsibilities, required_skills,
    preferred_skills, qualifications, competencies.
    """
    section_patterns = {
        "overview": [
            r"(?i)(overview|about\s+(the\s+)?role|purpose|about\s+(us|the\s+organisation|the\s+team)|role\s+summary|position\s+overview|the\s+opportunity)",
        ],
        "responsibilities": [
            r"(?i)(key\s+responsibilities|responsibilities|duties|what\s+you.ll\s+do|the\s+role|your\s+role|accountabilities|key\s+tasks)",
        ],
        "required_skills": [
            r"(?i)(required\s+skills|essential\s+(skills|requirements|criteria)|you\s+(will|must)\s+(have|bring)|minimum\s+requirements|what\s+you.ll\s+bring|skills\s+and\s+experience)",
        ],
        "preferred_skills": [
            r"(?i)(preferred\s+(skills|attributes)|desirable|nice\s+to\s+have|advantageous|bonus\s+skills)",
        ],
        "qualifications": [
            r"(?i)(qualifications|education|academic|degrees?|certifications?|credentials)",
        ],
        "competencies": [
            r"(?i)(competencies|key\s+competencies|behavioural\s+competencies|leadership\s+(competencies|profile)|values|attributes)",
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
        "overview": "",
        "responsibilities": "",
        "required_skills": "",
        "preferred_skills": "",
        "qualifications": "",
        "competencies": "",
    }

    for i, (pos, heading, section) in enumerate(classified):
        start = pos + len(heading)
        end = classified[i + 1][0] if i + 1 < len(classified) else len(text)
        content = text[start:end].strip(" \t:\n")
        if result[section]:
            result[section] += "\n" + content
        else:
            result[section] = content

    if not any(result.values()):
        result["overview"] = text.strip()

    if not result["overview"]:
        first_classified_pos = classified[0][0] if classified else len(text)
        result["overview"] = text[:first_classified_pos].strip()

    return result


def _clean_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = re.sub(r"\r\n|\r", "\n", normalized)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()
