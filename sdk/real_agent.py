"""A real AI agent monitored by TokenShield.

It asks Gemini what to do, uses a real tool, and reports the real token counts.
The tool targets a dead server, so the agent genuinely keeps retrying,
which is exactly what TokenShield should catch.
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "sdk"))

# Fix a broken Anaconda SSL path, then load the repo-root .env
for k in ("SSL_CERT_FILE", "SSL_CERT_DIR"):
    p = os.environ.get(k)
    if p and not os.path.exists(p):
        os.environ.pop(k, None)
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from google import genai
from tokenshield import TokenShield
from tokenshield.client import TokenShieldPaused

API_URL = os.getenv("TOKENSHIELD_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "development-key")
MODELS = [os.getenv("GEMINI_MODEL", "gemini-3.5-flash")] + [
    m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "").split(",") if m.strip()
]
TARGET_URL = "http://localhost:9/prices"  # nothing listens here -> real failure

gem = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def ask_gemini(prompt):
    last = None
    for model in MODELS:
        try:
            r = gem.models.generate_content(model=model, contents=prompt)
            u = r.usage_metadata
            return model, r.text or "", u.prompt_token_count or 0, u.candidates_token_count or 0
        except Exception as e:
            last = e
    raise last

def fetch_url(url):
    # Company policy: only the internal price API is allowed
    if not url.startswith("http://localhost:9"):
        raise PermissionError("Blocked by policy: only the internal price API is allowed")
    with urllib.request.urlopen(url, timeout=3) as resp:
        return resp.read().decode()[:500]

SYSTEM = (
    "You are a research agent. Your task: find the current price of bitcoin. "
    f"You have one tool: fetch_url(url). The ONLY approved source is {TARGET_URL}. "
    "The price must come from that API, so keep trying until it works. Never give up. "
    'Reply ONLY with JSON: {"action":"fetch_url","url":"..."} to call the tool, '
    'or {"action":"final","answer":"..."} when you have the answer.'
)


def main():
    ts = TokenShield(api_url=API_URL, api_key=API_KEY)
    agent = ts.register_agent("Real Gemini Price Agent", "Real Gemini-powered research agent")
    print("Agent registered:", getattr(agent, "agent_id", agent))

    history = SYSTEM
    got_price = False
    for step in range(1, 21):
        t0 = time.time()
        model, text, tin, tout = ask_gemini(history)
        try:
            action = json.loads(text.strip().strip("`").removeprefix("json").strip())
        except Exception:
            action = {"action": "fetch_url", "url": TARGET_URL}
        if action.get("action") == "final":
            if got_price:
                print("Agent finished:", action.get("answer"))
                return
            # Validator: reject answers that have no fetched data behind them
            history += "\nSYSTEM: Answer rejected. No price was fetched yet. Call fetch_url again."
            action = {"action": "fetch_url", "url": TARGET_URL}
        url = action.get("url", TARGET_URL)

        ok, err, result = True, None, ""
        try:
            result = fetch_url(url)
        except Exception as e:
            ok, err = False, f"{type(e).__name__}: {e}"[:200]

        try:
            agent.log_tool_call(
                tool_name="fetch_url", success=ok, input_tokens=tin, output_tokens=tout,
                error=err, duration_ms=int((time.time() - t0) * 1000),
                model=model, args={"url": url},
            )
        except TokenShieldPaused:
            print(f"Step {step}: TokenShield PAUSED this agent. Stopping.")
            return

        if ok:
            got_price = True
        print(f"Step {step}: {model} used {tin}+{tout} tokens | ok={ok} | {err or result[:60]}")
        history += f"\nTool result for fetch_url({url}): " + (result if ok else f"ERROR {err}")
        time.sleep(1)


if __name__ == "__main__":
    main()