import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datetime import datetime, timedelta, timezone
from app.services.cost.pricing import estimate_cost
from app.services.detection.engine import Thresholds, run_detection

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

def ev(i, tool="web_search", h="a", ok=True, tokens=700, cost=0.001, err=None):
    return dict(tool_name=tool, args_hash=h, success=ok, error_message=err,
                total_tokens=tokens, estimated_cost=cost, timestamp=T0 + timedelta(seconds=i))

def types(events, **kw):
    return {d.incident_type for d in run_detection(events, Thresholds(**kw))}

def test_cost_estimate():
    assert estimate_cost("gemini-2.5-flash", 1_000_000, 0) == 0.30
    assert estimate_cost("unknown-model", 1_000_000, 1_000_000) == 5.0  # default pricing

def test_healthy_has_no_incidents():
    events = [ev(i, tool=f"t{i}", h=str(i)) for i in range(8)]
    assert types(events) == set()

def test_repeated_call_detected_with_waste():
    events = [ev(i, ok=False, err="HTTP 503") for i in range(6)]
    d = [x for x in run_detection(events) if x.incident_type == "REPEATED_TOOL_CALL"][0]
    assert d.evidence["repeated_calls"] == 6
    assert abs(d.estimated_waste - 0.005) < 1e-9   # 5 wasted calls, first excluded
    assert d.should_pause

def test_below_threshold_not_flagged():
    assert "REPEATED_TOOL_CALL" not in types([ev(i) for i in range(4)])

def test_different_args_not_a_repeat():
    events = [ev(i, h=str(i)) for i in range(10)]
    assert "REPEATED_TOOL_CALL" not in types(events)

def test_consecutive_failures_across_tools():
    events = [ev(i, tool=f"t{i}", h=str(i), ok=False, err="HTTP 503") for i in range(5)]
    assert "CONSECUTIVE_FAILURES" in types(events)

def test_failure_streak_reset_by_success():
    events = [ev(i, tool=f"t{i}", h=str(i), ok=(i == 3)) for i in range(7)]
    assert "CONSECUTIVE_FAILURES" not in types(events)

def test_sequence_loop():
    seq = ["search", "open", "summarize"]
    events = [ev(i, tool=seq[i % 3], h=seq[i % 3]) for i in range(9)]
    found = [d for d in run_detection(events) if d.incident_type == "SEQUENCE_LOOP"]
    assert found and found[0].evidence["sequence"] == seq

def test_token_and_cost_budget():
    events = [ev(i, tool=f"t{i}", h=str(i), tokens=20000, cost=1.0) for i in range(3)]
    t = types(events)
    assert "TOKEN_BUDGET_EXCEEDED" in t and "COST_BUDGET_EXCEEDED" in t

def test_long_running():
    events = [ev(0), ev(1000, tool="x", h="x")]
    assert "LONG_RUNNING_TASK" in types(events)

def test_spend_spike():
    events = [ev(i, tool=f"t{i}", h=str(i), cost=0.001) for i in range(10)] + \
             [ev(10 + i, tool=f"u{i}", h=f"u{i}", cost=0.01) for i in range(10)]
    assert "HIGH_SPENDING" in types(events)

def test_thresholds_configurable():
    events = [ev(i) for i in range(3)]
    assert "REPEATED_TOOL_CALL" in types(events, max_repeated_calls=3)
