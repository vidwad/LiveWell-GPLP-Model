from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user
from app.core.config import settings
from app.db.models import User
from app.schemas.ai import AIResponse, AssumptionValidationRequest, ScenarioRequest
from app.services import ai as ai_service

router = APIRouter()


@router.post("/validate", response_model=AIResponse)
def validate_assumptions(
    payload: AssumptionValidationRequest,
    _: User = Depends(get_current_user),
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured (missing OPENAI_API_KEY)")
    result = ai_service.validate_assumptions(payload.model_dump(exclude_none=True))
    return AIResponse(result=result)


@router.post("/scenario", response_model=AIResponse)
def scenario_analysis(
    payload: ScenarioRequest,
    _: User = Depends(get_current_user),
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured (missing OPENAI_API_KEY)")
    result = ai_service.scenario_analysis(
        payload.interest_rate_shift, payload.portfolio_summary
    )
    return AIResponse(result=result)
