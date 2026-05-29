"""Auto-improve optimizer for hyperparameter optimization."""
import logging
import random
from typing import Any, Optional

logger = logging.getLogger(__name__)


class AutoImproveOptimizer:
    """
    Simple Bayesian-inspired optimizer for hyperparameter search.

    Uses past experiment results to suggest better hyperparameters.
    Implements a simplified approach using random perturbation around
    the best known configuration with decreasing exploration over time.
    """

    # Hyperparameter bounds
    BOUNDS = {
        "learning_rate": (1e-5, 1e-2),
        "n_layer": (2, 12),
        "n_head": (2, 12),
        "n_embd": (64, 512),
        "batch_size": (16, 128),
        "dropout": (0.0, 0.5),
        "weight_decay": (0.01, 0.5),
        "beta1": (0.8, 0.99),
        "beta2": (0.9, 0.999),
    }

    # Which params should be integers
    INT_PARAMS = {"n_layer", "n_head", "n_embd", "batch_size"}

    # Constraints: n_embd must be divisible by n_head

    def __init__(self):
        self.history: list[dict[str, Any]] = []
        self.best_result: Optional[dict[str, Any]] = None
        self.best_loss: float = float("inf")
        self.iteration = 0

    def add_result(self, config: dict[str, Any], final_loss: float) -> None:
        """Record an experiment result."""
        result = {
            "config": config.copy(),
            "loss": final_loss,
            "iteration": self.iteration,
        }
        self.history.append(result)

        if final_loss < self.best_loss:
            self.best_loss = final_loss
            self.best_result = result
            logger.info(f"New best loss: {final_loss:.4f}")

        self.iteration += 1

    def suggest_next(self, base_config: dict[str, Any]) -> dict[str, Any]:
        """
        Suggest next hyperparameters to try.

        Uses exploration/exploitation trade-off:
        - Early iterations: more exploration (larger perturbations)
        - Later iterations: more exploitation (smaller perturbations around best)
        """
        if not self.history or self.best_result is None:
            # First run: use base config with small random perturbation
            return self._perturb_config(base_config, strength=0.1)

        # Use best config as base, with decreasing perturbation
        best_config = self.best_result["config"]

        # Decay exploration over iterations
        exploration_strength = max(0.05, 0.3 * (0.9 ** self.iteration))

        # Sometimes do a larger exploration jump
        if random.random() < 0.2:
            exploration_strength *= 2

        suggested = self._perturb_config(best_config, strength=exploration_strength)

        # Ensure n_embd is divisible by n_head
        n_head = suggested.get("n_head", 6)
        n_embd = suggested.get("n_embd", 384)
        suggested["n_embd"] = (n_embd // n_head) * n_head

        logger.info(f"Suggested config (exploration={exploration_strength:.2f}): {suggested}")
        return suggested

    def _perturb_config(self, config: dict[str, Any], strength: float) -> dict[str, Any]:
        """Perturb a configuration by a given strength."""
        new_config = config.copy()

        for param, bounds in self.BOUNDS.items():
            if param not in new_config:
                continue

            current = new_config[param]
            low, high = bounds

            # For learning rate, perturb in log space
            if param == "learning_rate":
                import math
                log_current = math.log10(current)
                log_low = math.log10(low)
                log_high = math.log10(high)
                log_range = log_high - log_low
                perturbation = random.gauss(0, strength * log_range)
                new_log = max(log_low, min(log_high, log_current + perturbation))
                new_config[param] = 10 ** new_log
            else:
                # Linear perturbation
                range_size = high - low
                perturbation = random.gauss(0, strength * range_size)
                new_value = current + perturbation
                new_value = max(low, min(high, new_value))

                if param in self.INT_PARAMS:
                    new_value = int(round(new_value))

                new_config[param] = new_value

        return new_config

    def get_summary(self) -> dict[str, Any]:
        """Get optimization summary."""
        return {
            "iterations": self.iteration,
            "best_loss": self.best_loss if self.best_loss != float("inf") else None,
            "best_config": self.best_result["config"] if self.best_result else None,
            "history_length": len(self.history),
            "improvement": self._calculate_improvement(),
        }

    def _calculate_improvement(self) -> Optional[float]:
        """Calculate improvement from first to best result."""
        if len(self.history) < 2:
            return None
        first_loss = self.history[0]["loss"]
        return (first_loss - self.best_loss) / first_loss * 100

    def reset(self) -> None:
        """Reset optimizer state."""
        self.history = []
        self.best_result = None
        self.best_loss = float("inf")
        self.iteration = 0


# Global optimizer instance
_optimizer: Optional[AutoImproveOptimizer] = None


def get_optimizer() -> AutoImproveOptimizer:
    """Get or create the global optimizer instance."""
    global _optimizer
    if _optimizer is None:
        _optimizer = AutoImproveOptimizer()
    return _optimizer


def reset_optimizer() -> None:
    """Reset the global optimizer."""
    global _optimizer
    if _optimizer:
        _optimizer.reset()
    _optimizer = None
