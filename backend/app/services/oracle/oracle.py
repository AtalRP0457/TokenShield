"""Ask the Oracle: answers free-form questions about your agents in plain words.

Gemini only sees a compact, redacted summary (totals, agents, recent incidents), never
raw prompts, tool arguments or keys. If Gemini is not configured or fails, a rule-based
answer built from the same summary is returned instead, so the feature never breaks."""
import json
from sqlalchemy import select, func
from app.core.config import settings
from app.models.models import Agent, AgentEvent, Incident
from app.services.gemini.analyzer import PLAIN_RULES, _clean, _extract_json, call_gemini

PERILS = {
    "REPEATED_TOOL_CALL": "The Sirens (same tool called again and again)",
    "SEQUENCE_LOOP": "Charybdis (going round in circles through the same steps)",
    "CONSECUTIVE_FAILURES": "Poseidon's storm (failing again and again)",
    "TOKEN_BUDGET_EXCEEDED": "Aeolus' winds (used too many tokens)",
    "COST_BUDGET_EXCEEDED": "Cattle of Helios (spent past the budget)",
    "HIGH_SPENDING": "Scylla (spending much faster than normal)",
    "LONG_RUNNING_TASK": "Calypso's isle (stuck on a task too long)",
}


def build_context(db, agent_id: str | None = None) -> dict:
    stats = {r[0]: (r[1] or 0, r[2] or 0.0) for r in db.execute(
        select(AgentEvent.agent_id, func.sum(AgentEvent.total_tokens), func.sum(AgentEvent.estimated_cost))
        .group_by(AgentEvent.agent_id)).all()}
    opens = {r[0]: r[1] for r in db.execute(
        select(Incident.agent_id, func.count()).where(Incident.status == "open")
        .group_by(Incident.agent_id)).all()}
    agents = []
    for a in db.execute(select(Agent)).scalars():
        tokens, cost = stats.get(a.id, (0, 0.0))
        open_inc = opens.get(a.id, 0)
        agents.append({"id": a.id, "name": a.name.replace("[SIM] ", ""), "status": a.status,
                       "tokens": int(tokens), "estimated_cost_usd": round(float(cost), 4),
                       "open_problems": open_inc})
    names = {a["id"]: a["name"] for a in agents}
    q = select(Incident).order_by(Incident.created_at.desc()).limit(12)
    if agent_id:
        q = q.where(Incident.agent_id == agent_id)
    incidents = [{"agent": names.get(i.agent_id, "unknown"), "problem": PERILS.get(i.incident_type, i.incident_type),
                  "severity": i.severity, "status": i.status, "what_happened": i.description,
                  "estimated_waste_usd": round(i.estimated_waste, 4),
                  "plain_explanation": (i.gemini_analysis or {}).get("plain_explanation", ""),
                  "when_utc": i.created_at.isoformat() if i.created_at else None}
                 for i in db.execute(q).scalars()]
    agents.sort(key=lambda a: -a["estimated_cost_usd"])
    return {"agents": agents, "recent_problems": incidents,
            "total_estimated_cost_usd": round(sum(a["estimated_cost_usd"] for a in agents), 4),
            "total_estimated_waste_usd": round(sum(i["estimated_waste_usd"] for i in incidents), 4),
            "focus_agent": names.get(agent_id) if agent_id else None}


def build_prompt(question: str, ctx: dict) -> str:
    return (
        "You are 'the Oracle' inside TokenShield, a tool that watches AI agents (called 'heroes') "
        "and stops them when they loop or waste money. Problems are called 'perils'.\n"
        "Answer the user's question using ONLY the data below.\n" + PLAIN_RULES +
        "- Keep the answer under 90 words. Lead with the direct answer.\n"
        "- If the data cannot answer the question, say so simply and suggest what to check.\n"
        "Respond with a JSON object: answer (string), key_points (list of up to 3 short strings), "
        "next_step (string: one simple action the user can take, or empty).\n\n"
        "QUESTION: " + str(question)[:500] + "\n\nDATA:\n" + json.dumps(_clean(ctx), indent=2, default=str))


def _usd(v: float) -> str:
    return f"about ${v:.2f}" if v >= 0.01 else "less than a cent"


def rule_answer(question: str, ctx: dict) -> dict:
    """Plain-language fallback when Gemini is unavailable."""
    q = question.lower()
    agents, probs = ctx["agents"], ctx["recent_problems"]
    if not agents:
        return {"answer": "No heroes (agents) are connected yet, so there is nothing to report. "
                          "Start the demo simulation or connect an agent first.",
                "key_points": [], "next_step": "Press 'Start all' or open 'Summon a hero'."}
    top = agents[0]
    open_probs = [p for p in probs if p["status"] == "open"]
    if any(w in q for w in ("cost", "spend", "money", "expensive", "price", "$")):
        return {"answer": f"{top['name']} has cost the most so far: {_usd(top['estimated_cost_usd'])} "
                          f"out of {_usd(ctx['total_estimated_cost_usd'])} in total. These are estimates.",
                "key_points": [f"{a['name']}: {_usd(a['estimated_cost_usd'])}" for a in agents[:3]],
                "next_step": f"Open {top['name']} and set a budget so it pauses before spending too much."}
    if open_probs:
        p = open_probs[0]
        return {"answer": f"{len(open_probs)} problem(s) still need attention. The latest: {p['agent']} hit "
                          f"{p['problem']}. {p['plain_explanation'] or p['what_happened']}",
                "key_points": [f"{x['agent']}: {x['problem']}" for x in open_probs[:3]],
                "next_step": "Open Perils, read what happened, then resume the hero once it's fixed."}
    return {"answer": f"All calm. {len(agents)} hero(s) are connected and there are no open problems. "
                      f"Total estimated spend is {_usd(ctx['total_estimated_cost_usd'])}.",
            "key_points": [], "next_step": ""}


def ask(db, question: str, agent_id: str | None = None, caller=call_gemini) -> dict:
    ctx = build_context(db, agent_id)
    if settings.gemini_api_key:
        try:
            data = _extract_json(caller(build_prompt(question, ctx)))
            return {"answer": str(data.get("answer", "")).strip() or rule_answer(question, ctx)["answer"],
                    "key_points": [str(k) for k in (data.get("key_points") or [])][:3],
                    "next_step": str(data.get("next_step") or ""), "source": "gemini"}
        except Exception as exc:
            print(f"[oracle] Gemini failed, using rule-based answer: {type(exc).__name__}: {exc}")
    return {**rule_answer(question, ctx), "source": "rules"}
