# Multi-stage build: Backend
FROM python:3.12-slim as backend-builder

WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend files
COPY mock-backend/requirements.txt .
COPY mock-backend/pyproject.toml .
COPY mock-backend/.python-version .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Multi-stage build: Frontend
FROM node:20-alpine as frontend-builder

WORKDIR /app/frontend

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies using bun
RUN bun install --frozen-lockfile

# Copy frontend source
COPY . .

# Build Next.js app
RUN bun run build

# Final stage: Runtime
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install bun for potential runtime use
RUN npm install -g bun

# Copy Python backend from builder
COPY --from=backend-builder /app/backend /app/backend
COPY --from=backend-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy Node.js runtime from builder
COPY --from=frontend-builder /app/frontend /app/frontend

# Copy backend source code
COPY mock-backend/ /app/backend/

# Create startup script
RUN mkdir -p /app/scripts
COPY <<EOF /app/scripts/start.sh
#!/bin/bash
set -e

echo "🚀 Starting AI-ME POC Chatbot..."

# Start backend in background
echo "📦 Starting FastAPI backend on port 8081..."
cd /app/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8081 &
BACKEND_PID=$!

# Start frontend
echo "🎨 Starting Next.js frontend on port 8080..."
cd /app/frontend
bun run start &
FRONTEND_PID=$!

# Wait for both services
wait $BACKEND_PID $FRONTEND_PID
EOF

RUN chmod +x /app/scripts/start.sh

# Expose ports
EXPOSE 8080 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Start services
CMD ["/app/scripts/start.sh"]
