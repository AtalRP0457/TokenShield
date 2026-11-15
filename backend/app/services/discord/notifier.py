"""Discord notifications. Never raises. Does nothing if no webhook is configured.
Waits (up to 25s) for Gemini's analysis so the message includes it, then posts once per incident."""
import threading
import time
import requests
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.models import Incident, Agent

COLORS = {"critical": 0xE5484D, "high": 0xF76B15, "medium": 0xFFB224, "low": 0x30A46C}


def build_payload(inc, agent_name):
    g = inc.gemini_analysis or {}
    fields = [
        {"name": "Agent", "value": agent_name, "inline": True},
        {"name": "Severity", "value": inc.severity.upper(), "inline": True},
        {"name": "Type", "value": inc.incident_type, "inline": True},
        {"name": "Estimated waste", "value": f"${inc.estimated_waste:.4f} (estimate)", "inline": True},
    ]
    if g:
        fields.append({"name": "In plain words",
                       "value": str(g.get("plain_explanation") or g.get("summary", ""))[:500], "inline": False})
        acts = g.get("recommended_actions") or []
        if acts:
            fields.append({"name": "Recommended actions",
                           "value": "\n".join("• " + str(a)[:200] for a in acts[:3]), "inline": False})
    else:
        fields.append({"name": "Gemini analysis", "value": "Not available yet.", "inline": False})
    embed = {
        "title": "TokenShield: " + inc.incident_type.replace("_", " ").title(),
        "description": inc.description[:500],
        "color": COLORS.get(inc.severity, 0x888888),
        "fields": fields,
        "footer": {"text": "Costs are estimates, not provider billing"},
    }
    return {"username": "TokenShield", "embeds": [embed]}


# One alert at a time, spaced out: Discord webhooks only accept a few messages every few
# seconds, and "Start all" can create several perils at once.
_post_lock = threading.Lock()
_MIN_GAP = 1.5  # seconds between two posts
_last_post = [0.0]


def _retry_after(r) -> float:
    """Seconds Discord asks us to wait (JSON body, else header), capped so we never hang long."""
    wait = None
    try:
        wait = float(r.json().get("retry_after"))
    except Exception:
        try:
            wait = float(r.headers.get("Retry-After"))
        except Exception:
            wait = None
    return min(max(wait or 2.0, 0.5), 30.0)


def _post(payload) -> bool:
    """POST to the webhook; on 429 wait as Discord asks and retry (up to 4 tries)."""
    with _post_lock:
        for attempt in range(4):
            gap = _MIN_GAP - (time.time() - _last_post[0])
            if gap > 0:
                time.sleep(gap)
            r = requests.post(settings.discord_webhook_url, json=payload, timeout=10)
            _last_post[0] = time.time()
            if r.status_code in (200, 204):
                return True
            if r.status_code == 429:
                wait = _retry_after(r)
                scope = r.headers.get("X-RateLimit-Scope", "unknown")  # user | global | shared
                print(f"[discord] 429 rate limited (scope={scope}); retrying in {wait:.1f}s "
                      f"(try {attempt + 1}/4) {r.text[:160]}")
                time.sleep(wait)
                continue
            print(f"[discord] webhook returned {r.status_code}: {r.text[:200]}")
            return False
        print("[discord] gave up after 4 tries (still rate limited)")
        return False


def _send(incident_id):
    db = SessionLocal()
    try:
        inc = db.get(Incident, incident_id)
        deadline = time.time() + 25
        while inc and not inc.gemini_analysis and time.time() < deadline:
            time.sleep(2)
            db.refresh(inc)
        if inc is None or inc.notified:  # duplicate prevention
            return
        agent = db.get(Agent, inc.agent_id)
        if _post(build_payload(inc, agent.name if agent else "unknown")):
            inc.notified = True
            db.commit()
    except Exception as exc:  # never break the app because Discord failed
        print(f"[discord] notification failed: {type(exc).__name__}: {exc}")
    finally:
        db.close()


def discord_hook(db, inc, agent):
    """Registered in incident_hooks. Only high/critical incidents notify."""
    if not settings.discord_webhook_url or inc.severity not in ("high", "critical"):
        return
    threading.Thread(target=_send, args=(inc.id,), daemon=True).start()