# AI Pips

AI-powered recruitment and career tools platform — replacing recruitment agencies with intelligent, fair, and transparent candidate matching.

## Architecture

### Agents (Strands Framework)
- **Job Analyst** — parses JDs, extracts skills/competencies/requirements
- **Candidate Screener** — reviews CVs against job requirements, scores fit
- **Matching Orchestrator** — coordinates screening, ranks candidates, produces shortlist
- **Interview Prep** — generates structured interview questions per candidate
- **Compliance Checker** — enforces NZ public sector hiring standards (EEO, merit-based)

### Stack
- **Backend:** Python, FastAPI, Strands Agents
- **Frontend:** Next.js (TypeScript), Tailwind CSS
- **Database:** Supabase
- **Deployment:** Vercel (frontend), Railway/Render (backend) → AWS (future)

## Getting Started

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Project Structure
```
aipips/
├── backend/
│   ├── agents/        # Strands agent definitions
│   ├── api/           # FastAPI route handlers
│   ├── models/        # Pydantic data models
│   ├── services/      # Business logic
│   ├── tools/         # Strands tools (CV parser, JD parser, etc.)
│   └── main.py
├── frontend/          # Next.js app
├── docs/              # Architecture docs
└── scripts/           # Dev/deploy utilities
```
