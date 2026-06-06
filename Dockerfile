# Stage 1: build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN chmod +x node_modules/.bin/* && npm run build

# Stage 2: backend + combined app
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

ENV TESSERACT_CMD=tesseract
ENV UPLOAD_DIR=/data/uploads
ENV DATABASE_URL=sqlite+aiosqlite:////data/accountingsuite.db

EXPOSE 8000
CMD ["sh", "-c", "python main.py"]
