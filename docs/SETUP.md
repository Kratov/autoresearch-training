# Autoresearch Setup Guide

Quick reference for setting up and running the Autoresearch platform.

## Prerequisites

### Docker Setup

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### NVIDIA Container Toolkit (for GPU)

```bash
# Add NVIDIA repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install toolkit
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Configure Docker
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
```

### Local Development Dependencies

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.11+
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# pnpm (optional, faster than npm)
npm install -g pnpm
```

## Quick Start

```bash
# Clone and enter directory
cd cloud9

# Initialize all projects
make setup

# Start with Docker
make up

# Or start in dev mode (local)
make dev
```

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Dashboard & controls |
| API | http://localhost:4000/api | REST endpoints |
| API Docs | http://localhost:4000/api/docs | Swagger docs |
| Worker | http://localhost:8000/docs | FastAPI docs |

## Common Commands

```bash
# View logs
make logs           # All services
make logs-worker    # Worker only

# Shell access
make shell-worker   # Python worker
make shell-db       # PostgreSQL

# Development
make dev            # Start all in dev mode
make test           # Run all tests
make lint           # Run linters

# Cleanup
make down           # Stop containers
make clean          # Full cleanup
make reset-db       # Reset database
```

## Research Modes

Switch between modes via the frontend or API:

```bash
# Via API
curl -X PUT http://localhost:4000/api/research/config \
  -H "Content-Type: application/json" \
  -d '{"mode": "hyperparameter"}'

# Available modes
# - hyperparameter: Learning rate, batch size, warmup
# - architecture: Layers, heads, embeddings
# - optimizer: AdamW, Muon, custom
# - efficiency: Speed, memory, convergence
# - custom: User-defined
```

## Troubleshooting

### GPU not detected

```bash
# Check NVIDIA driver
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi

# If failing, reinstall nvidia-container-toolkit
sudo apt-get install --reinstall nvidia-container-toolkit
sudo systemctl restart docker
```

### Database connection issues

```bash
# Check if database is running
docker-compose ps db

# View database logs
make logs-db

# Reset database
make reset-db
make up
```

### Port conflicts

```bash
# Check what's using ports
sudo lsof -i :3000
sudo lsof -i :4000
sudo lsof -i :8000
sudo lsof -i :5432

# Kill process using port
sudo kill -9 $(sudo lsof -t -i :3000)
```

## Environment Variables

### API (apps/api/.env)

```env
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=autoresearch
DATABASE_PASSWORD=autoresearch_secret
DATABASE_NAME=autoresearch
WORKER_URL=http://localhost:8000
PORT=4000
```

### Frontend (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Worker (apps/worker/.env)

```env
API_URL=http://localhost:4000
```
