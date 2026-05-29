import asyncio
import logging
import random
import time
from typing import Any, Callable, Optional

from ..config.modes import ResearchMode

logger = logging.getLogger(__name__)


class ResearchRunner:
    """Runs research experiments based on the configured mode."""

    def __init__(
        self,
        experiment_id: str,
        mode: ResearchMode,
        config: dict[str, Any],
        callback: Callable,
        log_callback: Callable,
    ):
        self.experiment_id = experiment_id
        self.mode = mode
        self.config = config
        self.callback = callback
        self.log_callback = log_callback
        self._stop_requested = False
        self._trainer = None

    async def run(self):
        """Run the research experiment."""
        logger.info(f"Starting {self.mode.value} experiment: {self.experiment_id}")

        # Use real trainer for demo mode
        if self.config.get("real_training", False) or self.mode == ResearchMode.CUSTOM:
            await self._run_real_training()
        else:
            await self._run_simulation()

    async def _run_real_training(self):
        """Run actual GPT training."""
        from .trainer import RealTrainer

        self._trainer = RealTrainer(
            experiment_id=self.experiment_id,
            config=self.config,
            callback=self.callback,
            log_callback=self.log_callback,
        )
        await self._trainer.run()

    async def _run_simulation(self):
        """Run simulated experiment for testing."""
        await self._log(f"[{self.mode.value}] Starting simulated experiment {self.experiment_id}")
        await self._log(f"[{self.mode.value}] Configuration: {self.config}")

        try:
            await self._send_update(status="running")

            if self.mode == ResearchMode.HYPERPARAMETER:
                await self._run_hyperparameter_experiment()
            elif self.mode == ResearchMode.ARCHITECTURE:
                await self._run_architecture_experiment()
            elif self.mode == ResearchMode.OPTIMIZER:
                await self._run_optimizer_experiment()
            elif self.mode == ResearchMode.EFFICIENCY:
                await self._run_efficiency_experiment()
            else:
                await self._run_custom_experiment()

            if not self._stop_requested:
                await self._log(f"[{self.mode.value}] Experiment completed successfully!")
                await self._send_update(status="completed")

        except Exception as e:
            logger.error(f"Experiment failed: {e}")
            await self._log(f"[ERROR] Experiment failed: {e}")
            await self._send_update(status="failed", error=str(e))
            raise

    async def stop(self):
        """Stop the running experiment."""
        logger.info(f"Stopping experiment {self.experiment_id}")
        self._stop_requested = True
        if self._trainer:
            await self._trainer.stop()
        await self._log(f"Stop requested, cleaning up...")

    async def _log(self, message: str):
        """Send log message."""
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {message}"
        logger.info(message)
        await self.callback({"experimentId": self.experiment_id, "log": formatted})
        await self.log_callback(formatted)

    async def _send_update(
        self,
        status: Optional[str] = None,
        metrics: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        """Send update to API."""
        data = {"experimentId": self.experiment_id}
        if status:
            data["status"] = status
        if metrics:
            data["metrics"] = metrics
        if error:
            data["error"] = error
        await self.callback(data)

    # --- Simulation methods (for quick testing without GPU) ---

    async def _run_hyperparameter_experiment(self):
        """Simulate hyperparameter tuning experiment."""
        await self._log("Starting hyperparameter search (simulation)...")

        lr_range = self.config.get("learning_rate_range", [1e-5, 1e-2])
        batch_sizes = self.config.get("batch_sizes", [32, 64])
        epochs = self.config.get("epochs_per_experiment", 3)

        best_loss = float("inf")

        for batch_size in batch_sizes[:2]:
            if self._stop_requested:
                break

            lr = random.uniform(lr_range[0], lr_range[1])
            await self._log(f"Testing lr={lr:.6f}, batch_size={batch_size}")

            for epoch in range(epochs):
                if self._stop_requested:
                    break

                loss = self._simulate_loss(epoch, epochs, lr)
                accuracy = self._simulate_accuracy(epoch, epochs)

                await self._log(f"  Epoch {epoch + 1}/{epochs}: loss={loss:.4f}, accuracy={accuracy:.4f}")
                await self._send_update(
                    metrics={
                        "loss": loss,
                        "accuracy": accuracy,
                        "learningRate": lr,
                        "epoch": epoch + 1,
                        "batchSize": batch_size,
                    }
                )

                if loss < best_loss:
                    best_loss = loss

                await asyncio.sleep(0.5)

    async def _run_architecture_experiment(self):
        """Simulate architecture search experiment."""
        await self._log("Starting architecture search (simulation)...")
        epochs = self.config.get("epochs_per_experiment", 5)

        for num_layers in [4, 6]:
            if self._stop_requested:
                break
            for num_heads in [4, 8]:
                if self._stop_requested:
                    break

                await self._log(f"Testing layers={num_layers}, heads={num_heads}")

                for epoch in range(epochs):
                    if self._stop_requested:
                        break
                    loss = self._simulate_loss(epoch, epochs, 1e-3)
                    await self._log(f"  Epoch {epoch + 1}: loss={loss:.4f}")
                    await self._send_update(
                        metrics={"loss": loss, "epoch": epoch + 1, "numLayers": num_layers, "numHeads": num_heads}
                    )
                    await asyncio.sleep(0.5)

    async def _run_optimizer_experiment(self):
        """Simulate optimizer comparison."""
        await self._log("Starting optimizer comparison (simulation)...")
        epochs = self.config.get("epochs_per_experiment", 5)

        for opt in ["adamw", "sgd"]:
            if self._stop_requested:
                break
            await self._log(f"Testing optimizer={opt}")

            for epoch in range(epochs):
                if self._stop_requested:
                    break
                factor = 0.85 if opt == "adamw" else 1.1
                loss = self._simulate_loss(epoch, epochs, 1e-3) * factor
                await self._log(f"  Epoch {epoch + 1}: loss={loss:.4f}")
                await self._send_update(metrics={"loss": loss, "epoch": epoch + 1, "optimizer": opt})
                await asyncio.sleep(0.5)

    async def _run_efficiency_experiment(self):
        """Simulate efficiency optimization."""
        await self._log("Starting efficiency optimization (simulation)...")
        epochs = self.config.get("epochs_per_experiment", 3)

        for mp in ["no", "fp16"]:
            if self._stop_requested:
                break
            speed = 100 * (1.5 if mp == "fp16" else 1.0)
            await self._log(f"Testing mixed_precision={mp}")

            for epoch in range(epochs):
                if self._stop_requested:
                    break
                loss = self._simulate_loss(epoch, epochs, 1e-4)
                await self._log(f"  Epoch {epoch + 1}: loss={loss:.4f}, speed={speed:.0f} samples/s")
                await self._send_update(
                    metrics={"loss": loss, "epoch": epoch + 1, "samplesPerSecond": speed, "mixedPrecision": mp}
                )
                await asyncio.sleep(0.5)

    async def _run_custom_experiment(self):
        """Run custom/real experiment."""
        await self._run_real_training()

    def _simulate_loss(self, epoch: int, total_epochs: int, lr: float) -> float:
        base_loss = 2.0
        decay = (epoch + 1) / total_epochs
        noise = random.uniform(-0.1, 0.1)
        lr_effect = min(1.0, lr * 100)
        return max(0.1, base_loss * (1 - decay * lr_effect) + noise)

    def _simulate_accuracy(self, epoch: int, total_epochs: int) -> float:
        base_acc = 0.5
        improvement = (epoch + 1) / total_epochs * 0.4
        noise = random.uniform(-0.02, 0.02)
        return min(0.99, base_acc + improvement + noise)
