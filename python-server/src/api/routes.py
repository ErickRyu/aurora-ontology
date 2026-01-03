from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from .schemas import (
    HealthResponse,
    NotePayload,
    IndexResponse,
    DeleteResponse,
    ReindexRequest,
    ReindexResponse,
    QueryRequest,
    QueryResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    ConfigResponse,
    ConfigUpdateRequest,
)
from ..config import Settings, get_settings

router = APIRouter(prefix="/api/v1")


# Global state for services (will be injected from main.py)
class ServiceState:
    chroma_store = None
    vault_watcher = None
    question_generator = None
    settings: Optional[Settings] = None


state = ServiceState()


def get_state() -> ServiceState:
    """Dependency to get service state."""
    return state


@router.get("/health", response_model=HealthResponse)
async def health_check(services: ServiceState = Depends(get_state)):
    """Check server health and connection status."""
    chroma_connected = False
    indexed_insights = 0
    watching = False
    vault_path = None

    if services.chroma_store:
        try:
            indexed_insights = services.chroma_store.count()
            chroma_connected = True
        except Exception:
            pass

    if services.vault_watcher:
        watching = services.vault_watcher.is_running

    if services.settings and services.settings.vault_path:
        vault_path = services.settings.vault_path

    return HealthResponse(
        status="healthy",
        chroma_connected=chroma_connected,
        indexed_insights=indexed_insights,
        vault_path=vault_path,
        watching=watching,
    )


@router.post("/insights/index", response_model=IndexResponse)
async def index_insight(
    payload: NotePayload,
    services: ServiceState = Depends(get_state)
):
    """Index a single Insight note."""
    if not services.chroma_store:
        raise HTTPException(status_code=503, detail="ChromaDB not initialized")

    try:
        insight_id = await services.chroma_store.upsert(
            path=payload.path,
            content=payload.content,
            frontmatter=payload.frontmatter,
        )
        return IndexResponse(
            success=True,
            insight_id=insight_id,
            embedding_dimension=1536,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/insights/{path:path}", response_model=DeleteResponse)
async def delete_insight(
    path: str,
    services: ServiceState = Depends(get_state)
):
    """Remove an Insight from the index."""
    if not services.chroma_store:
        raise HTTPException(status_code=503, detail="ChromaDB not initialized")

    try:
        success = await services.chroma_store.delete(path)
        return DeleteResponse(
            success=success,
            message="Insight removed from index" if success else "Insight not found",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/insights/reindex", response_model=ReindexResponse)
async def reindex_insights(
    request: ReindexRequest,
    services: ServiceState = Depends(get_state)
):
    """Bulk re-index all Insights in the vault."""
    if not services.chroma_store:
        raise HTTPException(status_code=503, detail="ChromaDB not initialized")

    try:
        from ..services.note_parser import parse_insights_folder
        from pathlib import Path

        vault_path = Path(request.vault_path).expanduser().resolve()
        insights_folder = vault_path / "Insights"

        if not insights_folder.exists():
            raise HTTPException(status_code=404, detail="Insights folder not found")

        indexed_count = 0
        errors = []

        for note in parse_insights_folder(insights_folder, vault_path):
            try:
                await services.chroma_store.upsert(
                    path=note["path"],
                    content=note["content"],
                    frontmatter=note["frontmatter"],
                )
                indexed_count += 1
            except Exception as e:
                errors.append(f"{note['path']}: {str(e)}")

        return ReindexResponse(
            success=True,
            indexed_count=indexed_count,
            errors=errors,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/insights", response_model=QueryResponse)
async def query_insights(
    request: QueryRequest,
    services: ServiceState = Depends(get_state)
):
    """Query for related Insights based on Question content."""
    if not services.chroma_store:
        raise HTTPException(status_code=503, detail="ChromaDB not initialized")

    try:
        insights = await services.chroma_store.query(
            query_text=request.question_content,
            top_k=request.top_k,
            min_similarity=request.min_similarity,
        )
        return QueryResponse(insights=insights)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/comparison-questions", response_model=GenerateQuestionsResponse)
async def generate_comparison_questions(
    request: GenerateQuestionsRequest,
    services: ServiceState = Depends(get_state)
):
    """Generate comparison questions based on Question and retrieved Insights."""
    if not services.question_generator:
        raise HTTPException(status_code=503, detail="Question generator not initialized")

    try:
        result = await services.question_generator.generate(
            current_question=request.current_question,
            retrieved_insights=request.retrieved_insights,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config", response_model=ConfigResponse)
async def get_config(services: ServiceState = Depends(get_state)):
    """Get server configuration."""
    vault_path = None
    if services.settings and services.settings.vault_path:
        vault_path = services.settings.vault_path

    watching = False
    if services.vault_watcher:
        watching = services.vault_watcher.is_running

    openai_configured = bool(
        services.settings and services.settings.openai_api_key
    )

    return ConfigResponse(
        vault_path=vault_path,
        watching=watching,
        openai_configured=openai_configured,
    )


@router.put("/config", response_model=ConfigResponse)
async def update_config(
    request: ConfigUpdateRequest,
    services: ServiceState = Depends(get_state)
):
    """Update server configuration."""
    if request.vault_path and services.settings:
        services.settings.vault_path = request.vault_path

        # Restart vault watcher if running
        if services.vault_watcher:
            await services.vault_watcher.restart(request.vault_path)

    return await get_config(services)
