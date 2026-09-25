"""Router Licenze & Utenti DEMO (admin only)."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.services.supabase_client import get_supabase

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


@router.get("/utenti")
async def lista_utenti(admin_email: str = Query(..., description="Email admin")):
    """Elenca utenti registrati con stato licenza."""
    _verifica_admin(admin_email)
    try:
        supabase = get_supabase()
        res = supabase.auth.admin.list_users()
        utenti_raw = getattr(res, "users", res) if hasattr(res, "users") else res

        output = []
        now = datetime.now(timezone.utc)

        for u in utenti_raw:
            u_dict = u if isinstance(u, dict) else u.__dict__
            raw_meta = u_dict.get("user_metadata") or u_dict.get("raw_user_meta_data") or {}
            app_meta = u_dict.get("app_metadata") or u_dict.get("raw_app_meta_data") or {}

            email = u_dict.get("email") or ""
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

        supabase.auth.admin.update_user_by_id(req.user_id, {"user_metadata": meta})
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

        supabase.auth.admin.update_user_by_id(req.user_id, {"user_metadata": meta})

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

