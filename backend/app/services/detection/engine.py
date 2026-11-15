"""Rule-based detection. Pure functions: events in, detections out. No DB, no network.

An 'event' is a dict with: tool_name, args_hash, success, error_message,
total_tokens, estimated_cost, timestamp (datetime). Events are ordered oldest -> newest.
Gemini never detects anything; it only explains what this module found.
"""
from dataclasses import dataclass, field


@dataclass
class Thresholds:
    max_repeated_calls: int = 5
    max_consecutive_failures: int = 5
    max_sequence_repeats: int = 3
    max_task_tokens: int = 50000
    max_task_cost: float = 2.00
    max_task_duration_seconds: int = 600
    spend_spike_factor: float = 3.0
    spend_spike_window: int = 10


@dataclass
class Detection:
    incident_type: str
    severity: str
    description: str
    evidence: dict = field(default_factory=dict)
    estimated_waste: float = 0.0
    should_pause: bool = False  # Token Protection Mode: ask the agent to stop


def _key(e):
    return (e.get("tool_name"), e.get("args_hash"))


def detect_repeated_calls(events, t):
    if not events:
        return None
    last = _key(events[-1])
    run = 0
    for e in reversed(events):
        if _key(e) == last:
            run += 1
        else:
            break
    if run < t.max_repeated_calls:
        return None
    repeated = events[-run:]
    waste = sum(e["estimated_cost"] for e in repeated[1:])  # first call was legitimate
    failed = sum(1 for e in repeated if not e["success"])
    return Detection(
        "REPEATED_TOOL_CALL",
        "critical" if run >= t.max_repeated_calls * 3 else "high",
        f"Tool '{last[0]}' was called {run} times in a row with identical arguments"
        f" ({failed} failed).",
        {"tool_name": last[0], "repeated_calls": run, "failed_calls": failed,
         "last_error": repeated[-1].get("error_message")},
        round(waste, 6), should_pause=True)


def detect_consecutive_failures(events, t):
    run = 0
    for e in reversed(events):
        if not e["success"]:
            run += 1
        else:
            break
    if run < t.max_consecutive_failures:
        return None
    recent = events[-run:]
    errors = sorted({str(e.get("error_message")) for e in recent})
    return Detection(
        "CONSECUTIVE_FAILURES", "high",
        f"{run} consecutive tool calls failed.",
        {"consecutive_failures": run, "errors": errors[:5],
         "tools": sorted({str(e.get("tool_name")) for e in recent})},
        round(sum(e["estimated_cost"] for e in recent), 6), should_pause=True)


def detect_sequence_loop(events, t):
    """Find a repeating block of 2-6 calls, e.g. search -> read -> search -> read -> ..."""
    reps = t.max_sequence_repeats
    keys = [_key(e) for e in events]
    for period in range(2, 7):
        need = period * reps
        if len(keys) < need:
            continue
        block = keys[-period:]
        if len(set(block)) < 2:
            continue  # a single repeated call is handled by detect_repeated_calls
        if all(keys[-need + i] == block[i % period] for i in range(need)):
            window = events[-need:]
            return Detection(
                "SEQUENCE_LOOP", "high",
                f"A sequence of {period} tool calls repeated {reps}+ times.",
                {"sequence": [k[0] for k in block], "period": period, "repeats": reps},
                round(sum(e["estimated_cost"] for e in window[period:]), 6),
                should_pause=True)
    return None


def detect_token_budget(events, t):
    total = sum(e["total_tokens"] for e in events)
    if total <= t.max_task_tokens:
        return None
    return Detection(
        "TOKEN_BUDGET_EXCEEDED", "critical",
        f"Task used {total} tokens (limit {t.max_task_tokens}).",
        {"total_tokens": total, "limit": t.max_task_tokens},
        round(sum(e["estimated_cost"] for e in events) * (total - t.max_task_tokens) / total, 6),
        should_pause=True)


def detect_cost_budget(events, t):
    cost = sum(e["estimated_cost"] for e in events)
    if cost <= t.max_task_cost:
        return None
    return Detection(
        "COST_BUDGET_EXCEEDED", "critical",
        f"Estimated task cost ${cost:.2f} exceeds limit ${t.max_task_cost:.2f} (estimate).",
        {"estimated_cost": round(cost, 6), "limit": t.max_task_cost},
        round(cost - t.max_task_cost, 6), should_pause=True)


def detect_spend_spike(events, t):
    w = t.spend_spike_window
    if len(events) < w * 2:
        return None
    recent = sum(e["estimated_cost"] for e in events[-w:]) / w
    earlier = sum(e["estimated_cost"] for e in events[:-w]) / (len(events) - w)
    if earlier <= 0 or recent < earlier * t.spend_spike_factor:
        return None
    return Detection(
        "HIGH_SPENDING", "medium",
        f"Recent spend per call is {recent / earlier:.1f}x this task's earlier average.",
        {"recent_avg_cost": round(recent, 6), "earlier_avg_cost": round(earlier, 6)},
        round((recent - earlier) * w, 6))


def detect_long_running(events, t):
    if len(events) < 2:
        return None
    secs = (events[-1]["timestamp"] - events[0]["timestamp"]).total_seconds()
    if secs <= t.max_task_duration_seconds:
        return None
    return Detection(
        "LONG_RUNNING_TASK", "medium",
        f"Task has been running {int(secs)}s (limit {t.max_task_duration_seconds}s).",
        {"duration_seconds": int(secs), "limit": t.max_task_duration_seconds})


DETECTORS = [detect_repeated_calls, detect_consecutive_failures, detect_sequence_loop,
             detect_token_budget, detect_cost_budget, detect_spend_spike, detect_long_running]


def run_detection(events, thresholds=None):
    t = thresholds or Thresholds()
    found = [d for d in (fn(events, t) for fn in DETECTORS) if d]
    # One problem, one incident: if the same repeated call explains the whole failure streak,
    # drop the redundant CONSECUTIVE_FAILURES.
    rep = next((d for d in found if d.incident_type == "REPEATED_TOOL_CALL"), None)
    if rep:
        found = [d for d in found if not (
            d.incident_type == "CONSECUTIVE_FAILURES"
            and d.evidence["consecutive_failures"] <= rep.evidence["repeated_calls"])]
    return found
