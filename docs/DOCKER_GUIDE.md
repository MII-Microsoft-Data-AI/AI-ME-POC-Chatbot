# Docker Deployment Guide

This guide explains how to deploy the AI-ME POC Chatbot (Next.js frontend + FastAPI backend) using Docker.

## Overview

- **Frontend**: Next.js application on port **8080**
- **Backend**: FastAPI application on port **8081**
- **Single Docker Container**: Both applications run in one container
- **Health Checks**: Integrated health check endpoints for monitoring

## Quick Start

### Prerequisites

- Docker installed and running
- `.env` file configured with required environment variables (see [Environment Setup](#environment-setup))

### Build and Run

```bash
# Using Docker Compose (Recommended)
docker-compose up --build

# Or using Docker directly
docker build -t ai-me-chatbot .
docker run -p 8080:8080 -p 8081:8081 --env-file .env ai-me-chatbot
```

Once running, access:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8081
- **API Docs**: http://localhost:8081/docs

## Environment Setup

### 1. Create `.env` file

Copy the sample environment file and update with your configuration:

```bash
cp env.sample .env
```

### 2. Required Environment Variables

```bash
# API Configuration
BACKEND_URL=http://localhost:8081
NEXTAUTH_URL=http://localhost:8080
NEXTAUTH_SECRET=your-secret-key-here

# Authentication
BACKEND_API_USERNAME=your-username
BACKEND_API_PASSWORD=your-secure-password

# Azure Configuration
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_KEY=your-search-key

AZURE_COSMOS_CONNECTION_STRING=your-cosmos-connection-string

AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-region.api.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-document-intelligence-key

AZURE_BLOB_STORAGE_CONNECTION_STRING=your-blob-storage-connection-string

# Optional: LangSmith for debugging
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=your-project-name
```

## Health Checks

### Frontend Health Check

```bash
curl http://localhost:8080/api/health
```

**Response:**
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

### Backend Health Check

```bash
curl http://localhost:8081/health
```

**Response:**
```json
{
  "status": "healthy"
}
```

## Docker Configuration

### Dockerfile Structure

The Dockerfile uses a multi-stage build approach:

1. **Backend Builder**: Builds Python environment with dependencies
2. **Frontend Builder**: Builds Next.js application
3. **Runtime**: Combines both and runs both services

### Exposed Ports

- **8080**: Next.js frontend
- **8081**: FastAPI backend

### Health Check Strategy

- **Docker Health Check**: Monitors backend health every 30 seconds
- **Application Health Endpoints**: Both frontend and backend provide health endpoints

## Running Locally Without Docker

### Backend

```bash
cd mock-backend

# Using UV (recommended)
uv run uvicorn main:app --host 0.0.0.0 --port 8081

# Or using Python directly
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8081
```

### Frontend

```bash
# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun run dev
```

Frontend will be available at http://localhost:3000 (default Next.js port)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs -f ai-me-chatbot

# Or with Docker directly
docker logs <container_id>
```

### Health check failing

1. **Verify environment variables**: Make sure `.env` file exists and contains all required variables
2. **Check backend**: `curl http://localhost:8081/health`
3. **Check frontend**: `curl http://localhost:8080/api/health`

### Backend can't connect to services

- Ensure all Azure credentials in `.env` are correct
- Check network connectivity from container to Azure services
- Review container logs for specific error messages

## Docker Compose Features

- **Auto-restart**: Container automatically restarts unless stopped
- **Health monitoring**: Built-in health checks with retry logic
- **Environment management**: All variables configured via `.env`
- **Volume mounts**: `.env` file mounted as read-only for configuration

## Production Considerations

For production deployment:

1. **Use environment-specific .env files**: `docker-compose.prod.yml`
2. **Add resource limits**: Set CPU and memory constraints
3. **Enable logging**: Configure proper logging drivers
4. **Use secrets management**: Don't commit `.env` to version control
5. **Implement load balancing**: Consider reverse proxy setup
6. **Monitor health checks**: Set up alerting on health check failures

Example resource limits in docker-compose:

```yaml
services:
  ai-me-chatbot:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '1'
        memory: 2G
```

## Additional Commands

### View running containers
```bash
docker-compose ps
```

### Stop the application
```bash
docker-compose down
```

### Rebuild images
```bash
docker-compose build --no-cache
```

### Execute commands in container
```bash
docker-compose exec ai-me-chatbot bash
```
