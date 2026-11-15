"""Gemini EXPLAINS incidents that the rule engine already detected. It never detects,
never executes fixes, and never receives API keys, raw tool arguments or prompts.
If Gemini fails for any reason, the rule-based incident is kept untouched."""
import json
import re
import threading
from typing import Callable, Literal
from pydantic import BaseModel, Field, field_validator
from app.core.config import settings


class GeminiAnalysis(BaseModel):
    summary: str
    probable_root_cause: str
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float = Field(ge=0, le=1)
    evidence: list[str]
    recommended_actions: list[str]
    estimated_wasted_resources: str
    additional_investigation: list[str]

    @field_validator("severity", mode="before")
    @classmethod
    def _lower(cls, v):
        return str(v).lower().strip()

    @field_validator("confidence", mode="before")
    @classmethod
    def _conf(cls, v):
        v = float(v)
        return v / 100 if v > 1 else v  # tolerate "85" meaning 85%


_SECRET = re.compile(r"(AIza[0-9A-Za-z_\-]{20,}|sk-[0-9A-Za-z_\-]{16,}|Bearer\s+\S+|"
                     r"(api[_-]?key|token|secret|password)\s*[=:]\s*\S+)", re.I)


def redact(text, limit=200):
    return _SECRET.sub("[REDACTED]", str(text))[:limit]


def _clean(obj):
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return redact(obj) if isinstance(obj, str) else obj


def build_prompt(incident: dict) -> str:
    safe = _clean(incident)
    return (
        "You are an SRE assistant explaining an incident in an AI-agent monitoring tool.\n"
        "A rule-based detector ALREADY flagged this incident; do not question whether it happened.\n"
        "All dollar figures are ESTIMATES from a pricing table, not real provider billing.\n"
        "Use ONLY the data below. If evidence is insufficient, say so and lower your confidence.\n"
        "Respond with a single JSON object with exactly these keys:\n"
        'summary (string), probable_root_cause (string), severity ("low"|"medium"|"high"|"critical"), '
        "confidence (number 0 to 1), evidence (list of strings), recommended_actions (list of strings; "
        "suggestions for a human, nothing is auto-executed), estimated_wasted_resources (string, say it is an estimate), "
        "additional_investigation (list of strings).\n\n"
        "INCIDENT DATA:\n" + json.dumps(safe, indent=2, default=str))

def _client():
    from google import genai  # lazy import so the app runs without the SDK/key
    opts = {"timeout": 20000}  # ms: never hang on one request
    try:
        return genai.Client(api_key=settings.gemini_api_key,
                            http_options={**opts, "retry_options": {"attempts": 1}})
    except Exception:
        return genai.Client(api_key=settings.gemini_api_key, http_options=opts)


def _status(exc):
    return getattr(exc, "code", None) or getattr(exc, "status_code", None)


def call_gemini(prompt: str) -> str:
    """Per model: retry busy errors (429/5xx) with short backoff. Timeouts and other errors skip
    straight to the next fallback model, so a hanging model can't stall the demo."""
    import time
    client = _client()
    last_exc = None
    for model in [settings.gemini_model, *settings.gemini_fallback_models]:
        for attempt in range(3):
            try:
                resp = client.models.generate_content(
                    model=model, contents=prompt,
                    config={"response_mime_type": "application/json", "temperature": 0.2})
                return resp.text
            except Exception as exc:
                last_exc = exc
                if _status(exc) not in (429, 500, 502, 503, 504):
                    break  # timeout / 404 / auth: try the next model
                time.sleep(2 * (attempt + 1))  # 2s, 4s
    raise last_exc

def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    return json.loads(text)


def analyze(incident: dict, caller: Callable[[str], str] = call_gemini):
    """Returns GeminiAnalysis, or None on ANY failure (never raises)."""
    try:
        raw = caller(build_prompt(incident))
        return GeminiAnalysis.model_validate(_extract_json(raw))
    except Exception as exc:
        print(f"[gemini] analysis failed, keeping rule-based incident: {type(exc).__name__}: {exc}")
        return None


def incident_to_dict(inc, agent_name: str) -> dict:
    return {"agent_name": agent_name, "incident_type": inc.incident_type,
            "rule_severity": inc.severity, "description": inc.description,
            "evidence": inc.evidence, "estimated_waste_usd_estimate": inc.estimated_waste}


def analyze_and_store(db, incident_id: str, caller=call_gemini) -> dict | None:
    from app.models.models import Incident, Agent
    inc = db.get(Incident, incident_id)
    if inc is None:
        return None
    agent = db.get(Agent, inc.agent_id)
    result = analyze(incident_to_dict(inc, agent.name if agent else "unknown"), caller)
    if result is not None:
        inc.gemini_analysis = result.model_dump()
        db.commit()
        return inc.gemini_analysis
    return None


def _bg(incident_id: str):
    from app.database.session import SessionLocal
    db = SessionLocal()
    try:
        analyze_and_store(db, incident_id)
    finally:
        db.close()


def gemini_hook(db, inc, agent):
    """Registered in incident_hooks. Runs in a background thread so ingestion never waits on Gemini."""
    if not settings.gemini_api_key:
        return
    threading.Thread(target=_bg, args=(inc.id,), daemon=True).start()
