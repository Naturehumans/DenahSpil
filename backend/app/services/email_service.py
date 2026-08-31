import logging
from aiosmtplib import SMTP
from email.message import EmailMessage
from jinja2 import Environment, BaseLoader

from app.config import settings

logger = logging.getLogger("spildenah")

TEMPLATE = """
<html>
    <body>
        <h2>Reset Password Spil Denah</h2>
        <p>Anda telah meminta reset password. Klik link di bawah ini untuk mereset password Anda:</p>
        <p><a href="{{ reset_link }}" style="display:inline-block;padding:10px 20px;background-color:#6366f1;color:white;text-decoration:none;border-radius:5px;">Reset Password</a></p>
        <p>Link ini akan kadaluarsa dalam 1 jam.</p>
        <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
    </body>
</html>
"""

async def send_reset_email(to_email: str, reset_link: str) -> None:
    if not all([settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER, settings.SMTP_PASSWORD, settings.SMTP_FROM_EMAIL]):
        logger.warning(f"SMTP not configured. Would send reset link to {to_email}: {reset_link}")
        return
        
    env = Environment(loader=BaseLoader())
    template = env.from_string(TEMPLATE)
    html_content = template.render(reset_link=reset_link)
    
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message["Subject"] = "Reset Password - Spil Denah"
    message.add_alternative(html_content, subtype="html")
    
    try:
        smtp = SMTP(hostname=settings.SMTP_HOST, port=settings.SMTP_PORT, use_tls=False)
        await smtp.connect()
        await smtp.starttls()
        await smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        await smtp.send_message(message)
        await smtp.quit()
        logger.info(f"Reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
