"""
SentinelChain — Chroma Vector Store
Manages the 'documents' collection for RAG retrieval of geopolitical events.
Uses sentence-transformers for local embeddings (no API cost).
"""

import logging
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

from config import CHROMA_PERSIST_DIR, CHROMA_COLLECTION_NAME, EMBEDDING_MODEL

logger = logging.getLogger(__name__)

# ─── Singleton Instances ──────────────────────────────────────────────────────

_chroma_client: chromadb.PersistentClient | None = None
_collection: chromadb.Collection | None = None
_embedding_fn = None


def _get_embedding_fn():
    """Get or create the sentence-transformers embedding function."""
    global _embedding_fn
    if _embedding_fn is None:
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL)
        _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL
        )
        logger.info("Embedding model loaded successfully")
    return _embedding_fn


def get_collection() -> chromadb.Collection:
    """Return the 'documents' Chroma collection, creating it if needed."""
    global _chroma_client, _collection
    if _collection is None:
        logger.info("Initializing Chroma at: %s", CHROMA_PERSIST_DIR)
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        _collection = _chroma_client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            embedding_function=_get_embedding_fn(),
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "Chroma collection '%s' ready — %d documents",
            CHROMA_COLLECTION_NAME,
            _collection.count(),
        )
    return _collection


# ─── Document Operations ─────────────────────────────────────────────────────


def add_documents(
    texts: list[str],
    metadatas: list[dict[str, Any]],
    ids: list[str],
) -> int:
    """
    Add documents to the Chroma collection.
    Skips documents whose IDs already exist (idempotent).
    
    Returns the number of new documents added.
    """
    collection = get_collection()

    # Filter out existing IDs
    existing = set()
    if ids:
        try:
            result = collection.get(ids=ids)
            if result and result["ids"]:
                existing = set(result["ids"])
        except Exception:
            pass  # IDs don't exist yet

    new_texts = []
    new_metadatas = []
    new_ids = []
    for text, meta, doc_id in zip(texts, metadatas, ids):
        if doc_id not in existing:
            new_texts.append(text)
            new_metadatas.append(meta)
            new_ids.append(doc_id)

    if new_texts:
        collection.add(
            documents=new_texts,
            metadatas=new_metadatas,
            ids=new_ids,
        )
        logger.info("Added %d new documents to Chroma (skipped %d existing)",
                     len(new_texts), len(existing))
    else:
        logger.info("No new documents to add (all %d already exist)", len(ids))

    return len(new_texts)


def query_documents(
    query_text: str,
    n_results: int = 10,
    corridor_id: str | None = None,
) -> dict:
    """
    Query the documents collection by semantic similarity.
    
    Returns dict with keys: documents, metadatas, distances, ids
    """
    collection = get_collection()

    where_filter = None
    if corridor_id:
        where_filter = {"corridor_id": corridor_id}

    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where=where_filter,
    )

    return {
        "documents": results["documents"][0] if results["documents"] else [],
        "metadatas": results["metadatas"][0] if results["metadatas"] else [],
        "distances": results["distances"][0] if results["distances"] else [],
        "ids": results["ids"][0] if results["ids"] else [],
    }


def get_collection_count() -> int:
    """Return the total number of documents in the collection."""
    return get_collection().count()
