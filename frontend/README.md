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
VITE_API_BASE_URL=                     # leave empty
BACKEND_URL=http://localhost:8000      # where the backend runs
```

The dashboard calls `/api/...` on its own dev server, and Vite forwards those requests to `BACKEND_URL` (see `vite.config.ts`). The browser never makes a cross-origin request, so CORS can't break the connection, even if you open the dashboard on `127.0.0.1` or another port. To use a backend on another laptop, set `BACKEND_URL=http://<its-address>:8000`.

There is no WebSocket: the live feed and incidents poll every 2–3 s, as the backend contract asks. Restart `npm run dev` after editing `.env`.

## How the code is organised

```
src/
  types/api.ts            ← THE API contract. Every response shape lives here.
  types/settings.ts
  services/
    config.ts             env vars (mock flag, base URL, poll interval)
    http.ts               fetch wrapper: query params, timeout, JSON, ApiError
    apiClient.ts          TokenShieldApi interface — one method per endpoint
    realApi.ts            interface → FastAPI endpoints
    mock/mockTypes.ts     the mock's private internal state shapes
    mock/mockData.ts      deterministic seed data
    mock/mockApi.ts       in-memory backend + simulator, returns v2 shapes
    index.ts              exports `api` (mock or real, chosen by env)
    liveFeed.ts           polls GET /api/events/recent every 2.5 s
    settingsStorage.ts    protection limits (localStorage)
  hooks/                  useApiQuery, LiveEventsProvider, SimulationProvider, useNow
  lib/                    formatting (parseUtc), labels/perils, timeseries gap-filling, task grouping
  components/
    ui/ layout/ dashboard/ charts/ agents/ incidents/ activity/
  pages/                  one file per route
```

**Rule of thumb:** pages call `api.*` through `useApiQuery`; they never call `fetch` and never import mock data. Swapping mock ↔ real is one env var.

## API contract (v2, from the backend team)

`src/types/api.ts` mirrors the backend contract exactly. Mock mode (`src/services/mock/`) returns the same shapes, so switching `VITE_USE_MOCK` changes nothing else.

| Endpoint | Used for |
|---|---|
| `GET /api/metrics/overview` | KPI cards |
| `GET /api/metrics/timeseries?minutes=N` | Token, spend and tool-call charts (missing minutes are filled with 0) |
| `GET /api/agents`, `GET /api/agents/{id}` | Heroes list and agent page |
| `GET /api/agents/{id}/events?limit=100` | Agent charts, tool-call history, tasks, errors |
| `POST /api/agents/{id}/resume` | **Resume agent** button (shown when an agent is paused) |
| `GET /api/events/recent?limit=50` | Ship's log (live feed, polled) |
| `GET /api/incidents`, `GET /api/incidents/{id}` | Perils list and incident page (polled; shows "Analyzing…" until `gemini_analysis` arrives) |
| `PATCH /api/incidents/{id}` | Acknowledge / Mark resolved / Reopen |
| `POST /api/incidents/{id}/analyze` | **Re-run analysis** (45 s timeout) |
| `POST /api/simulation/start`, `/stop`, `/trigger?scenario=…` | Simulation menu |
| `GET /api/health` | Connection pill in the header |

UI rules from the contract that the frontend follows:

- Every cost is labelled as an estimate.
- Agents and events with `is_simulated: true` get a **SIMULATED** badge (the "[SIM]" name prefix is hidden because the badge says it).
- Timestamps are parsed as UTC even when the "Z" is missing (`parseUtc` in `src/lib/format.ts`).
- Gemini `confidence` (0–1) is shown as a percentage; `evidence` is rendered as key/value pairs.

Incident types are shown with their Odyssey names: `REPEATED_TOOL_CALL` = The Sirens, `SEQUENCE_LOOP` = Charybdis, `CONSECUTIVE_FAILURES` = Poseidon's storm, `TOKEN_BUDGET_EXCEEDED` = Aeolus' winds, `COST_BUDGET_EXCEEDED` = Cattle of Helios, `HIGH_SPENDING` = Scylla, `LONG_RUNNING_TASK` = Calypso's isle.

Not in the API yet (the UI handles it without inventing data):

- **No pause endpoint**: TokenShield pauses agents itself; the UI only offers Resume.
- **No tasks endpoint**: an agent's tasks are grouped from its events by `task_id`.
- **No settings endpoint**: protection limits on the settings page are saved in the browser.
