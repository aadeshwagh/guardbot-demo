"""Mock outbound email system. Emails are buffered for inspection."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

OUTBOX: List[Dict[str, Any]] = []


def send(to: str, subject: str, body: str, attachments: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    record = {
        "id": "email-" + uuid.uuid4().hex[:8],
        "to": to,
        "subject": subject,
        "body": body,
        "attachments": attachments or [],
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    OUTBOX.append(record)
    return record


def outbox() -> List[Dict[str, Any]]:
    return list(OUTBOX)
