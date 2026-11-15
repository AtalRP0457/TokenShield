"""Slack and email alerts for high/critical incidents. Same pattern as the Discord notifier:
wait (up to 25s) for Gemini's plain-language explanation, send once, never raise.
Each channel does nothing unless its settings are present."""
import smtplib
import threading
import time
from email.message import EmailMessage
import requests
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.models import Incident, Agent

_sent: set[tuple[str, str]] = set()  # (channel, incident_id): duplicate prevention
_lock = threading.Lock()


def slack_enabled() -> bool:
    return bool(settings.slack_webhook_url)


def email_enabled() -> bool:
    return bool(settings.smtp_host and settings.alert_email_to and (settings.alert_email_from or settings.smtp_user))


def _load(incident_id):
    db = SessionLocal()
    try:
        inc = db.get(Incident, incident_id)
        deadline = time.time() + 25
        while inc and not inc.gemini_analysis and time.time() < deadline:
            time.sleep(2)
            db.refresh(inc)
        if inc is None:
            return None
        agent = db.get(Agent, inc.agent_id)
        g = inc.gemini_analysis or {}
        return {"id": inc.id, "agent": (agent.name if agent else "unknown").replace("[SIM] ", ""),
                "type": inc.incident_type.replace("_", " ").title(), "severity": inc.severity.upper(),
                "description": inc.description, "waste": inc.estimated_waste,
                "plain": g.get("plain_explanation") or g.get("summary") or "",
                "actions": (g.get("recommended_actions") or [])[:3]}
    finally:
        db.close()


def _once(channel, incident_id) -> bool:
    with _lock:
        if (channel, incident_id) in _sent:
            return False
        _sent.add((channel, incident_id))
        return True


def _text(d) -> str:
    lines = [f"TokenShield: {d['type']} ({d['severity']}) on {d['agent']}", d["description"]]
    if d["plain"]:
        lines.append("In plain words: " + d["plain"])
    lines.append(f"Estimated waste: ${d['waste']:.4f} (estimate)")
    lines += ["- " + a for a in d["actions"]]
    return "\n".join(lines)


def _send_slack(incident_id):
    try:
        d = _load(incident_id)
        if d and _once("slack", incident_id):
            r = requests.post(settings.slack_webhook_url, json={"text": _text(d)}, timeout=10)
            if r.status_code >= 300:
                print(f"[slack] webhook returned {r.status_code}")
    except Exception as exc:
        print(f"[slack] notification failed: {type(exc).__name__}: {exc}")


def _send_email(incident_id):
    try:
        d = _load(incident_id)
        if not d or not _once("email", incident_id):
            return
        msg = EmailMessage()
        msg["Subject"] = f"[TokenShield] {d['severity']}: {d['type']} on {d['agent']}"
        msg["From"] = settings.alert_email_from or settings.smtp_user
        msg["To"] = settings.alert_email_to
        msg.set_content(_text(d) + "\n\nCosts are estimates, not provider billing.")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
    except Exception as exc:
        print(f"[email] notification failed: {type(exc).__name__}: {exc}")


def _important(inc) -> bool:
    return inc.severity in ("high", "critical")


def slack_hook(db, inc, agent):
    if slack_enabled() and _important(inc):
        threading.Thread(target=_send_slack, args=(inc.id,), daemon=True).start()


def email_hook(db, inc, agent):
    if email_enabled() and _important(inc):
        threading.Thread(target=_send_email, args=(inc.id,), daemon=True).start()
