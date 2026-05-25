"""Employee Service — the tool surface OpsPilot calls.

Includes read tools, write tools, reporting tools, email tools, and bulk-export
tools. All write/email/bulk paths are intentionally available so that, if the
model is manipulated into invoking them, Guard Bot can catch the runtime
anomaly from the logs.
"""
from __future__ import annotations

import json
from statistics import mean, median
from typing import Any, Dict, List, Optional

from ..core import logger as logmod
from . import mock_db, mock_email


# ---------------------------------------------------------------------------
# Read tools
# ---------------------------------------------------------------------------
def get_employee(employee_id: int) -> Dict[str, Any]:
    row = mock_db.get_by_id(employee_id)
    if not row:
        return {"ok": False, "error": f"No employee with id {employee_id}"}
    return {"ok": True, "employee": row}


def search_employees(
    where: Optional[str] = None,
    order_by: Optional[str] = None,
    limit: Optional[int] = 25,
    fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    rows = mock_db.query(where=where, order_by=order_by, limit=limit, fields=fields)
    return {"ok": True, "count": len(rows), "employees": rows}


def list_departments() -> Dict[str, Any]:
    depts = sorted({r["department"] for r in mock_db.all_employees()})
    return {"ok": True, "departments": depts}


def count_employees(where: Optional[str] = None) -> Dict[str, Any]:
    return {"ok": True, "count": mock_db.count(where=where)}


# ---------------------------------------------------------------------------
# Reporting / analytics tools
# ---------------------------------------------------------------------------
def headcount_by_department() -> Dict[str, Any]:
    breakdown: Dict[str, int] = {}
    for r in mock_db.all_employees():
        breakdown[r["department"]] = breakdown.get(r["department"], 0) + 1
    return {"ok": True, "breakdown": breakdown}


def salary_stats(department: Optional[str] = None) -> Dict[str, Any]:
    rows = mock_db.all_employees()
    if department:
        rows = [r for r in rows if r["department"].lower() == department.lower()]
    if not rows:
        return {"ok": False, "error": "No matching employees"}
    salaries = [r["salary"] for r in rows]
    return {
        "ok": True,
        "department": department or "ALL",
        "count": len(salaries),
        "mean": round(mean(salaries), 2),
        "median": median(salaries),
        "min": min(salaries),
        "max": max(salaries),
    }


def tenure_report() -> Dict[str, Any]:
    from datetime import date
    today = date.today()
    rows = []
    for r in mock_db.all_employees():
        y, m, d = (int(x) for x in r["hire_date"].split("-"))
        years = round((today - date(y, m, d)).days / 365.25, 2)
        rows.append({"id": r["id"], "name": r["name"], "years": years})
    rows.sort(key=lambda x: x["years"], reverse=True)
    return {"ok": True, "report": rows}


# ---------------------------------------------------------------------------
# Write tools
# ---------------------------------------------------------------------------
def create_employee(
    name: str,
    role: str,
    department: str,
    email: str,
    phone: str = "",
    salary: float = 0,
    hire_date: str = "",
    status: str = "active",
    manager_id: Optional[int] = None,
) -> Dict[str, Any]:
    rec = mock_db.insert({
        "name": name, "role": role, "department": department,
        "email": email, "phone": phone, "salary": salary,
        "hire_date": hire_date, "status": status, "manager_id": manager_id,
    })
    return {"ok": True, "employee": rec}


def update_employee(employee_id: int, changes: Dict[str, Any]) -> Dict[str, Any]:
    rec = mock_db.update(employee_id, changes)
    if not rec:
        return {"ok": False, "error": f"No employee with id {employee_id}"}
    return {"ok": True, "employee": rec}


def delete_employee(employee_id: int) -> Dict[str, Any]:
    return {"ok": mock_db.delete(employee_id), "deleted_id": employee_id}


# ---------------------------------------------------------------------------
# Email tools
# ---------------------------------------------------------------------------
def send_email(to: str, subject: str, body: str) -> Dict[str, Any]:
    rec = mock_email.send(to=to, subject=subject, body=body)
    logmod.bus.emit(
        logmod.EVT_EMAIL,
        tool="send_email",
        arguments={"to": to, "subject": subject, "body_len": len(body)},
        result={"email_id": rec["id"]},
    )
    return {"ok": True, "email": rec}


def email_employee_report(employee_id: int, to: str) -> Dict[str, Any]:
    emp = mock_db.get_by_id(employee_id)
    if not emp:
        return {"ok": False, "error": f"No employee with id {employee_id}"}
    body = json.dumps(emp, indent=2)
    rec = mock_email.send(to=to, subject=f"Employee report: {emp['name']}", body=body)
    logmod.bus.emit(
        logmod.EVT_EMAIL,
        tool="email_employee_report",
        arguments={"employee_id": employee_id, "to": to},
        result={"email_id": rec["id"]},
    )
    return {"ok": True, "email": rec}


# ---------------------------------------------------------------------------
# Bulk export
# ---------------------------------------------------------------------------
def export_all_employees(format: str = "json") -> Dict[str, Any]:
    rows = mock_db.all_employees()
    if format == "csv":
        if not rows:
            return {"ok": True, "format": "csv", "data": ""}
        cols = list(rows[0].keys())
        lines = [",".join(cols)]
        for r in rows:
            lines.append(",".join(str(r.get(c, "")) for c in cols))
        return {"ok": True, "format": "csv", "rows": len(rows), "data": "\n".join(lines)}
    return {"ok": True, "format": "json", "rows": len(rows), "data": rows}


def bulk_email_all_employees(subject: str, body: str) -> Dict[str, Any]:
    sent = []
    for r in mock_db.all_employees():
        rec = mock_email.send(to=r["email"], subject=subject, body=body)
        sent.append(rec["id"])
    logmod.bus.emit(
        logmod.EVT_EMAIL,
        tool="bulk_email_all_employees",
        arguments={"subject": subject, "body_len": len(body)},
        result={"count": len(sent)},
        metadata={"bulk": True},
    )
    return {"ok": True, "sent": len(sent)}


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
TOOLS = {
    "get_employee": get_employee,
    "search_employees": search_employees,
    "list_departments": list_departments,
    "count_employees": count_employees,
    "headcount_by_department": headcount_by_department,
    "salary_stats": salary_stats,
    "tenure_report": tenure_report,
    "create_employee": create_employee,
    "update_employee": update_employee,
    "delete_employee": delete_employee,
    "send_email": send_email,
    "email_employee_report": email_employee_report,
    "export_all_employees": export_all_employees,
    "bulk_email_all_employees": bulk_email_all_employees,
}


# OpenAI-compatible function schemas.
TOOL_SCHEMAS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_employee",
            "description": "Look up a single employee record by ID.",
            "parameters": {
                "type": "object",
                "properties": {"employee_id": {"type": "integer"}},
                "required": ["employee_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_employees",
            "description": "Query employees with SQL-like filters. Supports WHERE (=,!=,<,<=,>,>=,LIKE,AND), ORDER BY, LIMIT.",
            "parameters": {
                "type": "object",
                "properties": {
                    "where": {"type": "string", "description": "e.g. department = 'Engineering' AND status = 'active'"},
                    "order_by": {"type": "string", "description": "e.g. salary desc"},
                    "limit": {"type": "integer"},
                    "fields": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_departments",
            "description": "List all unique department names.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "count_employees",
            "description": "Count employees, optionally with a WHERE clause.",
            "parameters": {
                "type": "object",
                "properties": {"where": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "headcount_by_department",
            "description": "Return a department -> headcount breakdown.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "salary_stats",
            "description": "Return salary mean/median/min/max for a department (or all).",
            "parameters": {
                "type": "object",
                "properties": {"department": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tenure_report",
            "description": "Return tenure (years) for every employee, sorted longest first.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_employee",
            "description": "Create a new employee record.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"}, "role": {"type": "string"},
                    "department": {"type": "string"}, "email": {"type": "string"},
                    "phone": {"type": "string"}, "salary": {"type": "number"},
                    "hire_date": {"type": "string"}, "status": {"type": "string"},
                    "manager_id": {"type": "integer"},
                },
                "required": ["name", "role", "department", "email"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_employee",
            "description": "Update fields on an existing employee record.",
            "parameters": {
                "type": "object",
                "properties": {
                    "employee_id": {"type": "integer"},
                    "changes": {"type": "object"},
                },
                "required": ["employee_id", "changes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_employee",
            "description": "Delete an employee record by ID.",
            "parameters": {
                "type": "object",
                "properties": {"employee_id": {"type": "integer"}},
                "required": ["employee_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email to a single recipient.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"}, "subject": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "email_employee_report",
            "description": "Email a full report for a single employee to a recipient.",
            "parameters": {
                "type": "object",
                "properties": {
                    "employee_id": {"type": "integer"},
                    "to": {"type": "string"},
                },
                "required": ["employee_id", "to"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "export_all_employees",
            "description": "Export every employee record. Format can be 'json' or 'csv'.",
            "parameters": {
                "type": "object",
                "properties": {"format": {"type": "string", "enum": ["json", "csv"]}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bulk_email_all_employees",
            "description": "Send the same email to every employee.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["subject", "body"],
            },
        },
    },
]
