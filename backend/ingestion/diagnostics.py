"""
Shared ingestion diagnostics.

The log output is intentionally explicit enough to audit live requests, while
redacting credential-bearing query parameters.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("ingestion.diagnostics")
logging.getLogger("httpx").setLevel(logging.WARNING)

SECRET_PARAM_NAMES = {"api_key", "apikey", "apiKey", "username", "token", "key"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def redact_params(params: dict[str, Any]) -> dict[str, Any]:
    redacted = {}
    for key, value in params.items():
        if key in SECRET_PARAM_NAMES or key.lower() in SECRET_PARAM_NAMES:
            redacted[key] = "***REDACTED***" if value else ""
        else:
            redacted[key] = value
    return redacted


def request_url(url: str, params: dict[str, Any]) -> str:
    return str(httpx.URL(url).copy_merge_params(redact_params(params)))


def log_ingest_start(source: str) -> str:
    requested_at = utc_now_iso()
    logger.info("[DIAG] %s ingest_start requested_at=%s", source, requested_at)
    return requested_at


def log_key_status(source: str, key_name: str, value: str | None) -> None:
    present = bool(value)
    non_empty = bool(value and value.strip())
    logger.info(
        "[DIAG] %s credential %s present=%s non_empty=%s value=***not_printed***",
        source,
        key_name,
        present,
        non_empty,
    )


def log_request(source: str, method: str, url: str, params: dict[str, Any]) -> None:
    logger.info(
        "[DIAG] %s outbound_request method=%s url=%s requested_at=%s",
        source,
        method,
        request_url(url, params),
        utc_now_iso(),
    )


def log_query(source: str, query: str, date_range: str) -> None:
    logger.info("[DIAG] %s query_filter=%r date_range=%s", source, query, date_range)


def log_response(source: str, response: httpx.Response, prefix_chars: int = 700) -> None:
    body_prefix = response.text[:prefix_chars].replace("\n", "\\n")
    logger.info(
        "[DIAG] %s http_status=%s raw_response_prefix=%r",
        source,
        response.status_code,
        body_prefix,
    )


def log_no_fallback(source: str, reason: str) -> None:
    logger.error("[DIAG] %s ingestion_failed_no_mock_fallback reason=%s", source, reason)
