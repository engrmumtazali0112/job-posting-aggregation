"""Outgoing email over SMTP (Gmail, Brevo, Mailgun SMTP, Zoho ... anything that speaks SMTP).

Configure it with these settings in backend/.env (see .env.example):
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL (and optionally SMTP_FROM_NAME)

If SMTP_HOST / SMTP_USER / SMTP_PASSWORD are empty the message is only printed to the server log (handy for local
development: the verification / reset link is in the uvicorn console) and send_email() returns False.
If sending fails, the error is logged and re-raised: callers (verification, password reset, job alerts) catch it.

Quick test from the backend folder:   python -m app.emailer you@example.com
"""
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formataddr

from .config import settings

TIMEOUT = 15                  # seconds; a stuck mail server must not hang the request for long


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def smtp_summary() -> dict:
    """What the running process actually loaded. The password is never shown, only whether it is set."""
    pw = settings.smtp_password.replace(" ", "")
    return {"configured": smtp_configured(), "host": settings.smtp_host or "(empty)", "port": settings.smtp_port,
            "user": settings.smtp_user or "(empty)", "password": f"set ({len(pw)} characters)" if pw else "NOT SET",
            "from": f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_user or '(empty)'}>"}


def send_email(to: str, subject: str, body: str) -> bool:
    """True = the mail server accepted the message. False = SMTP is not configured (nothing was sent).
    Raises on a real SMTP failure (wrong password, blocked port, ...)."""
    if not smtp_configured():
        print(f"[email:not sent - SMTP is not configured] to={to}\n  subject: {subject}\n" + "\n".join("  " + ln for ln in body.splitlines()) + "\n")
        return False

    sender = settings.smtp_from_email or settings.smtp_user
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name, sender))
    msg["To"] = to
    msg.set_content(body)

    password = settings.smtp_password.replace(" ", "")           # Google shows app passwords in groups of 4 with spaces
    ctx = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:                            # implicit TLS
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=TIMEOUT, context=ctx) as s:
                s.login(settings.smtp_user, password)
                s.send_message(msg)
        else:                                                    # 587 (or 25): upgrade the connection with STARTTLS
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=TIMEOUT) as s:
                s.ehlo()
                s.starttls(context=ctx)
                s.ehlo()
                s.login(settings.smtp_user, password)
                s.send_message(msg)
    except smtplib.SMTPAuthenticationError as exc:
        print(f"[email] login to {settings.smtp_host} was refused ({exc.smtp_code}). For Gmail use an App Password, not your normal password.")
        raise
    except Exception as exc:
        print(f"[email] could not send to {to} via {settings.smtp_host}:{settings.smtp_port}: {exc!r}")
        raise
    print(f"[email] sent to {to}: {subject}")
    return True


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else settings.smtp_user
    if not smtp_configured():
        sys.exit("SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in backend/.env first.")
    send_email(target, "JobBoard test email", "If you can read this, your SMTP settings work.")
    print("Done. Check the inbox (and the spam folder) of", target)
