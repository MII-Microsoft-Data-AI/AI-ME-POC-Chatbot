# Docker Deployment - AI-ME POC Chatbot

Complete Docker setup for deploying the Next.js frontend and FastAPI backend in a single containerized environment.

## 📋 What's Included

### Core Files
- **Dockerfile** - Multi-stage build for both frontend and backend
- **docker-compose.yml** - Orchestration and service configuration
- **.dockerignore** - Build optimization
- **.env.docker** - Environment variable template

### Health Endpoints
- **Backend**: `GET /health` (FastAPI)
- **Frontend**: `GET /api/health` (Next.js)

### Documentation (4 guides)
1. **DOCKER_QUICKSTART.md** - Get started in 3 steps
2. **DOCKER_GUIDE.md** - Comprehensive deployment guide
3. **DOCKER_ARCHITECTURE.md** - Technical deep dive
4. **IMPLEMENTATION_CHECKLIST.md** - Verification checklist

## 🚀 Quick Start

### Prerequisites
- Docker installed and running
- `.env` file with configuration (see below)

### 3-Step Deployment

```bash
# 1. Create .env file from template
cp .env.docker .env

# 2. Edit .env with your Azure credentials
nano .env  # or your preferred editor

# 3. Deploy
docker-compose up --build
```

### Access the Application
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8081
- **API Documentation**: http://localhost:8081/docs

## 🔧 Environment Setup

Copy `.env.docker` to `.env` and configure these sections:

```env
# Backend Configuration
BACKEND_URL=http://localhost:8081
NEXTAUTH_URL=http://localhost:8080
NEXTAUTH_SECRET=your-secret-key

# Azure OpenAI
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=your-endpoint
AZURE_OPENAI_DEPLOYMENT=your-deployment

# Azure Search
AZURE_SEARCH_ENDPOINT=your-endpoint
AZURE_SEARCH_KEY=your-key

# Azure Cosmos DB
AZURE_COSMOS_CONNECTION_STRING=your-connection-string

# And more... (see .env.docker for all options)
```

## 🏗️ Architecture

### Container Structure
```
Docker Container (Linux)
├── FastAPI Backend (Port 8081)
│   └─ Python 3.11 + Uvicorn
├── Next.js Frontend (Port 8080)
│   └─ Node.js 20 + npm
└── Startup Script
    └─ Orchestrates both services
```

### Ports
- **8080** - Next.js frontend
- **8081** - FastAPI backend

### Health Checks
- Docker health check every 30 seconds
- Frontend health endpoint: `/api/health`
- Backend health endpoint: `/health`

## 📖 Documentation

### Quick Reference
For a quick deployment guide, see **DOCKER_QUICKSTART.md**

### Comprehensive Guide
For detailed instructions including troubleshooting, see **DOCKER_GUIDE.md**

### Technical Details
For architecture and technical implementation, see **DOCKER_ARCHITECTURE.md**

### Verification
To verify all components, see **IMPLEMENTATION_CHECKLIST.md**

## 💻 Common Commands

```bash
# Start (build if needed)
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop services
docker-compose down

# Shell access
docker-compose exec ai-me-chatbot bash

# Rebuild without cache
docker-compose build --no-cache
```

## 🧪 Testing Health Endpoints

```bash
# Test backend health
curl http://localhost:8081/health

# Test frontend health (includes backend check)
curl http://localhost:8080/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2026-01-15T04:41:53.750Z",
  "services": {
    "frontend": "healthy",
    "backend": "healthy"
  }
}
```

## 🔍 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs -f

# Verify .env exists
ls -la .env

# Ensure ports are available
lsof -i :8080
lsof -i :8081
```

### Health Check Failing
```bash
# Test backend directly
curl http://localhost:8081/health

# Check for Azure credential issues
docker-compose logs | grep -i error

# Verify environment variables
docker-compose exec ai-me-chatbot env | grep AZURE
```

### More Help
See **DOCKER_GUIDE.md** for comprehensive troubleshooting section

## 🔐 Security

- ✅ No hardcoded secrets
- ✅ Environment variables for all credentials
- ✅ .env file excluded from version control
- ✅ .env.docker as safe template
- ✅ Read-only .env volume mount
- ✅ Health endpoints (no authentication needed)

## 📦 Build Optimization

### Multi-Stage Build
1. **Backend Builder** - Python 3.11 with dependencies
2. **Frontend Builder** - Node.js 20 with built Next.js app
3. **Runtime** - Final production image

### Benefits
- Smaller final image size
- Faster builds (with caching)
- No build tools in production image
- Secure and optimized

## 🚀 Production Considerations

For production deployment:
1. Update `NEXTAUTH_SECRET` to a random value
2. Add resource limits to docker-compose.yml
3. Configure logging and monitoring
4. Use environment-specific .env files
5. Implement automated backups
6. Set up health check alerts

See **DOCKER_GUIDE.md** (Production section) for details.

## 📞 Support

- Quick start issues? → **DOCKER_QUICKSTART.md**
- Deployment help? → **DOCKER_GUIDE.md**
- Technical questions? → **DOCKER_ARCHITECTURE.md**
- Component verification? → **IMPLEMENTATION_CHECKLIST.md**

## ✨ Status

✅ Implementation complete and ready for deployment

**Total files created:** 9
**Total documentation:** 4 comprehensive guides
**Ready for:** Development, Testing, and Production

---

**Next step:** `cp .env.docker .env && nano .env && docker-compose up --build`
