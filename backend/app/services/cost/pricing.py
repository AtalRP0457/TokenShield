"""ESTIMATED costs only. Edit rates to match your provider's current price list.
These are NOT actual provider billing amounts."""
# USD per 1M tokens: (input, output)
MODEL_PRICING = {
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-pro": (1.25, 10.00),
    "gpt-4o": (2.50, 10.00),
    "claude-sonnet": (3.00, 15.00),
    "default": (1.00, 4.00),
}

def estimate_cost(model, input_tokens, output_tokens):
    rin, rout = MODEL_PRICING.get(model or "default", MODEL_PRICING["default"])
    return round((input_tokens * rin + output_tokens * rout) / 1_000_000, 6)
