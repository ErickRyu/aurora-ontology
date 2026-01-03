"""ChromaDB vector store for Insight embeddings."""

import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import Dict, Any, List, Optional
import logging
import hashlib

from .embedding import EmbeddingService
from .note_parser import normalize_content
from ..api.schemas import RetrievedInsight

logger = logging.getLogger(__name__)

COLLECTION_NAME = "personal_ontology_insights"


class ChromaStore:
    """Vector store for Insight notes using ChromaDB."""

    def __init__(
        self,
        persist_dir: str,
        openai_api_key: str,
        embedding_model: str = "text-embedding-3-small",
    ):
        self.persist_dir = persist_dir
        self.embedding_service = EmbeddingService(
            api_key=openai_api_key,
            model=embedding_model,
        )

        # Initialize ChromaDB with persistence
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(
                anonymized_telemetry=False,
            ),
        )

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

        logger.info(
            f"ChromaDB collection '{COLLECTION_NAME}' initialized "
            f"with {self.collection.count()} documents"
        )

    def _generate_id(self, path: str) -> str:
        """Generate a stable ID from path."""
        return hashlib.sha256(path.encode()).hexdigest()[:16]

    def count(self) -> int:
        """Return the number of indexed Insights."""
        return self.collection.count()

    async def upsert(
        self,
        path: str,
        content: str,
        frontmatter: Dict[str, Any],
    ) -> str:
        """
        Index or update an Insight.

        Args:
            path: Relative path from vault root
            content: Markdown content (without frontmatter)
            frontmatter: Parsed frontmatter metadata

        Returns:
            The document ID
        """
        doc_id = self._generate_id(path)

        # Normalize content for embedding
        normalized = normalize_content(content)

        if not normalized.strip():
            logger.warning(f"Empty content for {path}, skipping")
            raise ValueError("Cannot index empty content")

        # Generate embedding
        embedding = await self.embedding_service.embed(normalized)

        # Prepare metadata (ChromaDB only supports primitive types)
        metadata = {
            "path": path,
            "type": frontmatter.get("type", "insight"),
            "confidence": frontmatter.get("confidence", ""),
            "created": str(frontmatter.get("created", "")),
        }

        # Upsert to collection
        self.collection.upsert(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[content],  # Store original content for retrieval
            metadatas=[metadata],
        )

        logger.info(f"Indexed Insight: {path} (id: {doc_id})")
        return doc_id

    async def delete(self, path: str) -> bool:
        """
        Remove an Insight from the index.

        Args:
            path: Relative path from vault root

        Returns:
            True if deleted, False if not found
        """
        doc_id = self._generate_id(path)

        try:
            # Check if exists
            result = self.collection.get(ids=[doc_id])
            if not result["ids"]:
                return False

            self.collection.delete(ids=[doc_id])
            logger.info(f"Deleted Insight: {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete {path}: {e}")
            raise

    async def query(
        self,
        query_text: str,
        top_k: int = 5,
        min_similarity: float = 0.7,
    ) -> List[RetrievedInsight]:
        """
        Query for related Insights.

        Args:
            query_text: The Question content to search for
            top_k: Maximum number of results
            min_similarity: Minimum cosine similarity threshold

        Returns:
            List of retrieved Insights with similarity scores
        """
        if self.collection.count() == 0:
            logger.warning("No Insights indexed yet")
            return []

        # Normalize query
        normalized_query = normalize_content(query_text)

        # Generate query embedding
        query_embedding = await self.embedding_service.embed(normalized_query)

        # Query ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        insights = []
        for i, doc_id in enumerate(results["ids"][0]):
            # ChromaDB returns L2 distance for cosine space: distance = 1 - similarity
            distance = results["distances"][0][i]
            similarity = 1 - distance

            if similarity < min_similarity:
                continue

            metadata = results["metadatas"][0][i]
            content = results["documents"][0][i]

            insights.append(RetrievedInsight(
                path=metadata.get("path", ""),
                content=content,
                similarity=round(similarity, 4),
                frontmatter={
                    "type": metadata.get("type"),
                    "confidence": metadata.get("confidence"),
                    "created": metadata.get("created"),
                },
            ))

        logger.info(
            f"Query returned {len(insights)} Insights "
            f"(from {len(results['ids'][0])} candidates)"
        )
        return insights

    async def clear(self):
        """Clear all indexed Insights."""
        self.client.delete_collection(COLLECTION_NAME)
        self.collection = self.client.create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("Cleared all indexed Insights")
