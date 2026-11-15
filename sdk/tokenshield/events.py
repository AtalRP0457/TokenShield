def build_event(agent_id, task_id, tool_name, success=True, input_tokens=0, output_tokens=0,
                error=None, duration_ms=0, model=None, args=None):
    return {"agent_id": agent_id, "task_id": task_id, "event_type": "tool_call",
            "tool_name": tool_name, "success": success, "input_tokens": input_tokens,
            "output_tokens": output_tokens, "error_message": error,
            "duration_ms": duration_ms, "model": model, "args": args}
