"""Real training module - small GPT on Shakespeare."""

import asyncio
import math
import os
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import torch
import torch.nn as nn
from torch.nn import functional as F


@dataclass
class GPTConfig:
    block_size: int = 256
    vocab_size: int = 65  # Shakespeare has ~65 unique chars
    n_layer: int = 6
    n_head: int = 6
    n_embd: int = 384
    dropout: float = 0.2


class CausalSelfAttention(nn.Module):
    def __init__(self, config: GPTConfig):
        super().__init__()
        assert config.n_embd % config.n_head == 0
        self.c_attn = nn.Linear(config.n_embd, 3 * config.n_embd)
        self.c_proj = nn.Linear(config.n_embd, config.n_embd)
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)
        self.n_head = config.n_head
        self.n_embd = config.n_embd
        self.register_buffer(
            "bias",
            torch.tril(torch.ones(config.block_size, config.block_size)).view(
                1, 1, config.block_size, config.block_size
            ),
        )

    def forward(self, x):
        B, T, C = x.size()
        q, k, v = self.c_attn(x).split(self.n_embd, dim=2)
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)

        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
        att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        att = self.attn_dropout(att)
        y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        y = self.resid_dropout(self.c_proj(y))
        return y


class MLP(nn.Module):
    def __init__(self, config: GPTConfig):
        super().__init__()
        self.c_fc = nn.Linear(config.n_embd, 4 * config.n_embd)
        self.gelu = nn.GELU()
        self.c_proj = nn.Linear(4 * config.n_embd, config.n_embd)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x):
        x = self.c_fc(x)
        x = self.gelu(x)
        x = self.c_proj(x)
        x = self.dropout(x)
        return x


class Block(nn.Module):
    def __init__(self, config: GPTConfig):
        super().__init__()
        self.ln_1 = nn.LayerNorm(config.n_embd)
        self.attn = CausalSelfAttention(config)
        self.ln_2 = nn.LayerNorm(config.n_embd)
        self.mlp = MLP(config)

    def forward(self, x):
        x = x + self.attn(self.ln_1(x))
        x = x + self.mlp(self.ln_2(x))
        return x


class GPT(nn.Module):
    def __init__(self, config: GPTConfig):
        super().__init__()
        self.config = config
        self.transformer = nn.ModuleDict(
            dict(
                wte=nn.Embedding(config.vocab_size, config.n_embd),
                wpe=nn.Embedding(config.block_size, config.n_embd),
                drop=nn.Dropout(config.dropout),
                h=nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
                ln_f=nn.LayerNorm(config.n_embd),
            )
        )
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)
        self.transformer.wte.weight = self.lm_head.weight  # weight tying

        self.apply(self._init_weights)
        n_params = sum(p.numel() for p in self.parameters())
        print(f"Model parameters: {n_params / 1e6:.2f}M")

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None):
        device = idx.device
        b, t = idx.size()
        pos = torch.arange(0, t, dtype=torch.long, device=device)

        tok_emb = self.transformer.wte(idx)
        pos_emb = self.transformer.wpe(pos)
        x = self.transformer.drop(tok_emb + pos_emb)
        for block in self.transformer.h:
            x = block(x)
        x = self.transformer.ln_f(x)

        if targets is not None:
            logits = self.lm_head(x)
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1
            )
        else:
            logits = self.lm_head(x[:, [-1], :])
            loss = None

        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None):
        for _ in range(max_new_tokens):
            idx_cond = (
                idx
                if idx.size(1) <= self.config.block_size
                else idx[:, -self.config.block_size :]
            )
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float("Inf")
            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, idx_next), dim=1)
        return idx


class TextDataset:
    """Generic text dataset for character-level language modeling."""

    def __init__(self, data_path: Optional[str] = None, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        if data_path and Path(data_path).exists():
            self.data_path = Path(data_path)
        else:
            # Default to Shakespeare
            self.data_path = self.data_dir / "shakespeare.txt"
            self._download_shakespeare()

        self._load()

    def _download_shakespeare(self):
        if not self.data_path.exists():
            url = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
            print(f"Downloading Shakespeare dataset...")
            urllib.request.urlretrieve(url, self.data_path)
            print(f"Downloaded to {self.data_path}")

    def _load(self):
        with open(self.data_path, "r") as f:
            text = f.read()

        chars = sorted(list(set(text)))
        self.vocab_size = len(chars)
        self.stoi = {ch: i for i, ch in enumerate(chars)}
        self.itos = {i: ch for i, ch in enumerate(chars)}

        data = torch.tensor([self.stoi[c] for c in text], dtype=torch.long)
        n = int(0.9 * len(data))
        self.train_data = data[:n]
        self.val_data = data[n:]
        print(f"Dataset: {len(text)} chars, vocab size: {self.vocab_size}")
        print(f"Train: {len(self.train_data)}, Val: {len(self.val_data)}")

    def encode(self, s: str) -> list[int]:
        return [self.stoi[c] for c in s if c in self.stoi]

    def decode(self, tokens: list[int]) -> str:
        return "".join([self.itos[t] for t in tokens])

    def get_batch(self, split: str, batch_size: int, block_size: int, device: str):
        data = self.train_data if split == "train" else self.val_data
        ix = torch.randint(len(data) - block_size, (batch_size,))
        x = torch.stack([data[i : i + block_size] for i in ix])
        y = torch.stack([data[i + 1 : i + block_size + 1] for i in ix])
        return x.to(device), y.to(device)


class RealTrainer:
    """Real GPT trainer for demo."""

    def __init__(
        self,
        experiment_id: str,
        config: dict,
        callback: Callable,
        log_callback: Callable,
    ):
        self.experiment_id = experiment_id
        self.config = config
        self.callback = callback
        self.log_callback = log_callback
        self._stop_requested = False

        # Training params from config
        self.batch_size = config.get("batch_size", 64)
        self.block_size = config.get("block_size", 256)
        self.max_iters = config.get("max_iters", 500)
        self.eval_interval = config.get("eval_interval", 50)
        self.learning_rate = config.get("learning_rate", 3e-4)
        self.n_layer = config.get("n_layer", 6)
        self.n_head = config.get("n_head", 6)
        self.n_embd = config.get("n_embd", 384)
        self.dataset_id = config.get("dataset", "shakespeare")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.best_val_loss = float("inf")  # Track best val loss for optimizer
        self.model = None  # Store model for later generation
        self.dataset = None  # Store dataset for encoding/decoding

    async def _log(self, message: str):
        import time
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {message}"
        print(message)
        await self.callback({"experimentId": self.experiment_id, "log": formatted})
        await self.log_callback(formatted)

    async def _send_update(
        self,
        status: Optional[str] = None,
        metrics: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        data = {"experimentId": self.experiment_id}
        if status:
            data["status"] = status
        if metrics:
            data["metrics"] = metrics
        if error:
            data["error"] = error
        await self.callback(data)

    @torch.no_grad()
    def estimate_loss(self, eval_iters=20):
        out = {}
        self.model.eval()
        for split in ["train", "val"]:
            losses = torch.zeros(eval_iters)
            for k in range(eval_iters):
                X, Y = self.dataset.get_batch(
                    split, self.batch_size, self.block_size, self.device
                )
                _, loss = self.model(X, Y)
                losses[k] = loss.item()
            out[split] = losses.mean().item()
        self.model.train()
        return out

    async def run(self):
        await self._log(f"Starting real GPT training on {self.device.upper()}")
        await self._log(f"Config: layers={self.n_layer}, heads={self.n_head}, embd={self.n_embd}")
        await self._send_update(status="running")

        try:
            # Load dataset
            from ..datasets.manager import get_dataset_manager
            manager = get_dataset_manager()
            dataset_path = manager.get_dataset_path(self.dataset_id)

            if dataset_path:
                await self._log(f"Loading dataset: {self.dataset_id}")
            else:
                await self._log(f"Dataset '{self.dataset_id}' not found, using Shakespeare as default...")

            self.dataset = TextDataset(data_path=dataset_path)

            # Create model
            await self._log("Creating GPT model...")
            gpt_config = GPTConfig(
                block_size=self.block_size,
                vocab_size=self.dataset.vocab_size,
                n_layer=self.n_layer,
                n_head=self.n_head,
                n_embd=self.n_embd,
            )
            self.model = GPT(gpt_config).to(self.device)

            n_params = sum(p.numel() for p in self.model.parameters()) / 1e6
            await self._log(f"Model created: {n_params:.2f}M parameters")

            # Optimizer
            optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.learning_rate)

            await self._log(f"Training for {self.max_iters} iterations...")
            await self._log("-" * 50)

            for iter in range(self.max_iters):
                if self._stop_requested:
                    await self._log("Training stopped by user")
                    break

                # Evaluate periodically
                if iter % self.eval_interval == 0 or iter == self.max_iters - 1:
                    losses = self.estimate_loss()
                    train_loss = losses["train"]
                    val_loss = losses["val"]

                    await self._log(
                        f"Iter {iter:4d} | train loss: {train_loss:.4f} | val loss: {val_loss:.4f}"
                    )

                    await self._send_update(
                        metrics={
                            "loss": train_loss,
                            "valLoss": val_loss,
                            "iteration": iter,
                            "learningRate": self.learning_rate,
                            "parameters": n_params,
                        }
                    )

                    if val_loss < self.best_val_loss:
                        self.best_val_loss = val_loss

                # Training step
                xb, yb = self.dataset.get_batch(
                    "train", self.batch_size, self.block_size, self.device
                )
                _, loss = self.model(xb, yb)
                optimizer.zero_grad(set_to_none=True)
                loss.backward()
                optimizer.step()

                # Yield control periodically
                if iter % 10 == 0:
                    await asyncio.sleep(0)

            await self._log("-" * 50)
            await self._log(f"Training complete! Best val loss: {self.best_val_loss:.4f}")

            # Generate sample
            await self._log("\nGenerating sample text...")
            sample_text = self.generate_text("\n", max_tokens=200, temperature=0.8)
            await self._log(f"\n--- Generated Text ---\n{sample_text}\n--- End ---")

            await self._send_update(status="completed")
            await self._log("Experiment completed successfully!")

        except Exception as e:
            await self._log(f"ERROR: {str(e)}")
            await self._send_update(status="failed", error=str(e))
            raise

    async def stop(self):
        self._stop_requested = True

    @torch.no_grad()
    def generate_text(self, prompt: str = "\n", max_tokens: int = 200, temperature: float = 0.8) -> str:
        """Generate text from the trained model."""
        if self.model is None or self.dataset is None:
            return "No model available. Please train a model first."

        self.model.eval()
        try:
            # Encode the prompt
            encoded = self.dataset.encode(prompt)
            if not encoded:
                encoded = [0]  # Use a default token if prompt has no valid chars

            context = torch.tensor([encoded], dtype=torch.long, device=self.device)
            generated = self.model.generate(context, max_new_tokens=max_tokens, temperature=temperature)
            text = self.dataset.decode(generated[0].tolist())
            return text
        finally:
            self.model.train()

    def is_model_ready(self) -> bool:
        """Check if the model is ready for generation."""
        return self.model is not None and self.dataset is not None
