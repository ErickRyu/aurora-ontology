"""File system watcher for Obsidian vault Insights folder."""

import asyncio
from pathlib import Path
from typing import Optional
import logging

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from .chroma_store import ChromaStore
from .note_parser import parse_note, get_relative_path, is_insight_note

logger = logging.getLogger(__name__)

DEBOUNCE_SECONDS = 0.3


class InsightEventHandler(FileSystemEventHandler):
    """Handle file system events for Insight notes."""

    def __init__(
        self,
        vault_path: Path,
        chroma_store: ChromaStore,
        loop: asyncio.AbstractEventLoop,
    ):
        super().__init__()
        self.vault_path = vault_path
        self.chroma_store = chroma_store
        self.loop = loop
        self._pending_tasks: dict[str, asyncio.TimerHandle] = {}

    def _schedule_update(self, path: str, is_delete: bool = False):
        """Schedule a debounced update for a file."""
        # Cancel any pending task for this path
        if path in self._pending_tasks:
            self._pending_tasks[path].cancel()

        # Schedule new task
        async def do_update():
            try:
                file_path = Path(path)
                relative_path = get_relative_path(file_path, self.vault_path)

                if is_delete:
                    await self.chroma_store.delete(relative_path)
                    logger.info(f"Removed from index: {relative_path}")
                else:
                    if file_path.exists():
                        parsed = parse_note(file_path)
                        await self.chroma_store.upsert(
                            path=relative_path,
                            content=parsed["content"],
                            frontmatter=parsed["frontmatter"],
                        )
                        logger.info(f"Updated index: {relative_path}")
            except Exception as e:
                logger.error(f"Failed to process {path}: {e}")
            finally:
                self._pending_tasks.pop(path, None)

        def run_update():
            asyncio.run_coroutine_threadsafe(do_update(), self.loop)

        handle = self.loop.call_later(DEBOUNCE_SECONDS, run_update)
        self._pending_tasks[path] = handle

    def on_created(self, event: FileSystemEvent):
        """Handle file creation."""
        if event.is_directory:
            return

        path = Path(event.src_path)
        if is_insight_note(path, self.vault_path):
            logger.debug(f"Insight created: {event.src_path}")
            self._schedule_update(event.src_path)

    def on_modified(self, event: FileSystemEvent):
        """Handle file modification."""
        if event.is_directory:
            return

        path = Path(event.src_path)
        if is_insight_note(path, self.vault_path):
            logger.debug(f"Insight modified: {event.src_path}")
            self._schedule_update(event.src_path)

    def on_deleted(self, event: FileSystemEvent):
        """Handle file deletion."""
        if event.is_directory:
            return

        # Check if it was in Insights folder (can't check file anymore)
        relative = event.src_path.replace(str(self.vault_path), "").lstrip("/\\")
        if relative.startswith("Insights/") and event.src_path.endswith(".md"):
            logger.debug(f"Insight deleted: {event.src_path}")
            self._schedule_update(event.src_path, is_delete=True)

    def on_moved(self, event: FileSystemEvent):
        """Handle file move/rename."""
        if event.is_directory:
            return

        src_path = Path(event.src_path)
        dest_path = Path(event.dest_path)

        # Handle as delete + create
        src_relative = event.src_path.replace(str(self.vault_path), "").lstrip("/\\")
        if src_relative.startswith("Insights/") and event.src_path.endswith(".md"):
            self._schedule_update(event.src_path, is_delete=True)

        if is_insight_note(dest_path, self.vault_path):
            self._schedule_update(event.dest_path)


class VaultWatcher:
    """Watch Obsidian vault for Insight changes."""

    def __init__(
        self,
        vault_path: str,
        chroma_store: ChromaStore,
    ):
        self.vault_path = Path(vault_path).resolve()
        self.chroma_store = chroma_store
        self.observer: Optional[Observer] = None
        self._running = False

    @property
    def is_running(self) -> bool:
        """Check if watcher is running."""
        return self._running

    async def start(self):
        """Start watching the vault."""
        if self._running:
            logger.warning("Vault watcher already running")
            return

        insights_path = self.vault_path / "Insights"
        if not insights_path.exists():
            insights_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created Insights folder: {insights_path}")

        loop = asyncio.get_event_loop()
        handler = InsightEventHandler(
            vault_path=self.vault_path,
            chroma_store=self.chroma_store,
            loop=loop,
        )

        self.observer = Observer()
        self.observer.schedule(
            handler,
            str(insights_path),
            recursive=True,
        )
        self.observer.start()
        self._running = True

        logger.info(f"Started watching: {insights_path}")

    async def stop(self):
        """Stop watching the vault."""
        if self.observer:
            self.observer.stop()
            self.observer.join(timeout=5)
            self.observer = None
            self._running = False
            logger.info("Vault watcher stopped")

    async def restart(self, new_vault_path: Optional[str] = None):
        """Restart the watcher, optionally with a new vault path."""
        await self.stop()

        if new_vault_path:
            self.vault_path = Path(new_vault_path).resolve()

        await self.start()
