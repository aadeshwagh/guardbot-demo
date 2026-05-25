"""In-memory employee database with a small SQL-like query layer.

Supports: WHERE (=, !=, <, <=, >, >=, LIKE, AND), ORDER BY (asc/desc), LIMIT.
This is intentionally small and dependency-free.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# --- Seed data --------------------------------------------------------------
EMPLOYEES: List[Dict[str, Any]] = [
    {"id": 1001, "name": "Alice Carter", "role": "Senior Engineer", "department": "Engineering", "email": "alice.carter@acme.io", "phone": "+1-415-555-0101", "salary": 165000, "hire_date": "2019-03-12", "status": "active", "manager_id": 2001},
    {"id": 1002, "name": "Bryan Lee", "role": "Engineer", "department": "Engineering", "email": "bryan.lee@acme.io", "phone": "+1-415-555-0102", "salary": 138000, "hire_date": "2021-07-01", "status": "active", "manager_id": 2001},
    {"id": 1003, "name": "Carla Diaz", "role": "Engineering Manager", "department": "Engineering", "email": "carla.diaz@acme.io", "phone": "+1-415-555-0103", "salary": 215000, "hire_date": "2017-11-20", "status": "active", "manager_id": 2002},
    {"id": 1004, "name": "Dmitri Volkov", "role": "Staff Engineer", "department": "Engineering", "email": "dmitri.volkov@acme.io", "phone": "+1-415-555-0104", "salary": 198000, "hire_date": "2018-05-30", "status": "active", "manager_id": 2001},
    {"id": 1005, "name": "Elena Park", "role": "Engineer", "department": "Engineering", "email": "elena.park@acme.io", "phone": "+1-415-555-0105", "salary": 142000, "hire_date": "2022-02-14", "status": "active", "manager_id": 2001},
    {"id": 1006, "name": "Frank O'Neil", "role": "HR Business Partner", "department": "People Ops", "email": "frank.oneil@acme.io", "phone": "+1-415-555-0106", "salary": 128000, "hire_date": "2020-08-22", "status": "active", "manager_id": 2003},
    {"id": 1007, "name": "Grace Kim", "role": "Recruiter", "department": "People Ops", "email": "grace.kim@acme.io", "phone": "+1-415-555-0107", "salary": 96000, "hire_date": "2023-01-09", "status": "active", "manager_id": 2003},
    {"id": 1008, "name": "Hassan Reza", "role": "Payroll Specialist", "department": "Finance", "email": "hassan.reza@acme.io", "phone": "+1-415-555-0108", "salary": 102000, "hire_date": "2019-10-15", "status": "active", "manager_id": 2004},
    {"id": 1009, "name": "Ivy Sun", "role": "Financial Analyst", "department": "Finance", "email": "ivy.sun@acme.io", "phone": "+1-415-555-0109", "salary": 118000, "hire_date": "2021-04-19", "status": "active", "manager_id": 2004},
    {"id": 1010, "name": "Jonas Weber", "role": "Sales Director", "department": "Sales", "email": "jonas.weber@acme.io", "phone": "+1-415-555-0110", "salary": 205000, "hire_date": "2016-06-01", "status": "active", "manager_id": 2005},
    {"id": 1011, "name": "Kira Patel", "role": "Account Executive", "department": "Sales", "email": "kira.patel@acme.io", "phone": "+1-415-555-0111", "salary": 134000, "hire_date": "2022-11-03", "status": "active", "manager_id": 1010},
    {"id": 1012, "name": "Liam Murphy", "role": "Account Executive", "department": "Sales", "email": "liam.murphy@acme.io", "phone": "+1-415-555-0112", "salary": 129000, "hire_date": "2023-03-28", "status": "active", "manager_id": 1010},
    {"id": 1013, "name": "Maya Singh", "role": "Product Manager", "department": "Product", "email": "maya.singh@acme.io", "phone": "+1-415-555-0113", "salary": 172000, "hire_date": "2020-01-13", "status": "active", "manager_id": 2006},
    {"id": 1014, "name": "Noah Adams", "role": "Designer", "department": "Product", "email": "noah.adams@acme.io", "phone": "+1-415-555-0114", "salary": 124000, "hire_date": "2022-09-05", "status": "active", "manager_id": 2006},
    {"id": 1015, "name": "Olivia Brooks", "role": "Engineer", "department": "Engineering", "email": "olivia.brooks@acme.io", "phone": "+1-415-555-0115", "salary": 141000, "hire_date": "2023-06-19", "status": "on_leave", "manager_id": 1003},
    {"id": 1016, "name": "Pedro Alvarez", "role": "DevOps Engineer", "department": "Engineering", "email": "pedro.alvarez@acme.io", "phone": "+1-415-555-0116", "salary": 152000, "hire_date": "2021-12-02", "status": "active", "manager_id": 1003},
    {"id": 1017, "name": "Quinn Rivera", "role": "Marketing Manager", "department": "Marketing", "email": "quinn.rivera@acme.io", "phone": "+1-415-555-0117", "salary": 138000, "hire_date": "2020-05-25", "status": "active", "manager_id": 2007},
    {"id": 1018, "name": "Ravi Mehta", "role": "Engineer", "department": "Engineering", "email": "ravi.mehta@acme.io", "phone": "+1-415-555-0118", "salary": 145000, "hire_date": "2022-04-11", "status": "terminated", "manager_id": 1003},
    {"id": 1019, "name": "Sofia Costa", "role": "Legal Counsel", "department": "Legal", "email": "sofia.costa@acme.io", "phone": "+1-415-555-0119", "salary": 188000, "hire_date": "2019-09-09", "status": "active", "manager_id": 2008},
    {"id": 1020, "name": "Theo Nguyen", "role": "Data Engineer", "department": "Engineering", "email": "theo.nguyen@acme.io", "phone": "+1-415-555-0120", "salary": 156000, "hire_date": "2021-08-17", "status": "active", "manager_id": 1003},
]


# --- Query parser -----------------------------------------------------------
_OPS = ["<=", ">=", "!=", "=", "<", ">"]


def _coerce(value: str) -> Any:
    v = value.strip()
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        return v[1:-1]
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    if re.fullmatch(r"-?\d+\.\d+", v):
        return float(v)
    return v


def _like_to_regex(pattern: str) -> re.Pattern:
    escaped = re.escape(pattern).replace("%", ".*").replace("_", ".")
    return re.compile("^" + escaped + "$", re.IGNORECASE)


def _match_clause(row: Dict[str, Any], clause: str) -> bool:
    clause = clause.strip()
    # LIKE
    m = re.match(r"(\w+)\s+LIKE\s+(.+)", clause, re.IGNORECASE)
    if m:
        field, pat = m.group(1), _coerce(m.group(2))
        return bool(_like_to_regex(str(pat)).match(str(row.get(field, ""))))
    for op in _OPS:
        if op in clause:
            field, raw = clause.split(op, 1)
            field, raw = field.strip(), _coerce(raw)
            cell = row.get(field)
            if op == "=":
                return cell == raw
            if op == "!=":
                return cell != raw
            try:
                if op == "<":
                    return cell < raw
                if op == "<=":
                    return cell <= raw
                if op == ">":
                    return cell > raw
                if op == ">=":
                    return cell >= raw
            except TypeError:
                return False
    return True


def _matches_where(row: Dict[str, Any], where: str) -> bool:
    # Only AND is supported — good enough for the demo without inviting injection surprises.
    parts = re.split(r"\s+AND\s+", where, flags=re.IGNORECASE)
    return all(_match_clause(row, p) for p in parts if p.strip())


def _parse_order(order_by: str) -> Tuple[str, bool]:
    tokens = order_by.strip().split()
    field = tokens[0]
    desc = len(tokens) > 1 and tokens[1].lower() == "desc"
    return field, desc


# --- Public API -------------------------------------------------------------
def query(
    where: Optional[str] = None,
    order_by: Optional[str] = None,
    limit: Optional[int] = None,
    fields: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    rows = [r.copy() for r in EMPLOYEES]
    if where:
        rows = [r for r in rows if _matches_where(r, where)]
    if order_by:
        field, desc = _parse_order(order_by)
        rows.sort(key=lambda r: (r.get(field) is None, r.get(field)), reverse=desc)
    if limit is not None:
        rows = rows[: int(limit)]
    if fields:
        rows = [{k: r.get(k) for k in fields} for r in rows]
    return rows


def get_by_id(employee_id: int) -> Optional[Dict[str, Any]]:
    for r in EMPLOYEES:
        if r["id"] == int(employee_id):
            return r.copy()
    return None


def insert(record: Dict[str, Any]) -> Dict[str, Any]:
    new_id = max((r["id"] for r in EMPLOYEES), default=1000) + 1
    record = {**record, "id": new_id}
    EMPLOYEES.append(record)
    return record.copy()


def update(employee_id: int, changes: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for r in EMPLOYEES:
        if r["id"] == int(employee_id):
            r.update(changes)
            return r.copy()
    return None


def delete(employee_id: int) -> bool:
    for i, r in enumerate(EMPLOYEES):
        if r["id"] == int(employee_id):
            EMPLOYEES.pop(i)
            return True
    return False


def count(where: Optional[str] = None) -> int:
    return len(query(where=where))


def all_employees() -> List[Dict[str, Any]]:
    return [r.copy() for r in EMPLOYEES]
