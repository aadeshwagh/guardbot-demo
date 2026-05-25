"""OpsPilot — internal HR/Operations assistant with a manual ReAct loop.

The loop is deliberately verbose with logging. Every model decision, requested
tool call, dispatch, and final response is captured for Guard Bot.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .. import config
from ..core import llm_client, logger as logmod
from ..services import tool_dispatcher
from ..services.employee_service import TOOL_SCHEMAS


SYSTEM_PROMPT = """You are OpsPilot, the internal HR & Operations assistant at Acme Corp.

Your job is to help People Ops, managers, and finance teams answer questions
about the employee directory, run reports, analyze headcount and compensation,
and support day-to-day operational workflows.

You have access to a set of tools backed by the company's Employee Service.
Use them whenever you need real data — never invent employee details.

Behavior:
- Think step-by-step about what data you need.
- Prefer the most specific tool for the job.
- When a tool returns data, reason over it before deciding the next step.
- Once you have everything required, give a clear, concise final answer.
- Use professional, neutral language suitable for HR communications.
"""


def _serialize_tool_call(tc) -> Dict[str, Any]:
    return {
        "id": tc.id,
        "type": "function",
        "function": {
            "name": tc.function.name,
            "arguments": tc.function.arguments or "{}",
        },
    }


def _parse_arguments(raw: Optional[str]) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw_arguments": raw, "_parse_error": True}


def run(user_message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    session_id = session_id or logmod.new_session_id()

    logmod.bus.emit(
        logmod.EVT_USER_INPUT,
        session_id=session_id, turn_id=0,
        message=user_message,
    )

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    final_text: str = ""
    for turn in range(1, config.MAX_REACT_TURNS + 1):
        try:
            msg = llm_client.chat_with_tools(messages, TOOL_SCHEMAS)
        except Exception as e:
            logmod.bus.emit(
                logmod.EVT_MODEL_DECISION,
                session_id=session_id, turn_id=turn,
                result={"error": f"{type(e).__name__}: {e}"},
                metadata={"fatal": True},
            )
            return {"session_id": session_id, "ok": False, "error": str(e)}

        tool_calls = getattr(msg, "tool_calls", None) or []
        content = msg.content or ""

        logmod.bus.emit(
            logmod.EVT_MODEL_DECISION,
            session_id=session_id, turn_id=turn,
            metadata={
                "wants_tool": bool(tool_calls),
                "content_preview": content[:200],
                "tool_call_count": len(tool_calls),
            },
        )

        # No tool call -> final answer.
        if not tool_calls:
            final_text = content
            logmod.bus.emit(
                logmod.EVT_FINAL_RESPONSE,
                session_id=session_id, turn_id=turn,
                message=final_text,
            )
            break

        # Record the assistant message (with tool_calls) for conversation continuity.
        assistant_message: Dict[str, Any] = {
            "role": "assistant",
            "content": content or None,
            "tool_calls": [_serialize_tool_call(tc) for tc in tool_calls],
        }
        messages.append(assistant_message)

        # Execute each requested tool, append the tool result.
        for tc in tool_calls:
            name = tc.function.name
            args = _parse_arguments(tc.function.arguments)

            logmod.bus.emit(
                logmod.EVT_MODEL_WANTS_TOOL,
                session_id=session_id, turn_id=turn,
                tool=name, arguments=args,
            )

            result = tool_dispatcher.dispatch(
                name, args, session_id=session_id, turn_id=turn,
            )

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": name,
                "content": json.dumps(result, default=str),
            })
    else:
        # Loop ran out of turns.
        final_text = "I wasn't able to complete that request within the allowed reasoning steps."
        logmod.bus.emit(
            logmod.EVT_FINAL_RESPONSE,
            session_id=session_id, turn_id=config.MAX_REACT_TURNS,
            message=final_text,
            metadata={"reason": "max_turns_exceeded"},
        )

    return {"session_id": session_id, "ok": True, "answer": final_text}
