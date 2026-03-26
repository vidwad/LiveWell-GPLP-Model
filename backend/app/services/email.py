"""Email service using Resend for transactional emails."""

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_resend_config() -> tuple[str, str]:
    """Get Resend API key and from-email, checking DB settings first, then env."""
    api_key = settings.RESEND_API_KEY
    from_email = settings.RESEND_FROM_EMAIL or "onboarding@resend.dev"

    # Try to read from DB (UI-configured values take priority)
    try:
        from app.db.session import SessionLocal
        from app.db.models import PlatformSetting

        db = SessionLocal()
        try:
            for s in db.query(PlatformSetting).filter(
                PlatformSetting.key.in_(["RESEND_API_KEY", "RESEND_FROM_EMAIL"])
            ).all():
                if s.key == "RESEND_API_KEY" and s.value:
                    api_key = s.value
                elif s.key == "RESEND_FROM_EMAIL" and s.value:
                    from_email = s.value
        finally:
            db.close()
    except Exception:
        pass  # Fall back to env vars

    return api_key, from_email


def send_invitation_email(
    to_email: str,
    invite_url: str,
    inviter_name: str,
    role: str,
    personal_message: str | None = None,
    invitee_name: str | None = None,
) -> bool:
    """Send an invitation email via Resend. Returns True on success."""
    api_key, from_email = _get_resend_config()

    if not api_key:
        logger.warning("RESEND_API_KEY not set — skipping email send")
        return False

    import resend
    resend.api_key = api_key

    # Build the full invite URL
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    full_invite_url = f"{frontend_url}{invite_url}"

    greeting = f"Hi {invitee_name}," if invitee_name else "Hi,"
    role_display = role.replace("_", " ").title()

    # Personal message section
    message_block = ""
    if personal_message:
        message_block = f"""
        <div style="background-color: #f8f9fa; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #4b5563; font-style: italic;">"{personal_message}"</p>
          <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">— {inviter_name}</p>
        </div>
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Logo / Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background-color: #ef4444; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 24px;">
              ❤️
            </div>
            <h1 style="margin: 16px 0 0 0; font-size: 24px; color: #111827;">Living Well Communities</h1>
          </div>

          <!-- Body -->
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">{greeting}</p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>{inviter_name}</strong> has invited you to join the 
            <strong>Living Well Communities</strong> platform as a 
            <strong>{role_display}</strong>.
          </p>

          {message_block}

          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Click the button below to set up your account:
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="{full_invite_url}" 
               style="display: inline-block; background-color: #111827; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
              Accept Invitation
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{full_invite_url}" style="color: #6366f1; word-break: break-all;">{full_invite_url}</a>
          </p>
        </div>

        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Living Well Communities · Alberta, Canada
        </p>
      </div>
    </body>
    </html>
    """

    try:
        result = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": f"You're invited to join Living Well Communities as {role_display}",
            "html": html_body,
        })
        logger.info(f"Invitation email sent to {to_email}, id={result.get('id', 'unknown')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send invitation email to {to_email}: {e}")
        return False
