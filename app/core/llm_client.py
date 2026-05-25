"""Thin wrapper around the Azure OpenAI v1 (OpenAI-compatible) endpoint."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from openai import OpenAI

from .. import config


def _normalize_base_url(raw: str) -> str:
    """Accept any of:
        https://x.openai.azure.com
        https://x.openai.azure.com/openai/v1
        https://x.openai.azure.com/openai/v1/chat/completions
    and return:
        https://x.openai.azure.com/openai/v1
    """
    url = (raw or "").strip().rstrip("/")
    for suffix in ("/chat/completions", "/responses", "/embeddings"):
        if url.endswith(suffix):
            url = url[: -len(suffix)]
            break
    if not url.endswith("/openai/v1"):
        url = url + "/openai/v1"
    return url


_client: Optional[OpenAI] = None


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=_normalize_base_url(config.OPENAI_ENDPOINT),
        )
    return _client


def chat_with_tools(
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
    deployment: Optional[str] = None,
    temperature: float = 0.2,
) -> Any:
    resp = client().chat.completions.create(
        model=(deployment or config.OPENAI_DEPLOYMENT).strip(),
        messages=messages,
        tools=tools,
        tool_choice="auto",
        temperature=temperature,
    )
    return resp.choices[0].message


def chat_json(
    messages: List[Dict[str, Any]],
    deployment: Optional[str] = None,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    resp = client().chat.completions.create(
        model=(deployment or config.GUARDBOT_DEPLOYMENT).strip(),
        messages=messages,
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw, "_parse_error": True}
