from openai import OpenAI

from app.core.config import settings

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def _chat(system: str, user: str, temperature: float = 0.2) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=500,
        temperature=temperature,
    )
    return response.choices[0].message.content.strip()


def validate_assumptions(assumptions: dict) -> str:
    system = (
        "You are an expert real estate development analyst for Canadian affordable housing. "
        "Validate the following development assumptions (construction costs, timelines, cap rates) "
        "and flag anything that seems out of range for the current market. Be concise."
    )
    return _chat(system, str(assumptions), temperature=0.2)


def scenario_analysis(interest_rate_shift: float, portfolio_summary: dict) -> str:
    system = (
        "You are a senior real estate financial analyst. Analyse the impact of an interest rate "
        "change on the following GPLP portfolio. Cover NOI, cap rates, debt service coverage, "
        "and LP returns. Be concise."
    )
    user = (
        f"Interest rate shift: +{interest_rate_shift}%\n"
        f"Portfolio summary:\n{portfolio_summary}"
    )
    return _chat(system, user, temperature=0.3)
