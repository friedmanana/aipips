from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes.booking import router as booking_router
from api.routes.candidate import router as candidate_router
from api.routes.comms import router as comms_router
from api.routes.db_jobs import router as db_jobs_router
from api.routes.integrations import router as integrations_router
from api.routes.jobs import router as jobs_router
from api.routes.slots import router as slots_router
from api.schemas import HealthResponse
from db.migrate import run_migrations

# Run DB migrations on every startup — safe/idempotent, skips already-applied files
run_migrations()

app = FastAPI(
    title="AI Pips",
    description="AI-powered recruitment and career tools platform",
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

# Ensure CORS headers are present even on unhandled 500 errors.
# Without this, browsers see "Load failed" instead of the real error message
# because the CORS middleware doesn't run after an unhandled exception.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

app.include_router(jobs_router)
app.include_router(db_jobs_router)
app.include_router(comms_router)
app.include_router(slots_router)
app.include_router(booking_router)
app.include_router(integrations_router)
app.include_router(candidate_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version="0.1.0")
