import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def _fix_ssl():
    """Anaconda/Git Bash sometimes set SSL_CERT_FILE to a file that doesn't exist, which crashes
    the Gemini client before it sends anything. Remove such broken values."""
    for var, is_dir in (("SSL_CERT_FILE", False), ("SSL_CERT_DIR", True)):
        path = os.environ.get(var)
        if path and not (os.path.isdir(path) if is_dir else os.path.isfile(path)):
            os.environ.pop(var, None)

_fix_ssl()

def _f(name, default): return float(os.getenv(name, default))
def _i(name, default): return int(os.getenv(name, default))

class Settings:
    database_url = os.getenv("DATABASE_URL", "sqlite:///./tokenshield.db")
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    gemini_fallback_models = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "").split(",") if m.strip()]
    discord_webhook_url = os.getenv("DISCORD_WEBHOOK_URL", "")
    environment = os.getenv("ENVIRONMENT", "development")
    api_key = os.getenv("API_KEY", "development-key")
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    max_repeated_calls = _i("MAX_REPEATED_CALLS", 5)
    max_consecutive_failures = _i("MAX_CONSECUTIVE_FAILURES", 5)
    max_sequence_repeats = _i("MAX_SEQUENCE_REPEATS", 3)
    max_task_tokens = _i("MAX_TASK_TOKENS", 50000)
    max_task_cost = _f("MAX_TASK_COST", 2.00)
    max_task_duration_seconds = _i("MAX_TASK_DURATION_SECONDS", 600)
    incident_cooldown_seconds = _i("INCIDENT_COOLDOWN_SECONDS", 60)

settings = Settings()
