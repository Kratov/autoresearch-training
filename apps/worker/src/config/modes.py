from enum import Enum
from typing import Any


class ResearchMode(Enum):
    HYPERPARAMETER = "hyperparameter"
    ARCHITECTURE = "architecture"
    OPTIMIZER = "optimizer"
    EFFICIENCY = "efficiency"
    CUSTOM = "custom"  # This runs real training


RESEARCH_CONFIGS: dict[ResearchMode, dict[str, Any]] = {
    ResearchMode.HYPERPARAMETER: {
        "name": "Hyperparameter Tuning",
        "description": "Learning rate, batch size, warmup - Quick parameter tuning (simulation)",
        "parameters": {
            "learning_rate_range": [1e-5, 1e-2],
            "batch_sizes": [16, 32, 64, 128],
            "warmup_steps": [0, 100, 500, 1000],
            "weight_decay": [0, 0.01, 0.1],
        },
        "max_experiments": 20,
        "epochs_per_experiment": 3,
        "real_training": False,
    },
    ResearchMode.ARCHITECTURE: {
        "name": "Architecture Search",
        "description": "Layers, heads, embeddings - Model structure experiments (simulation)",
        "parameters": {
            "num_layers": [2, 4, 6, 8, 12],
            "num_heads": [4, 8, 12, 16],
            "embedding_dims": [256, 512, 768, 1024],
            "hidden_dim_multiplier": [2, 4],
        },
        "max_experiments": 16,
        "epochs_per_experiment": 5,
        "real_training": False,
    },
    ResearchMode.OPTIMIZER: {
        "name": "Optimizer Comparison",
        "description": "AdamW, Muon, custom - Optimizer comparisons (simulation)",
        "parameters": {
            "optimizers": ["adam", "adamw", "sgd", "muon"],
            "learning_rates": [1e-4, 3e-4, 1e-3],
            "weight_decay": [0, 0.01, 0.1],
            "momentum": [0.9, 0.95, 0.99],
        },
        "max_experiments": 24,
        "epochs_per_experiment": 5,
        "real_training": False,
    },
    ResearchMode.EFFICIENCY: {
        "name": "Efficiency Optimization",
        "description": "Speed, memory, convergence - Performance optimization (simulation)",
        "parameters": {
            "gradient_checkpointing": [True, False],
            "mixed_precision": ["no", "fp16", "bf16"],
            "compile_mode": [False, True],
            "gradient_accumulation": [1, 2, 4, 8],
        },
        "max_experiments": 16,
        "epochs_per_experiment": 3,
        "real_training": False,
    },
    ResearchMode.CUSTOM: {
        "name": "Real Training Demo",
        "description": "Train a small GPT on Shakespeare - REAL GPU training (~2-3 min)",
        "parameters": {},
        # Real training config
        "real_training": True,
        "batch_size": 64,
        "block_size": 256,
        "max_iters": 500,
        "eval_interval": 50,
        "learning_rate": 3e-4,
        "n_layer": 6,
        "n_head": 6,
        "n_embd": 384,
    },
}


def get_research_config(mode: ResearchMode) -> dict[str, Any]:
    """Get the configuration for a research mode."""
    return RESEARCH_CONFIGS.get(mode, RESEARCH_CONFIGS[ResearchMode.HYPERPARAMETER]).copy()
