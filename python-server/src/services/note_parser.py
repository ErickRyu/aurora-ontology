"""Markdown note parsing with frontmatter extraction."""

import frontmatter
from pathlib import Path
from typing import Dict, Any, Iterator, Optional
import logging

logger = logging.getLogger(__name__)


def parse_note(file_path: Path) -> Dict[str, Any]:
    """
    Parse a markdown note file.

    Returns:
        Dict with 'content', 'frontmatter', and 'raw' keys
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            post = frontmatter.load(f)

        return {
            "content": post.content,
            "frontmatter": dict(post.metadata),
            "raw": post.content,
        }
    except Exception as e:
        logger.error(f"Failed to parse note {file_path}: {e}")
        raise


def get_relative_path(file_path: Path, vault_path: Path) -> str:
    """Get relative path from vault root."""
    try:
        return str(file_path.relative_to(vault_path))
    except ValueError:
        return str(file_path)


def is_insight_note(file_path: Path, vault_path: Path) -> bool:
    """
    Check if a file is an Insight note.

    Uses folder-based classification: must be in Insights/ folder.
    """
    relative = get_relative_path(file_path, vault_path)
    return relative.startswith("Insights/") and file_path.suffix == ".md"


def is_question_note(file_path: Path, vault_path: Path) -> bool:
    """
    Check if a file is a Question note.

    Uses folder-based classification: must be in Questions/ folder.
    """
    relative = get_relative_path(file_path, vault_path)
    return relative.startswith("Questions/") and file_path.suffix == ".md"


def is_thought_note(file_path: Path, vault_path: Path) -> bool:
    """
    Check if a file is a Thought note.

    Uses folder-based classification: must be in Thoughts/ folder.
    """
    relative = get_relative_path(file_path, vault_path)
    return relative.startswith("Thoughts/") and file_path.suffix == ".md"


def parse_insights_folder(
    insights_folder: Path,
    vault_path: Path
) -> Iterator[Dict[str, Any]]:
    """
    Parse all Insight notes in the Insights folder.

    Yields:
        Dict with 'path', 'content', and 'frontmatter' keys
    """
    if not insights_folder.exists():
        logger.warning(f"Insights folder not found: {insights_folder}")
        return

    for file_path in insights_folder.rglob("*.md"):
        try:
            parsed = parse_note(file_path)
            yield {
                "path": get_relative_path(file_path, vault_path),
                "content": parsed["content"],
                "frontmatter": parsed["frontmatter"],
            }
        except Exception as e:
            logger.error(f"Skipping {file_path}: {e}")
            continue


def normalize_content(content: str) -> str:
    """
    Normalize content for embedding.

    - Strip excessive whitespace
    - Normalize Obsidian links to plain text
    """
    import re

    # Normalize whitespace
    content = " ".join(content.split())

    # Convert [[Link|Display]] to Display
    content = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", content)

    # Convert [[Link]] to Link
    content = re.sub(r"\[\[([^\]]+)\]\]", r"\1", content)

    return content.strip()
