# Docker Architecture & Implementation Details

## Overview

The AI-ME POC Chatbot Docker implementation provides a containerized deployment solution for both the Next.js frontend and FastAPI backend applications. This document details the technical architecture and implementation specifics.

---

## Architecture

### Application Structure

```
┌─────────────────────────────────────────────────┐
│           Docker Container (Linux)              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────┐                     │
│  │  Next.js Frontend     │                     │
│  │  Port: 8080           │                     │
│  │  Health: /api/health  │                     │
│  └───────────────────────┘                     │
│                                                 │
│  ┌───────────────────────┐                     │
│  │  FastAPI Backend      │                     │
│  │  Port: 8081           │                     │
│  │  Health: /health      │                     │
│  └───────────────────────┘                     │
│                                                 │
│  ┌───────────────────────┐                     │
│  │  Startup Script       │                     │
│  │  (Orchestrates both)  │                     │
│  └───────────────────────┘                     │
│                                                 │
└─────────────────────────────────────────────────┘
         ↓                           ↓
    External Access            External Access
    localhost:8080            localhost:8081
```

### Build Process

```
┌──────────────────────────────────────────────────────┐
│           Docker Multi-Stage Build                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Stage 1: Backend Builder                           │
│  ├─ FROM python:3.11-slim                           │
│  ├─ Install system dependencies                     │
│  ├─ Copy requirements.txt                           │
│  └─ Install Python dependencies                     │
│                                                      │
│  Stage 2: Frontend Builder                          │
│  ├─ FROM node:20-alpine                             │
│  ├─ Copy package files                              │
│  ├─ Install Node dependencies                       │
│  └─ Build Next.js (npm run build)                   │
│                                                      │
│  Stage 3: Final Runtime (python:3.11-slim)          │
│  ├─ Copy Python environment from Stage 1            │
│  ├─ Copy Node.js runtime                            │
│  ├─ Copy built frontend from Stage 2                │
│  ├─ Copy backend source code                        │
│  ├─ Create startup script                           │
│  └─ Expose ports 8080 & 8081                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Dockerfile Details

### Base Images

- **Backend**: `python:3.11-slim` - Lightweight Python image
- **Frontend**: `node:20-alpine` - Minimal Node.js image
- **Runtime**: `python:3.11-slim` - Final production image

### Multi-Stage Build Benefits

1. **Size Optimization**: Builder images not included in final image
2. **Dependency Isolation**: Backend and frontend dependencies separated
3. **Caching**: Each stage caches independently
4. **Security**: Build tools not in final image

### Startup Script

```bash
#!/bin/bash
set -e

echo "🚀 Starting AI-ME POC Chatbot..."

# Backend startup
cd /app/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8081 &
BACKEND_PID=$!

# Frontend startup
cd /app/frontend
npm run start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
```

**Features**:
- Starts backend first (API dependencies ready for frontend)
- Starts frontend in background
- Maintains both processes (exits if either fails)
- Proper error handling with `set -e`

---

## Docker Compose Configuration

### Service Definition

```yaml
services:
  ai-me-chatbot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ai-me-chatbot
    ports:
      - "8080:8080"  # Frontend
      - "8081:8081"  # Backend
    environment:
      # All configuration from .env file
    volumes:
      - .env:/app/.env:ro  # Read-only .env mount
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Key Features

1. **Port Mapping**: Maps container ports to host ports
2. **Environment Variables**: Injected from .env file
3. **Volume Mount**: .env as read-only for security
4. **Restart Policy**: Auto-restart unless manually stopped
5. **Health Checks**: Docker monitor's backend health

---

## Health Check Implementation

### Backend Health Check

**File**: `mock-backend/main.py`

```python
@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
```

**Characteristics**:
- No authentication required
- Returns immediately
- No external service dependencies

### Frontend Health Check

**File**: `src/app/api/health/route.ts`

```typescript
export async function GET() {
  try {
    // Check backend connectivity
    const backendHealth = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.ok).catch(() => false);

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          frontend: 'healthy',
          backend: backendHealth ? 'healthy' : 'unhealthy',
        },
      },
      { status: backendHealth ? 200 : 503 }
    );
  } catch (error) {
    // Error handling
  }
}
```

**Characteristics**:
- Checks both frontend and backend
- Returns service status
- HTTP status reflects overall health (200 vs 503)
- Timestamp for monitoring

---

## Environment Variable Management

### Template File: `.env.docker`

Provides a template with all required variables and descriptions. Users copy to `.env` and fill in actual values.

### Loading in Docker Compose

```yaml
env_file:
  - .env  # Automatically loaded by docker-compose
```

### Loading in Applications

**Backend** (FastAPI):
```python
from dotenv import load_dotenv
load_dotenv()  # Loads from .env file
```

**Frontend** (Next.js):
```javascript
// Next.js automatically loads .env.local and environment variables
const backendUrl = process.env.BACKEND_URL
```

---

## Port Configuration

### Port Mapping

```
Host:Container Mapping
8080:8080  → Frontend (Next.js)
8081:8081  → Backend (FastAPI)
```

### Why These Ports?

- **8080**: Commonly used for HTTP traffic, non-privileged
- **8081**: Avoids conflict with typical development servers
- Both outside privileged range (< 1024), requiring no sudo

### Accessing Services

```
Frontend:  http://localhost:8080
Backend:   http://localhost:8081
API Docs:  http://localhost:8081/docs
```

---

## Performance Optimization

### Docker Build Optimization

1. **Multi-stage build**: Reduces final image size
2. **.dockerignore**: Excludes unnecessary files from build context
3. **Alpine images**: Minimal Node.js image (node:20-alpine)
4. **slim images**: Lightweight Python image (python:3.11-slim)

### Runtime Performance

1. **Process management**: Both apps run in parallel
2. **Port isolation**: No port conflicts
3. **Health checks**: Non-intrusive 30-second interval

### Build Time Optimization

```dockerfile
# Leverage build cache effectively
# Install dependencies before copying source
COPY mock-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY mock-backend/ /app/backend/
```

---

## Security Considerations

### Image Security

1. **Python base image**: Regular security updates
2. **Non-root user**: Consider adding USER directive
3. **Read-only .env**: `volumes: - .env:/app/.env:ro`

### Secrets Management

1. **.env not in git**: Added to .gitignore
2. **Template provided**: `.env.docker` shows required structure
3. **No hardcoded secrets**: All via environment variables

### CORS Configuration

Backend CORS settings:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Review for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Note**: Consider restricting `allow_origins` in production.

---

## Monitoring & Logging

### Docker Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ai-me-chatbot

# Last 100 lines
docker-compose logs --tail=100
```

### Application Logging

**Backend** (Uvicorn):
```
⏱️  [METHOD] /path - START
⏱️  [METHOD] /path - DONE in 0.123s
```

**Frontend** (Next.js):
```
- info: compiled successfully
- info: compiled client and server successfully
```

---

## Scaling Considerations

### Current Limitations

- Single container with both applications
- No load balancing
- No database persistence outside container
- Suitable for development and small deployments

### For Production Scaling

1. **Separate containers**: Split frontend and backend
2. **Docker Swarm/Kubernetes**: Orchestrate multiple containers
3. **Reverse proxy**: nginx for load balancing
4. **Persistent volumes**: For database and file storage
5. **Service discovery**: For inter-service communication

---

## Troubleshooting Guide

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Port already in use | Another app on 8080/8081 | Change ports in docker-compose.yml |
| .env file not found | Missing .env file | `cp .env.docker .env` |
| Health check failing | Backend not responding | Check logs, verify Azure credentials |
| Container exits immediately | Build or startup error | Review docker-compose logs |
| Out of memory | Resource constraints | Increase Docker memory limit |

### Debug Commands

```bash
# Check container status
docker-compose ps

# View full logs
docker-compose logs --tail=500

# Test health endpoint
docker-compose exec ai-me-chatbot curl http://localhost:8081/health

# Interactive shell
docker-compose exec ai-me-chatbot bash

# Check image size
docker images ai-me-chatbot
```

---

## File Structure

```
project-root/
├── Dockerfile                 # Multi-stage build definition
├── docker-compose.yml         # Service orchestration
├── .dockerignore              # Build context optimization
├── .env.docker                # Environment template
├── DOCKER_GUIDE.md            # Comprehensive guide
├── DOCKER_QUICKSTART.md       # Quick reference
├── mock-backend/
│   ├── main.py               # Backend with /health endpoint
│   ├── requirements.txt
│   └── ...
├── src/
│   └── app/api/health/
│       └── route.ts          # Frontend health endpoint
├── package.json
└── ...
```

---

## References

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
