from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(str, Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    FILLED = "FILLED"


class EmploymentType(str, Enum):
    PERMANENT = "permanent"
    FIXED_TERM = "fixed-term"
    CASUAL = "casual"


class JobDescription(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: UUID = Field(default_factory=uuid4)
    title: str
    organisation: str
    department: str
    location: str
    salary_band: str
    employment_type: EmploymentType
    closing_date: datetime
    overview: str
    responsibilities: List[str]
    required_skills: List[str]
    preferred_skills: List[str]
    qualifications: List[str]
    competencies: List[str]
    status: JobStatus = JobStatus.DRAFT
    created_at: datetime = Field(default_factory=datetime.utcnow)
