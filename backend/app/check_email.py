"""Shows what the backend actually loaded from backend/.env, then (optionally) sends a test email.

    python -m app.check_email                    -> only prints the settings (password hidden)
    python -m app.check_email you@gmail.com      -> prints the settings AND sends a test email to that address
"""
import sys

from .config import BACKEND_DIR, settings
from . import emailer


def main() -> int:
    env = BACKEND_DIR / ".env"
    s = emailer.smtp_summary()
    print("backend folder :", BACKEND_DIR)
    print(".env file      :", env, "(found)" if env.exists() else "(NOT FOUND - create it next to requirements.txt)")
    print("environment    :", settings.environment)
    print("SMTP_HOST      :", s["host"])
    print("SMTP_PORT      :", s["port"])
    print("SMTP_USER      :", s["user"])
    print("SMTP_PASSWORD  :", s["password"], "(Gmail App Passwords have 16)")
    print("From           :", s["from"])
    print("SITE_URL       :", settings.site_url)
    print("  verify link  :", f"{settings.site_url}/verify-email/<token>")
    print("  reset link   :", f"{settings.site_url}/reset-password/<token>")
    if "vercel.app" in settings.site_url and settings.environment != "production":
        print("  NOTE: SITE_URL points at Vercel. For local testing set SITE_URL=http://localhost:5173")
    if not s["configured"]:
        print("\nSMTP is NOT configured: emails are only printed to the server log. Fill SMTP_HOST, SMTP_USER and SMTP_PASSWORD in backend/.env.")
        return 1
    if len(sys.argv) < 2:
        print("\nSettings look complete. Add an address to send a test:  python -m app.check_email you@gmail.com")
        return 0
    to = sys.argv[1]
    try:
        emailer.send_email(to, "JobBoard test email", "If you can read this, your SMTP settings work.")
    except Exception as exc:
        print("\nFAILED:", repr(exc))
        return 1
    print("\nOK. Test email sent to", to, "(check the Spam folder too).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
