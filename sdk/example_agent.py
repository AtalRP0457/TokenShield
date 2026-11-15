from tokenshield import TokenShield, TokenShieldPaused

monitor = TokenShield(api_url="http://localhost:8000", api_key="development-key")
agent = monitor.register_agent(name="Research Assistant")
try:
    agent.log_tool_call("web_search", success=True, input_tokens=500, output_tokens=200, args={"q": "ai"})
    for _ in range(30):  # a buggy retry loop
        agent.log_tool_call("http_get", success=False, error="HTTP 503",
                            input_tokens=500, output_tokens=200, args={"url": "https://example.com"})
except TokenShieldPaused as e:
    print("Stopped by TokenShield:", e)
