# Deployment Guide

This guide covers deploying the AI Pips platform to production using Supabase (database), Railway (backend), and Vercel (frontend).

---

## Section 1: Prerequisites

You will need accounts on the following platforms:

- **GitHub** — already set up (hosts the code)
- **Supabase** — managed Postgres database ([supabase.com](https://supabase.com))
- **Railway** — backend hosting ([railway.app](https://railway.app))
- **Vercel** — frontend hosting ([vercel.com](https://vercel.com))

---

## Section 2: Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
   - Choose region **ap-southeast-2 (Sydney)** for lowest latency from NZ.
2. In the Supabase dashboard, go to **SQL Editor**.
   - Paste the contents of `supabase/migrations/001_initial_schema.sql` and click **Run**.
3. Optionally, run `supabase/seed.sql` in the SQL Editor to populate example data.
4. Go to **Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (the `anon` key under "Project API keys")

---

## Section 3: Backend — Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select the `aipips` repository.
3. Railway will auto-detect `backend/Dockerfile` via `railway.json` and use it for the build.
4. In the Railway dashboard for your service, go to **Variables** and set the following environment variables:
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
   - `SUPABASE_URL` — the Project URL from Supabase Settings → API
   - `SUPABASE_KEY` — the anon key from Supabase Settings → API
   - `ALLOWED_ORIGINS` — leave blank for now; you will add this after Vercel deployment (step 4.7)
5. Once deployed, copy the Railway-assigned public URL (e.g. `https://aipips-production.up.railway.app`).
6. Go to your GitHub repository **Settings → Secrets and variables → Actions** and add:
   - `RAILWAY_TOKEN` — from Railway dashboard → Account Settings → Tokens

---

## Section 4: Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → **Import from GitHub**.
2. Select the `aipips` repository.
3. Set the **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` — your Railway URL from step 3.5 (e.g. `https://aipips-production.up.railway.app`)
5. Click **Deploy**.
6. Once deployed, copy the Vercel URL (e.g. `https://aipips.vercel.app`).
7. Go back to Railway → your service **Variables** and add:
   - `ALLOWED_ORIGINS=https://aipips.vercel.app`
   - (If you have multiple Vercel URLs, separate them with commas.)
8. Go to your GitHub repository **Settings → Secrets and variables → Actions** and add:
   - `VERCEL_TOKEN` — from Vercel dashboard → Account Settings → Tokens
   - `VERCEL_ORG_ID` — from Vercel project settings → General
   - `VERCEL_PROJECT_ID` — from Vercel project settings → General

---

## Section 5: Verify

After deployment, confirm everything is running:

- Visit `https://your-railway-url/health` — should return `{"status":"ok","version":"0.1.0"}`
- Visit `https://your-railway-url/docs` — FastAPI Swagger UI should load
- Visit your Vercel URL — the dashboard should load and connect to the backend

---

## Section 6: CI/CD After First Deploy

Once the initial deployment is complete, all future changes are automated:

- Merges to `main` that touch `backend/**` automatically deploy the backend to Railway.
- Merges to `main` that touch `frontend/**` automatically deploy the frontend to Vercel.

**Recommended branching flow:**

```
feature branch → PR → develop → PR → main → auto-deploy
```

- Work on feature branches.
- Open a PR into `develop` for review and CI checks (lint, type-check, tests).
- Once validated, open a PR from `develop` into `main`.
- Merging to `main` triggers the deploy workflows.
