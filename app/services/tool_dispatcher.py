"""ToolDispatcher — primary path is Employee Service; falls back to MockDatabase.

Every dispatch is logged. Unknown tools, fallbacks, and execution errors all
produce structured events so Guard Bot can reason over them.
"""
from __future__ import annotations

import inspect
from typing import Any, Dict, Optional

from ..core import logger as logmod
from . import employee_service, mock_db


# A few read-only operations the dispatcher can satisfy directly from the DB
# if the Employee Service ever fails — this is what makes "fallback" meaningful.
DB_FALLBACK_TOOLS = {
    "get_employee": lambda employee_id: {"ok": True, "employee": mock_db.get_by_id(int(employee_id))},
    "search_employees": lambda **kw: {
        "ok": True,
        "employees": mock_db.query(
            where=kw.get("where"),
            order_by=kw.get("order_by"),
            limit=kw.get("limit", 25),
            fields=kw.get("fields"),
        ),
    },
    "count_employees": lambda where=None: {"ok": True, "count": mock_db.count(where=where)},
    "list_departments": lambda: {"ok": True, "departments": sorted({r["department"] for r in mock_db.all_employees()})},
}


def _safe_call(fn, arguments: Dict[str, Any]) -> Any:
    """Call fn with whatever subset of arguments it accepts."""
    sig = inspect.signature(fn)
    accepted_kwargs = {k: v for k, v in arguments.items() if k in sig.parameters}
    return fn(**accepted_kwargs)


def dispatch(
    tool_name: str,
    arguments: Optional[Dict[str, Any]],
    *,
    session_id: str,
    turn_id: int,
) -> Dict[str, Any]:
    arguments = arguments or {}

    logmod.bus.emit(
        logmod.EVT_TOOL_DISPATCH,
        session_id=session_id, turn_id=turn_id,
        tool=tool_name, arguments=arguments,
    )

    # 1. Try Employee Service first.
    fn = employee_service.TOOLS.get(tool_name)
    if fn is not None:
        logmod.bus.emit(
            logmod.EVT_TOOL_EXECUTING,
            session_id=session_id, turn_id=turn_id,
            tool=tool_name, arguments=arguments,
            metadata={"source": "employee_service"},
        )
        try:
            result = _safe_call(fn, arguments)
            logmod.bus.emit(
                logmod.EVT_TOOL_RESULT,
                session_id=session_id, turn_id=turn_id,
                tool=tool_name, arguments=arguments, result=result,
                metadata={"source": "employee_service"},
            )
            return result
        except Exception as e:
            logmod.bus.emit(
                logmod.EVT_TOOL_RESULT,
                session_id=session_id, turn_id=turn_id,
                tool=tool_name, arguments=arguments,
                result={"ok": False, "error": f"{type(e).__name__}: {e}"},
                metadata={"source": "employee_service", "exception": True},
            )
            # fall through to DB fallback if available

    # 2. Fallback to mock DB.
    fb = DB_FALLBACK_TOOLS.get(tool_name)
    if fb is not None:
        logmod.bus.emit(
            logmod.EVT_DB_FALLBACK,
            session_id=session_id, turn_id=turn_id,
            tool=tool_name, arguments=arguments,
            metadata={"reason": "employee_service_unavailable_or_failed"},
        )
        logmod.bus.emit(
            logmod.EVT_TOOL_EXECUTING,
            session_id=session_id, turn_id=turn_id,
            tool=tool_name, arguments=arguments,
            metadata={"source": "mock_db"},
        )
        try:
            result = _safe_call(fb, arguments)
            logmod.bus.emit(
                logmod.EVT_TOOL_RESULT,
                session_id=session_id, turn_id=turn_id,
                tool=tool_name, arguments=arguments, result=result,
                metadata={"source": "mock_db"},
            )
            return result
        except Exception as e:
            result = {"ok": False, "error": f"{type(e).__name__}: {e}"}
            logmod.bus.emit(
                logmod.EVT_TOOL_RESULT,
                session_id=session_id, turn_id=turn_id,
                tool=tool_name, arguments=arguments, result=result,
                metadata={"source": "mock_db", "exception": True},
            )
            return result

    # 3. Unknown tool.
    logmod.bus.emit(
        logmod.EVT_TOOL_UNKNOWN,
        session_id=session_id, turn_id=turn_id,
        tool=tool_name, arguments=arguments,
        risk={"reason": "unknown_tool", "severity": "medium"},
    )
    return {"ok": False, "error": f"Unknown tool: {tool_name}"}
