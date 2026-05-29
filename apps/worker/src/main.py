import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from .research.runner import ResearchRunner
from .research.optimizer import get_optimizer, reset_optimizer
from .config.modes import get_research_config, ResearchMode
from .datasets.manager import get_dataset_manager


class Settings(BaseSettings):
    api_url: str = "http://localhost:4000"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
logging.basicConfig(level=getattr(logging, settings.log_level))
logger = logging.getLogger(__name__)


class RunRequest(BaseModel):
    experimentId: str
    mode: str
    config: dict = {}
    autoImprove: bool = False


class ConfigRequest(BaseModel):
    mode: str


class WorkerState:
    def __init__(self):
        self.runner: Optional[ResearchRunner] = None
        self.current_experiment_id: Optional[str] = None
        self.is_running: bool = False
        self.current_mode: ResearchMode = ResearchMode.HYPERPARAMETER
        self.websocket_clients: list[WebSocket] = []
        self.auto_improve: bool = False
        self.current_config: dict = {}
        self.last_loss: Optional[float] = None
        self.last_trainer = None  # Keep reference to last trainer for generation


state = WorkerState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Worker starting up...")
    yield
    logger.info("Worker shutting down...")
    if state.runner:
        await state.runner.stop()


app = FastAPI(
    title="Autoresearch Worker",
    description="Python worker for ML research experiments",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def send_callback(data: dict):
    """Send update to API server."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{settings.api_url}/api/research/callback",
                json=data,
                timeout=10.0,
            )
    except Exception as e:
        logger.error(f"Failed to send callback: {e}")


async def broadcast_log(message: str):
    """Broadcast log message to WebSocket clients."""
    for ws in state.websocket_clients:
        try:
            await ws.send_text(message)
        except Exception:
            pass


@app.get("/")
async def root():
    return {"status": "ok", "service": "autoresearch-worker"}


@app.get("/status")
async def get_status():
    optimizer = get_optimizer()
    return {
        "is_running": state.is_running,
        "current_mode": state.current_mode.value,
        "current_experiment_id": state.current_experiment_id,
        "auto_improve": state.auto_improve,
        "optimizer": optimizer.get_summary(),
    }


@app.get("/optimizer")
async def get_optimizer_status():
    """Get optimizer status and history."""
    optimizer = get_optimizer()
    return optimizer.get_summary()


@app.post("/optimizer/reset")
async def reset_optimizer_state():
    """Reset the optimizer state."""
    if state.is_running:
        return {"error": "Cannot reset optimizer while running"}
    reset_optimizer()
    return {"status": "reset"}


@app.post("/config")
async def set_config(request: ConfigRequest):
    if state.is_running:
        return {"error": "Cannot change config while running"}

    try:
        state.current_mode = ResearchMode(request.mode)
        return {
            "mode": state.current_mode.value,
            "config": get_research_config(state.current_mode),
        }
    except ValueError:
        return {"error": f"Invalid mode: {request.mode}"}


@app.post("/run")
async def run_experiment(request: RunRequest):
    if state.is_running:
        return {"error": "Experiment already running"}

    logger.info(f"Starting experiment {request.experimentId} with mode {request.mode}")

    state.current_experiment_id = request.experimentId
    state.is_running = True
    state.auto_improve = request.autoImprove

    try:
        mode = ResearchMode(request.mode)
    except ValueError:
        mode = ResearchMode.HYPERPARAMETER

    config = get_research_config(mode)
    config.update(request.config)

    # If auto-improve is enabled, let optimizer suggest parameters
    if state.auto_improve:
        optimizer = get_optimizer()
        suggested = optimizer.suggest_next(config)
        config.update(suggested)
        logger.info(f"Auto-improve suggested config: {suggested}")
        await broadcast_log(f"[AUTO-IMPROVE] Optimizer suggested new hyperparameters")

    state.current_config = config.copy()

    # Create runner and start experiment
    state.runner = ResearchRunner(
        experiment_id=request.experimentId,
        mode=mode,
        config=config,
        callback=send_callback,
        log_callback=broadcast_log,
    )

    # Run experiment in background
    asyncio.create_task(run_experiment_task())

    return {"status": "started", "experiment_id": request.experimentId, "config": config}


async def run_experiment_task():
    """Background task to run the experiment."""
    final_loss = None
    success = False

    try:
        await state.runner.run()
        success = True
        # Try to get the final loss from the runner
        if state.runner and hasattr(state.runner, '_trainer') and state.runner._trainer:
            trainer = state.runner._trainer
            if hasattr(trainer, 'best_val_loss'):
                final_loss = trainer.best_val_loss
    except Exception as e:
        logger.error(f"Experiment failed: {e}")
        await send_callback({
            "experimentId": state.current_experiment_id,
            "status": "failed",
            "error": str(e),
        })
    finally:
        # Record result if auto-improve is enabled and we have a loss
        if state.auto_improve and final_loss is not None and success:
            optimizer = get_optimizer()
            optimizer.add_result(state.current_config, final_loss)
            state.last_loss = final_loss
            summary = optimizer.get_summary()
            await broadcast_log(
                f"[AUTO-IMPROVE] Recorded result: loss={final_loss:.4f}, "
                f"best_loss={summary['best_loss']:.4f}, "
                f"iterations={summary['iterations']}"
            )

        # Keep reference to trainer for text generation
        if state.runner and hasattr(state.runner, '_trainer') and state.runner._trainer:
            state.last_trainer = state.runner._trainer

        state.is_running = False
        state.current_experiment_id = None
        state.runner = None


@app.post("/stop")
async def stop_experiment():
    if state.runner:
        await state.runner.stop()
        state.is_running = False
        state.current_experiment_id = None
        state.runner = None
        return {"status": "stopped"}
    return {"status": "not_running"}


class GenerateRequest(BaseModel):
    prompt: str = ""
    max_tokens: int = 200
    temperature: float = 0.8
    context: Optional[str] = None  # Context/prefix to prepend to prompt


@app.post("/generate")
async def generate_text(request: GenerateRequest):
    """Generate text from the last trained model."""
    if state.last_trainer is None:
        return {"error": "No trained model available. Please train a model first.", "text": None}

    if not state.last_trainer.is_model_ready():
        return {"error": "Model not ready for generation.", "text": None}

    if state.is_running:
        return {"error": "Cannot generate while training is in progress.", "text": None}

    try:
        # Combine context and prompt
        full_prompt = request.prompt or "\n"
        if request.context:
            full_prompt = request.context + full_prompt

        text = state.last_trainer.generate_text(
            prompt=full_prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )
        return {"text": text, "error": None}
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return {"error": str(e), "text": None}


@app.get("/model-status")
async def get_model_status():
    """Check if a model is available for generation."""
    has_model = state.last_trainer is not None and state.last_trainer.is_model_ready()
    return {
        "has_model": has_model,
        "is_training": state.is_running,
    }


## Dataset Management Endpoints ##

@app.get("/datasets")
async def list_datasets():
    """List all available datasets."""
    manager = get_dataset_manager()
    datasets = manager.list_datasets()
    return {
        "datasets": [
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "size": d.size,
                "source": d.source,
                "downloaded": d.downloaded,
                "charCount": d.char_count,
            }
            for d in datasets
        ]
    }


@app.post("/datasets/download/{dataset_id}")
async def download_dataset(dataset_id: str):
    """Download a predefined dataset."""
    manager = get_dataset_manager()
    try:
        dataset = manager.download_dataset(dataset_id)
        return {
            "status": "downloaded",
            "dataset": {
                "id": dataset.id,
                "name": dataset.name,
                "path": dataset.path,
                "charCount": dataset.char_count,
            }
        }
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Failed to download dataset: {e}")
        return {"error": f"Failed to download: {str(e)}"}


@app.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a custom dataset."""
    manager = get_dataset_manager()
    try:
        content = await file.read()
        dataset = manager.upload_dataset(file.filename or "custom.txt", content)
        return {
            "status": "uploaded",
            "dataset": {
                "id": dataset.id,
                "name": dataset.name,
                "path": dataset.path,
                "charCount": dataset.char_count,
            }
        }
    except Exception as e:
        logger.error(f"Failed to upload dataset: {e}")
        return {"error": f"Failed to upload: {str(e)}"}


@app.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Delete a custom dataset."""
    manager = get_dataset_manager()
    if manager.delete_dataset(dataset_id):
        return {"status": "deleted"}
    return {"error": "Cannot delete this dataset (only custom datasets can be deleted)"}


@app.get("/datasets/{dataset_id}/preview")
async def preview_dataset(dataset_id: str, max_chars: int = 1000):
    """Get a preview of a dataset."""
    manager = get_dataset_manager()
    preview = manager.get_dataset_preview(dataset_id, max_chars)
    if preview:
        return {"preview": preview}
    return {"error": "Dataset not found or not downloaded"}


## Autoresearch Agent Endpoints ##

class AutoresearchStartRequest(BaseModel):
    max_iterations: int = 10
    target_loss: float = 1.20
    anthropic_api_key: Optional[str] = None


@app.post("/autoresearch/start")
async def start_autoresearch(request: AutoresearchStartRequest):
    """Start the autoresearch agent loop."""
    if state.is_running:
        return {"error": "An experiment is already running"}

    if hasattr(state, 'agent') and state.agent and state.agent.state.is_running:
        return {"error": "Autoresearch agent is already running"}

    try:
        from .autoresearch.agent import AutoresearchAgent, AgentConfig

        config = AgentConfig(
            max_iterations=request.max_iterations,
            target_loss=request.target_loss,
            anthropic_api_key=request.anthropic_api_key,
        )

        async def agent_callback(data):
            await send_callback({"experimentId": "autoresearch", **data})
            for ws in state.websocket_clients:
                try:
                    import json
                    await ws.send_text(json.dumps({"type": "autoresearch", **data}))
                except Exception:
                    pass

        state.agent = AutoresearchAgent(config, agent_callback, broadcast_log)

        # Run in background
        asyncio.create_task(run_autoresearch_task())

        return {"status": "started", "max_iterations": request.max_iterations}

    except Exception as e:
        logger.error(f"Failed to start autoresearch: {e}")
        return {"error": str(e)}


async def run_autoresearch_task():
    """Background task for autoresearch agent."""
    try:
        result = await state.agent.run()
        await broadcast_log(f"[AUTORESEARCH] Completed: best_val_loss={result.get('best_val_loss', 'N/A')}")
    except Exception as e:
        logger.error(f"Autoresearch failed: {e}")
        await broadcast_log(f"[AUTORESEARCH] Failed: {e}")
    finally:
        state.agent = None


@app.post("/autoresearch/stop")
async def stop_autoresearch():
    """Stop the autoresearch agent."""
    if hasattr(state, 'agent') and state.agent:
        state.agent.stop()
        return {"status": "stopping"}
    return {"status": "not_running"}


@app.get("/autoresearch/status")
async def get_autoresearch_status():
    """Get autoresearch agent status."""
    if hasattr(state, 'agent') and state.agent:
        return {
            "is_running": state.agent.state.is_running,
            "iteration": state.agent.state.iteration,
            "best_val_loss": state.agent.state.best_val_loss,
            "history": [
                {
                    "iteration": r.iteration,
                    "val_loss": r.val_loss,
                    "changes": r.changes_made,
                }
                for r in state.agent.state.history
            ],
        }
    return {"is_running": False, "iteration": 0, "best_val_loss": None, "history": []}


@app.get("/autoresearch/program")
async def get_program():
    """Get the current program.md content."""
    from pathlib import Path
    program_path = Path(__file__).parent / "autoresearch" / "program.md"
    if program_path.exists():
        return {"content": program_path.read_text()}
    return {"content": "", "error": "program.md not found"}


@app.put("/autoresearch/program")
async def update_program(content: str = Form(...)):
    """Update program.md content."""
    from pathlib import Path
    program_path = Path(__file__).parent / "autoresearch" / "program.md"
    program_path.write_text(content)
    return {"status": "updated"}


@app.get("/autoresearch/train")
async def get_train_py():
    """Get the current train.py content."""
    from pathlib import Path
    train_path = Path(__file__).parent / "autoresearch" / "train.py"
    if train_path.exists():
        return {"content": train_path.read_text()}
    return {"content": "", "error": "train.py not found"}


@app.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()
    state.websocket_clients.append(websocket)
    logger.info("WebSocket client connected")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.websocket_clients.remove(websocket)
        logger.info("WebSocket client disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
