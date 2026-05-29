"""GPT Training Script - THIS FILE IS EDITED BY THE AGENT.

Everything in this file is fair game for modification:
- Model architecture (layers, heads, embeddings, attention)
- Optimizer (AdamW, Muon, SGD, custom)
- Hyperparameters (learning rate, batch size, warmup)
- Training loop (gradient accumulation, mixed precision)
- Regularization (dropout, weight decay)

The agent will iteratively improve this file based on program.md instructions.
"""

import math
import os
import time
from dataclasses import dataclass
from typing import Optional, Callable

# Disable torch dynamo before importing torch to avoid compatibility issues
os.environ["TORCHDYNAMO_DISABLE"] = "1"

import torch
import torch.nn as nn
from torch.nn import functional as F

# Import utilities from prepare.py (not edited by agent)
from .prepare import DataLoader, evaluate, get_device, prepare_data, Tokenizer, DATA_DIR


# =============================================================================
# Model Configuration
# =============================================================================

@dataclass
class GPTConfig:
    block_size: int = 256      # Context length
    vocab_size: int = 65       # Will be set from tokenizer
    n_layer: int = 6           # Number of transformer layers
    n_head: int = 6            # Number of attention heads
    n_embd: int = 384          # Embedding dimension
    dropout: float = 0.2       # Dropout rate


# =============================================================================
# Model Architecture
# =============================================================================

class CausalSelfAttention(nn.Module):
    """Multi-head causal self-attention."""

    def __init__(self, config: GPTConfig):
        super().__init__()
        assert config.n_embd % config.n_head == 0

        self.c_attn = nn.Linear(config.n_embd, 3 * config.n_embd)
        self.c_proj = nn.Linear(config.n_embd, config.n_embd)
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)

        self.n_head = config.n_head
        self.n_embd = config.n_embd

        # Causal mask
        self.register_buffer(
            "bias",
            torch.tril(torch.ones(config.block_size, config.block_size)).view(
                1, 1, config.block_size, config.block_size
            ),
        )

    def forward(self, x):
        B, T, C = x.size()

        # Query, Key, Value projections
        q, k, v = self.c_attn(x).split(self.n_embd, dim=2)
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)

        # Attention
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
        att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        att = self.attn_dropout(att)
        y = att @ v

        # Output projection
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        y = self.resid_dropout(self.c_proj(y))
        return y


class MLP(nn.Module):
    """Feed-forward network."""

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
    """Transformer block."""

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
    """GPT Language Model."""

    def __init__(self, config: GPTConfig):
        super().__init__()
        self.config = config

        self.transformer = nn.ModuleDict(dict(
            wte=nn.Embedding(config.vocab_size, config.n_embd),
            wpe=nn.Embedding(config.block_size, config.n_embd),
            drop=nn.Dropout(config.dropout),
            h=nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
            ln_f=nn.LayerNorm(config.n_embd),
        ))
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)

        # Weight tying
        self.transformer.wte.weight = self.lm_head.weight

        # Initialize weights
        self.apply(self._init_weights)

        # Count parameters
        n_params = sum(p.numel() for p in self.parameters())
        print(f"Model parameters: {n_params/1e6:.2f}M", flush=True)

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

        # Embeddings
        tok_emb = self.transformer.wte(idx)
        pos_emb = self.transformer.wpe(pos)
        x = self.transformer.drop(tok_emb + pos_emb)

        # Transformer blocks
        for block in self.transformer.h:
            x = block(x)
        x = self.transformer.ln_f(x)

        # Output
        if targets is not None:
            logits = self.lm_head(x)
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
        else:
            logits = self.lm_head(x[:, [-1], :])
            loss = None

        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None):
        """Generate new tokens."""
        for _ in range(max_new_tokens):
            idx_cond = idx if idx.size(1) <= self.config.block_size else idx[:, -self.config.block_size:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature

            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float("Inf")

            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, idx_next), dim=1)

        return idx


# =============================================================================
# Optimizer - Muon + AdamW hybrid
# =============================================================================

class Muon(torch.optim.Optimizer):
    """Muon optimizer - momentum-based update with orthogonalization."""

    def __init__(self, params, lr=0.02, momentum=0.95):
        defaults = dict(lr=lr, momentum=momentum)
        super().__init__(params, defaults)

    def step(self):
        for group in self.param_groups:
            lr = group['lr']
            momentum = group['momentum']

            for p in group['params']:
                if p.grad is None:
                    continue

                g = p.grad
                state = self.state[p]

                if len(state) == 0:
                    state['momentum_buffer'] = torch.zeros_like(g)

                buf = state['momentum_buffer']
                buf.mul_(momentum).add_(g)

                # Orthogonalize for 2D+ tensors
                if g.ndim >= 2:
                    buf = self._orthogonalize(buf)

                p.data.add_(buf, alpha=-lr)

    def _orthogonalize(self, g):
        """Newton-Schulz orthogonalization."""
        if g.ndim < 2:
            return g

        shape = g.shape
        g = g.view(shape[0], -1)

        # Simple orthogonalization via QR
        if g.shape[0] <= g.shape[1]:
            q, _ = torch.linalg.qr(g.T)
            g = q.T[:shape[0]]
        else:
            q, _ = torch.linalg.qr(g)
            g = q

        return g.view(shape)


def create_optimizer(model: GPT, lr: float = 3e-4, weight_decay: float = 0.1) -> torch.optim.Optimizer:
    """Create optimizer with weight decay only on 2D+ parameters."""

    decay_params = []
    nodecay_params = []

    for name, param in model.named_parameters():
        if param.requires_grad:
            if param.ndim >= 2:
                decay_params.append(param)
            else:
                nodecay_params.append(param)

    optim_groups = [
        {'params': decay_params, 'weight_decay': weight_decay},
        {'params': nodecay_params, 'weight_decay': 0.0}
    ]

    optimizer = torch.optim.AdamW(optim_groups, lr=lr, betas=(0.9, 0.95))
    return optimizer


# =============================================================================
# Training Configuration
# =============================================================================

@dataclass
class TrainConfig:
    # Data
    dataset: str = "shakespeare"
    block_size: int = 256
    batch_size: int = 64

    # Training
    max_iters: int = 500
    eval_interval: int = 50
    eval_iters: int = 20

    # Optimizer
    learning_rate: float = 3e-4
    weight_decay: float = 0.1
    warmup_iters: int = 100

    # Model
    n_layer: int = 6
    n_head: int = 6
    n_embd: int = 384
    dropout: float = 0.2


# =============================================================================
# Training Loop
# =============================================================================

def train(
    config: Optional[TrainConfig] = None,
    callback: Optional[Callable] = None,
    log_callback: Optional[Callable] = None,
) -> dict:
    """Main training function.

    Args:
        config: Training configuration
        callback: Function to call with updates (for UI integration)
        log_callback: Function to call with log messages

    Returns:
        Dictionary with final metrics and trained model
    """
    if config is None:
        config = TrainConfig()

    device = get_device()

    def log(msg: str):
        print(msg, flush=True)
        if log_callback:
            log_callback(msg)

    log(f"Training on {device.upper()}")
    log(f"Config: layers={config.n_layer}, heads={config.n_head}, embd={config.n_embd}")

    # Prepare data
    log("Preparing data...")
    train_path, val_path, tokenizer = prepare_data(config.dataset)

    # Create dataloaders
    train_loader = DataLoader(train_path, config.block_size, config.batch_size, device)
    val_loader = DataLoader(val_path, config.block_size, config.batch_size, device)

    # Create model
    log("Creating model...")
    gpt_config = GPTConfig(
        block_size=config.block_size,
        vocab_size=tokenizer.vocab_size,
        n_layer=config.n_layer,
        n_head=config.n_head,
        n_embd=config.n_embd,
        dropout=config.dropout,
    )
    model = GPT(gpt_config).to(device)

    # Create optimizer
    optimizer = create_optimizer(model, config.learning_rate, config.weight_decay)

    # Training loop
    log(f"Training for {config.max_iters} iterations...")
    log("-" * 50)

    best_val_loss = float("inf")
    start_time = time.time()

    for iter_num in range(config.max_iters):
        # Learning rate warmup
        if iter_num < config.warmup_iters:
            lr = config.learning_rate * (iter_num + 1) / config.warmup_iters
            for param_group in optimizer.param_groups:
                param_group['lr'] = lr

        # Evaluate periodically
        if iter_num % config.eval_interval == 0 or iter_num == config.max_iters - 1:
            train_loss = evaluate(model, train_loader, config.eval_iters)
            val_loss = evaluate(model, val_loader, config.eval_iters)

            log(f"Iter {iter_num:4d} | train loss: {train_loss:.4f} | val loss: {val_loss:.4f}")

            if callback:
                callback({
                    "iteration": iter_num,
                    "train_loss": train_loss,
                    "val_loss": val_loss,
                    "learning_rate": optimizer.param_groups[0]['lr'],
                    "elapsed_time": time.time() - start_time,
                })

            if val_loss < best_val_loss:
                best_val_loss = val_loss

        # Training step
        x, y = train_loader.get_batch()
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()

    elapsed = time.time() - start_time
    log("-" * 50)
    log(f"Training complete! Best val loss: {best_val_loss:.4f}")
    log(f"Total time: {elapsed:.1f}s")

    return {
        "model": model,
        "tokenizer": tokenizer,
        "best_val_loss": best_val_loss,
        "final_train_loss": train_loss,
        "elapsed_time": elapsed,
        "config": config,
    }


# =============================================================================
# Entry point
# =============================================================================

if __name__ == "__main__":
    result = train()
    print(f"\nFinal validation loss: {result['best_val_loss']:.4f}")
