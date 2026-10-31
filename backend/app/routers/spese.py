"""
Router Spese e Scadenze.
CRUD spese + generazione automatica scadenze ricorrenti.
"""
import logging
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/spese", tags=["spese"])

# ============================================================================
# SCHEMI
# ============================================================================

class SpesaBase(BaseModel):
    data: str  # YYYY-MM-DD
    descrizione: str
    importo: float
    importo_ivato: bool = True
    imponibile: Optional[float] = None
    iva: Optional[float] = None
    categoria: Optional[str] = None
    fornitore_id: Optional[int] = None
    tipo: str = "una_tantum"  # 'una_tantum' | 'ricorrente'
    ricorrenza: Optional[str] = None  # 'mensile' | 'trimestrale' | 'semestrale' | 'annuale'
    data_scadenza: Optional[str] = None
    pagata: bool = False
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    note: Optional[str] = None
    ricorrenza_attiva: bool = False
    giorno_scadenza: Optional[int] = None
    mesi_anticipo: Optional[int] = 12


class SpesaCreate(SpesaBase):
    user_id: str  # UUID utente Supabase


class SpesaUpdate(BaseModel):
    data: Optional[str] = None
    descrizione: Optional[str] = None
    importo: Optional[float] = None
    categoria: Optional[str] = None
    fornitore_id: Optional[int] = None
    tipo: Optional[str] = None
    ricorrenza: Optional[str] = None
    data_scadenza: Optional[str] = None
    pagata: Optional[bool] = None
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    note: Optional[str] = None
    ricorrenza_attiva: Optional[bool] = None
    giorno_scadenza: Optional[int] = None
    mesi_anticipo: Optional[int] = 12


# ============================================================================
# HELPER: calcola date future per ricorrenze
# ============================================================================

def _calcola_data_scadenza(data_base: date, giorno_scadenza: int | None, mesi_avanti: int) -> date:
    """Calcola la data di scadenza N mesi dopo data_base, al giorno specificato."""
    d = data_base + relativedelta(months=mesi_avanti)
    if giorno_scadenza:
        # Imposta il giorno (con clamp per mesi più corti, es. 31 → 28/29 feb)
        ultimo_giorno = (d.replace(day=1) + relativedelta(months=1, days=-1)).day
        giorno_effettivo = min(giorno_scadenza, ultimo_giorno)
        d = d.replace(day=giorno_effettivo)
    return d


def _calcola_step_giorni(ricorrenza: str) -> int:
    """Ritorna quanti giorni avanzare per ogni ricorrenza."""
    return {
        "settimanale": 7,
        "quindicinale": 15,
        "mensile": 30,  # approssimato, meglio usare mesi
        "bimestrale": 60,
        "trimestrale": 90,
        "semestrale": 180,
        "annuale": 365,
    }.get(ricorrenza, 30)


# ============================================================================
# ENDPOINT
# ============================================================================

@router.get("")
async def lista_spese(
    user_id: str = Query(..., description="UUID utente"),
    da: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    a: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    pagata: Optional[bool] = Query(None),
    categoria: Optional[str] = Query(None),
    solo_scadenze: bool = Query(False, description="Solo scadenze non pagate"),
):
    """Lista spese con filtri."""
    try:
        sb = get_supabase()
        q = sb.table("spese").select("*").eq("user_id", user_id)

        if da:
            q = q.gte("data", da)
        if a:
            q = q.lte("data", a)
        if pagata is not None:
            q = q.eq("pagata", pagata)
        if categoria:
            q = q.eq("categoria", categoria)
        if solo_scadenze:
            q = q.eq("pagata", False).not_.is_("data_scadenza", "null")

        q = q.order("data", desc=True).order("data_scadenza", desc=False)
        res = q.execute()
        return {"success": True, "spese": res.data or []}
    except Exception as e:
        logger.exception("Errore lista spese")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def crea_spesa(spesa: SpesaCreate):
    """Crea una nuova spesa. Se ricorrente, genera le scadenze future."""
    try:
        sb = get_supabase()

        # 1. Inserisci la spesa principale
        spesa_dict = spesa.model_dump(exclude_none=False)
        res = sb.table("spese").insert(spesa_dict).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Errore inserimento")

        spesa_creata = res.data[0]

        # 2. Se ricorrente e attiva, genera le scadenze future (12 mesi)
        scadenze_generate = 0
        if (
            spesa.tipo == "ricorrente"
            and spesa.ricorrenza_attiva
            and spesa.ricorrenza
            and spesa.data_scadenza
        ):
            step_mesi = _calcola_step_mesi(spesa.ricorrenza)
            data_base = datetime.strptime(spesa.data_scadenza, "%Y-%m-%d").date()
            mesi_totali = spesa.mesi_anticipo or 12
            n_mesi = mesi_totali // step_mesi

            for i in range(1, n_mesi + 1):
                data_futura = _calcola_data_scadenza(data_base, spesa.giorno_scadenza, i * step_mesi)
                scadenza_dict = {
                    "user_id": spesa.user_id,
                    "data": data_futura.isoformat(),
                    "descrizione": f"{spesa.descrizione} ({data_futura.strftime('%m/%Y')})",
                    "importo": spesa.importo,
                    "categoria": spesa.categoria,
                    "fornitore_id": spesa.fornitore_id,
                    "tipo": "ricorrente",
                    "ricorrenza": spesa.ricorrenza,
                    "data_scadenza": data_futura.isoformat(),
                    "pagata": False,
                    "note": f"Generata automaticamente da ricorrenza (spesa #{spesa_creata['id']})",
                    "ricorrenza_attiva": False,  # Le figlie non generano altre
                    "giorno_scadenza": spesa.giorno_scadenza,
                }
                sb.table("spese").insert(scadenza_dict).execute()
                scadenze_generate += 1

        return {
            "success": True,
            "spesa": spesa_creata,
            "scadenze_generate": scadenze_generate,
        }
    except Exception as e:
        logger.exception("Errore creazione spesa")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{spesa_id}")
async def aggiorna_spesa(spesa_id: int, spesa: SpesaUpdate):
    """Aggiorna una spesa esistente."""
    try:
        sb = get_supabase()
        update_dict = {k: v for k, v in spesa.model_dump().items() if v is not None}
        if not update_dict:
            raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

        res = sb.table("spese").update(update_dict).eq("id", spesa_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Spesa non trovata")
        return {"success": True, "spesa": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore aggiornamento spesa")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{spesa_id}")
async def elimina_spesa(spesa_id: int):
    """Elimina una spesa."""
    try:
        sb = get_supabase()
        res = sb.table("spese").delete().eq("id", spesa_id).execute()
        return {"success": True, "eliminata": bool(res.data)}
    except Exception as e:
        logger.exception("Errore eliminazione spesa")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi")
async def kpi_spese(
    user_id: str = Query(...),
    mese: Optional[str] = Query(None, description="YYYY-MM (default: mese corrente)"),
):
    """KPI spese: totale mese, scadenze prossime 30gg, pagate/non pagate."""
    try:
        sb = get_supabase()
        oggi = date.today()
        if mese:
            inizio_mese = datetime.strptime(f"{mese}-01", "%Y-%m-%d").date()
        else:
            inizio_mese = oggi.replace(day=1)
        fine_mese = inizio_mese + relativedelta(months=1, days=-1)

        # Totale spese mese
        res_mese = sb.table("spese").select("importo").eq("user_id", user_id).gte("data", inizio_mese.isoformat()).lte("data", fine_mese.isoformat()).execute()
        totale_mese = sum(float(s.get("importo") or 0) for s in (res_mese.data or []))

        # Scadenze prossimi 7 giorni (non pagate)
        tra_7 = oggi + timedelta(days=7)
        res_scadenze_7 = sb.table("spese").select("importo").eq("user_id", user_id).eq("pagata", False).not_.is_("data_scadenza", "null").gte("data_scadenza", oggi.isoformat()).lte("data_scadenza", tra_7.isoformat()).execute()
        totale_scadenze_7gg = sum(float(s.get("importo") or 0) for s in (res_scadenze_7.data or []))
        n_scadenze_7gg = len(res_scadenze_7.data or [])

        # Scadenze prossimi 30 giorni (non pagate)
        tra_30 = oggi + timedelta(days=30)
        res_scadenze = sb.table("spese").select("importo").eq("user_id", user_id).eq("pagata", False).not_.is_("data_scadenza", "null").gte("data_scadenza", oggi.isoformat()).lte("data_scadenza", tra_30.isoformat()).execute()
        totale_scadenze_30gg = sum(float(s.get("importo") or 0) for s in (res_scadenze.data or []))
        n_scadenze_30gg = len(res_scadenze.data or [])

        # Pagate/non pagate nel mese
        res_mese_full = sb.table("spese").select("pagata, importo").eq("user_id", user_id).gte("data", inizio_mese.isoformat()).lte("data", fine_mese.isoformat()).execute()
        pagate = [s for s in (res_mese_full.data or []) if s.get("pagata")]
        non_pagate = [s for s in (res_mese_full.data or []) if not s.get("pagata")]

        return {
            "success": True,
            "mese": inizio_mese.strftime("%Y-%m"),
            "totale_mese": round(totale_mese, 2),
            "scadenze_prossimi_7gg": {
                "totale": round(totale_scadenze_7gg, 2),
                "numero": n_scadenze_7gg,
            },
            "scadenze_prossimi_30gg": {
                "totale": round(totale_scadenze_30gg, 2),
                "numero": n_scadenze_30gg,
            },
            "pagate": {
                "numero": len(pagate),
                "totale": round(sum(float(s.get("importo") or 0) for s in pagate), 2),
            },
            "non_pagate": {
                "numero": len(non_pagate),
                "totale": round(sum(float(s.get("importo") or 0) for s in non_pagate), 2),
            },
        }
    except Exception as e:
        logger.exception("Errore KPI spese")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CATEGORIE
# ============================================================================

class CategoriaCreate(BaseModel):
    user_id: str
    nome: str

@router.get("/categorie")
async def lista_categorie(user_id: str = Query(...)):
    try:
        sb = get_supabase()
        res = sb.table("categorie_spese").select("id, nome").eq("user_id", user_id).order("nome").execute()
        return {"success": True, "categorie": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/categorie")
async def crea_categoria(cat: CategoriaCreate):
    try:
        sb = get_supabase()
        res = sb.table("categorie_spese").insert({"user_id": cat.user_id, "nome": cat.nome.strip()}).execute()
        return {"success": True, "categoria": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
