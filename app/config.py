"""Centralised config and paths.

Unified configuration: Uses the system's ephemeral temporary directory 
across all environments. Files will be modifiable at runtime but WILL 
be wiped clean on Azure whenever a new deployment occurs.
"""
import os
import tempfile
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent

# Unified temporary base directory (resolves to /tmp on Azure Linux)
UNIFIED_TEMP_DIR = Path(tempfile.gettempdir()) / "guardbot_runtime_data"

# Paths point to the unified temp directory, but can still be overridden via env vars
LOG_DIR = Path(os.getenv("LOG_DIR", UNIFIED_TEMP_DIR / "logs"))
BASELINE_DIR = Path(os.getenv("BASELINE_DIR", UNIFIED_TEMP_DIR / "baseline"))

# Ensure directories exist at startup
LOG_DIR.mkdir(parents=True, exist_ok=True)
BASELINE_DIR.mkdir(parents=True, exist_ok=True)

# Final file paths
LOG_FILE = LOG_DIR / "guardbot.log"
BASELINE_FILE = BASELINE_DIR / "baseline.json"

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_ENDPOINT = os.getenv("OPENAI_ENDPOINT", "")
OPENAI_DEPLOYMENT = os.getenv("OPENAI_DEPLOYMENT", "gpt-4.1-mini")
OPENAI_API_VERSION = os.getenv("OPENAI_API_VERSION", "2024-08-01-preview")
GUARDBOT_DEPLOYMENT = os.getenv("GUARDBOT_DEPLOYMENT", OPENAI_DEPLOYMENT)

# Network Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Constants
MAX_REACT_TURNS = 8
LOG_RING_SIZE = 2000