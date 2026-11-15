import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database.session import Base

def now(): return datetime.now(timezone.utc)
def uid(): return uuid.uuid4().hex
def inc_id(): return 'INC-' + uuid.uuid4().hex[:6].upper()

class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="active")  # active | paused | stopped
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class AgentTask(Base):
    __tablename__ = "agent_tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="running")
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class AgentEvent(Base):
    # Composite PK (id, timestamp) so this table can become a Timescale hypertable.
    __tablename__ = "agent_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True, default=now)
    agent_id: Mapped[str] = mapped_column(String, index=True)
    task_id: Mapped[str] = mapped_column(String, index=True)
    event_type: Mapped[str] = mapped_column(String, default="tool_call")
    tool_name: Mapped[str | None] = mapped_column(String, nullable=True)
    args_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=inc_id)
    agent_id: Mapped[str] = mapped_column(String, index=True)
    task_id: Mapped[str] = mapped_column(String, index=True)
    incident_type: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    estimated_waste: Mapped[float] = mapped_column(Float, default=0.0)
    gemini_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, default="open")  # open | acknowledged | resolved
    notified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AgentGuard(Base):
    """Per-hero overrides of the global detection limits (null = use the global default).
    A separate table so create_all adds it to existing databases without a migration."""
    __tablename__ = "agent_guards"
    agent_id: Mapped[str] = mapped_column(String, primary_key=True)
    max_task_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_task_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_repeated_calls: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_consecutive_failures: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
