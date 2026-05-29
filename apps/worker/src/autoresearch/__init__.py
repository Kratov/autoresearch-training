"""Autoresearch module - AI-driven ML research automation."""

# Disable torch dynamo before any torch imports to avoid compatibility issues
import os
os.environ["TORCHDYNAMO_DISABLE"] = "1"

from .agent import AutoresearchAgent, AgentConfig, run_agent
from .prepare import prepare_data, DataLoader, evaluate, Tokenizer
from .train import train, TrainConfig, GPT, GPTConfig

__all__ = [
    "AutoresearchAgent",
    "AgentConfig", 
    "run_agent",
    "prepare_data",
    "DataLoader",
    "evaluate",
    "Tokenizer",
    "train",
    "TrainConfig",
    "GPT",
    "GPTConfig",
]
