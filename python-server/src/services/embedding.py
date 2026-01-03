"""OpenAI embedding service for generating text embeddings."""

from openai import AsyncOpenAI
from typing import List, Optional
import logging
import tiktoken

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings using OpenAI."""

    MAX_TOKENS = 8191  # text-embedding-3-small limit
    SAFE_TOKEN_LIMIT = 6000  # Leave buffer for safety

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
    ):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
        self._encoding: Optional[tiktoken.Encoding] = None

    @property
    def encoding(self) -> tiktoken.Encoding:
        """Lazy load tokenizer."""
        if self._encoding is None:
            try:
                self._encoding = tiktoken.encoding_for_model(self.model)
            except KeyError:
                self._encoding = tiktoken.get_encoding("cl100k_base")
        return self._encoding

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.encoding.encode(text))

    def truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within token limit."""
        tokens = self.encoding.encode(text)
        if len(tokens) <= max_tokens:
            return text

        truncated_tokens = tokens[:max_tokens]
        truncated_text = self.encoding.decode(truncated_tokens)

        logger.warning(
            f"Text truncated from {len(tokens)} to {max_tokens} tokens"
        )
        return truncated_text

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        # Truncate if necessary
        safe_text = self.truncate_to_tokens(text, self.SAFE_TOKEN_LIMIT)

        response = await self.client.embeddings.create(
            input=safe_text,
            model=self.model,
        )

        return response.data[0].embedding

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        # Truncate all texts
        safe_texts = [
            self.truncate_to_tokens(text, self.SAFE_TOKEN_LIMIT)
            for text in texts
        ]

        response = await self.client.embeddings.create(
            input=safe_texts,
            model=self.model,
        )

        # Sort by index to ensure correct order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
