FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PATH="/home/worker/.local/bin:$PATH"

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# Create non-root user first
RUN useradd -m -u 1000 worker

WORKDIR /app

# Copy project files
COPY --chown=worker:worker pyproject.toml ./
COPY --chown=worker:worker src ./src

# Switch to worker user and install
USER worker

# Install Python dependencies as user
RUN pip install --user --no-cache-dir \
    "fastapi>=0.109.0" \
    "uvicorn[standard]>=0.27.0" \
    "httpx>=0.26.0" \
    "websockets>=12.0" \
    "pydantic>=2.5.0" \
    "pydantic-settings>=2.1.0" \
    "torch>=2.1.0" \
    "numpy>=1.26.0" \
    "python-multipart>=0.0.6"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
