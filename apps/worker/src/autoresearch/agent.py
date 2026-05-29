"""Autoresearch Agent - Uses Claude to iteratively improve train.py.

The agent loop:
1. Reads program.md for research goals
2. Reads current train.py
3. Runs training to get metrics
4. Asks Claude for improvements
5. Applies changes to train.py
6. Repeats until goal is met or max iterations reached
"""

import asyncio
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import httpx

# Paths
AUTORESEARCH_DIR = Path(__file__).parent
TRAIN_PY = AUTORESEARCH_DIR / "train.py"
PROGRAM_MD = AUTORESEARCH_DIR / "program.md"


@dataclass
class AgentConfig:
    """Configuration for the autoresearch agent."""
    max_iterations: int = 10
    target_loss: float = 1.20
    anthropic_api_key: Optional[str] = None
    model: str = "claude-sonnet-4-20250514"


@dataclass
class IterationResult:
    """Result of a single agent iteration."""
    iteration: int
    train_loss: float
    val_loss: float
    changes_made: str
    reasoning: str
    elapsed_time: float
    success: bool = True
    error: Optional[str] = None


@dataclass
class AgentState:
    """State of the autoresearch agent."""
    iteration: int = 0
    best_val_loss: float = float("inf")
    history: list[IterationResult] = field(default_factory=list)
    original_train_py: str = ""
    current_train_py: str = ""
    program_md: str = ""
    is_running: bool = False
    should_stop: bool = False


class AutoresearchAgent:
    """Agent that uses Claude to iteratively improve train.py."""

    def __init__(
        self,
        config: AgentConfig,
        callback: Optional[Callable] = None,
        log_callback: Optional[Callable] = None,
    ):
        self.config = config
        self.callback = callback or (lambda x: None)
        self.log_callback = log_callback or (lambda x: None)
        self.state = AgentState()

        # Get API key from config or environment
        self.api_key = config.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

    async def log(self, message: str):
        """Log a message."""
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] [AGENT] {message}"
        print(formatted)
        await asyncio.to_thread(self.log_callback, formatted)

    async def send_update(self, data: dict):
        """Send update to callback."""
        await asyncio.to_thread(self.callback, data)

    def load_files(self):
        """Load train.py and program.md."""
        self.state.current_train_py = TRAIN_PY.read_text()
        self.state.original_train_py = self.state.current_train_py
        self.state.program_md = PROGRAM_MD.read_text()

    def save_train_py(self, content: str):
        """Save modified train.py."""
        TRAIN_PY.write_text(content)
        self.state.current_train_py = content

    def restore_train_py(self):
        """Restore original train.py."""
        TRAIN_PY.write_text(self.state.original_train_py)
        self.state.current_train_py = self.state.original_train_py

    async def run_training(self) -> dict:
        """Run training and return metrics."""
        await self.log("Running training...")

        try:
            # Import and run training
            # We need to reload the module to pick up changes
            import importlib
            from . import train as train_module
            importlib.reload(train_module)

            # Create a simple callback to capture metrics
            metrics = {"iterations": []}

            def training_callback(data):
                metrics["iterations"].append(data)

            # Run training with reduced iterations for faster feedback
            from .train import train, TrainConfig
            config = TrainConfig(max_iters=200, eval_interval=25)

            result = await asyncio.to_thread(
                train,
                config=config,
                callback=training_callback,
                log_callback=lambda msg: asyncio.run(self.log(f"  {msg}")),
            )

            return {
                "success": True,
                "best_val_loss": result["best_val_loss"],
                "final_train_loss": result["final_train_loss"],
                "elapsed_time": result["elapsed_time"],
                "metrics": metrics,
            }

        except Exception as e:
            await self.log(f"Training failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def ask_claude(self, context: str) -> dict:
        """Ask Claude for improvements to train.py."""
        await self.log("Asking Claude for improvements...")

        prompt = f"""You are an ML research agent working to improve a GPT training script.

## Research Program
{self.state.program_md}

## Current train.py
```python
{self.state.current_train_py}
```

## Recent Results
{context}

## Your Task
Analyze the current code and results, then propose ONE specific improvement to try.

Respond in this exact format:

<reasoning>
Explain your analysis and why you're making this change.
</reasoning>

<change_description>
Brief description of what you're changing (1-2 sentences).
</change_description>

<new_train_py>
The complete updated train.py file with your change.
</new_train_py>

Remember:
- Make ONE focused change at a time
- Keep the overall structure intact
- Ensure the code is syntactically valid
- Focus on changes that could reduce validation loss
"""

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": self.config.model,
                        "max_tokens": 8000,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"API error: {response.status_code}"}

                data = response.json()
                content = data["content"][0]["text"]

                # Parse response
                reasoning_match = re.search(r"<reasoning>(.*?)</reasoning>", content, re.DOTALL)
                change_match = re.search(r"<change_description>(.*?)</change_description>", content, re.DOTALL)
                code_match = re.search(r"<new_train_py>(.*?)</new_train_py>", content, re.DOTALL)

                if not code_match:
                    return {"success": False, "error": "Could not parse Claude's response"}

                return {
                    "success": True,
                    "reasoning": reasoning_match.group(1).strip() if reasoning_match else "",
                    "change_description": change_match.group(1).strip() if change_match else "",
                    "new_code": code_match.group(1).strip(),
                }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def run_iteration(self) -> IterationResult:
        """Run one iteration of the agent loop."""
        iteration = self.state.iteration
        await self.log(f"=== Iteration {iteration} ===")

        # Build context from history
        context_parts = []
        for result in self.state.history[-3:]:  # Last 3 iterations
            context_parts.append(
                f"Iteration {result.iteration}: val_loss={result.val_loss:.4f}, "
                f"changes='{result.changes_made}'"
            )
        context = "\n".join(context_parts) if context_parts else "No previous iterations."

        # Ask Claude for improvements
        claude_result = await self.ask_claude(context)

        if not claude_result["success"]:
            return IterationResult(
                iteration=iteration,
                train_loss=0,
                val_loss=float("inf"),
                changes_made="",
                reasoning=claude_result.get("error", "Unknown error"),
                elapsed_time=0,
                success=False,
                error=claude_result.get("error"),
            )

        # Apply the changes
        await self.log(f"Change: {claude_result['change_description']}")
        self.save_train_py(claude_result["new_code"])

        # Run training
        train_result = await self.run_training()

        if not train_result["success"]:
            # Revert on failure
            await self.log("Training failed, reverting changes...")
            self.restore_train_py()
            return IterationResult(
                iteration=iteration,
                train_loss=0,
                val_loss=float("inf"),
                changes_made=claude_result["change_description"],
                reasoning=claude_result["reasoning"],
                elapsed_time=0,
                success=False,
                error=train_result.get("error"),
            )

        val_loss = train_result["best_val_loss"]

        # Check if this is an improvement
        if val_loss < self.state.best_val_loss:
            await self.log(f"New best! val_loss: {val_loss:.4f} (was {self.state.best_val_loss:.4f})")
            self.state.best_val_loss = val_loss
        else:
            await self.log(f"No improvement: val_loss: {val_loss:.4f} (best: {self.state.best_val_loss:.4f})")

        result = IterationResult(
            iteration=iteration,
            train_loss=train_result["final_train_loss"],
            val_loss=val_loss,
            changes_made=claude_result["change_description"],
            reasoning=claude_result["reasoning"],
            elapsed_time=train_result["elapsed_time"],
            success=True,
        )

        # Update program.md with result
        await self.update_program_md(result)

        return result

    async def update_program_md(self, result: IterationResult):
        """Update program.md with iteration results."""
        # Add to history table
        new_row = f"| {result.iteration} | {result.changes_made[:50]} | {result.val_loss:.4f} | {'Improved!' if result.val_loss < self.state.best_val_loss else 'No improvement'} |"

        content = PROGRAM_MD.read_text()

        # Find the table and add the row
        if "| Iter |" in content:
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if line.startswith("| 0 |") or (line.startswith("|") and "Baseline" in line):
                    # Insert after header rows
                    insert_idx = i + 1
                    while insert_idx < len(lines) and lines[insert_idx].startswith("|"):
                        insert_idx += 1
                    lines.insert(insert_idx, new_row)
                    break

            content = "\n".join(lines)
            PROGRAM_MD.write_text(content)
            self.state.program_md = content

    async def run(self) -> dict:
        """Run the full agent loop."""
        await self.log("Starting autoresearch agent...")
        self.state.is_running = True
        self.state.should_stop = False

        try:
            # Load files
            self.load_files()

            # Run baseline first
            await self.log("Running baseline training...")
            baseline = await self.run_training()

            if baseline["success"]:
                self.state.best_val_loss = baseline["best_val_loss"]
                await self.log(f"Baseline val_loss: {self.state.best_val_loss:.4f}")

                await self.send_update({
                    "type": "baseline",
                    "val_loss": self.state.best_val_loss,
                })

            # Main loop
            for i in range(self.config.max_iterations):
                if self.state.should_stop:
                    await self.log("Stop requested, ending agent loop.")
                    break

                self.state.iteration = i + 1
                result = await self.run_iteration()
                self.state.history.append(result)

                await self.send_update({
                    "type": "iteration",
                    "iteration": result.iteration,
                    "val_loss": result.val_loss,
                    "train_loss": result.train_loss,
                    "changes": result.changes_made,
                    "reasoning": result.reasoning,
                    "best_val_loss": self.state.best_val_loss,
                })

                # Check if we've hit the target
                if self.state.best_val_loss <= self.config.target_loss:
                    await self.log(f"Target loss {self.config.target_loss} achieved!")
                    break

            await self.log(f"Agent finished. Best val_loss: {self.state.best_val_loss:.4f}")

            return {
                "success": True,
                "best_val_loss": self.state.best_val_loss,
                "iterations": len(self.state.history),
                "history": [
                    {
                        "iteration": r.iteration,
                        "val_loss": r.val_loss,
                        "changes": r.changes_made,
                    }
                    for r in self.state.history
                ],
            }

        except Exception as e:
            await self.log(f"Agent error: {e}")
            return {"success": False, "error": str(e)}

        finally:
            self.state.is_running = False

    def stop(self):
        """Request the agent to stop."""
        self.state.should_stop = True


async def run_agent(
    config: Optional[AgentConfig] = None,
    callback: Optional[Callable] = None,
    log_callback: Optional[Callable] = None,
) -> dict:
    """Convenience function to run the agent."""
    if config is None:
        config = AgentConfig()

    agent = AutoresearchAgent(config, callback, log_callback)
    return await agent.run()
