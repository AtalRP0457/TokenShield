from collections import defaultdict
from datetime import timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.session import get_db
from app.models.models import Agent, AgentEvent, AgentGuard, Incident, now
from app.schemas.schemas import (AgentRegister, EventIn, IncidentPatch, IncidentOut,
                                 EventOut, AgentOut, AgentGuardsIn, OracleQuestion)
from app.services.ingest.pipeline import process_event
from app.simulation import runner

router = APIRouter(prefix="/api")


def require_key(x_api_key: str = Header(default="")):
    if x_api_key != settings.api_key:
        raise HTTPException(401, "invalid API key")


def _incident_out(db, i: Incident) -> IncidentOut:
    agent = db.get(Agent, i.agent_id)
    return IncidentOut(
        id=i.id, agent_id=i.agent_id, agent_name=agent.name if agent else "unknown",
        task_id=i.task_id, incident_type=i.incident_type, severity=i.severity,
        description=i.description, evidence=i.evidence or {},
        repeated_calls=(i.evidence or {}).get("repeated_calls"),
        estimated_waste=i.estimated_waste, gemini_analysis=i.gemini_analysis,
        status=i.status, created_at=i.created_at)


def _agent_out(db, a: Agent) -> AgentOut:
    tokens, cost = db.execute(
        select(func.coalesce(func.sum(AgentEvent.total_tokens), 0),
               func.coalesce(func.sum(AgentEvent.estimated_cost), 0.0))
        .where(AgentEvent.agent_id == a.id)).one()
    open_inc = db.execute(select(func.count()).select_from(Incident)
                          .where(Incident.agent_id == a.id, Incident.status == "open")).scalar()
    return AgentOut(id=a.id, name=a.name, description=a.description, status=a.status,
                    is_simulated=a.is_simulated, created_at=a.created_at, last_seen=a.last_seen,
                    total_tokens=int(tokens), estimated_cost=round(float(cost), 6),
                    open_incidents=open_inc)


# ---------- ingestion ----------
@router.post("/agents/register", dependencies=[Depends(require_key)])
def register_agent(body: AgentRegister, db: Session = Depends(get_db)):
    agent = Agent(name=body.name, description=body.description, is_simulated=body.is_simulated)
    db.add(agent)
    db.commit()
    return {"agent_id": agent.id, "name": agent.name, "status": agent.status}


@router.post("/events", dependencies=[Depends(require_key)])
def ingest_event(body: EventIn, db: Session = Depends(get_db)):
    try:
        res = process_event(db, body)
    except LookupError:
        raise HTTPException(404, "unknown agent_id")
    return {"event_id": res["event"].id,
            "estimated_cost": res["event"].estimated_cost,
            "agent_status": res["agent_status"],
            "should_stop": res["should_stop"],
            "new_incident_ids": [i.id for i in res["new_incidents"]]}


# ---------- agents ----------
@router.get("/agents", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    return [_agent_out(db, a) for a in db.execute(select(Agent)).scalars()]


@router.post("/agents", response_model=AgentOut)
def create_agent(body: AgentRegister, db: Session = Depends(get_db)):
    """Add a hero from the dashboard. The agent then reports with its agent_id
    (SDK: TokenShield(...).connect_agent(agent_id))."""
    agent = Agent(name=body.name.strip(), description=body.description.strip(), is_simulated=False)
    db.add(agent)
    db.commit()
    return _agent_out(db, agent)


@router.post("/agents/{agent_id}/test-failure")
def test_failure(agent_id: str, db: Session = Depends(get_db)):
    """Send one failed step for this hero, to check that failure alerts reach you.
    Goes through the normal pipeline, so it counts toward 'failures in a row'."""
    if not db.get(Agent, agent_id):
        raise HTTPException(404, "agent not found")
    res = process_event(db, EventIn(agent_id=agent_id, task_id=f"{agent_id}-test", tool_name="test_alert",
                                    success=False, error_message="Test failure sent from the TokenShield dashboard"))
    return {"event_id": res["event"].id, "agent_status": res["agent_status"],
            "should_stop": res["should_stop"], "new_incident_ids": [i.id for i in res["new_incidents"]]}


@router.get("/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    a = db.get(Agent, agent_id)
    if not a:
        raise HTTPException(404, "agent not found")
    return _agent_out(db, a)


@router.post("/agents/{agent_id}/resume")
def resume_agent(agent_id: str, db: Session = Depends(get_db)):
    a = db.get(Agent, agent_id)
    if not a:
        raise HTTPException(404, "agent not found")
    a.status = "active"
    db.commit()
    return {"agent_id": a.id, "status": a.status}


# ---------- per-hero budgets (guards) ----------
GUARD_DEFAULTS = lambda: {"max_task_tokens": settings.max_task_tokens, "max_task_cost": settings.max_task_cost,
                          "max_repeated_calls": settings.max_repeated_calls,
                          "max_consecutive_failures": settings.max_consecutive_failures}


def _guards_out(agent_id, g):
    fields = GUARD_DEFAULTS()
    return {"agent_id": agent_id, "defaults": fields,
            **{k: (getattr(g, k) if g else None) for k in fields}}


@router.get("/agents/{agent_id}/guards")
def get_guards(agent_id: str, db: Session = Depends(get_db)):
    if not db.get(Agent, agent_id):
        raise HTTPException(404, "agent not found")
    return _guards_out(agent_id, db.get(AgentGuard, agent_id))


@router.put("/agents/{agent_id}/guards")
def put_guards(agent_id: str, body: AgentGuardsIn, db: Session = Depends(get_db)):
    """Replace this hero's budgets. Send null for a field to go back to the global default."""
    if not db.get(Agent, agent_id):
        raise HTTPException(404, "agent not found")
    g = db.get(AgentGuard, agent_id) or AgentGuard(agent_id=agent_id)
    for k, v in body.model_dump().items():
        setattr(g, k, v)
    g.updated_at = now()
    db.add(g)
    db.commit()
    return _guards_out(agent_id, g)


@router.get("/agents/{agent_id}/events", response_model=list[EventOut])
def agent_events(agent_id: str, limit: int = Query(100, le=1000), db: Session = Depends(get_db)):
    q = (select(AgentEvent).where(AgentEvent.agent_id == agent_id)
         .order_by(AgentEvent.timestamp.desc()).limit(limit))
    return [EventOut.model_validate(e, from_attributes=True) for e in db.execute(q).scalars()]


@router.get("/events/recent", response_model=list[EventOut])
def recent_events(limit: int = Query(50, le=500), db: Session = Depends(get_db)):
    """Live activity feed."""
    q = select(AgentEvent).order_by(AgentEvent.timestamp.desc()).limit(limit)
    return [EventOut.model_validate(e, from_attributes=True) for e in db.execute(q).scalars()]


# ---------- metrics (all costs are ESTIMATES) ----------
@router.get("/metrics/overview")
def overview(db: Session = Depends(get_db)):
    tokens, cost = db.execute(select(func.coalesce(func.sum(AgentEvent.total_tokens), 0),
                                     func.coalesce(func.sum(AgentEvent.estimated_cost), 0.0))).one()
    # Several incidents on one task can cover the same wasted calls, so take the
    # largest per task (not the sum), and never report more waste than total spend.
    per_task = select(func.max(Incident.estimated_waste).label("w")).group_by(Incident.task_id).subquery()
    waste = db.execute(select(func.coalesce(func.sum(per_task.c.w), 0.0))).scalar()
    waste = min(float(waste), float(cost))
    loops = db.execute(select(func.count()).select_from(Incident).where(
        Incident.incident_type.in_(["REPEATED_TOOL_CALL", "SEQUENCE_LOOP"]))).scalar()
    active_inc = db.execute(select(func.count()).select_from(Incident)
                            .where(Incident.status == "open")).scalar()
    active_agents = db.execute(select(func.count()).select_from(Agent)
                               .where(Agent.status == "active")).scalar()
    return {"active_agents": active_agents, "total_tokens": int(tokens),
            "estimated_cost": round(float(cost), 4),
            "potential_waste": round(float(waste), 4),
            "detected_loops": loops, "active_incidents": active_inc,
            "cost_is_estimate": True}


def _agg_rows(db, minutes):
    """Per-minute rows. On Tiger Data this READS THE CONTINUOUS AGGREGATE (events_per_minute),
    which Timescale keeps pre-computed. On SQLite (dev fallback) it buckets in Python."""
    if db.get_bind().dialect.name == "postgresql":
        try:
            rows = db.execute(text(
                "SELECT bucket, sum(calls) AS calls, sum(tokens) AS tokens, "
                "sum(cost) AS cost, sum(failures) AS failures "
                "FROM events_per_minute WHERE bucket >= now() - (:m * interval '1 minute') "
                "GROUP BY bucket ORDER BY bucket"), {"m": minutes}).all()
            return "timescale_continuous_aggregate", [
                {"time": r.bucket.strftime("%Y-%m-%dT%H:%M:00"), "calls": int(r.calls or 0),
                 "tokens": int(r.tokens or 0), "cost": round(float(r.cost or 0), 6),
                 "failures": int(r.failures or 0)} for r in rows]
        except Exception as exc:
            db.rollback()
            print(f"[metrics] continuous aggregate unavailable, using fallback: {exc}")
    since = now() - timedelta(minutes=minutes)
    b = defaultdict(lambda: {"calls": 0, "tokens": 0, "cost": 0.0, "failures": 0})
    for e in db.execute(select(AgentEvent).where(AgentEvent.timestamp >= since)).scalars():
        k = b[e.timestamp.strftime("%Y-%m-%dT%H:%M:00")]
        k["calls"] += 1
        k["tokens"] += e.total_tokens
        k["cost"] += e.estimated_cost
        k["failures"] += 0 if e.success else 1
    return "python_fallback", [{"time": t, **v, "cost": round(v["cost"], 6)} for t, v in sorted(b.items())]


@router.get("/metrics/tokens")
def metrics_tokens(minutes: int = 60, db: Session = Depends(get_db)):
    source, rows = _agg_rows(db, minutes)
    return {"series": [{"time": r["time"], "value": r["tokens"]} for r in rows], "source": source}


@router.get("/metrics/cost")
def metrics_cost(minutes: int = 60, db: Session = Depends(get_db)):
    source, rows = _agg_rows(db, minutes)
    return {"series": [{"time": r["time"], "value": r["cost"]} for r in rows],
            "is_estimate": True, "source": source}


@router.get("/metrics/timeseries")
def metrics_timeseries(minutes: int = 60, db: Session = Depends(get_db)):
    """Per-minute calls, tokens, cost (estimate) and failures in one response."""
    source, rows = _agg_rows(db, minutes)
    return {"series": rows, "is_estimate": True, "source": source}


@router.get("/metrics/agents")
def metrics_agents(db: Session = Depends(get_db)):
    return [_agent_out(db, a) for a in db.execute(select(Agent)).scalars()]


# ---------- incidents ----------
@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Incident).order_by(Incident.created_at.desc())
    if status:
        q = q.where(Incident.status == status)
    return [_incident_out(db, i) for i in db.execute(q).scalars()]


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    i = db.get(Incident, incident_id)
    if not i:
        raise HTTPException(404, "incident not found")
    return _incident_out(db, i)


@router.post("/incidents/{incident_id}/analyze", response_model=IncidentOut)
def analyze_incident(incident_id: str, db: Session = Depends(get_db)):
    """Run (or re-run) Gemini analysis now. If Gemini fails the incident is returned unchanged."""
    from app.services.gemini.analyzer import analyze_and_store
    i = db.get(Incident, incident_id)
    if not i:
        raise HTTPException(404, "incident not found")
    if not settings.gemini_api_key:
        raise HTTPException(503, "GEMINI_API_KEY is not set")
    analyze_and_store(db, incident_id)
    db.refresh(i)
    return _incident_out(db, i)


@router.patch("/incidents/{incident_id}", response_model=IncidentOut)
def patch_incident(incident_id: str, body: IncidentPatch, db: Session = Depends(get_db)):
    i = db.get(Incident, incident_id)
    if not i:
        raise HTTPException(404, "incident not found")
    i.status = body.status
    db.commit()
    return _incident_out(db, i)


# ---------- Ask the Oracle (plain-language Q&A, Gemini with rule-based fallback) ----------
@router.post("/oracle/ask")
def oracle_ask(body: OracleQuestion, db: Session = Depends(get_db)):
    from app.services.oracle.oracle import ask
    return ask(db, body.question, body.agent_id)


# ---------- alert channels ----------
@router.get("/notifications/status")
def notifications_status():
    from app.services.alerts.channels import email_enabled, slack_enabled
    return {"discord": bool(settings.discord_webhook_url), "slack": slack_enabled(),
            "email": email_enabled(), "gemini": bool(settings.gemini_api_key)}


# ---------- simulation ----------
@router.post("/simulation/start")
def sim_start():
    return runner.start_all()


@router.post("/simulation/stop")
def sim_stop():
    return runner.stop_all()


@router.post("/simulation/trigger")
def sim_trigger(scenario: str = Query(..., description="healthy|repeating|token_heavy|failing|sequence_loop")):
    try:
        return runner.trigger(scenario)
    except KeyError:
        raise HTTPException(400, f"unknown scenario; choose from {list(runner.SCENARIOS)}")


@router.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}
