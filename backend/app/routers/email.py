import logging
from fastapi import APIRouter, HTTPException

from app.schemas.email import TestEmailRequest, EmailResponse
from app.services.email_service import invia_email_smtp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"])


@router.post("/test", response_model=EmailResponse)
async def test_email_endpoint(req: TestEmailRequest):
    try:
        corpo_html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #007aff; margin: 0; font-size: 22px;">Studio Righetti Since 1967</h1>
                <p style="color: #8e8e93; font-size: 13px; margin: 4px 0 0 0;">Test Connessione Email Gestionale</p>
            </div>
            <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">✅ Configurazione verificata con successo!</p>
                <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
                    Il tuo account Google Workspace / server SMTP comunica correttamente con il Gestionale Righetti. Da questo momento potrai inviare promemoria appuntamenti, ricevute, schede di cura e informative con il tuo dominio.
                </p>
            </div>
            <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; font-size: 11px; color: #8e8e93; text-align: center;">
                Parametri: {req.host}:{req.port} • Mittente: {req.username}
            </div>
        </div>
        """

        res = invia_email_smtp(
            host=req.host.strip(),
            port=req.port,
            secure=req.secure,
            username=req.username.strip(),
            password=req.password.strip(),
            from_name=req.from_name or "Studio Righetti",
            from_email=req.from_email or req.username.strip(),
            destinatario=req.destinatario.strip(),
            oggetto="✅ Test Connessione Email — Gestionale Righetti 1967",
            corpo_html=corpo_html,
            corpo_testo="Test completato con successo. Il server SMTP comunica correttamente con il Gestionale.",
        )
        return EmailResponse(success=True, messaggio=res["messaggio"])

    except Exception as e:
        logger.error("Errore test email: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
