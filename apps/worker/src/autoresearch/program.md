# Autoresearch Program

You are an ML research agent tasked with improving the GPT training script.

## Objective

Minimize validation loss on the Shakespeare character-level language modeling task.

## Current Best: 1.50 (baseline)

## Constraints

- Training must complete in under 5 minutes on RTX 4080
- Model must fit in 8GB VRAM
- Maximum 500 training iterations
- Must use the provided data loading utilities from prepare.py

## What You Can Modify

Everything in `train.py` is fair game:

### Architecture
- Number of layers, heads, embedding dimension
- Attention mechanism (standard, flash, linear)
- Activation functions (GELU, SwiGLU, ReLU)
- Normalization (LayerNorm, RMSNorm, pre/post)
- Position embeddings (learned, RoPE, ALiBi)

### Optimizer
- Optimizer choice (AdamW, Muon, SGD, Lion)
- Learning rate and schedule
- Weight decay
- Momentum / beta parameters
- Gradient clipping

### Training
- Batch size
- Gradient accumulation
- Mixed precision (fp16, bf16)
- Warmup schedule
- Dropout rate

## What You Cannot Modify

- `prepare.py` - data loading and evaluation utilities
- The dataset (Shakespeare)
- The evaluation metric (validation loss)

## Strategy Guidelines

1. Start with small changes to establish baselines
2. Focus on one component at a time
3. If a change hurts, revert it
4. Document your reasoning for each change
5. Track what worked and what didn't

## Iteration History

Record your experiments here:

| Iter | Change | Val Loss | Notes |
|------|--------|----------|-------|
| 0 | Baseline | ~1.50 | Starting point |

## Current Focus

Start by experimenting with learning rate and warmup schedule. The baseline uses:
- lr=3e-4
- warmup=100 iterations
- AdamW optimizer

Try:
1. Higher learning rate with more warmup
2. Cosine learning rate decay
3. Different beta parameters
