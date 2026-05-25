"""Structured logging for runtime governance.

Every internal event is written as a single JSON line to logs/guardbot.log,
mirrored to an in-memory ring buffer, and broadcast to async subscribers
(Guard Bot, SSE endpoints, etc.).

Nothing logged here ever goes to stdout — only user-facing API responses do.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, AsyncIterator, Deque, Dict, List, Optional

from .. import config

# ---------------------------------------------------------------------------
# Event types — keep in one place so Guard Bot can reference them by name.
# ---------------------------------------------------------------------------
EVT_USER_INPUT = "USER_INPUT"
EVT_MODEL_DECISION = "MODEL_DECISION"
EVT_MODEL_WANTS_TOOL = "MODEL_WANTS_TOOL"
EVT_TOOL_DISPATCH = "TOOL_DISPATCH"
EVT_TOOL_EXECUTING = "TOOL_EXECUTING"
EVT_TOOL_RESULT = "TOOL_RESULT"
EVT_TOOL_UNKNOWN = "TOOL_UNKNOWN"
EVT_DB_FALLBACK = "DB_FALLBACK"
EVT_EMAIL = "EMAIL"
EVT_FINAL_RESPONSE = "FINAL_RESPONSE"
EVT_SECURITY_EVENT = "SECURITY_EVENT"
EVT_BASELINE = "BASELINE"
EVT_MONITOR = "MONITOR"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventBus:
    """File-backed, in-memory, async pub-sub for governance events."""

    def __init__(self, log_path, ring_size: int = 2000):
        self.log_path = log_path
        self.ring: Deque[Dict[str, Any]] = deque(maxlen=ring_size)
        self._lock = Lock()
        self._subscribers: List[asyncio.Queue] = []
        self._sub_lock = asyncio.Lock()
        self._fh = open(self.log_path, "a", buffering=1, encoding="utf-8")

    def emit(
        self,
        event_type: str,
        *,
        session_id: Optional[str] = None,
        turn_id: Optional[int] = None,
        tool: Optional[str] = None,
        arguments: Optional[Dict[str, Any]] = None,
        result: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
        risk: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        record: Dict[str, Any] = {
            "ts": _now_iso(),
            "epoch": time.time(),
            "event": event_type,
            "session_id": session_id,
            "turn_id": turn_id,
            "tool": tool,
            "arguments": arguments,
            "result": _truncate(result),
            "metadata": metadata or {},
            "risk": risk,
            "message": message,
            "id": uuid.uuid4().hex,
        }

        with self._lock:
            self._fh.write(json.dumps(record, default=str) + "\n")
            self.ring.append(record)

        for q in list(self._subscribers):
            try:
                q.put_nowait(record)
            except asyncio.QueueFull:
                pass
        return record

    def history(self, limit: int = 200, event_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        with self._lock:
            data = list(self.ring)
        if event_types:
            data = [r for r in data if r.get("event") in event_types]
        return data[-limit:]

    def all_records(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.ring)

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        async with self._sub_lock:
            self._subscribers.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._sub_lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    async def stream(self) -> AsyncIterator[Dict[str, Any]]:
        q = await self.subscribe()
        try:
            while True:
                record = await q.get()
                yield record
        finally:
            await self.unsubscribe(q)


def _truncate(value: Any, max_len: int = 4000) -> Any:
    try:
        encoded = json.dumps(value, default=str)
    except Exception:
        return str(value)[:max_len]
    if len(encoded) <= max_len:
        return value
    return {"_truncated": True, "preview": encoded[:max_len]}


bus = EventBus(config.LOG_FILE, ring_size=config.LOG_RING_SIZE)


def new_session_id() -> str:
    return "sess-" + uuid.uuid4().hex[:10]
