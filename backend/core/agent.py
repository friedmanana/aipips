"""
Lightweight agentic engine built on Groq (Llama 3.3 70B).

Usage
-----
Define tools as plain Python functions decorated with @agent_tool, then
create a GroqAgent with a system prompt and a list of those tools.
The agent runs an autonomous loop: it calls tools as many times as it
decides, then returns a final text or structured answer.

Example
-------
    @agent_tool(
        description="Search LinkedIn for candidates",
        parameters={
            "type": "object",
            "properties": {
                "job_title": {"type": "string"},
                "skills":    {"type": "array", "items": {"type": "string"}},
            },
            "required": ["job_title"],
        },
    )
    def search_linkedin(job_title: str, skills: list[str] = []) -> list[dict]:
        ...

    agent = GroqAgent(
        system_prompt="You are a recruitment specialist...",
        tools=[search_linkedin],
        max_iterations=10,
    )
    result = agent.run("Find AI engineers in Wellington NZ")
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

# ---------------------------------------------------------------------------
# Tool descriptor
# ---------------------------------------------------------------------------

@dataclass
class AgentTool:
    name: str
    description: str
    parameters: dict          # JSON Schema object
    fn: Callable[..., Any]

    @property
    def schema(self) -> dict:
        """OpenAI-compatible tool schema for Groq function calling."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


def agent_tool(description: str, parameters: dict):
    """Decorator that wraps a Python function into an AgentTool."""
    def decorator(fn: Callable) -> AgentTool:
        return AgentTool(
            name=fn.__name__,
            description=description,
            parameters=parameters,
            fn=fn,
        )
    return decorator


# ---------------------------------------------------------------------------
# Groq client (thin httpx wrapper — same pattern as cv_enhancement_agent)
# ---------------------------------------------------------------------------

def _groq_chat(
    messages: list[dict],
    tools: list[dict] | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    _retry: int = 0,
) -> dict:
    """Send a chat request to Groq with automatic retry on 429 rate-limit."""
    import time

    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set — add it in Render environment variables")

    body: dict[str, Any] = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"

    resp = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        json=body,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=120,
    )

    # Retry on 429 with exponential backoff (max 3 retries)
    if resp.status_code == 429 and _retry < 3:
        wait = 20 * (2 ** _retry)   # 20s, 40s, 80s
        print(f"[groq] 429 rate-limit — waiting {wait}s then retrying (attempt {_retry + 1}/3)")
        time.sleep(wait)
        return _groq_chat(messages, tools, temperature, max_tokens, _retry + 1)

    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Agent engine
# ---------------------------------------------------------------------------

class GroqAgent:
    """
    Autonomous agent powered by Llama 3.3 70B on Groq.

    The agent loop:
      1. Send system prompt + conversation history to Groq
      2. If the model wants to call a tool → execute it, append result, repeat
      3. If the model is done → return its final response text
    """

    def __init__(
        self,
        system_prompt: str,
        tools: list[AgentTool],
        max_iterations: int = 15,
        temperature: float = 0.2,
    ):
        self.system_prompt = system_prompt
        self.tools = {t.name: t for t in tools}
        self.tool_schemas = [t.schema for t in tools]
        self.max_iterations = max_iterations
        self.temperature = temperature

    def run(self, user_message: str) -> str:
        """Run the agent and return the final text response."""
        messages: list[dict] = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user",   "content": user_message},
        ]

        for iteration in range(self.max_iterations):
            response = _groq_chat(
                messages=messages,
                tools=self.tool_schemas or None,
                temperature=self.temperature,
            )

            choice = response["choices"][0]
            finish_reason = choice["finish_reason"]
            message = choice["message"]

            # Append assistant message to history
            messages.append(message)

            if finish_reason == "tool_calls":
                tool_calls = message.get("tool_calls", [])
                print(f"[agent] iteration {iteration+1}: calling {len(tool_calls)} tool(s)")

                for tc in tool_calls:
                    fn_name = tc["function"]["name"]
                    fn_args_raw = tc["function"].get("arguments", "{}")
                    tool_call_id = tc["id"]

                    try:
                        fn_args = json.loads(fn_args_raw)
                        tool = self.tools.get(fn_name)
                        if tool is None:
                            result = f"Error: tool '{fn_name}' not found"
                        else:
                            print(f"[agent]   → {fn_name}({fn_args})")
                            result = tool.fn(**fn_args)
                    except Exception as exc:
                        result = f"Tool error: {exc}"
                        print(f"[agent]   ✗ {fn_name} failed: {exc}")

                    # Groq expects tool results as role=tool messages
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "name": fn_name,
                        "content": json.dumps(result, default=str),
                    })

            else:
                # Model finished — return its response
                print(f"[agent] done after {iteration+1} iteration(s)")
                return message.get("content", "")

        return "Agent reached maximum iterations without completing."

    def run_structured(self, user_message: str, output_schema: dict) -> dict:
        """
        Run the agent, then ask it to return a final JSON answer
        conforming to output_schema. Returns parsed dict.
        """
        # First run the agentic loop to gather information
        intermediate = self.run(user_message)

        # Then ask for structured output
        structured_prompt = (
            f"Based on your analysis:\n\n{intermediate}\n\n"
            f"Now return ONLY a JSON object matching this schema:\n"
            f"{json.dumps(output_schema, indent=2)}\n\n"
            "JSON only, no other text."
        )
        response = _groq_chat(
            messages=[
                {"role": "system", "content": "Return only valid JSON matching the requested schema."},
                {"role": "user",   "content": structured_prompt},
            ],
            temperature=0.1,
            max_tokens=4096,
        )
        raw = response["choices"][0]["message"]["content"]
        try:
            import re
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            return json.loads(match.group()) if match else {}
        except (json.JSONDecodeError, AttributeError):
            return {}
