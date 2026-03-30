"""Twilio integration service — voice calls, SMS, and transcription."""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_setting(db: Session, key: str) -> Optional[str]:
    """Read a platform setting, falling back to environment variable."""
    row = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    return (row.value if row and row.value else None) or os.environ.get(key)


def normalize_e164(phone: str) -> str:
    """Best-effort normalisation of a phone number to E.164 format."""
    digits = re.sub(r"[^\d+]", "", phone)
    if not digits:
        return phone
    # If it already starts with + assume it's E.164
    if digits.startswith("+"):
        return digits
    # North America: 10 digits → +1
    if len(digits) == 10:
        return f"+1{digits}"
    # 11 digits starting with 1
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}"


def get_twilio_client(db: Session):
    """Create an authenticated Twilio REST client."""
    from twilio.rest import Client

    sid = _get_setting(db, "TWILIO_ACCOUNT_SID")
    token = _get_setting(db, "TWILIO_AUTH_TOKEN")
    if not sid or not token:
        raise ValueError("Twilio credentials not configured. Add them in Settings → API Keys.")
    return Client(sid, token)


def get_twilio_phone(db: Session) -> str:
    """Return the configured Twilio phone number."""
    number = _get_setting(db, "TWILIO_PHONE_NUMBER")
    if not number:
        raise ValueError("Twilio phone number not configured. Add it in Settings → Telephony.")
    return number


def get_webhook_base(db: Session) -> str:
    """Return the public webhook base URL (no trailing slash)."""
    url = _get_setting(db, "TWILIO_WEBHOOK_BASE_URL")
    if not url:
        raise ValueError("Twilio webhook base URL not configured. Add it in Settings → Telephony.")
    return url.rstrip("/")


# ---------------------------------------------------------------------------
# SMS
# ---------------------------------------------------------------------------

def send_sms(
    db: Session,
    investor_id: int,
    body: str,
    sent_by_user_id: int,
    to_number: Optional[str] = None,
) -> TwilioSMSLog:
    """Send an SMS to an investor and log it."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise ValueError("Investor not found")

    destination = to_number or getattr(inv, "mobile", None) or getattr(inv, "phone", None)
    if not destination:
        raise ValueError("No phone number available for this investor")
    destination = normalize_e164(destination)

    client = get_twilio_client(db)
    from_number = get_twilio_phone(db)
    webhook_base = get_webhook_base(db)

    message = client.messages.create(
        body=body,
        from_=from_number,
        to=destination,
        status_callback=f"{webhook_base}/api/twilio/webhooks/sms-status",
    )

    # Create CRM activity
    activity = CRMActivity(
        investor_id=investor_id,
        activity_type=CRMActivityType.sms,
        subject=f"SMS sent to {destination}",
        body=body,
        twilio_sms_sid=message.sid,
        created_by=sent_by_user_id,
    )
    db.add(activity)
    db.flush()

    # Create SMS log
    sms_log = TwilioSMSLog(
        investor_id=investor_id,
        activity_id=activity.activity_id,
        twilio_message_sid=message.sid,
        direction="outbound",
        from_number=from_number,
        to_number=destination,
        body=body,
        status=message.status or "queued",
        sent_by=sent_by_user_id,
    )
    db.add(sms_log)
    db.commit()
    db.refresh(sms_log)
    return sms_log


# ---------------------------------------------------------------------------
# Voice Calls
# ---------------------------------------------------------------------------

def initiate_call(
    db: Session,
    investor_id: int,
    initiated_by_user_id: int,
    to_number: Optional[str] = None,
) -> TwilioCallLog:
    """Initiate an outbound Twilio call to an investor."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise ValueError("Investor not found")

    destination = to_number or getattr(inv, "mobile", None) or getattr(inv, "phone", None)
    if not destination:
        raise ValueError("No phone number available for this investor")
    destination = normalize_e164(destination)

    client = get_twilio_client(db)
    from_number = get_twilio_phone(db)
    webhook_base = get_webhook_base(db)

    call = client.calls.create(
        to=destination,
        from_=from_number,
        url=f"{webhook_base}/api/twilio/webhooks/voice",
        status_callback=f"{webhook_base}/api/twilio/webhooks/call-status",
        status_callback_event=["initiated", "ringing", "answered", "completed"],
        record=True,
        recording_status_callback=f"{webhook_base}/api/twilio/webhooks/recording",
    )

    # Create CRM activity
    activity = CRMActivity(
        investor_id=investor_id,
        activity_type=CRMActivityType.call,
        subject=f"Outbound call to {destination}",
        body="Call initiated via Twilio",
        twilio_call_sid=call.sid,
        created_by=initiated_by_user_id,
    )
    db.add(activity)
    db.flush()

    # Create call log
    call_log = TwilioCallLog(
        investor_id=investor_id,
        activity_id=activity.activity_id,
        twilio_call_sid=call.sid,
        direction="outbound",
        from_number=from_number,
        to_number=destination,
        status=TwilioCallStatus.initiated,
        initiated_by=initiated_by_user_id,
    )
    db.add(call_log)
    db.commit()
    db.refresh(call_log)
    return call_log


# ---------------------------------------------------------------------------
# Transcription (OpenAI Whisper — reuses existing pattern)
# ---------------------------------------------------------------------------

def transcribe_recording(db: Session, call_log_id: int) -> str:
    """Download a Twilio recording and transcribe with OpenAI Whisper."""
    log = db.query(TwilioCallLog).filter(TwilioCallLog.call_log_id == call_log_id).first()
    if not log:
        raise ValueError("Call log not found")
    if not log.recording_url:
        raise ValueError("No recording available for this call")

    log.transcription_status = "pending"
    db.commit()

    try:
        from openai import OpenAI as _OpenAI

        api_key = _get_setting(db, "OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key not configured")

        # Download recording from Twilio
        import requests
        sid = _get_setting(db, "TWILIO_ACCOUNT_SID")
        token = _get_setting(db, "TWILIO_AUTH_TOKEN")
        rec_url = log.recording_url
        if not rec_url.startswith("http"):
            rec_url = f"https://api.twilio.com{rec_url}"
        # Twilio recordings are available as .mp3
        if not rec_url.endswith(".mp3"):
            rec_url += ".mp3"
        resp = requests.get(rec_url, auth=(sid, token))
        resp.raise_for_status()

        # Save temp file and send to Whisper
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        client = _OpenAI(api_key=api_key)
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )

        os.unlink(tmp_path)

        log.transcript = transcript.text
        log.transcription_status = "completed"

        # Update CRM activity body with transcript
        if log.activity_id:
            activity = db.query(CRMActivity).filter(CRMActivity.activity_id == log.activity_id).first()
            if activity:
                activity.body = f"Call transcript:\n{transcript.text}"

        db.commit()
        return transcript.text

    except Exception as e:
        log.transcription_status = "failed"
        db.commit()
        raise ValueError(f"Transcription failed: {str(e)}")


# ---------------------------------------------------------------------------
# Capability Token (for browser-based calling via Twilio Client SDK)
# ---------------------------------------------------------------------------

def generate_voice_token(db: Session, identity: str) -> str:
    """Generate a Twilio Access Token with Voice grant for browser calling."""
    from twilio.jwt.access_token import AccessToken
    from twilio.jwt.access_token.grants import VoiceGrant

    sid = _get_setting(db, "TWILIO_ACCOUNT_SID")
    token = _get_setting(db, "TWILIO_AUTH_TOKEN")
    twiml_app_sid = _get_setting(db, "TWILIO_TWIML_APP_SID")

    if not sid or not token:
        raise ValueError("Twilio credentials not configured")
    if not twiml_app_sid:
        raise ValueError("Twilio TwiML App SID not configured")

    access_token = AccessToken(sid, token, identity=identity)
    voice_grant = VoiceGrant(
        outgoing_application_sid=twiml_app_sid,
        incoming_allow=True,
    )
    access_token.add_grant(voice_grant)
    return access_token.to_jwt()
