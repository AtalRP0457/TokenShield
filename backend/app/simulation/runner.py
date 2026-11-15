"""Simulated agents. They call process_event() directly — the same pipeline the API uses —
and honour the pause signal (Token Protection Mode). All simulated data is flagged is_simulated."""
import threading
import time
from app.database.session import SessionLocal
from app.models.models import Agent
from app.schemas.schemas import EventIn
from app.services.ingest.pipeline import process_event

DELAY = 0.15  # seconds between simulated calls


def _healthy():
    for tool in ["web_search", "read_page", "summarize", "web_search", "read_page", "write_report"]:
        yield dict(tool_name=tool, args={"q": tool + str(time.time())}, input_tokens=400, output_tokens=150)


def _repeating():
    for _ in range(30):
        yield dict(tool_name="http_get", args={"url": "https://example.com/data"},
                   success=False, error_message="HTTP 503", input_tokens=500, output_tokens=200)


def _token_heavy():
    for i in range(12):
        yield dict(tool_name="analyze_document", args={"chunk": i}, input_tokens=9000, output_tokens=2500,
                   model="gemini-2.5-pro")


def _failing():
    for i in range(15):
        yield dict(tool_name="call_api", args={"i": i}, success=False,
                   error_message="HTTP 503 Service Unavailable", input_tokens=300, output_tokens=50)


def _sequence_loop():
    for _ in range(8):
        for tool in ["search_docs", "open_result", "summarize_page"]:
            yield dict(tool_name=tool, args={"step": tool}, input_tokens=600, output_tokens=200)


SCENARIOS = {
    "healthy": ("Healthy Agent", _healthy),
    "repeating": ("Repeating Agent", _repeating),
    "token_heavy": ("Token-Heavy Agent", _token_heavy),
    "failing": ("Failing Agent", _failing),
    "sequence_loop": ("Sequence-Loop Agent", _sequence_loop),
}

_stop = threading.Event()
_threads = {}


def _run(scenario: str):
    name, gen = SCENARIOS[scenario]
    db = SessionLocal()
    try:
        agent = Agent(name=f"[SIM] {name}", description="Simulated agent", is_simulated=True)
        db.add(agent)
        db.commit()
        task_id = f"sim-{scenario}-{agent.id[:6]}"
        for ev in gen():
            if _stop.is_set():
                break
            payload = EventIn(agent_id=agent.id, task_id=task_id, is_simulated=True,
                              model=ev.pop("model", "gemini-2.5-flash"), **ev)
            res = process_event(db, payload)
            if res["should_stop"]:  # Token Protection Mode: agent honours the pause
                break
            time.sleep(DELAY)
    finally:
        db.close()


def trigger(scenario: str):
    if scenario not in SCENARIOS:
        raise KeyError(scenario)
    t = threading.Thread(target=_run, args=(scenario,), daemon=True)
    t.start()
    return {"started": scenario, "simulated": True}


def start_all():
    _stop.clear()
    for s in SCENARIOS:
        trigger(s)
    return {"started": list(SCENARIOS), "simulated": True}


def stop_all():
    _stop.set()
    return {"stopped": True}
