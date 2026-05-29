# Autoresearch Full-Stack Platform

A full-stack platform for automated ML research experiments with switchable research modes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                            │
├─────────────┬─────────────────┬─────────────┬───────────────────┤
│   Next.js   │    NestJS API   │   Python    │   PostgreSQL      │
│   Frontend  │    Gateway      │   Worker    │   (experiments)   │
│   :3000     │    :4000        │   :8000     │   :5432           │
└─────────────┴─────────────────┴─────────────┴───────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| web | 3000 | Next.js frontend with Redux Toolkit & Recharts |
| api | 4000 | NestJS API gateway with TypeORM |
| worker | 8000 | Python FastAPI worker with autoresearch |
| db | 5432 | PostgreSQL database |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- NVIDIA Container Toolkit (for GPU support)
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)

### Setup & Run

```bash
# Initialize all projects
make setup

# Start all services with Docker
make up

# Or run in development mode (local)
make dev
```

### Access Points

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000/api
- **Worker Docs**: http://localhost:8000/docs

## Research Modes

| Mode | Focus | Description |
|------|-------|-------------|
| `hyperparameter` | Learning rate, batch size, warmup | Quick parameter tuning |
| `architecture` | Layers, heads, embeddings | Model structure experiments |
| `optimizer` | AdamW, Muon, custom | Optimizer comparisons |
| `efficiency` | Speed, memory, convergence | Performance optimization |
| `custom` | User-defined | Free-form research |

## Development

### Available Commands

```bash
make setup          # Initialize all projects
make dev            # Start all services in dev mode
make build          # Build all Docker images
make up             # Start with docker-compose
make down           # Stop all services
make logs           # View all logs
make logs-worker    # View Python worker logs
make shell-worker   # Shell into Python worker
make test           # Run all tests
make clean          # Clean up everything
```

### Project Structure

```
cloud9/
├── docker-compose.yml
├── Makefile
├── README.md
├── apps/
│   ├── web/                    # Next.js + Redux Toolkit + Recharts
│   ├── api/                    # NestJS API Gateway
│   └── worker/                 # Python autoresearch worker
└── docs/
    └── SETUP.md                # Setup reference
```

## API Endpoints

### Research

- `POST /api/research/start` - Start new research session
- `POST /api/research/stop` - Stop current session
- `GET /api/research/config` - Get available research modes
- `PUT /api/research/config` - Switch research mode

### Experiments

- `GET /api/experiments` - List all experiments
- `GET /api/experiments/:id` - Get experiment details
- `POST /api/experiments` - Create experiment
- `DELETE /api/experiments/:id` - Delete experiment

### Worker (Python)

- `POST /run` - Execute experiment with config
- `GET /status` - Current experiment status
- `POST /config` - Update research mode
- `WS /logs` - Stream experiment logs

## GPU Configuration

This project is configured for NVIDIA RTX 4080 Laptop GPU. Ensure you have:

1. NVIDIA drivers installed
2. `nvidia-container-toolkit` installed
3. Docker configured to use NVIDIA runtime

```bash
# Verify GPU is accessible
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
```

## License

MIT
