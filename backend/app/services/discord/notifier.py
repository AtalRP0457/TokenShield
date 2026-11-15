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
        r = requests.post(settings.discord_webhook_url,
                          json=build_payload(inc, agent.name if agent else "unknown"), timeout=10)
        if r.status_code in (200, 204):
            inc.notified = True
            db.commit()
        else:
            print(f"[discord] webhook returned {r.status_code}")
    except Exception as exc:  # never break the app because Discord failed
        print(f"[discord] notification failed: {type(exc).__name__}: {exc}")
    finally:
        db.close()


def discord_hook(db, inc, agent):
    """Registered in incident_hooks. Only high/critical incidents notify."""
    if not settings.discord_webhook_url or inc.severity not in ("high", "critical"):
        return
    threading.Thread(target=_send, args=(inc.id,), daemon=True).start()