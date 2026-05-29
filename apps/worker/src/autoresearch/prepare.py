"""Data preparation and utilities for autoresearch.

This file is NOT edited by the agent. It provides:
- One-time data download and tokenizer training
- Dataloader for training
- Evaluation utilities
"""

import os
import pickle
import urllib.request
from pathlib import Path
from typing import Optional

import torch
import numpy as np


DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


class Tokenizer:
    """Simple character-level tokenizer (or BPE if trained)."""

    def __init__(self, vocab_path: Optional[Path] = None):
        self.stoi = {}
        self.itos = {}
        self.vocab_size = 0

        if vocab_path and vocab_path.exists():
            self.load(vocab_path)

    def train(self, text: str):
        """Train character-level tokenizer on text."""
        chars = sorted(list(set(text)))
        self.vocab_size = len(chars)
        self.stoi = {ch: i for i, ch in enumerate(chars)}
        self.itos = {i: ch for i, ch in enumerate(chars)}

    def encode(self, text: str) -> list[int]:
        """Encode text to token ids."""
        return [self.stoi.get(c, 0) for c in text]

    def decode(self, tokens: list[int]) -> str:
        """Decode token ids to text."""
        return ''.join([self.itos.get(t, '') for t in tokens])

    def save(self, path: Path):
        """Save tokenizer to file."""
        with open(path, 'wb') as f:
            pickle.dump({'stoi': self.stoi, 'itos': self.itos, 'vocab_size': self.vocab_size}, f)

    def load(self, path: Path):
        """Load tokenizer from file."""
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.stoi = data['stoi']
            self.itos = data['itos']
            self.vocab_size = data['vocab_size']


def download_data(dataset: str = "shakespeare") -> Path:
    """Download training data if not present."""

    datasets = {
        "shakespeare": {
            "url": "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt",
            "filename": "shakespeare.txt"
        },
        "wiki": {
            "url": "https://raw.githubusercontent.com/pytorch/examples/main/word_language_model/data/wikitext-2/train.txt",
            "filename": "wiki.txt"
        }
    }

    if dataset not in datasets:
        dataset = "shakespeare"

    info = datasets[dataset]
    filepath = DATA_DIR / info["filename"]

    if not filepath.exists():
        print(f"Downloading {dataset} dataset...")
        urllib.request.urlretrieve(info["url"], filepath)
        print(f"Downloaded to {filepath}")

    return filepath


def prepare_data(dataset: str = "shakespeare") -> tuple[Path, Path, Tokenizer]:
    """Prepare data: download, tokenize, split into train/val."""

    # Download data
    data_path = download_data(dataset)

    # Read text
    with open(data_path, 'r', encoding='utf-8') as f:
        text = f.read()

    print(f"Dataset: {len(text):,} characters")

    # Train tokenizer
    tokenizer = Tokenizer()
    tokenizer.train(text)
    tokenizer.save(DATA_DIR / "tokenizer.pkl")
    print(f"Vocabulary size: {tokenizer.vocab_size}")

    # Encode data
    data = torch.tensor(tokenizer.encode(text), dtype=torch.long)

    # Split into train/val (90/10)
    n = int(0.9 * len(data))
    train_data = data[:n]
    val_data = data[n:]

    # Save to binary files
    train_path = DATA_DIR / "train.bin"
    val_path = DATA_DIR / "val.bin"

    train_data.numpy().astype(np.uint16).tofile(train_path)
    val_data.numpy().astype(np.uint16).tofile(val_path)

    print(f"Train: {len(train_data):,} tokens")
    print(f"Val: {len(val_data):,} tokens")

    return train_path, val_path, tokenizer


class DataLoader:
    """Simple dataloader for training."""

    def __init__(self, data_path: Path, block_size: int, batch_size: int, device: str = "cuda"):
        self.block_size = block_size
        self.batch_size = batch_size
        self.device = device

        # Memory-map the data for efficiency
        self.data = np.memmap(data_path, dtype=np.uint16, mode='r')
        self.n_tokens = len(self.data)

    def get_batch(self) -> tuple[torch.Tensor, torch.Tensor]:
        """Get a random batch of data."""
        ix = torch.randint(self.n_tokens - self.block_size, (self.batch_size,))
        x = torch.stack([torch.from_numpy(self.data[i:i+self.block_size].astype(np.int64)) for i in ix])
        y = torch.stack([torch.from_numpy(self.data[i+1:i+1+self.block_size].astype(np.int64)) for i in ix])
        return x.to(self.device), y.to(self.device)


@torch.no_grad()
def evaluate(model, val_loader: DataLoader, eval_iters: int = 50) -> float:
    """Evaluate model on validation set."""
    model.eval()
    losses = []

    for _ in range(eval_iters):
        x, y = val_loader.get_batch()
        _, loss = model(x, y)
        losses.append(loss.item())

    model.train()
    return sum(losses) / len(losses)


def get_device() -> str:
    """Get best available device."""
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


# Run preparation if executed directly
if __name__ == "__main__":
    import sys
    dataset = sys.argv[1] if len(sys.argv) > 1 else "shakespeare"
    prepare_data(dataset)
    print("Data preparation complete!")
