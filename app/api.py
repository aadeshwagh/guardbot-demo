"""FastAPI surface for OpsPilot and Guard Bot.

Endpoints:
  POST /ask                — run an OpsPilot turn
  GET  /logs/stream        — tails logs/guardbot.log forever; one stream, raw JSON lines

  POST /baseline/train     — read logs/guardbot.log and generate baseline.json
  GET  /baseline           — read current baseline
  POST /monitor/start      — start the LLM-driven live monitor (requires baseline)
  POST /monitor/stop       — stop the monitor
  GET  /monitor/status     — monitor health + recent alerts
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import config
from .agents import guardbot, opspilot


app = FastAPI(title="Guard Bot Demo", version="0.1.0")

# Permissive CORS for the demo UI (Next.js dev server on :3000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class AskResponse(BaseModel):
    session_id: str
    ok: bool
    answer: Optional[str] = None
    error: Optional[str] = None


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    return {"ok": True}


# ---------------------------------------------------------------------------
# Agents — exposes the real OpsPilot agent metadata so the UI can render it.
# ---------------------------------------------------------------------------
@app.get("/agents")
def agents_list() -> Dict[str, Any]:
    bl = guardbot.load_baseline()
    return {
        "agents": [
            {
                "id": "opspilot-prod",
                "name": "OpsPilot",
                "version": "v1.0",
                "status": "baselined" if bl else "awaiting",
                "system_prompt": opspilot.SYSTEM_PROMPT,
                "baseline": bl,
            }
        ]
    }


# ---------------------------------------------------------------------------
# OpsPilot
# ---------------------------------------------------------------------------
@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    result = await asyncio.to_thread(opspilot.run, req.message, req.session_id)
    return AskResponse(**result)


# ---------------------------------------------------------------------------
# Logs — one streaming endpoint that tails the file
# ---------------------------------------------------------------------------
async def _tail_log_file(path: Path, from_start: bool = False):
    """Yield log lines as they are appended.

    By default this seeks to the end of the file and only emits new lines,
    so reconnecting clients always start with a fresh view.
    Pass `from_start=True` to replay the entire file first.
    """
    while not path.exists():
        await asyncio.sleep(0.3)
    with open(path, "r", encoding="utf-8") as f:
        if not from_start:
            f.seek(0, 2)  # SEEK_END
        while True:
            line = f.readline()
            if line:
                yield line
            else:
                await asyncio.sleep(0.3)


@app.get("/logs/stream")
async def logs_stream(from_start: bool = False):
    """Continuous newline-delimited JSON stream of guardbot.log.

    Query params:
        from_start (bool, default false): if true, replay the whole file first.
    """
    async def gen():
        async for line in _tail_log_file(config.LOG_FILE, from_start=from_start):
            yield line
    return StreamingResponse(gen(), media_type="application/x-ndjson")


# ---------------------------------------------------------------------------
# Guard Bot — baseline
# ---------------------------------------------------------------------------
@app.post("/baseline/train")
async def baseline_train() -> Dict[str, Any]:
    result = await asyncio.to_thread(guardbot.train_baseline)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "baseline failed"))
    return result


@app.get("/baseline")
def baseline_get() -> Dict[str, Any]:
    bl = guardbot.load_baseline()
    if bl is None:
        raise HTTPException(status_code=404, detail="No baseline yet. POST /baseline/train.")
    return bl


# ---------------------------------------------------------------------------
# Guard Bot — live monitor
# ---------------------------------------------------------------------------
@app.post("/monitor/start")
async def monitor_start() -> Dict[str, Any]:
    result = await guardbot.monitor.start()
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/monitor/stop")
async def monitor_stop() -> Dict[str, Any]:
    return await guardbot.monitor.stop()


@app.get("/monitor/status")
def monitor_status() -> Dict[str, Any]:
    return guardbot.monitor.status()


# ---------------------------------------------------------------------------
# Incidents — derived from SECURITY_EVENT entries in the log file.
# ---------------------------------------------------------------------------
def _read_all_log_records() -> List[Dict[str, Any]]:
    if not config.LOG_FILE.exists():
        return []
    out: List[Dict[str, Any]] = []
    with open(config.LOG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def _format_trace_step(e: Dict[str, Any]) -> str:
    evt = e.get("event")
    ts = (e.get("ts") or "")[11:19]
    if evt == "USER_INPUT":
        return f"[{ts}] USER: {(e.get('message') or '')[:240]}"
    if evt == "MODEL_DECISION":
        meta = e.get("metadata") or {}
        wants = meta.get("wants_tool")
        preview = (meta.get("content_preview") or "")[:160]
        return f"[{ts}] MODEL: wants_tool={wants}  {preview}"
    if evt == "MODEL_WANTS_TOOL":
        args = e.get("arguments") or {}
        try:
            args_str = json.dumps(args, default=str)[:200]
        except Exception:
            args_str = str(args)[:200]
        return f"[{ts}] MODEL → TOOL: {e.get('tool')}({args_str})"
    if evt == "TOOL_DISPATCH":
        return f"[{ts}] DISPATCH: {e.get('tool')}"
    if evt == "TOOL_RESULT":
        result = e.get("result")
        try:
            result_str = json.dumps(result, default=str)[:200]
        except Exception:
            result_str = str(result)[:200]
        return f"[{ts}] TOOL_RESULT [{e.get('tool')}]: {result_str}"
    if evt == "DB_FALLBACK":
        return f"[{ts}] DB_FALLBACK: {e.get('tool')}"
    if evt == "TOOL_UNKNOWN":
        return f"[{ts}] TOOL_UNKNOWN: {e.get('tool')}"
    if evt == "EMAIL":
        args = e.get("arguments") or {}
        return f"[{ts}] EMAIL: tool={e.get('tool')} to={args.get('to')}"
    if evt == "FINAL_RESPONSE":
        return f"[{ts}] FINAL: {(e.get('message') or '')[:200]}"
    if evt == "SECURITY_EVENT":
        risk = e.get("risk") or {}
        return (
            f"[{ts}] ALERT: rule={risk.get('rule')} severity={risk.get('severity')} "
            f"score={risk.get('score')} — {e.get('message')}"
        )
    return f"[{ts}] {evt}"


def _severity_to_label(sev: Optional[str]) -> str:
    sev = (sev or "").lower()
    if sev == "high":
        return "critical"
    if sev == "medium":
        return "warning"
    return "info"


@app.get("/incidents")
def incidents_list(limit: int = 100) -> Dict[str, Any]:
    """Return SECURITY_EVENT incidents derived from the log file, newest first."""
    all_events = _read_all_log_records()
    incidents: List[Dict[str, Any]] = []
    for i, ev in enumerate(all_events):
        if ev.get("event") != "SECURITY_EVENT":
            continue
        session_id = ev.get("session_id")

        # Forensic trace: events from the same session, up to and including this alert.
        # If session is missing, fall back to a small window of preceding events.
        related = [
            e
            for e in all_events[: i + 1]
            if session_id and e.get("session_id") == session_id
        ]
        if not related:
            related = all_events[max(0, i - 6) : i + 1]

        risk = ev.get("risk") or {}
        incidents.append({
            "id": ev.get("id"),
            "ts": ev.get("ts"),
            "session_id": session_id,
            "agent": "OpsPilot",
            "tool": ev.get("tool"),
            "rule": risk.get("rule") or "unspecified_rule",
            "severity": risk.get("severity"),
            "severity_label": _severity_to_label(risk.get("severity")),
            "score": risk.get("score"),
            "message": ev.get("message"),
            "thinking_log": [_format_trace_step(e) for e in related],
        })

    # newest first, capped
    incidents.reverse()
    return {"count": len(incidents), "incidents": incidents[:limit]}
