import os
import aiosmtplib
from email.message import EmailMessage

# Configuration would typically come from environment variables
SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 1025))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")

async def send_email(to_email: str, subject: str, body: str, is_html: bool = False):
    message = EmailMessage()
    message["From"] = "no-reply@naql.com"
    message["To"] = to_email
    message["Subject"] = subject
    
    if is_html:
        message.set_content("Please enable HTML to view this email.")
        message.add_alternative(body, subtype="html")
    else:
        message.set_content(body)

    await aiosmtplib.send(
        message,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        username=SMTP_USER,
        password=SMTP_PASSWORD,
        use_tls=bool(SMTP_USER and SMTP_PASSWORD),
    )
