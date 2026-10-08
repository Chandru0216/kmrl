FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 APP_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-mal \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
RUN mkdir -p uploads

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 2 --timeout 120 app:app"]
