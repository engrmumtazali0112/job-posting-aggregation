"""Outgoing email.

MOCK for now: the message is printed to the server log (Render > your service > Logs, or the uvicorn console)
instead of being sent. To send real mail later (SMTP, SendGrid, Mailgun, Resend ...) replace the body of
send_email(); every caller (email verification, password reset, job alerts) keeps working unchanged.
Note: verification / reset links are visible in the log while this is a mock.
"""


def send_email(to: str, subject: str, body: str) -> bool:
    """Returns True when the message was handed over for delivery."""
    print(f"[email:mock] to={to}\n  subject: {subject}\n" + "\n".join("  " + ln for ln in body.splitlines()) + "\n")
    return True
