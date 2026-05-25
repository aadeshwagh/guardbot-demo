"""Entry point: `python main.py` or `uvicorn app.api:app --reload`."""
from __future__ import annotations

import uvicorn

from app import config


if __name__ == "__main__":
    uvicorn.run(
        "app.api:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="warning",  # keep uvicorn quiet; all our events go to logs/guardbot.log
    )
