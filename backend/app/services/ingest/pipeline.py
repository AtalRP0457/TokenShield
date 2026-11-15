"""The ONE pipeline. SDK events, API events and simulator events all go through process_event()."""
import hashlib
import json
from datetime import timedelta
from sqlalchemy import select
from app.core.config import settings
from app.models.models import Agent, AgentGuard, AgentTask, AgentEvent, Incident, now
from app.services.cost.pricing import estimate_cost
from app.services.detection.engine import Thresholds, run_detection

# Hooks run after an incident is created: Gemini analysis, Discord, websocket push.
# Each hook takes (db, incident, agent). Failures never break ingestion.
incident_hooks = []


GUARD_FIELDS = ("max_task_tokens", "max_task_cost", "max_repeated_calls", "max_consecutive_failures")


def thresholds_from_settings(guard: "AgentGuard | None" = None) -> Thresholds:
    t = Thresholds(
        max_repeated_calls=settings.max_repeated_calls,
        max_consecutive_failures=settings.max_consecutive_failures,
        max_sequence_repeats=settings.max_sequence_repeats,
        max_task_tokens=settings.max_task_tokens,
        max_task_cost=settings.max_task_cost,
        max_task_duration_seconds=settings.max_task_duration_seconds)
    if guard is not None:  # per-hero budgets set from the dashboard win over the globals
        for f in GUARD_FIELDS:
            v = getattr(guard, f)
            if v is not None:
                setattr(t, f, v)
    return t


def hash_args(args) -> str | None:
    if args is None:
        return None
    raw = json.dumps(args, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _recent_duplicate(db, task_id, incident_type) -> bool:
    cutoff = now() - timedelta(seconds=settings.incident_cooldown_seconds)
    q = select(Incident.id).where(
        Incident.task_id == task_id, Incident.incident_type == incident_type,
        Incident.created_at >= cutoff)
    return db.execute(q).first() is not None


def process_event(db, payload):
    """Returns dict: event, new_incidents, agent_status, should_stop."""
    agent = db.get(Agent, payload.agent_id)
    if agent is None:
        raise LookupError("unknown agent_id")

    task_id = payload.task_id or f"{agent.id}-default"
    task = db.get(AgentTask, task_id)
    if task is None:
        task = AgentTask(id=task_id, agent_id=agent.id)
        db.add(task)

    total = payload.input_tokens + payload.output_tokens
    cost = estimate_cost(payload.model, payload.input_tokens, payload.output_tokens)
    event = AgentEvent(
        agent_id=agent.id, task_id=task_id, event_type=payload.event_type,
        tool_name=payload.tool_name,
        args_hash=payload.args_hash or hash_args(payload.args),
        model=payload.model, input_tokens=payload.input_tokens,
        output_tokens=payload.output_tokens, total_tokens=total, estimated_cost=cost,
        success=payload.success, error_message=payload.error_message,
        duration_ms=payload.duration_ms,
        is_simulated=payload.is_simulated or agent.is_simulated)
    db.add(event)

    task.total_tokens = (task.total_tokens or 0) + total
    task.estimated_cost = round((task.estimated_cost or 0.0) + cost, 6)
    agent.last_seen = now()
    db.flush()

    rows = db.execute(select(AgentEvent).where(AgentEvent.task_id == task_id)
                      .order_by(AgentEvent.timestamp)).scalars().all()
    dicts = [dict(tool_name=r.tool_name, args_hash=r.args_hash, success=r.success,
                  error_message=r.error_message, total_tokens=r.total_tokens,
                  estimated_cost=r.estimated_cost, timestamp=r.timestamp) for r in rows]

    new_incidents, pause = [], False
    for d in run_detection(dicts, thresholds_from_settings(db.get(AgentGuard, agent.id))):
        pause = pause or d.should_pause
        if _recent_duplicate(db, task_id, d.incident_type):
            continue
        inc = Incident(agent_id=agent.id, task_id=task_id, incident_type=d.incident_type,
                       severity=d.severity, description=d.description,
                       evidence=d.evidence, estimated_waste=d.estimated_waste)
        db.add(inc)
        new_incidents.append(inc)

    # Token Protection Mode: flag the agent as paused. This is cooperative —
    # the SDK/simulator must honour should_stop. We cannot stop arbitrary third-party agents.
    if pause and agent.status == "active":
        agent.status = "paused"
        task.status = "paused"
    db.commit()

    for inc in new_incidents:
        for hook in incident_hooks:
            try:
                hook(db, inc, agent)
            except Exception as exc:  # never let analysis/notify break ingestion
                print(f"[hook error] {hook.__name__}: {exc}")

    return {"event": event, "new_incidents": new_incidents,
            "agent_status": agent.status, "should_stop": agent.status != "active"}
