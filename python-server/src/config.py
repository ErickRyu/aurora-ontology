from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    """Application configuration settings."""

    # OpenAI Configuration
    openai_api_key: str = Field(..., description="OpenAI API Key")

    # Server Configuration
    host: str = Field(default="127.0.0.1", description="Server host")
    port: int = Field(default=8742, description="Server port")

    # Vault Configuration
    vault_path: Optional[str] = Field(default=None, description="Path to Obsidian vault")

    # ChromaDB Configuration
    chroma_persist_dir: str = Field(
        default="./chroma_data",
        description="Directory to persist ChromaDB data"
    )

    # Embedding Configuration
    embedding_model: str = Field(
        default="text-embedding-3-small",
        description="OpenAI embedding model to use"
    )

    # LLM Configuration
    llm_model: str = Field(
        default="gpt-4-turbo-preview",
        description="OpenAI LLM model for question generation"
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

    @property
    def vault_path_resolved(self) -> Optional[Path]:
        """Return resolved vault path."""
        if self.vault_path:
            return Path(self.vault_path).expanduser().resolve()
        return None

    @property
    def chroma_persist_dir_resolved(self) -> Path:
        """Return resolved ChromaDB persist directory."""
        return Path(self.chroma_persist_dir).expanduser().resolve()


def get_settings() -> Settings:
    """Get application settings singleton."""
    return Settings()
