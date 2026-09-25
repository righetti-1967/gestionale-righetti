"""Client Supabase con service role per operazioni admin."""
import logging

from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)

_client: Client | None = None


def get_supabase() -> Client:
    """Ritorna il client Supabase admin (service role).
    Crea il client solo la prima volta (lazy).
    """
    global _client
    if _client is not None:
        return _client

    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "SUPABASE_URL o SUPABASE_SERVICE_KEY non configurati. "
            "Imposta le variabili d'ambiente su Railway."
        )

    _client = create_client(settings.supabase_url, settings.supabase_service_key)
    logger.info("Supabase admin client inizializzato")
    return _client
