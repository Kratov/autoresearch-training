# ML Concepts Quick Reference

## Training vs Research

| Training | Research |
|----------|----------|
| Train ONE model with fixed settings | Run MULTIPLE experiments with different configs |
| Just execute | Compare and find what works best |
| "Make a model" | "Find the best way to make a model" |

---

## Loss & The Valley Analogy

**Loss** = how wrong the model's predictions are

```
High loss → bad predictions:  "ROMEO: asdfkjh2#@x"
Low loss  → good predictions: "ROMEO: But soft, what light..."
```

**Loss Landscape** = a mathematical surface where:
- **Height** = error/loss (want to minimize)
- **Position** = model's weights (millions of numbers)

**Training** = adjusting weights to move "downhill" toward lower loss.

Imagine blindfolded in a valley, trying to find the lowest point by feeling the slope under your feet.

---

## Parameters vs Hyperparameters

| Parameters | Hyperparameters |
|------------|-----------------|
| What the model **learns** | What **you choose** before training |
| Millions of weights | A few settings |
| Found by gradient descent | Found by trial & error (research) |
| Change every training step | Fixed during training |

### Parameters (learned automatically)
```python
attention_weights = [0.23, -0.15, 0.87, ...]  # millions of these
feed_forward_weights = [...]
embeddings = [...]
```

### Hyperparameters (you decide)
```python
learning_rate = 3e-4      # how fast to learn
n_layers = 6              # how deep the model
n_heads = 6               # attention heads
batch_size = 64           # examples per step
dropout = 0.2             # regularization
```

---

## Learning Rate (lr)

Controls how big the weight updates are:

```
new_weight = old_weight - lr × gradient
```

| lr | Value | Effect |
|----|-------|--------|
| High | 0.1 | Big steps → fast but unstable, might overshoot |
| Medium | 0.001 | Balanced → typical starting point |
| Low | 0.00001 | Tiny steps → stable but slow |

**Common values:**
```python
lr = 1e-3    # 0.001     - common default
lr = 3e-4    # 0.0003    - often works well
lr = 1e-4    # 0.0001    - conservative
lr = 1e-5    # 0.00001   - fine-tuning pretrained models
```

**Why it matters:**
- Too high → loss explodes to infinity
- Too low → training takes forever
- Just right → efficient convergence

---

## The Training Loop

```python
for iteration in range(max_iters):
    # 1. Get batch of data
    x, y = get_batch(data)

    # 2. Forward pass - make predictions
    predictions = model(x)

    # 3. Compute loss - how wrong?
    loss = cross_entropy(predictions, y)

    # 4. Backward pass - compute gradients
    loss.backward()

    # 5. Update weights
    optimizer.step()  # weights -= lr * gradients
```

---

## Transformer Architecture (GPT)

```
Input: "To be or not to"
          ↓
    [Embedding Layer]     - convert tokens to vectors
          ↓
    [Positional Encoding] - add position information
          ↓
    ┌─────────────────┐
    │  Attention      │ ─┐
    │  Layer          │  │ × n_layers
    │  + Feed Forward │  │   (6 in our demo)
    └─────────────────┘ ─┘
          ↓
    [Output Layer]
          ↓
Output: " be" (next token prediction)
```

**Key hyperparameters:**
- `n_layer` - depth (how many transformer blocks)
- `n_head` - attention heads (parallel attention patterns)
- `n_embd` - embedding dimension (vector size)
- `block_size` - context length (how many tokens it sees)

---

## Common Optimizers

| Optimizer | Description |
|-----------|-------------|
| **SGD** | Simple, just follows gradient |
| **Adam** | Adaptive lr per parameter + momentum |
| **AdamW** | Adam with better weight decay |
| **Muon** | New experimental optimizer |

Most people use **AdamW** - it just works.

---

## Metrics to Watch

| Metric | Meaning | Good Sign |
|--------|---------|-----------|
| **Training Loss** | Error on training data | Going down |
| **Validation Loss** | Error on held-out data | Going down, close to train |
| **Perplexity** | exp(loss), interpretable | Lower is better |

**Warning signs:**
- Train loss ↓ but val loss ↑ → **overfitting**
- Both stuck → **lr too low** or **model too small**
- Loss = NaN → **lr too high** or **bug**

---

## Quick Numbers for Reference

**Our demo model:**
```
Parameters:    ~10M
Layers:        6
Heads:         6
Embedding:     384
Context:       256 tokens
Training:      500 iterations
Time:          ~2-3 min on RTX 4080
```

**For comparison:**
| Model | Parameters |
|-------|------------|
| Our demo | 10M |
| GPT-2 Small | 124M |
| GPT-2 Large | 774M |
| GPT-3 | 175B |
| GPT-4 | ~1T (estimated) |

---

## Interview Talking Points

1. **"What does this platform do?"**
   > Automates ML research by running multiple experiments with different hyperparameters and comparing results.

2. **"Why automate this?"**
   > Finding good hyperparameters requires many experiments. Manual tuning is slow and error-prone.

3. **"How does training work?"**
   > Forward pass → compute loss → backward pass → update weights. Repeat until loss is low.

4. **"What's a transformer?"**
   > Neural network architecture using self-attention. Can process sequences in parallel, captures long-range dependencies.

5. **"Why GPU?"**
   > Matrix multiplications are parallelizable. GPU has thousands of cores vs CPU's few.
