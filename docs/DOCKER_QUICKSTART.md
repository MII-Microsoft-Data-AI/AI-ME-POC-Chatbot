# Quick Start Guide - Docker Deployment

## Summary of Changes

This implementation includes a complete Docker setup for deploying the AI-ME POC Chatbot with both the Next.js frontend and FastAPI backend in a single container.

### Files Created:

1. **Dockerfile** - Multi-stage Docker build
   - Backend (Python 3.11) on port 8081
   - Frontend (Next.js with Node.js 20) on port 8080
   - Automated startup script

2. **docker-compose.yml** - Orchestration configuration
   - Service definition with port mappings
   - Environment variable management
   - Health checks and restart policies
   - Volume mounting for .env file

3. **DOCKER_GUIDE.md** - Comprehensive documentation
   - Quick start instructions
   - Environment setup guide
   - Health check endpoints reference
   - Troubleshooting section
   - Production considerations

4. **.dockerignore** - Build optimization
   - Excludes unnecessary files from Docker context
   - Reduces image size

5. **.env.docker** - Environment template
   - Template for all required environment variables
   - Comments explaining each configuration

6. **src/app/api/health/route.ts** - Frontend health check
   - Endpoint: GET `/api/health`
   - Checks both frontend and backend status
   - Returns service status and timestamp

### Key Features:

✅ **Single Container**: Both frontend and backend run together
✅ **Port Configuration**: Frontend on 8080, Backend on 8081
✅ **Health Checks**: Built-in endpoints for monitoring
✅ **Environment Management**: Centralized configuration via .env
✅ **Docker Compose**: Easy orchestration with one command
✅ **Multi-stage Build**: Optimized image size

---

## Getting Started

### 1. Prepare Environment Variables

```bash
# Copy the Docker environment template
cp .env.docker .env

# Edit .env with your actual Azure credentials
nano .env  # or use your preferred editor
```

### 2. Build and Run

```bash
# Build and start the container
docker-compose up --build

# Or rebuild only
docker-compose build --no-cache
```

### 3. Access the Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8081
- **API Documentation**: http://localhost:8081/docs

### 4. Check Health

```bash
# Frontend health check (includes backend status)
curl http://localhost:8080/api/health

# Backend health check
curl http://localhost:8081/health
```

---

## Environment Variables

All required variables must be set in the `.env` file:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| BACKEND_URL | Yes | http://localhost:8081 | Backend connection URL |
| NEXTAUTH_URL | Yes | http://localhost:8080 | NextAuth callback URL |
| NEXTAUTH_SECRET | Yes | - | NextAuth encryption secret |
| BACKEND_API_USERNAME | Yes | - | Backend API authentication |
| BACKEND_API_PASSWORD | Yes | - | Backend API authentication |
| AZURE_OPENAI_API_KEY | Yes | - | Azure OpenAI key |
| AZURE_OPENAI_ENDPOINT | Yes | - | Azure OpenAI endpoint |
| AZURE_OPENAI_DEPLOYMENT | Yes | - | Azure OpenAI deployment name |
| AZURE_SEARCH_* | Yes | - | Azure Search credentials |
| AZURE_COSMOS_CONNECTION_STRING | Yes | - | Cosmos DB connection |
| AZURE_DOCUMENT_INTELLIGENCE_* | Yes | - | Document Intelligence credentials |
| AZURE_BLOB_STORAGE_CONNECTION_STRING | Yes | - | Blob storage connection |
| LANGCHAIN_API_KEY | No | - | LangSmith API key (optional) |
| LANGCHAIN_PROJECT | No | - | LangSmith project name (optional) |
| USE_OPENAI_CLIENT | No | true | Use OpenAI client instead of Azure OpenAI (set to 'false' to use Azure OpenAI) |

---

## Common Commands

```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart services
docker-compose restart

# Execute command in running container
docker-compose exec ai-me-chatbot bash

# Check service status
docker-compose ps

# View specific service logs
docker-compose logs ai-me-chatbot
```

---

## Health Check Endpoints

### Frontend Health Check

**Endpoint**: `GET /api/health`

**Response (Success)**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T04:41:53.750Z",
  "services": {
    "frontend": "healthy",
    "backend": "healthy"
  }
}
```

**Status Code**: 200

### Backend Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy"
}
```

**Status Code**: 200

---

## Troubleshooting

### Container exits immediately

1. Check logs: `docker-compose logs`
2. Verify `.env` file exists with all required variables
3. Check if ports 8080 and 8081 are available

### Backend connection error

1. Verify AZURE_* variables in `.env`
2. Check Azure service connectivity
3. Review container logs for specific errors

### Health check failing

1. Check backend is running: `curl http://localhost:8081/health`
2. Check frontend is running: `curl http://localhost:8080`
3. Verify environment variables are properly loaded

---

## Production Deployment

For production:

1. Use a `.env.prod` file with production secrets
2. Add resource limits to docker-compose.yml
3. Configure logging and monitoring
4. Use a reverse proxy (nginx) in front
5. Implement proper backup strategy
6. Set up automated health checks and alerts

See **DOCKER_GUIDE.md** for detailed production considerations.

---

## Next Steps

- Review DOCKER_GUIDE.md for comprehensive documentation
- Check health endpoints are responding correctly
- Configure monitoring and logging
- Plan backup and disaster recovery
