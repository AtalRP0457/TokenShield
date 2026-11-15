"""Create tables. If DATABASE_URL is Postgres + TimescaleDB (Tiger Data), also make agent_events
a hypertable and add a continuous aggregate for per-minute token/cost."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from sqlalchemy import text
from app.database.session import Base, engine
from app.models import models  # noqa

Base.metadata.create_all(engine)
if engine.dialect.name == "postgresql":
    with engine.begin() as c:
        c.execute(text("SELECT create_hypertable('agent_events','timestamp', if_not_exists => TRUE)"))
    # Continuous aggregates can't run inside a transaction block:
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as c:
        c.execute(text("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS events_per_minute
        WITH (timescaledb.continuous) AS
        SELECT time_bucket('1 minute', timestamp) AS bucket, agent_id,
               count(*) AS calls, sum(total_tokens) AS tokens, sum(estimated_cost) AS cost,
               count(*) FILTER (WHERE NOT success) AS failures
        FROM agent_events GROUP BY bucket, agent_id WITH NO DATA"""))
        try:  # real-time aggregation: include recent rows not yet materialized
            c.execute(text("ALTER MATERIALIZED VIEW events_per_minute SET (timescaledb.materialized_only = false)"))
        except Exception as exc:
            print("note: could not enable real-time aggregation:", exc)
        c.execute(text("""SELECT add_continuous_aggregate_policy('events_per_minute',
            start_offset => INTERVAL '1 hour', end_offset => INTERVAL '10 seconds',
            schedule_interval => INTERVAL '10 seconds', if_not_exists => TRUE)"""))
    print("Hypertable + continuous aggregate ready.")
else:
    print("SQLite fallback: tables created (no hypertable).")
