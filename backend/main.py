from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.db_jobs import router as db_jobs_router
from api.routes.jobs import router as jobs_router
from api.schemas import HealthResponse

app = FastAPI(
    title="PubSec Recruiter NZ",
    description="AI-powered recruitment platform for NZ public sector organisations",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# FastAPI CORSMiddleware only supports exact origins or "*" (no wildcard subdomains).
# We allow all origins so the Vercel frontend can reach the Render backend without
# needing to hard-code a specific deployment URL.  Credentials are not used (no
# cookies / session auth), so allow_origins="*" is safe here.
_extra_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router)
app.include_router(db_jobs_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version="0.1.0")
