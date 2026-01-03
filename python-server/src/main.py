from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .config import get_settings
from .api.routes import router, state

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Personal Ontology Server...")

    # Load settings
    settings = get_settings()
    state.settings = settings

    # Initialize ChromaDB
    try:
        from .services.chroma_store import ChromaStore
        state.chroma_store = ChromaStore(
            persist_dir=str(settings.chroma_persist_dir_resolved),
            openai_api_key=settings.openai_api_key,
            embedding_model=settings.embedding_model,
        )
        logger.info(f"ChromaDB initialized at {settings.chroma_persist_dir_resolved}")
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB: {e}")

    # Initialize Question Generator
    try:
        from .services.question_generator import QuestionGenerator
        state.question_generator = QuestionGenerator(
            openai_api_key=settings.openai_api_key,
            model=settings.llm_model,
        )
        logger.info("Question Generator initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Question Generator: {e}")

    # Initialize Vault Watcher if vault path is set
    if settings.vault_path:
        try:
            from .services.vault_watcher import VaultWatcher
            state.vault_watcher = VaultWatcher(
                vault_path=str(settings.vault_path_resolved),
                chroma_store=state.chroma_store,
            )
            await state.vault_watcher.start()
            logger.info(f"Vault Watcher started for {settings.vault_path}")
        except Exception as e:
            logger.error(f"Failed to start Vault Watcher: {e}")

    logger.info(f"Server ready at http://{settings.host}:{settings.port}")

    yield

    # Cleanup
    logger.info("Shutting down server...")

    if state.vault_watcher:
        await state.vault_watcher.stop()
        logger.info("Vault Watcher stopped")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Personal Ontology System",
        description="Question-centered RAG for personal knowledge management",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Configure CORS for Obsidian plugin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Obsidian uses app:// protocol
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(router)

    return app


app = create_app()
