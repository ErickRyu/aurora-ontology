from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    chroma_connected: bool
    indexed_insights: int
    vault_path: Optional[str] = None
    watching: bool = False


class NotePayload(BaseModel):
    """Payload for indexing a note."""
    path: str = Field(..., description="Relative path to note from vault root")
    content: str = Field(..., description="Full markdown content")
    frontmatter: Dict[str, Any] = Field(default_factory=dict, description="Parsed frontmatter")
    modified_at: Optional[str] = Field(default=None, description="ISO 8601 timestamp")


class IndexResponse(BaseModel):
    """Response after indexing an Insight."""
    success: bool
    insight_id: str
    embedding_dimension: int = 1536


class DeleteResponse(BaseModel):
    """Response after deleting an Insight."""
    success: bool
    message: str = ""


class ReindexRequest(BaseModel):
    """Request for bulk re-indexing."""
    vault_path: str = Field(..., description="Path to the vault")


class ReindexResponse(BaseModel):
    """Response after bulk re-indexing."""
    success: bool
    indexed_count: int
    errors: List[str] = Field(default_factory=list)


class QueryRequest(BaseModel):
    """Request for querying related Insights."""
    question_content: str = Field(..., description="Full text of the Question note")
    top_k: int = Field(default=5, ge=1, le=10, description="Number of results to return")
    min_similarity: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity threshold")


class RetrievedInsight(BaseModel):
    """A retrieved Insight from the query."""
    path: str
    content: str
    similarity: float
    frontmatter: Dict[str, Any] = Field(default_factory=dict)


class QueryResponse(BaseModel):
    """Response with retrieved Insights."""
    insights: List[RetrievedInsight]


class QuestionType(str, Enum):
    """Types of comparison questions."""
    MEMORY_INVOKE = "memory_invoke"
    CONFLICT_DETECT = "conflict_detect"
    AMPLIFY = "amplify"


class ComparisonQuestion(BaseModel):
    """A generated comparison question."""
    type: QuestionType
    insight_reference: Optional[str] = Field(default=None, description="Path to referenced Insight")
    quote: Optional[str] = Field(default=None, description="Quote from the Insight")
    question: str = Field(..., description="The generated question")


class GenerateQuestionsRequest(BaseModel):
    """Request for generating comparison questions."""
    current_question: str = Field(..., description="Full Question note content")
    retrieved_insights: List[RetrievedInsight]


class GenerateQuestionsResponse(BaseModel):
    """Response with generated comparison questions."""
    questions: List[ComparisonQuestion]
    token_usage: Dict[str, int] = Field(default_factory=dict)


class ConfigResponse(BaseModel):
    """Server configuration response."""
    vault_path: Optional[str]
    watching: bool
    openai_configured: bool


class ConfigUpdateRequest(BaseModel):
    """Request to update server configuration."""
    vault_path: Optional[str] = None
