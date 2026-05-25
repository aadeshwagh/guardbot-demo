"""Centralised config and paths.

On Azure App Service (Linux), `/home` is a persistent mounted share. Set
`LOG_DIR=/home/data/logs` and `BASELINE_DIR=/home/data/baseline` so the log file
and baseline JSON survive restarts and redeploys.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent

# Default to repo-local paths for dev. Override with env vars in production.
LOG_DIR = Path(os.getenv("LOG_DIR", ROOT_DIR / "logs"))
BASELINE_DIR = Path(os.getenv("BASELINE_DIR", ROOT_DIR / "baseline"))
LOG_DIR.mkdir(parents=True, exist_ok=True)
BASELINE_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "guardbot.log"
BASELINE_FILE = BASELINE_DIR / "baseline.json"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_ENDPOINT = os.getenv("OPENAI_ENDPOINT", "")
OPENAI_DEPLOYMENT = os.getenv("OPENAI_DEPLOYMENT", "gpt-4.1-mini")
OPENAI_API_VERSION = os.getenv("OPENAI_API_VERSION", "2024-08-01-preview")
GUARDBOT_DEPLOYMENT = os.getenv("GUARDBOT_DEPLOYMENT", OPENAI_DEPLOYMENT)

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

MAX_REACT_TURNS = 8
LOG_RING_SIZE = 2000
