import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.services.gemini.analyzer import analyze, build_prompt, redact

INC = {"agent_name": "A", "incident_type": "REPEATED_TOOL_CALL", "rule_severity": "high",
       "description": "x", "evidence": {"last_error": "HTTP 503 api_key=SECRET123 AIzaSyABCDEFGHIJKLMNOPQRSTUV"},
       "estimated_waste_usd_estimate": 0.01}

GOOD = {"summary": "s", "probable_root_cause": "r", "severity": "HIGH", "confidence": 85,
        "evidence": ["e"], "recommended_actions": ["a"],
        "estimated_wasted_resources": "~$0.01 (estimate)", "additional_investigation": ["i"]}

def test_valid_response_parsed_and_normalised():
    r = analyze(INC, caller=lambda p: "```json\n" + json.dumps(GOOD) + "\n```")
    assert r is not None and r.severity == "high" and r.confidence == 0.85

def test_invalid_json_falls_back_to_none():
    assert analyze(INC, caller=lambda p: "not json at all") is None

def test_missing_fields_falls_back_to_none():
    assert analyze(INC, caller=lambda p: json.dumps({"summary": "only this"})) is None

def test_gemini_exception_falls_back_to_none():
    def boom(p): raise RuntimeError("quota exceeded")
    assert analyze(INC, caller=boom) is None

def test_secrets_never_reach_prompt():
    p = build_prompt(INC)
    assert "SECRET123" not in p and "AIzaSy" not in p and "[REDACTED]" in p

def test_redact_truncates():
    assert len(redact("x" * 1000)) == 200
