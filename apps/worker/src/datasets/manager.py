"""Dataset manager for handling different training datasets."""
import os
import urllib.request
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DATA_DIR = Path("/app/data")


@dataclass
class DatasetInfo:
    """Information about a dataset."""
    id: str
    name: str
    description: str
    size: str
    source: str
    downloaded: bool
    path: Optional[str]
    char_count: Optional[int] = None


# Predefined datasets that can be downloaded
AVAILABLE_DATASETS = {
    "shakespeare": {
        "name": "Tiny Shakespeare",
        "description": "Complete works of Shakespeare (~1MB). Classic choice for character-level language models.",
        "url": "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt",
        "filename": "shakespeare.txt",
        "size": "~1MB",
    },
    "shakespeare_modern": {
        "name": "Shakespeare (Modern)",
        "description": "Shakespeare plays in modern formatting.",
        "url": "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt",
        "filename": "shakespeare_modern.txt",
        "size": "~1MB",
    },
    "wiki_simple": {
        "name": "Simple Wikipedia",
        "description": "Simple English Wikipedia articles. Good for learning general language patterns.",
        "url": "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt",  # Placeholder
        "filename": "wiki_simple.txt",
        "size": "~5MB",
    },
}


class DatasetManager:
    """Manages datasets for training."""

    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.custom_dir = self.data_dir / "custom"
        self.custom_dir.mkdir(parents=True, exist_ok=True)

    def list_datasets(self) -> list[DatasetInfo]:
        """List all available datasets (predefined + custom)."""
        datasets = []

        # Add predefined datasets
        for dataset_id, info in AVAILABLE_DATASETS.items():
            file_path = self.data_dir / info["filename"]
            downloaded = file_path.exists()
            char_count = None
            if downloaded:
                char_count = file_path.stat().st_size

            datasets.append(DatasetInfo(
                id=dataset_id,
                name=info["name"],
                description=info["description"],
                size=info["size"],
                source="predefined",
                downloaded=downloaded,
                path=str(file_path) if downloaded else None,
                char_count=char_count,
            ))

        # Add custom uploaded datasets
        for file_path in self.custom_dir.glob("*.txt"):
            char_count = file_path.stat().st_size
            datasets.append(DatasetInfo(
                id=f"custom_{file_path.stem}",
                name=file_path.stem,
                description=f"Custom uploaded dataset ({char_count:,} chars)",
                size=self._format_size(char_count),
                source="custom",
                downloaded=True,
                path=str(file_path),
                char_count=char_count,
            ))

        return datasets

    def download_dataset(self, dataset_id: str) -> DatasetInfo:
        """Download a predefined dataset."""
        if dataset_id not in AVAILABLE_DATASETS:
            raise ValueError(f"Unknown dataset: {dataset_id}")

        info = AVAILABLE_DATASETS[dataset_id]
        file_path = self.data_dir / info["filename"]

        if file_path.exists():
            logger.info(f"Dataset {dataset_id} already exists at {file_path}")
        else:
            logger.info(f"Downloading dataset {dataset_id} from {info['url']}")
            urllib.request.urlretrieve(info["url"], file_path)
            logger.info(f"Downloaded to {file_path}")

        char_count = file_path.stat().st_size
        return DatasetInfo(
            id=dataset_id,
            name=info["name"],
            description=info["description"],
            size=info["size"],
            source="predefined",
            downloaded=True,
            path=str(file_path),
            char_count=char_count,
        )

    def upload_dataset(self, filename: str, content: bytes) -> DatasetInfo:
        """Upload a custom dataset."""
        # Sanitize filename
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._-").rstrip()
        if not safe_name.endswith(".txt"):
            safe_name += ".txt"

        file_path = self.custom_dir / safe_name

        # Write content
        with open(file_path, "wb") as f:
            f.write(content)

        char_count = len(content)
        logger.info(f"Uploaded custom dataset: {safe_name} ({char_count} chars)")

        return DatasetInfo(
            id=f"custom_{file_path.stem}",
            name=file_path.stem,
            description=f"Custom uploaded dataset ({char_count:,} chars)",
            size=self._format_size(char_count),
            source="custom",
            downloaded=True,
            path=str(file_path),
            char_count=char_count,
        )

    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete a dataset (only custom datasets can be deleted)."""
        if dataset_id.startswith("custom_"):
            name = dataset_id[7:]  # Remove "custom_" prefix
            file_path = self.custom_dir / f"{name}.txt"
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted custom dataset: {name}")
                return True
        return False

    def get_dataset_path(self, dataset_id: str) -> Optional[str]:
        """Get the file path for a dataset."""
        if dataset_id.startswith("custom_"):
            name = dataset_id[7:]
            file_path = self.custom_dir / f"{name}.txt"
            if file_path.exists():
                return str(file_path)
        elif dataset_id in AVAILABLE_DATASETS:
            file_path = self.data_dir / AVAILABLE_DATASETS[dataset_id]["filename"]
            if file_path.exists():
                return str(file_path)
        return None

    def get_dataset_preview(self, dataset_id: str, max_chars: int = 1000) -> Optional[str]:
        """Get a preview of the dataset content."""
        path = self.get_dataset_path(dataset_id)
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read(max_chars)
        return None

    def _format_size(self, size_bytes: int) -> str:
        """Format size in human-readable format."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"


# Global instance
_manager: Optional[DatasetManager] = None


def get_dataset_manager() -> DatasetManager:
    """Get or create the global dataset manager."""
    global _manager
    if _manager is None:
        _manager = DatasetManager()
    return _manager
