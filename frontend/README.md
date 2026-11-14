# TokenShield — Frontend

React + TypeScript + Vite + Tailwind CSS v4 + Recharts + Lucide dashboard for monitoring AI agents and stopping wasted spend.

## Run it

```bash
cd frontend
npm install
cp .env.example .env   # already done once; edit to switch modes
npm run dev            # http://localhost:5173
```

Mock mode (`VITE_USE_MOCK=true`, the default) runs entirely in the browser — no backend needed. A simulator streams live events; use **Simulation** in the top bar to inject an execution loop, failure storm or token spike.

### Connect the FastAPI backend

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/events   # optional; omit to use polling
```

The backend must allow CORS from `http://localhost:5173`:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
```

## How the code is organised

```
src/
  types/api.ts            ← THE API contract. Every response shape lives here.
  types/settings.ts
  services/
    config.ts             env vars (mock flag, base URL, WS URL)
    http.ts               fetch wrapper: timeout, JSON, ApiError
    apiClient.ts          TokenShieldApi interface — one method per endpoint
    realApi.ts            interface → FastAPI endpoints
    mock/mockData.ts      deterministic seed data
    mock/mockApi.ts       in-memory backend + event simulator
    index.ts              exports `api` (mock or real, chosen by env)
    liveFeed.ts           WebSocket → polling fallback → mock bus
    settingsStorage.ts    protection limits (localStorage)
  hooks/                  useApiQuery, LiveEventsProvider, SimulationProvider, useNow
  lib/                    formatting, enum labels/colours, chart palette
  components/
    ui/ layout/ dashboard/ charts/ agents/ incidents/ activity/
  pages/                  one file per route
```

**Rule of thumb:** pages call `api.*` through `useApiQuery`; they never call `fetch` and never import mock data. Swapping mock ↔ real is one env var.

## API contract (agree this with the backend)

`src/types/api.ts` is a *proposed* contract — the backend spec only listed endpoints, not response bodies. If the FastAPI models differ, update that file and TypeScript will point at every place that needs to change.

| Endpoint | Frontend expects |
|---|---|
| `GET /api/agents` | `Agent[]` |
| `GET /api/agents/{id}` | `AgentDetail` (Agent + `current_tasks`) |
| `GET /api/agents/{id}/events` | `AgentEvent[]` |
| `POST /api/agents/{id}/pause` | body `{ reason? }` → `Agent` (status `paused`, `paused_by: "user"`) |
| `POST /api/agents/{id}/resume` | → `Agent` (status back to `active`) |
| `POST /api/events` | → `{ event, action: "continue" \| "stop", reason }` |
| `GET /api/metrics/overview` | `MetricsOverview` |
| `GET /api/metrics/tokens` | `TokenMetricPoint[]` (hourly, oldest first) |
| `GET /api/metrics/cost` | `CostMetricPoint[]` (hourly, oldest first) |
| `GET /api/metrics/agents` | `AgentMetric[]` |
| `GET /api/incidents` / `{id}` | `Incident[]` / `Incident` |
| `PATCH /api/incidents/{id}` | body `{ status }` → `Incident` |
| `POST /api/simulation/start\|stop\|trigger` | `{ running, message }`; trigger body `{ scenario }` |
| `GET /api/health` | `{ status, version? }` |
| WebSocket (optional) | messages are an `AgentEvent`, an array of them, or `{ data: … }` |

Gaps worth raising with the backend:

- **No global events endpoint** — polling fetches `/api/agents/{id}/events` per agent. A `GET /api/events?limit=` would be cheaper.
- **No settings endpoint** — protection limits are stored in the browser and labelled "Saved in browser only". When the backend enforces a limit, add its key to `BACKEND_ENFORCED_SETTINGS` in `services/settingsStorage.ts`.
- **No simulation status endpoint** — in real mode the UI shows Start *and* Stop until the first response tells it the state.

## How TokenShield stops an agent

TokenShield can't kill another program, so agents cooperate: after every `POST /api/events` the agent reads `action` and ends its task on `"stop"`.

```python
resp = requests.post(f"{API}/api/events", json=event).json()
if resp["action"] == "stop":
    print("TokenShield stopped me:", resp["reason"])
    return  # end the task
```

The backend answers `"stop"` when:

- the agent is paused (from the dashboard's **Pause agent** button, or by an earlier violation), or
- the event breaks a protection limit: same call repeated ≥ max repeated tool calls (Charybdis), failures in a row ≥ max consecutive failures (Poseidon's storm), or a task's tokens > max tokens per task (Aeolus' winds).

On a violation it also creates an incident with `agent_stopped: true` and sets the agent to `status: "paused"`, `paused_by: "tokenshield"`, `pause_reason: "<why>"`.

`enforce()` in `src/services/mock/mockApi.ts` implements exactly these rules. Use it as the reference for the FastAPI version.
