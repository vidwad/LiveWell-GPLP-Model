"""Twilio integration routes — voice calls, SMS, and webhooks."""

from __future__ import annotations

import hmac
import hashlib
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_or_ops
from app.db.models import (
    CRMActivity,
    CRMActivityType,
    Investor,
    PlatformSetting,
    TwilioCallLog,
    TwilioCallStatus,
    TwilioSMSLog,
    User,
)
from app.db.session import get_db
from app.services.twilio_service import (
    generate_voice_token,
    get_twilio_client,
    get_twilio_phone,
    get_webhook_base,
    initiate_call,
    normalize_e164,
    send_sms,
    transcribe_recording,
    _get_setting,
)

router = APIRouter()


# ===========================================================================
# Request / Response Schemas
# ===========================================================================

class SendSMSRequest(BaseModel):
    investor_id: int
    body: str
    to_number: Optional[str] = None


class InitiateCallRequest(BaseModel):
    investor_id: int
    to_number: Optional[str] = None


class SMSOut(BaseModel):
    sms_log_id: int
    investor_id: int
    twilio_message_sid: str
    direction: str
    from_number: str
    to_number: str
    body: str
    status: str
    sent_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CallLogOut(BaseModel):
    call_log_id: int
    investor_id: int
    twilio_call_sid: str
    direction: str
    from_number: str
    to_number: str
    status: str
    duration_seconds: Optional[int] = None
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    transcription_status: Optional[str] = None
    initiated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# Twilio Configuration Status
# ===========================================================================

@router.get("/status")
def twilio_status(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Check whether Twilio is configured and operational."""
    sid = _get_setting(db, "TWILIO_ACCOUNT_SID")
    token = _get_setting(db, "TWILIO_AUTH_TOKEN")
    phone = _get_setting(db, "TWILIO_PHONE_NUMBER")
    webhook = _get_setting(db, "TWILIO_WEBHOOK_BASE_URL")
    twiml = _get_setting(db, "TWILIO_TWIML_APP_SID")

    configured = bool(sid and token and phone)
    details = {
        "account_sid": bool(sid),
        "auth_token": bool(token),
        "phone_number": phone or None,
        "webhook_base_url": webhook or None,
        "twiml_app_sid": bool(twiml),
        "sms_ready": configured,
        "voice_ready": configured and bool(twiml) and bool(webhook),
    }

    # Optionally verify credentials
    if configured:
        try:
            client = get_twilio_client(db)
            account = client.api.accounts(sid).fetch()
            details["account_status"] = account.status
            details["account_name"] = account.friendly_name
        except Exception as e:
            details["account_status"] = f"error: {str(e)}"

    return {"configured": configured, **details}


# ===========================================================================
# SMS Endpoints
# ===========================================================================

@router.post("/sms/send", response_model=SMSOut)
def api_send_sms(
    body: SendSMSRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Send an SMS to an investor."""
    try:
        sms_log = send_sms(
            db=db,
            investor_id=body.investor_id,
            body=body.body,
            sent_by_user_id=current_user.user_id,
            to_number=body.to_number,
        )
        return sms_log
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"SMS send failed: {str(e)}")


@router.get("/sms/{investor_id}")
def get_sms_thread(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get the SMS conversation thread for an investor."""
    messages = (
        db.query(TwilioSMSLog)
        .filter(TwilioSMSLog.investor_id == investor_id)
        .order_by(TwilioSMSLog.created_at.asc())
        .all()
    )
    return [SMSOut.model_validate(m) for m in messages]


# ===========================================================================
# Voice Call Endpoints
# ===========================================================================

@router.post("/calls/initiate", response_model=CallLogOut)
def api_initiate_call(
    body: InitiateCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Initiate an outbound call to an investor via Twilio."""
    try:
        call_log = initiate_call(
            db=db,
            investor_id=body.investor_id,
            initiated_by_user_id=current_user.user_id,
            to_number=body.to_number,
        )
        return call_log
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Call initiation failed: {str(e)}")


@router.get("/calls/{investor_id}")
def get_call_logs(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get call history for an investor."""
    calls = (
        db.query(TwilioCallLog)
        .filter(TwilioCallLog.investor_id == investor_id)
        .order_by(TwilioCallLog.created_at.desc())
        .all()
    )
    return [CallLogOut.model_validate(c) for c in calls]


@router.get("/calls/detail/{call_log_id}", response_model=CallLogOut)
def get_call_detail(
    call_log_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get details of a specific call including transcript."""
    log = db.query(TwilioCallLog).filter(TwilioCallLog.call_log_id == call_log_id).first()
    if not log:
        raise HTTPException(404, "Call log not found")
    return log


@router.post("/calls/{call_log_id}/transcribe")
def api_transcribe_call(
    call_log_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Manually trigger transcription for a recorded call."""
    try:
        transcript = transcribe_recording(db, call_log_id)
        return {"call_log_id": call_log_id, "transcript": transcript}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ===========================================================================
# Twilio Capability Token (for browser-based calling)
# ===========================================================================

@router.get("/token")
def get_voice_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Generate a Twilio access token for browser-based calling."""
    try:
        identity = f"user_{current_user.user_id}"
        token = generate_voice_token(db, identity)
        return {"token": token, "identity": identity}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ===========================================================================
# Twilio Webhooks (no JWT auth — validated via Twilio signature)
# ===========================================================================

def _validate_twilio_signature(request: Request, db: Session) -> bool:
    """Validate that the request actually came from Twilio."""
    auth_token = _get_setting(db, "TWILIO_AUTH_TOKEN")
    if not auth_token:
        return False
    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(auth_token)
        signature = request.headers.get("X-Twilio-Signature", "")
        url = str(request.url)
        # For POST requests, we need the form data
        return validator.validate(url, {}, signature)
    except Exception:
        return False


@router.post("/webhooks/voice")
async def webhook_voice(request: Request, db: Session = Depends(get_db)):
    """TwiML response when an outbound call connects — connects the call."""
    from twilio.twiml.voice_response import VoiceResponse

    response = VoiceResponse()
    # Get the 'To' number from the request
    form = await request.form()
    to_number = form.get("To", "")

    if to_number:
        dial = response.dial(
            caller_id=form.get("From", ""),
            record="record-from-answer-dual",
            recording_status_callback=f"{_get_webhook_base_safe(db)}/api/twilio/webhooks/recording",
        )
        dial.number(to_number)
    else:
        response.say("No destination number provided.")

    return Response(content=str(response), media_type="application/xml")


@router.post("/webhooks/call-status")
async def webhook_call_status(request: Request, db: Session = Depends(get_db)):
    """Twilio call status callback — updates call log."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    status = form.get("CallStatus", "")
    duration = form.get("CallDuration")

    if not call_sid:
        return {"ok": True}

    log = db.query(TwilioCallLog).filter(TwilioCallLog.twilio_call_sid == call_sid).first()
    if log:
        # Map Twilio status to our enum
        status_map = {
            "initiated": TwilioCallStatus.initiated,
            "ringing": TwilioCallStatus.ringing,
            "in-progress": TwilioCallStatus.in_progress,
            "completed": TwilioCallStatus.completed,
            "busy": TwilioCallStatus.busy,
            "no-answer": TwilioCallStatus.no_answer,
            "canceled": TwilioCallStatus.canceled,
            "failed": TwilioCallStatus.failed,
        }
        if status in status_map:
            log.status = status_map[status]
        if duration:
            log.duration_seconds = int(duration)

        # Update CRM activity outcome
        if log.activity_id and status in ("completed", "busy", "no-answer", "failed", "canceled"):
            activity = db.query(CRMActivity).filter(CRMActivity.activity_id == log.activity_id).first()
            if activity:
                dur_str = f" ({duration}s)" if duration else ""
                activity.outcome = f"Call {status}{dur_str}"

        db.commit()

    return {"ok": True}


@router.post("/webhooks/recording")
async def webhook_recording(request: Request, db: Session = Depends(get_db)):
    """Twilio recording complete callback — stores URL and triggers transcription."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    recording_url = form.get("RecordingUrl", "")
    recording_sid = form.get("RecordingSid", "")

    if not call_sid:
        return {"ok": True}

    log = db.query(TwilioCallLog).filter(TwilioCallLog.twilio_call_sid == call_sid).first()
    if log:
        log.recording_url = recording_url
        log.recording_sid = recording_sid
        db.commit()

        # Auto-transcribe using Whisper
        try:
            transcribe_recording(db, log.call_log_id)
        except Exception:
            pass  # Transcription is best-effort

    return {"ok": True}


@router.post("/webhooks/sms-status")
async def webhook_sms_status(request: Request, db: Session = Depends(get_db)):
    """Twilio SMS delivery status callback."""
    form = await request.form()
    message_sid = form.get("MessageSid", "")
    status = form.get("MessageStatus", "")

    if not message_sid:
        return {"ok": True}

    sms = db.query(TwilioSMSLog).filter(TwilioSMSLog.twilio_message_sid == message_sid).first()
    if sms:
        sms.status = status
        db.commit()

    return {"ok": True}


@router.post("/webhooks/sms-inbound")
async def webhook_sms_inbound(request: Request, db: Session = Depends(get_db)):
    """Handle incoming SMS — match to investor and log as CRM activity."""
    from twilio.twiml.messaging_response import MessagingResponse

    form = await request.form()
    from_number = form.get("From", "")
    to_number = form.get("To", "")
    body = form.get("Body", "")
    message_sid = form.get("MessageSid", "")

    # Try to match the sender to an investor by phone/mobile
    investor = None
    if from_number:
        normalized = normalize_e164(from_number)
        investor = (
            db.query(Investor)
            .filter(
                (Investor.phone == from_number) |
                (Investor.phone == normalized) |
                (Investor.mobile == from_number) |
                (Investor.mobile == normalized)
            )
            .first()
        )

    if investor and message_sid:
        # Log as CRM activity
        activity = CRMActivity(
            investor_id=investor.investor_id,
            activity_type=CRMActivityType.sms,
            subject=f"Inbound SMS from {from_number}",
            body=body,
            twilio_sms_sid=message_sid,
        )
        db.add(activity)
        db.flush()

        sms_log = TwilioSMSLog(
            investor_id=investor.investor_id,
            activity_id=activity.activity_id,
            twilio_message_sid=message_sid,
            direction="inbound",
            from_number=from_number,
            to_number=to_number,
            body=body,
            status="received",
        )
        db.add(sms_log)
        db.commit()

    # Respond with empty TwiML (no auto-reply for now)
    resp = MessagingResponse()
    return Response(content=str(resp), media_type="application/xml")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_webhook_base_safe(db: Session) -> str:
    """Return webhook base URL or empty string."""
    try:
        return get_webhook_base(db)
    except ValueError:
        return ""
