"""Router Licenze & Utenti DEMO (admin only)."""
import logging
import httpx
from app.config import settings
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.services.supabase_client import get_supabase

def _get_clienti_app_cliente_uuid(supabase):
    try:
        res = supabase.table("client_users").select("auth_user_id").execute()
        rows = res.data or []
        return {str(r.get("auth_user_id")) for r in rows if r.get("auth_user_id")}
    except Exception as e:
        logger.warning(f"Impossibile leggere client_users: {e}")
        return set()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/licenze", tags=["licenze"])

ADMIN_EMAIL = settings.admin_email


class ProrogaRequest(BaseModel):
    user_id: str
    giorni: Optional[int] = None
    data_scadenza_iso: Optional[str] = None


class SbloccaRealeRequest(BaseModel):
    user_id: str
    azzera_dati_demo: bool = True


class PopolaDemoRequest(BaseModel):
    user_id: str


def _verifica_admin(admin_email: Optional[str]):
    if not admin_email or admin_email.lower().strip() != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Accesso riservato all'amministratore")





async def _aggiorna_user_meta(user_id: str, meta: dict) -> None:
    """Aggiorna user_metadata E raw_user_meta_data via SQL diretto (RPC).

    Necessario perche' GoTrue admin API non rimuove mai chiavi da raw_user_meta_data.
    """
    url = f"{settings.supabase_url}/rest/v1/rpc/aggiorna_meta_utente"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "p_user_id": user_id,
        "p_meta": meta,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code >= 400:
            logger.error(f"Errore aggiornamento meta (SQL): {r.status_code} {r.text}")
            r.raise_for_status()
    logger.info(f"✅ Meta aggiornati via SQL per {user_id}: {len(meta)} campi")


@router.get("/utenti")
async def lista_utenti(admin_email: str = Query(..., description="Email admin")):
    """Elenca utenti registrati con stato licenza."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        clienti_app_cliente = _get_clienti_app_cliente_uuid(supabase)
        res = supabase.auth.admin.list_users()
        utenti_raw = getattr(res, "users", res) if hasattr(res, "users") else res

        output = []
        now = datetime.now(timezone.utc)

        for u in utenti_raw:
            u_dict = u if isinstance(u, dict) else u.__dict__
            um_raw = u_dict.get("user_metadata")
            um_dict = um_raw if isinstance(um_raw, dict) else (getattr(um_raw, "__dict__", None) or {})
            raw_raw = u_dict.get("raw_user_meta_data")
            raw_dict = raw_raw if isinstance(raw_raw, dict) else (getattr(raw_raw, "__dict__", None) or {})
            # user_metadata e' aggiornato dall'API admin; raw_user_meta_data e' una copia
            # fotografica aggiornata solo al login OAuth -> leggiamo SOLO user_metadata.
            raw_meta = um_dict if um_dict else (raw_dict or {})
            app_meta = u_dict.get("app_metadata") or u_dict.get("raw_app_meta_data") or {}

            email = u_dict.get("email") or ""
            user_uuid = str(u_dict.get("id") or "")

            if user_uuid in clienti_app_cliente:
                continue

            is_righetti = email.lower().strip() == ADMIN_EMAIL.lower()
            ruolo = "admin" if is_righetti else (raw_meta.get("ruolo") or app_meta.get("ruolo") or "demo").lower()

            scadenza_str = raw_meta.get("demo_scadenza")
            scadenza_dt = None
            giorni_rimasti = 999
            is_scaduto = False

            if ruolo == "demo":
                if scadenza_str:
                    try:
                        scadenza_dt = datetime.fromisoformat(scadenza_str.replace("Z", "+00:00"))
                    except Exception:
                        scadenza_dt = None
                if not scadenza_dt:
                    created_at_str = u_dict.get("created_at")
                    if created_at_str:
                        try:
                            created_dt = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
                            scadenza_dt = created_dt + timedelta(days=15)
                        except Exception:
                            scadenza_dt = now + timedelta(days=15)
                    else:
                        scadenza_dt = now + timedelta(days=15)

                diff = (scadenza_dt - now).total_seconds()
                giorni_rimasti = max(0, int(diff // 86400) + (1 if diff % 86400 > 0 else 0))
                is_scaduto = diff <= 0

            output.append({
                "id": str(u_dict.get("id")),
                "email": email,
                "azienda": raw_meta.get("azienda") or raw_meta.get("ragione_sociale") or "",
                "full_name": raw_meta.get("full_name") or "",
                "created_at": str(u_dict.get("created_at") or ""),
                "ruolo": ruolo,
                "demo_scadenza": scadenza_dt.isoformat() if scadenza_dt else None,
                "giorni_rimasti": giorni_rimasti,
                "is_scaduto": is_scaduto,
                "bloccato": bool(raw_meta.get("bloccato")),
                "bloccato_il": raw_meta.get("bloccato_il"),
                "motivo_blocco": raw_meta.get("motivo_blocco"),
                "eliminato": bool(raw_meta.get("eliminato")),
                "eliminato_il": raw_meta.get("eliminato_il"),
                "motivo_eliminazione": raw_meta.get("motivo_eliminazione"),

                "is_admin": is_righetti,
            })

        return {"utenti": output}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore recupero utenti")
        raise HTTPException(status_code=500, detail=f"Errore lettura utenti: {e}")


@router.post("/proroga")
async def proroga_demo(req: ProrogaRequest, admin_email: str = Query(...)):
    """Proroga il periodo demo di un utente."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        u = supabase.auth.admin.get_user_by_id(req.user_id)
        u_dict = u.user if hasattr(u, "user") else u
        meta = (getattr(u_dict, "user_metadata", None) or getattr(u_dict, "raw_user_meta_data", None) or {}).copy()

        now = datetime.now(timezone.utc)

        if req.data_scadenza_iso:
            nuova_scadenza = req.data_scadenza_iso
        elif req.giorni:
            base_dt = now
            if meta.get("demo_scadenza"):
                try:
                    curr = datetime.fromisoformat(meta["demo_scadenza"].replace("Z", "+00:00"))
                    if curr > now:
                        base_dt = curr
                except Exception:
                    pass
            nuova_scadenza = (base_dt + timedelta(days=req.giorni)).isoformat()
        else:
            nuova_scadenza = (now + timedelta(days=15)).isoformat()

        meta["ruolo"] = "demo"
        meta["demo_scadenza"] = nuova_scadenza

        await _aggiorna_user_meta(req.user_id, meta)
        logger.info(f"Proroga demo utente {req.user_id} impostata al {nuova_scadenza}")
        return {"success": True, "demo_scadenza": nuova_scadenza}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore proroga")
        raise HTTPException(status_code=500, detail=f"Errore proroga: {e}")


@router.post("/sblocca-reale")
async def sblocca_reale(req: SbloccaRealeRequest, admin_email: str = Query(...)):
    """Attiva licenza reale a vita + reset dati demo."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        u = supabase.auth.admin.get_user_by_id(req.user_id)
        u_dict = u.user if hasattr(u, "user") else u
        user_email = getattr(u_dict, "email", "") or ""

        if user_email.lower() == ADMIN_EMAIL.lower():
            return {"success": True, "message": "Account admin già reale"}

        meta = (getattr(u_dict, "user_metadata", None) or getattr(u_dict, "raw_user_meta_data", None) or {}).copy()
        meta["ruolo"] = "reale"
        meta.pop("demo_scadenza", None)

        await _aggiorna_user_meta(req.user_id, meta)

        if req.azzera_dati_demo:
            try:
                # Ordine: figli prima, poi genitori (per FK)
                supabase.table("prodotti_cliente").delete().eq("user_id", req.user_id).execute()
                supabase.table("analisi").delete().eq("user_id", req.user_id).execute()
                supabase.table("clienti").delete().eq("user_id", req.user_id).execute()
                supabase.table("prodotti").delete().eq("user_id", req.user_id).execute()
                supabase.table("eventi").delete().eq("user_id", req.user_id).execute()
                supabase.table("dati_aziendali").delete().eq("user_id", req.user_id).execute()
                logger.info(f"Dati demo azzerati per utente {req.user_id}")
            except Exception as ex_db:
                logger.warning(f"Avviso azzeramento: {ex_db}")

        return {"success": True, "message": "Licenza reale attivata e dati azzerati"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore sblocco reale")
        raise HTTPException(status_code=500, detail=f"Errore sblocco reale: {e}")

@router.post("/popola-demo")
async def popola_demo(req: PopolaDemoRequest, admin_email: str = Query(...)):
    """Popola un utente DEMO con dati di esempio.
    Solo per admin Righetti.
    """
    _verifica_admin(admin_email)

    try:
        supabase = get_supabase()
        u = supabase.auth.admin.get_user_by_id(req.user_id)
        u_dict = u.user if hasattr(u, "user") else u
        user_email = getattr(u_dict, "email", "") or ""

        if user_email.lower() == ADMIN_EMAIL.lower():
            raise HTTPException(status_code=400, detail="Non popolare l'account admin")

        from app.services.demo_seed import popola_demo_utente
        risultato = popola_demo_utente(req.user_id)

        return {
            "success": True,
            "user_id": req.user_id,
            "riepilogo": risultato,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore popolamento demo")
        raise HTTPException(status_code=500, detail=f"Errore popolamento: {e}")


# ... codici nuovi endpoint ...


# ============================================================================
# BLOCCO / SBLOCCO / ELIMINAZIONE UTENTI
# ============================================================================

class BloccaRequest(BaseModel):
    user_id: str
    motivo: Optional[str] = None


class SbloccaRequest(BaseModel):
    user_id: str


class EliminaRequest(BaseModel):
    user_id: str
    motivo: Optional[str] = None


@router.post("/blocca")
async def blocca_utente(req: BloccaRequest, admin_email: str = Query(...)):
    """Blocca un utente. Il login verrà rifiutato finché non viene sbloccato."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        u = supabase.auth.admin.get_user_by_id(req.user_id)
        u_dict = u.user if hasattr(u, "user") else u
        user_email = getattr(u_dict, "email", "") or ""

        if user_email.lower() == ADMIN_EMAIL.lower():
            raise HTTPException(status_code=400, detail="Non puoi bloccare l'account admin")

        meta = (getattr(u_dict, "user_metadata", None) or getattr(u_dict, "raw_user_meta_data", None) or {}).copy()
        meta["bloccato"] = True
        meta["bloccato_il"] = datetime.now(timezone.utc).isoformat()
        if req.motivo:
            meta["motivo_blocco"] = req.motivo

        await _aggiorna_user_meta(req.user_id, meta)
        logger.info(f"Utente {req.user_id} ({user_email}) bloccato dall'admin {admin_email}")
        return {"success": True, "message": f"Utente {user_email} bloccato"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore blocco utente")
        raise HTTPException(status_code=500, detail=f"Errore blocco: {e}")


@router.post("/sblocca")
async def sblocca_utente(req: SbloccaRequest, admin_email: str = Query(...)):
    """Rimuove il blocco da un utente."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        u = supabase.auth.admin.get_user_by_id(req.user_id)
        u_dict = u.user if hasattr(u, "user") else u
        user_email = getattr(u_dict, "email", "") or ""

        meta = (getattr(u_dict, "user_metadata", None) or getattr(u_dict, "raw_user_meta_data", None) or {}).copy()
        meta.pop("bloccato", None)
        meta.pop("bloccato_il", None)
        meta.pop("motivo_blocco", None)

        await _aggiorna_user_meta(req.user_id, meta)
        logger.info(f"Utente {req.user_id} ({user_email}) sbloccato dall'admin {admin_email}")
        return {"success": True, "message": f"Utente {user_email} sbloccato"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore sblocco utente")
        raise HTTPException(status_code=500, detail=f"Errore sblocco: {e}")


@router.post("/elimina")
async def elimina_utente(req: EliminaRequest, admin_email: str = Query(...)):
    """Soft delete: marca come eliminato (impedisce login, mantiene dati nel DB)."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        u = supabase.auth.admin.get_user_by_id(req.user_id)
        u_dict = u.user if hasattr(u, "user") else u
        user_email = getattr(u_dict, "email", "") or ""

        if user_email.lower() == ADMIN_EMAIL.lower():
            raise HTTPException(status_code=400, detail="Non puoi eliminare l'account admin")

        meta = (getattr(u_dict, "user_metadata", None) or getattr(u_dict, "raw_user_meta_data", None) or {}).copy()
        meta["eliminato"] = True
        meta["eliminato_il"] = datetime.now(timezone.utc).isoformat()
        meta["bloccato"] = True  # blocca anche l'accesso
        if req.motivo:
            meta["motivo_eliminazione"] = req.motivo

        await _aggiorna_user_meta(req.user_id, meta)
        logger.info(f"Utente {req.user_id} ({user_email}) soft-eliminato dall'admin {admin_email}")
        return {"success": True, "message": f"Utente {user_email} eliminato (soft delete)"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore eliminazione utente")
        raise HTTPException(status_code=500, detail=f"Errore eliminazione: {e}")
