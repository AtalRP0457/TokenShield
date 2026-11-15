import uuid
import requests
from .events import build_event


class TokenShieldPaused(Exception):
    """Raised when TokenShield asks the agent to stop (Token Protection Mode).
    Enforcement is cooperative: it only works if your agent uses this SDK and lets this propagate."""


class Agent:
    def __init__(self, client, agent_id, name):
        self._c, self.id, self.name = client, agent_id, name
        self.task_id = uuid.uuid4().hex
        self.paused = False

    def new_task(self):
        self.task_id = uuid.uuid4().hex
        return self.task_id

    def log_tool_call(self, tool_name, success=True, input_tokens=0, output_tokens=0,
                      error=None, duration_ms=0, model=None, args=None, raise_on_pause=True):
        body = build_event(self.id, self.task_id, tool_name, success, input_tokens,
                           output_tokens, error, duration_ms, model, args)
        r = self._c._post("/api/events", body)
        self.paused = r.get("should_stop", False)
        if self.paused and raise_on_pause:
            raise TokenShieldPaused(f"Agent '{self.name}' paused by TokenShield")
        return r


class TokenShield:
    def __init__(self, api_url, api_key):
        self.api_url, self.api_key = api_url.rstrip("/"), api_key

    def _post(self, path, body):
        r = requests.post(self.api_url + path, json=body,
                          headers={"X-API-Key": self.api_key}, timeout=10)
        r.raise_for_status()
        return r.json()

    def register_agent(self, name, description=""):
        """Create a new agent in TokenShield and return it."""
        r = self._post("/api/agents/register", {"name": name, "description": description})
        return Agent(self, r["agent_id"], name)

    def connect_agent(self, agent_id, name=""):
        """Report as an agent you already added in the dashboard ("Add a hero")."""
        return Agent(self, agent_id, name or agent_id)
