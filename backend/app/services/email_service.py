import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

logger = logging.getLogger(__name__)


def invia_email_smtp(
    host: str,
    port: int,
    secure: bool,
    username: str,
    password: str,
    from_name: str,
    from_email: str,
    destinatario: str,
    oggetto: str,
    corpo_html: str,
    corpo_testo: str = "",
) -> dict:
    """Invia un'email tramite server SMTP (compatibile con Google Workspace, Gmail, Aruba, ecc.)."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = oggetto
        msg["From"] = formataddr((from_name or "Studio Righetti", from_email or username))
        msg["To"] = destinatario

        if corpo_testo:
            msg.attach(MIMEText(corpo_testo, "plain", "utf-8"))
        if corpo_html:
            msg.attach(MIMEText(corpo_html, "html", "utf-8"))

        # Connessione SSL diretta (porta 465) o STARTTLS (porta 587 o 25)
        if secure or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(username, password)
        server.sendmail(from_email or username, [destinatario], msg.as_string())
        server.quit()

        logger.info("Email inviata con successo a %s tramite %s:%d", destinatario, host, port)
        return {"success": True, "messaggio": f"Email inviata con successo a {destinatario}!"}

    except smtplib.SMTPAuthenticationError as e:
        logger.error("Errore autenticazione SMTP: %s", e)
        raise ValueError("Autenticazione fallita: controlla l'indirizzo email e la Password per le app generata su Google.")
    except Exception as e:
        logger.error("Errore invio email SMTP: %s", e)
        raise ValueError(f"Errore connessione server SMTP: {str(e)}")
