from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class AgentRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    is_simulated: bool = False


class EventIn(BaseModel):
    agent_id: str
    task_id: Optional[str] = None
    event_type: str = "tool_call"
    tool_name: Optional[str] = None
    args: Optional[Any] = None          # hashed server-side; raw args are NOT stored
    args_hash: Optional[str] = None
    model: Optional[str] = None
    input_tokens: int = Field(0, ge=0)
    output_tokens: int = Field(0, ge=0)
    success: bool = True
    error_message: Optional[str] = None
    duration_ms: int = Field(0, ge=0)
    is_simulated: bool = False


class IncidentPatch(BaseModel):
    status: str = Field(pattern="^(open|acknowledged|resolved)$")


class IncidentOut(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    task_id: str
    incident_type: str
    severity: str
    description: str
    evidence: dict
    repeated_calls: Optional[int] = None
    estimated_waste: float
    gemini_analysis: Optional[dict] = None
    status: str
    created_at: datetime


class EventOut(BaseModel):
    id: str
    agent_id: str
    task_id: str
    event_type: str
    tool_name: Optional[str]
    model: Optional[str]
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost: float
    success: bool
    error_message: Optional[str]
    duration_ms: int
    is_simulated: bool
    timestamp: datetime


class AgentOut(BaseModel):
    id: str
    name: str
    description: str
    status: str
    is_simulated: bool
    created_at: datetime
    last_seen: datetime
    total_tokens: int = 0
    estimated_cost: float = 0.0
    open_incidents: int = 0
