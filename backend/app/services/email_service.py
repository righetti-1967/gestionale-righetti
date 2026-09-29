import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import requests

logger = logging.getLogger(__name__)

DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyYHBGLaBIePHpB3f19xJ1W6tpsHQYlpCT_M2XPSDS96UZcEKJ7NXMjYd40XJTNGmJd/exec"


def invia_email_google_relay(
    script_url: str,
    destinatario: str,
    oggetto: str,
    corpo_html: str,
    from_name: str = "Righetti Since 1967",
    corpo_testo: str = "",
    allegato_base64: str | None = None,
    allegato_nome: str | None = None,
) -> dict:
    """Invia email tramite Google Apps Script Web App su HTTPS (porta 443)."""
    url = script_url.strip() if script_url and script_url.strip() else DEFAULT_GOOGLE_SCRIPT_URL
    payload = {
        "destinatario": destinatario.strip(),
        "oggetto": oggetto.strip(),
        "corpo_html": corpo_html,
        "corpo_testo": corpo_testo or "Messaggio da Righetti Since 1967",
        "from_name": from_name or "Righetti Since 1967",
        "allegato_base64": allegato_base64,
        "allegato_nome": allegato_nome,
    }

    resp = requests.post(url, json=payload, timeout=25, allow_redirects=True)
    if resp.status_code != 200:
        raise ValueError(f"Google Script ha risposto con codice {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        if not data.get("success"):
            raise ValueError(data.get("error") or "Errore sconosciuto da Google Apps Script")
        return {"success": True, "messaggio": data.get("messaggio", "Email inviata con successo tramite Google Workspace!")}
    except Exception as e:
        # A volte Google Apps Script restituisce un redirect o HTML se c'e' stato un errore
        if "success" in resp.text.lower():
            return {"success": True, "messaggio": "Email inviata con successo tramite Google Workspace!"}
        raise ValueError(f"Risposta non valida da Google: {resp.text[:200]}")


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
    """Invio fallback SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = oggetto
    msg["From"] = formataddr((from_name or "Righetti Since 1967", from_email or username))
    msg["To"] = destinatario

    if corpo_testo:
        msg.attach(MIMEText(corpo_testo, "plain", "utf-8"))
    if corpo_html:
        msg.attach(MIMEText(corpo_html, "html", "utf-8"))

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
    return {"success": True, "messaggio": f"Email inviata a {destinatario}!"}
