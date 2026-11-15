# TokenShield · Aegis of Athena

**TokenShield watches your AI agents, catches the runaway ones, stops them, and explains what went wrong, before the bill gets big.**

AI agents rarely fail loudly. They fail *expensively*: an agent retries the same failing tool call forever, circles through the same steps, or blows through a token budget, re-sending its whole history every time. Nothing crashes, and nobody notices until the invoice arrives.

TokenShield is the guard that notices.

> *Like Athena guiding Odysseus past Charybdis and the Sirens, TokenShield guides AI agents past the traps that waste money.*

---

## What it does

1. **Watches.** Agents report each step (tool calls, tokens, errors) to TokenShield, and a live dashboard shows every agent, token and dollar.
2. **Catches.** A rule-based detection engine spots runaway patterns the moment they happen.
3. **Stops.** The offending agent is paused automatically. Agents using the SDK stop on their next call.
4. **Explains.** Gemini reads the evidence and writes a root-cause analysis with recommended fixes.
5. **Alerts.** High and critical incidents are posted to Discord, with Gemini's analysis included.

All costs are **estimates** (computed from token counts), not provider billing.

## Features

- **Saved by TokenShield**: a headline estimate of the money kept from being burned by caught loops.
- **Ask the Oracle**: ask questions in everyday words ("Which hero costs the most?") and Gemini answers in plain English from your own data. Falls back to a rule-based answer if Gemini is unavailable.
- **"In plain words" explanations**: every peril is explained so a non-programmer understands it, with an everyday comparison.
- **Athena's quick fix**: one-click budget change for the hero that hit the peril.
- **Per-hero budgets**: spend, token, repeat and failure limits per agent, enforced by the backend on the next event.
- **Replay the voyage**: step through what the agent did up to the moment it was caught.
- **Peril timeline** on each hero, and a **costliest heroes** leaderboard on the dashboard.
- **Alerts**: in-app toast, chime and desktop notification on high/critical perils; Discord, Slack and email from the backend.
- **Export report**: download a peril as Markdown, or print / save as PDF.

## The perils it catches

Every incident type is named after a danger from Homer's *Odyssey*, with its plain-English name always shown alongside:

| Peril | Incident type | What the agent is doing |
|---|---|---|
| **The Sirens** | `REPEATED_TOOL_CALL` | Calling the same tool with identical arguments again and again |
| **Charybdis** | `SEQUENCE_LOOP` | Circling through the same sequence of steps without progress |
| **Poseidon's storm** | `CONSECUTIVE_FAILURES` | Failing call after call with no change of course |
| **Aeolus' winds** | `TOKEN_BUDGET_EXCEEDED` | A burst of tokens past the per-task budget |
| **Cattle of Helios** | `COST_BUDGET_EXCEEDED` | Estimated spend past the per-task budget |
| **Scylla** | `HIGH_SPENDING` | Spending far faster than normal |
| **Calypso's isle** | `LONG_RUNNING_TASK` | A task that's stuck and won't finish |

Limits are configurable in `.env` (`MAX_REPEATED_CALLS`, `MAX_CONSECUTIVE_FAILURES`, `MAX_TASK_TOKENS`, …).

## Architecture

```
 AI agents ──(SDK / POST /api/events)──▶  FastAPI backend  ──▶  Tiger Data (TimescaleDB)
                                          │  detection engine        hypertable + continuous aggregate
                                          │  auto-pause              (or SQLite for local dev)
                                          ├──▶ Gemini   root-cause analysis
                                          └──▶ Discord  alerts
                                                  ▲
                    React dashboard ──(polls /api every 2.5 s)──┘
```

| Part | Tech | Folder |
|---|---|---|
| Dashboard | React, TypeScript, Vite, Tailwind CSS, Recharts | `frontend/` |
| API and detection | Python, FastAPI, SQLAlchemy | `backend/` |
| Time-series storage | Tiger Data (TimescaleDB): `agent_events` hypertable plus an `events_per_minute` continuous aggregate | `scripts/setup_database.py` |
| AI analysis | Google Gemini (`google-genai`) | `backend/app/services/gemini/` |
| Alerts | Discord webhooks | `backend/app/services/discord/` |
| Agent SDK | Python | `sdk/` |

## Run it locally

You need **Python 3.11+** and **Node.js 20+**. Use two Terminal windows.

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env`:

- `GEMINI_API_KEY`: get one at [aistudio.google.com](https://aistudio.google.com). Optional; without it, incidents still work, just without the AI analysis.
- `DISCORD_WEBHOOK_URL`: optional. Discord → Server Settings → Integrations → Webhooks.
- `DATABASE_URL`: leave as SQLite for local dev, or use Tiger Data (see below).

### 2. Backend (Terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it at http://localhost:8000/api/health. Interactive API docs are at http://localhost:8000/docs.

### 3. Frontend (Terminal 2)

```bash
cd frontend
npm install
cp .env.example .env      # then set VITE_USE_MOCK=false to use the backend
npm run dev
```

Open http://localhost:5173. The dashboard proxies `/api` to the backend, so there's no CORS setup to do.

> **No backend?** Keep `VITE_USE_MOCK=true` and the dashboard runs entirely on built-in mock data.

### 4. Try it

In the dashboard, open **Simulation**:

- **Sing the Sirens' song**: the best single demo. An agent fails 5 times, an incident appears, the agent is paused, and Gemini explains it, all in about 10 seconds.
- **Start all**: runs all five scenarios (healthy, repeating, token-heavy, failing, sequence loop).

Or run a real agent that uses the SDK:

```bash
PYTHONPATH=sdk python3 sdk/example_agent.py
```

## Live Gemini on the Vercel demo

The demo site runs its agents in the browser, but the Oracle can still use **real Gemini** through a Vercel server function (`frontend/api/gemini.ts`). The key stays on Vercel's servers.

1. Vercel → your project → **Settings → Environment Variables** → add `GEMINI_API_KEY` (Production and Preview). Optionally `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).
2. Redeploy (push a commit, or Deployments → ⋯ → Redeploy).

Free-tier safe: Flash-Lite models, 6 requests per minute per visitor, at most 8 automatic readings per visit, and automatic fallback to built-in answers if the quota runs out. **Never** put the key in a `VITE_` variable: those are visible in the browser.

## Using Tiger Data

1. Create a TimescaleDB service in the Tiger Data console and copy its connection string.
2. In `.env`, set `DATABASE_URL` and **start it with `postgresql+psycopg2://`** (not `postgres://` or `postgresql://`):
   ```
   DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:PORT/tsdb?sslmode=require
   ```
3. Create the hypertable and continuous aggregate (one time):
   ```bash
   source backend/.venv/bin/activate
   python scripts/setup_database.py
   ```
4. Restart the backend. The dashboard charts now say **"Tiger Data continuous aggregate"**.

## Gemini quota tips

The free tier limits requests per model per day, and the main Flash models allow far fewer than Flash-Lite. If analyses stop appearing, set a model with a bigger free quota and fallbacks:

```
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3.8-flash
```

Each incident uses one Gemini request. `INCIDENT_COOLDOWN_SECONDS` stops the same problem from creating repeated incidents.

## Adding TokenShield to your own agent

```python
from tokenshield import TokenShield, TokenShieldPaused

monitor = TokenShield(api_url="http://localhost:8000", api_key="development-key")
agent = monitor.register_agent(name="Research Assistant")

try:
    agent.log_tool_call("web_search", success=True, input_tokens=500, output_tokens=200,
                        args={"q": "vector databases"})
except TokenShieldPaused as e:
    print("Stopped by TokenShield:", e)   # end the task here
```

Stopping is cooperative: TokenShield answers every event with whether the agent should stop, and the SDK raises `TokenShieldPaused` when it should.

### Add an agent from the dashboard

On **Heroes**, click **Add a hero**: name it, choose "alert me the moment any step fails", and how many failures in a row should pause it. You get the agent's ID and code to paste:

```python
agent = TokenShield(api_url="http://localhost:8000", api_key="development-key").connect_agent("<agent_id>")
agent.log_tool_call("search_web", success=False, error="HTTP 503")  # report failures so you get alerted
```

Use **Send a test failure** (in the dialog or on the hero's page) to check the alert reaches you.

## API

The full contract the dashboard uses is documented in [`frontend/README.md`](frontend/README.md) and typed in `frontend/src/types/api.ts`. Main endpoints:

`GET /api/metrics/overview` · `GET /api/metrics/timeseries?minutes=N` · `GET /api/agents` · `POST /api/agents/{id}/resume` · `GET /api/events/recent` · `GET /api/incidents` · `PATCH /api/incidents/{id}` · `POST /api/incidents/{id}/analyze` · `POST /api/simulation/start|stop|trigger` · `POST /api/events` (agents, requires `X-API-Key`)

### New endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/api/agents` | Add a hero from the dashboard (`{name, description}`) |
| POST | `/api/agents/{id}/test-failure` | Send one failed step, to test alerts |
| GET / PUT | `/api/agents/{id}/guards` | Read or set one hero's budgets (`null` = global default) |
| POST | `/api/oracle/ask` | `{question, agent_id?}` → plain-language answer |
| GET | `/api/notifications/status` | Which alert channels (Discord, Slack, email, Gemini) are configured |

## Security notes

- Never commit `.env`. It is git-ignored; `.env.example` is the template.
- Tool-call arguments are stored only as a hash, and text sent to Gemini is redacted and truncated.
- Gemini only *suggests* actions. Nothing it says is executed automatically.
