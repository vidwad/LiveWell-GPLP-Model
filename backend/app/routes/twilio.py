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
        phone = ""
        try:
            phone = get_twilio_phone(db)
        except Exception:
            pass
        return {"token": token, "identity": identity, "phone_number": phone}
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
    """TwiML response for browser-to-phone calls via Twilio Voice SDK.

    The browser SDK sends custom parameters (To, investorId) which arrive
    as form fields. We respond with TwiML that dials the target number,
    routing audio from the browser (WebRTC) to the phone (PSTN).
    """
    from twilio.twiml.voice_response import VoiceResponse

    response = VoiceResponse()
    form = await request.form()
    to_number = form.get("To", "")
    investor_id = form.get("investorId", "")
    call_sid = form.get("CallSid", "")
    caller_identity = form.get("From", "")

    webhook_base = _get_webhook_base_safe(db)
    twilio_phone = ""
    try:
        twilio_phone = get_twilio_phone(db)
    except Exception:
        pass

    if to_number:
        dial_kwargs = {
            "caller_id": twilio_phone or caller_identity,
            "record": "record-from-answer-dual",
            "timeout": 30,  # Ring for 30 seconds before giving up
        }
        if webhook_base:
            dial_kwargs["recording_status_callback"] = f"{webhook_base}/api/twilio/webhooks/recording"
            dial_kwargs["recording_status_callback_event"] = "completed"
            # Action URL handles post-dial (VM, busy, no-answer) with proper TwiML
            dial_kwargs["action"] = f"{webhook_base}/api/twilio/webhooks/dial-complete"
        dial = response.dial(**dial_kwargs)

        num_kwargs = {
            "machine_detection": "DetectMessageEnd",  # Detect VM and wait for beep
        }
        if webhook_base:
            num_kwargs["status_callback"] = f"{webhook_base}/api/twilio/webhooks/call-status"
            num_kwargs["status_callback_event"] = "initiated ringing answered completed"
            num_kwargs["machine_detection_timeout"] = 5
        dial.number(to_number, **num_kwargs)

        # Create call log for this browser-initiated call
        if investor_id and call_sid:
            try:
                inv_id = int(investor_id)
                # Check if log already exists for this SID
                existing = db.query(TwilioCallLog).filter(
                    TwilioCallLog.twilio_call_sid == call_sid
                ).first()
                if not existing:
                    activity = CRMActivity(
                        investor_id=inv_id,
                        activity_type=CRMActivityType.call,
                        subject=f"Browser call to {to_number}",
                        body="Call initiated from CRM browser",
                        twilio_call_sid=call_sid,
                    )
                    db.add(activity)
                    db.flush()
                    call_log = TwilioCallLog(
                        investor_id=inv_id,
                        activity_id=activity.activity_id,
                        twilio_call_sid=call_sid,
                        direction="outbound",
                        from_number=twilio_phone or "browser",
                        to_number=to_number,
                        status=TwilioCallStatus.initiated,
                    )
                    db.add(call_log)
                    db.commit()
            except Exception:
                pass  # Don't fail the TwiML response
    else:
        response.say("No destination number provided. Please try again from the CRM.")

    return Response(content=str(response), media_type="application/xml")


@router.post("/webhooks/dial-complete")
async def webhook_dial_complete(request: Request, db: Session = Depends(get_db)):
    """Called after <Dial> completes. Returns TwiML to end the call cleanly.

    Also updates the call log with the dial outcome (answered, busy, no-answer, failed).
    """
    from twilio.twiml.voice_response import VoiceResponse

    form = await request.form()
    call_sid = form.get("CallSid", "")
    dial_call_status = form.get("DialCallStatus", "")  # completed, busy, no-answer, failed, canceled
    dial_call_duration = form.get("DialCallDuration", "")
    dial_call_sid = form.get("DialCallSid", "")
    recording_url = form.get("RecordingUrl", "")

    # Update call log
    if call_sid:
        log = db.query(TwilioCallLog).filter(TwilioCallLog.twilio_call_sid == call_sid).first()
        if log:
            status_map = {
                "completed": TwilioCallStatus.completed,
                "busy": TwilioCallStatus.busy,
                "no-answer": TwilioCallStatus.no_answer,
                "canceled": TwilioCallStatus.canceled,
                "failed": TwilioCallStatus.failed,
            }
            if dial_call_status in status_map:
                log.status = status_map[dial_call_status]
            if dial_call_duration:
                try:
                    log.duration_seconds = int(dial_call_duration)
                except (ValueError, TypeError):
                    pass
            if recording_url and not log.recording_url:
                log.recording_url = recording_url

            # Update CRM activity
            if log.activity_id:
                activity = db.query(CRMActivity).filter(
                    CRMActivity.activity_id == log.activity_id
                ).first()
                if activity:
                    dur_str = f" ({dial_call_duration}s)" if dial_call_duration else ""
                    activity.outcome = f"Call {dial_call_status}{dur_str}"
            db.commit()

    # Return empty TwiML to hang up cleanly
    resp = VoiceResponse()
    return Response(content=str(resp), media_type="application/xml")


@router.post("/webhooks/call-status")
async def webhook_call_status(request: Request, db: Session = Depends(get_db)):
    """Twilio call status callback — updates call log.

    IMPORTANT: This endpoint is used both as a statusCallback (expects any response)
    AND as the Dial action URL (expects TwiML). We always return valid TwiML
    to avoid the "application error" message after hangup.
    """
    from twilio.twiml.voice_response import VoiceResponse

    form = await request.form()
    call_sid = form.get("CallSid", "")
    # Try parent call SID too (browser SDK calls have a parent SID)
    parent_call_sid = form.get("ParentCallSid", "")
    status = form.get("CallStatus", "") or form.get("DialCallStatus", "")
    duration = form.get("CallDuration") or form.get("DialCallDuration")

    if call_sid or parent_call_sid:
        # Try to find by call_sid first, then parent_call_sid
        log = None
        if call_sid:
            log = db.query(TwilioCallLog).filter(TwilioCallLog.twilio_call_sid == call_sid).first()
        if not log and parent_call_sid:
            log = db.query(TwilioCallLog).filter(TwilioCallLog.twilio_call_sid == parent_call_sid).first()

        if log:
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
                try:
                    log.duration_seconds = int(duration)
                except (ValueError, TypeError):
                    pass

            # Update CRM activity outcome
            if log.activity_id and status in ("completed", "busy", "no-answer", "failed", "canceled"):
                activity = db.query(CRMActivity).filter(CRMActivity.activity_id == log.activity_id).first()
                if activity:
                    dur_str = f" ({duration}s)" if duration else ""
                    activity.outcome = f"Call {status}{dur_str}"

            db.commit()

    # Always return valid TwiML (empty response = hang up cleanly)
    resp = VoiceResponse()
    return Response(content=str(resp), media_type="application/xml")


@router.post("/webhooks/recording")
async def webhook_recording(request: Request, db: Session = Depends(get_db)):
    """Twilio recording complete callback — stores URL and triggers transcription."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    parent_call_sid = form.get("ParentCallSid", "")
    recording_url = form.get("RecordingUrl", "")
    recording_sid = form.get("RecordingSid", "")
    # Log all params for debugging
    import logging
    logging.info(f"Recording webhook: CallSid={call_sid} ParentCallSid={parent_call_sid} "
                 f"RecordingUrl={recording_url} RecordingSid={recording_sid}")

    if recording_url and (call_sid or parent_call_sid):
        log = None
        # Try matching by CallSid, then ParentCallSid
        for sid in [call_sid, parent_call_sid]:
            if sid:
                log = db.query(TwilioCallLog).filter(TwilioCallLog.twilio_call_sid == sid).first()
                if log:
                    break
        # Fallback: find most recent call log without a recording (within last 5 min)
        if not log:
            from datetime import datetime, timedelta
            cutoff = datetime.utcnow() - timedelta(minutes=5)
            log = (
                db.query(TwilioCallLog)
                .filter(
                    TwilioCallLog.recording_url.is_(None),
                    TwilioCallLog.created_at >= cutoff,
                )
                .order_by(TwilioCallLog.created_at.desc())
                .first()
            )

        if log:
            log.recording_url = recording_url
            log.recording_sid = recording_sid
            db.commit()

            # Auto-transcribe using Whisper
            try:
                transcribe_recording(db, log.call_log_id)
            except Exception:
                pass  # Transcription is best-effort

    return Response(content="<Response/>", media_type="application/xml")


@router.post("/webhooks/sms-status")
async def webhook_sms_status(request: Request, db: Session = Depends(get_db)):
    """Twilio SMS delivery status callback."""
    form = await request.form()
    message_sid = form.get("MessageSid", "")
    status = form.get("MessageStatus", "")

    if not message_sid:
        return Response(content="<Response/>", media_type="application/xml")

    sms = db.query(TwilioSMSLog).filter(TwilioSMSLog.twilio_message_sid == message_sid).first()
    if sms:
        sms.status = status
        db.commit()

    return Response(content="<Response/>", media_type="application/xml")


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
