import logging
from fastapi import APIRouter, HTTPException

from app.schemas.email import (
    InviaEmailRequest,
    TestEmailRequest,
    EmailResponse,
)
from app.services.email_service import invia_email_google_relay, invia_email_smtp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"])


@router.post("/test", response_model=EmailResponse)
async def test_email_endpoint(req: TestEmailRequest):
    corpo_html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://yporpszebtasalwazirz.supabase.co/storage/v1/object/public/azienda/logo.png" alt="Righetti Since 1967" style="height: 52px; max-width: 220px; object-fit: contain; margin-bottom: 8px;" />
            <p style="color: #8e8e93; font-size: 13px; margin: 4px 0 0 0;">Test Connessione Email Gestionale</p>
        </div>
        <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">✅ Configurazione verificata con successo!</p>
            <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
                Il tuo account Google Workspace comunica correttamente con il Gestionale Righetti tramite HTTPS Relay sicuro. Da questo momento potrai inviare promemoria appuntamenti, ricevute, schede di cura e informative direttamente dal tuo dominio.
            </p>
        </div>
        <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; font-size: 11px; color: #8e8e93; text-align: center;">
            Canale: Google Workspace HTTPS Relay • Destinatario: {req.destinatario}
        </div>
    </div>
    """

    try:
        # Se c'e' un google_script_url o usiamo il relay predefinito di Google Workspace
        if req.google_script_url or not req.host:
            res = invia_email_google_relay(
                script_url=req.google_script_url or "",
                destinatario=req.destinatario,
                oggetto="✅ Test Connessione Email — Gestionale Righetti 1967",
                corpo_html=corpo_html,
                from_name=req.from_name or "Righetti Since 1967",
            )
            return EmailResponse(success=True, messaggio=res["messaggio"])
        else:
            # Fallback SMTP
            res = invia_email_smtp(
                host=req.host.strip(),
                port=req.port,
                secure=req.secure,
                username=req.username.strip() if req.username else "",
                password=req.password.strip() if req.password else "",
                from_name=req.from_name or "Righetti Since 1967",
                from_email=req.from_email or (req.username.strip() if req.username else ""),
                destinatario=req.destinatario.strip(),
                oggetto="✅ Test Connessione Email — Gestionale Righetti 1967",
                corpo_html=corpo_html,
            )
            return EmailResponse(success=True, messaggio=res["messaggio"])

    except Exception as e:
        logger.error("Errore test email: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invia", response_model=EmailResponse)
async def invia_email_generica_endpoint(req: InviaEmailRequest):
    """Invia qualsiasi email con oggetto e corpo HTML personalizzati."""
    try:
        if req.google_script_url or not req.host:
            res = invia_email_google_relay(
                script_url=req.google_script_url or "",
                destinatario=req.destinatario,
                oggetto=req.oggetto,
                corpo_html=req.corpo_html,
                from_name=req.from_name or "Righetti Since 1967",
                corpo_testo=req.corpo_testo or "",
                allegato_base64=req.allegato_base64,
                allegato_nome=req.allegato_nome,
            )
            return EmailResponse(success=True, messaggio=res["messaggio"])
        else:
            res = invia_email_smtp(
                host=req.host.strip(),
                port=req.port,
                secure=req.secure,
                username=req.username.strip() if req.username else "",
                password=req.password.strip() if req.password else "",
                from_name=req.from_name or "Righetti Since 1967",
                from_email=req.from_email or (req.username.strip() if req.username else ""),
                destinatario=req.destinatario.strip(),
                oggetto=req.oggetto,
                corpo_html=req.corpo_html,
                corpo_testo=req.corpo_testo or "",
            )
            return EmailResponse(success=True, messaggio=res["messaggio"])
    except Exception as e:
        logger.error("Errore invio email generica: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
