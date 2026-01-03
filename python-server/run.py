#!/usr/bin/env python3
"""Entry point for running the Personal Ontology server."""

import uvicorn
from src.config import get_settings


def main():
    """Run the server."""
    settings = get_settings()

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,  # Enable auto-reload for development
        log_level="info",
    )


if __name__ == "__main__":
    main()
