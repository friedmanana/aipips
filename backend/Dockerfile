FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    # Remove HTTP/2 libraries — Render free tier's HTTP/2 connections to Supabase
    # produce StreamReset (PROTOCOL_ERROR) errors. Without h2, httpx falls back
    # to HTTP/1.1 which is stable. See: https://github.com/encode/httpx/issues/2113
    && pip uninstall -y h2 hpack hyperframe 2>/dev/null || true

# Copy application code
COPY . .

# Railway injects PORT env var
ENV PORT=8000

EXPOSE $PORT

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
