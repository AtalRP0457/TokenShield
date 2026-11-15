"""Test agents for TokenShield.

Each one is a separate program that reports to TokenShield through the SDK, exactly like a
real agent would. Run the backend first, open the dashboard, then run one of these and watch
it appear under Heroes (and under Perils if it misbehaves).

    python examples/test_agents.py --list
    python examples/test_agents.py sirens
    python examples/test_agents.py flaky --agent-id <id from "Add a hero">

Settings (optional): TOKENSHIELD_URL (default http://localhost:8000),
TOKENSHIELD_API_KEY (default development-key), GEMINI_API_KEY (only for the `gemini` agent).
"""
import argparse
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk"))
import requests  # noqa: E402
from tokenshield import TokenShield, TokenShieldPaused  # noqa: E402

URL = os.getenv("TOKENSHIELD_URL", "http://localhost:8000").rstrip("/")
KEY = os.getenv("TOKENSHIELD_API_KEY", "development-key")
STEP = 0.6  # seconds between steps, so you can watch it live on the dashboard


def say(msg):
    print(f"  {msg}", flush=True)


def step(agent, tool, ok=True, error=None, tin=400, tout=150, model=None, args=None):
    """Report one step to TokenShield and print it."""
    agent.log_tool_call(tool, success=ok, error=error, input_tokens=tin, output_tokens=tout,
                        model=model, args=args if args is not None else {"t": time.time()})
    say(f"{'ok  ' if ok else 'FAIL'} {tool}" + (f"  ({error})" if error else ""))
    time.sleep(STEP)


# ---------------------------------------------------------------- agents

def healthy(agent):
    """Does a normal research task and finishes. Should appear under Heroes with no perils."""
    for tool in ["web_search", "read_page", "read_page", "summarize", "write_report"]:
        step(agent, tool)


def sirens(agent):
    """Retries the same failing request with the same arguments (The Sirens)."""
    for _ in range(20):
        step(agent, "http_get", ok=False, error="HTTP 503", tin=500, tout=200,
             args={"url": "https://api.example.com/data"})


def storm(agent):
    """Different calls, all failing: an outage it keeps pushing through (Poseidon's storm)."""
    for i in range(12):
        step(agent, random.choice(["call_crm", "call_billing", "call_inventory"]), ok=False,
             error="HTTP 503 Service Unavailable", args={"customer": i})


def charybdis(agent):
    """Goes round in circles: search -> open -> summarize -> search ... (Charybdis)."""
    for _ in range(6):
        for tool in ["search_docs", "open_result", "summarize_page"]:
            step(agent, tool, tin=600, tout=200, args={"step": tool})


def winds(agent):
    """Stuffs huge documents into every prompt until the token budget bursts (Aeolus' winds)."""
    for i in range(10):
        step(agent, "analyze_document", tin=9000, tout=2500, model="gemini-2.5-pro", args={"chunk": i})


def helios(agent):
    """Sets a tiny $0.05 budget for itself, then uses an expensive model (Cattle of Helios)."""
    r = requests.put(f"{URL}/api/agents/{agent.id}/guards", json={
        "max_task_cost": 0.05, "max_task_tokens": None, "max_repeated_calls": None,
        "max_consecutive_failures": None}, timeout=10)
    say(f"budget set to $0.05 per task ({r.status_code})")
    for i in range(10):
        step(agent, "draft_contract", tin=3000, tout=1000, model="claude-sonnet", args={"section": i})


def scylla(agent):
    """Cheap for a while, then suddenly expensive (Scylla). Medium severity: flagged, not paused."""
    for i in range(20):
        step(agent, "classify_ticket", tin=150, tout=50, model="gemini-2.5-flash", args={"ticket": i})
    for i in range(10):
        step(agent, "deep_analysis", tin=3000, tout=1000, model="gemini-2.5-pro", args={"ticket": i})


def calypso(agent):
    """A task that never finishes (Calypso's isle). Takes about 11 minutes: the limit is 10."""
    say("this one is slow on purpose: one step every 30 s for ~11 minutes. Ctrl+C to stop.")
    for i in range(23):
        agent.log_tool_call("wait_for_approval", success=True, input_tokens=50, output_tokens=10, args={"poll": i})
        say(f"ok   wait_for_approval  (poll {i + 1}/23)")
        time.sleep(30)


def flaky(agent):
    """Mostly works, sometimes fails. Pair it with a hero from 'Add a hero' to test failure alerts."""
    for i in range(25):
        fail = random.random() < 0.3
        step(agent, random.choice(["fetch_invoice", "parse_pdf", "update_sheet"]), ok=not fail,
             error="Timeout after 30s" if fail else None, args={"invoice": i})
        time.sleep(1.5)


def gemini(agent):
    """A REAL Gemini-powered agent: asks Gemini questions and reports the real token counts.
    Then hits a bug (a model name that doesn't exist) and keeps retrying it, so TokenShield
    catches a real failure loop. Needs GEMINI_API_KEY (it's read from the repo's .env too)."""
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    except ImportError:
        pass
    from google import genai
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        sys.exit("Set GEMINI_API_KEY (or put it in the repo's .env) to run the gemini agent.")
    client = genai.Client(api_key=key)
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    for q in ["In one sentence, what is a vector database?",
              "In one sentence, why do AI agents get stuck in loops?"]:
        t0 = time.time()
        try:
            resp = client.models.generate_content(model=model, contents=q)
            u = resp.usage_metadata
            agent.log_tool_call("ask_gemini", success=True, model=model,
                                input_tokens=u.prompt_token_count or 0,
                                output_tokens=u.candidates_token_count or 0,
                                duration_ms=int((time.time() - t0) * 1000), args={"q": q})
            say(f"ok   ask_gemini -> {resp.text.strip()[:90]}")
        except TokenShieldPaused:
            raise
        except Exception as e:
            agent.log_tool_call("ask_gemini", success=False, error=str(e)[:200], model=model, args={"q": q})
            say(f"FAIL ask_gemini ({type(e).__name__})")
        time.sleep(STEP)

    say("now the bug: retrying a model name that doesn't exist...")
    for _ in range(10):
        try:
            client.models.generate_content(model="gemini-does-not-exist", contents="hello")
        except Exception as e:
            agent.log_tool_call("ask_gemini", success=False, error=str(e)[:200], args={"model": "gemini-does-not-exist"})
            say(f"FAIL ask_gemini ({type(e).__name__})")
        time.sleep(STEP)


AGENTS = {
    "healthy": (healthy, "Healthy Research Agent", "No perils. Shows up under Heroes as Active."),
    "sirens": (sirens, "Sirens Test Agent", "The Sirens: same failing call repeated -> paused."),
    "storm": (storm, "Storm Test Agent", "Poseidon's storm: failures in a row -> paused."),
    "charybdis": (charybdis, "Charybdis Test Agent", "Charybdis: a loop of 3 steps -> paused."),
    "winds": (winds, "Winds Test Agent", "Aeolus' winds: token budget exceeded -> paused."),
    "helios": (helios, "Helios Test Agent", "Cattle of Helios: cost budget exceeded -> paused."),
    "scylla": (scylla, "Scylla Test Agent", "Scylla: sudden spending spike -> flagged (medium, not paused)."),
    "calypso": (calypso, "Calypso Test Agent", "Calypso's isle: task runs > 10 min -> flagged. Slow (~11 min)."),
    "flaky": (flaky, "Flaky Invoice Agent", "Random failures, for testing 'Alert on every failure'."),
    "gemini": (gemini, "Real Gemini Agent", "Real Gemini calls + a real bug loop -> paused. Needs GEMINI_API_KEY."),
}


def main():
    p = argparse.ArgumentParser(description="Run a test agent against TokenShield.")
    p.add_argument("agent", nargs="?", choices=list(AGENTS) + ["all"], help="which agent to run ('all' runs every fast one)")
    p.add_argument("--agent-id", help="report as a hero you created with 'Add a hero' instead of registering a new one")
    p.add_argument("--list", action="store_true", help="list the agents")
    a = p.parse_args()

    if a.list or not a.agent:
        print("Test agents (python examples/test_agents.py <name>):\n")
        for k, (_, _, desc) in AGENTS.items():
            print(f"  {k:<10} {desc}")
        print("\n  all        Runs every agent above except calypso and gemini, one after another.")
        return

    try:
        requests.get(f"{URL}/api/health", timeout=5).raise_for_status()
    except Exception:
        sys.exit(f"Can't reach TokenShield at {URL}. Start the backend first (uvicorn).")

    shield = TokenShield(api_url=URL, api_key=KEY)
    names = [k for k in AGENTS if k not in ("calypso", "gemini")] if a.agent == "all" else [a.agent]
    for name in names:
        fn, title, desc = AGENTS[name]
        agent = shield.connect_agent(a.agent_id, name=title) if a.agent_id else shield.register_agent(title, desc)
        print(f"\n{title}  (agent id {agent.id})\n  expect: {desc}")
        try:
            fn(agent)
            print("  finished without being stopped.")
        except TokenShieldPaused:
            print("  >>> STOPPED BY TOKENSHIELD. Open Perils on the dashboard to see why.")
        except KeyboardInterrupt:
            print("  interrupted.")
            break
        except requests.HTTPError as e:
            print(f"  TokenShield rejected the event: {e}. Is the agent id right?")


if __name__ == "__main__":
    main()
